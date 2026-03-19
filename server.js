const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS: permite qualquer origem (GitHub Pages, Netlify, etc.)
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Neovero Classificador IA' });
});

// ── Endpoint principal: recebe lote de textos, devolve causas classificadas
app.post('/classificar', async (req, res) => {
  const { textos, causas } = req.body;

  if (!Array.isArray(textos) || textos.length === 0) {
    return res.status(400).json({ erro: 'Envie um array "textos" não vazio.' });
  }
  if (!Array.isArray(causas) || causas.length === 0) {
    return res.status(400).json({ erro: 'Envie um array "causas" com a lista oficial.' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ erro: 'ANTHROPIC_API_KEY não configurada no servidor.' });
  }

  const systemPrompt = `Você é um classificador de causas de ordens de serviço de ar-condicionado hospitalar.
Dado o texto de uma O.S. (reclamação, ocorrência, observações do técnico e causa registrada no sistema), você deve retornar EXCLUSIVAMENTE uma das causas da lista abaixo — sem explicação, sem pontuação extra, apenas o texto exato da causa.

CAUSAS PERMITIDAS (retorne EXATAMENTE como está escrito abaixo):
${causas.join('\n')}

REGRAS:
- Responda APENAS com as causas, uma por linha, na mesma ordem das O.S. recebidas.
- Não invente causas fora da lista.
- Se não conseguir classificar, retorne: SUJEIRA`;

  const userMsg = textos.map((t, i) => `OS${i + 1}: ${t}`).join('\n');

  try {
    const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Classifique cada O.S. abaixo. Responda APENAS com as causas, uma por linha, na mesma ordem:\n\n${userMsg}` }],
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      return res.status(502).json({ erro: 'Erro na API Anthropic: ' + errText });
    }

    const apiData = await apiResp.json();
    const texto   = (apiData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const linhas  = texto.split('\n').map(l => l.trim()).filter(Boolean);

    // Valida e mapeia cada resposta para a lista oficial
    const resultado = textos.map((_, i) => {
      const candidata = (linhas[i] || '').toUpperCase().trim();
      const match = causas.find(c => c.toUpperCase() === candidata);
      return match || causas[0]; // fallback para primeira causa se não bater
    });

    res.json({ causas: resultado });

  } catch (err) {
    res.status(500).json({ erro: 'Erro interno: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Neovero Classificador IA rodando na porta ${PORT}`);
});
