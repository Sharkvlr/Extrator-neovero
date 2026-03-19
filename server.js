const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Neovero Classificador IA' });
});

app.post('/classificar', async (req, res) => {
  const { textos, causas } = req.body;

  if (!Array.isArray(textos) || textos.length === 0)
    return res.status(400).json({ erro: 'Envie um array "textos" não vazio.' });
  if (!Array.isArray(causas) || causas.length === 0)
    return res.status(400).json({ erro: 'Envie um array "causas" com a lista oficial.' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY)
    return res.status(500).json({ erro: 'ANTHROPIC_API_KEY não configurada no servidor.' });

  const systemPrompt = `Você é um técnico especialista em manutenção de ar-condicionado hospitalar. Classifique cada O.S. com exatamente uma das causas abaixo.

CAUSAS PERMITIDAS (retorne EXATAMENTE como escrito):
BOMBA DE DRENAGEM DEFEITUOSA
BOTÃO DE ACIONAMENTO DEFEITUOSO
DRENO DESCONECTADO
FILTRO SECADOR OBSTRUÍDO
PORTAS OU JANELAS DO AMBIENTE ABERTAS
REDE ELÉTRICA DO COMPRESSOR DANIFICADA
REGISTRO DE ÁGUA FECHADO
NECESSIDADE DE SUBSTITUIÇÃO DO EQUIPAMENTO COMPLETO
COMPRESSOR DEFEITUOSO
CONTROLE REMOTO DEFEITUOSO OU EXTRAVIADO
NECESSIDADE DE REPOSICIONAMENTO DE EQUIPAMENTO
SENSOR DE TEMPERATURA DEFEITUOSO
CORREIA QUEBRADA
DISJUNTOR DESLIGADO
GRELHA OU DIFUSOR DESAJUSTADO
TURBINA MAL POSICIONADA
PROBLEMA NO ATUADOR DE VÁLVULA DE CONTROLE DE ÁGUA GELADA
REDE ELÉTRICA DE INTERLIGAÇÃO NECESSITANDO DE REPARO OU SUBSTITUIÇÃO
EQUIPAMENTO DESLIGADO DEVIDO A FALTA OU VARIAÇÃO DE ENERGIA
CAPACITOR DO COMPRESSOR DEFEITUOSO
REDE ELÉTRICA NECESSITADO DE REPARO OU SUBSTITUIÇÃO (PONTO DE FORÇA)
MOTOR VENTILADOR DEFEITUOSO
ISOLAMENTO TÉRMICO DANIFICADO OU ENCHARCADO
O.S. IMPOSSIBILITADA DE CONCLUSÃO
VAZAMENTO DE FLUIDO REFRIGERANTE
VELOCIDADE DO MOTOR VENTILADOR DESAJUSTADA
DEFLETOR DE AR DESAJUSTADO
EQUIPAMENTO COM SERPETINA CONGELADA
PLACA ELETRÔNICA DEFEITUOSA
O.S. AGUARDANDO PROGRAMAÇÃO DE PREVENTIVA
NECESSIDADE DE RESET
NENHUMA CAUSA RELACIONADA AOS SERVIÇOS DA UNIAR
SUJEIRA NO DRENO E BANDEJA
FILTRO SUJO
CONTROLE REMOTO DESCONFIGURADO
TERMOSTATO DESREGULADO

PRIORIDADE:
1. Se houver observação do TÉCNICO (mão de obra) → use ela como base principal
2. Se não houver → use a reclamação do paciente/funcionário

REGRAS:
- Pingando, gotejando, água caindo, dreno entupido, bandeja suja → SUJEIRA NO DRENO E BANDEJA
- Dreno solto, desconectado, mangueira caída → DRENO DESCONECTADO
- Filtro sujo, aleta suja, equipamento sujo, limpeza de filtro, filtro obstruído → FILTRO SUJO
- Condensando, ambiente condensando, equipamento suando → TERMOSTATO DESREGULADO
- Congelado, soltando gelo, gelo na serpentina → EQUIPAMENTO COM SERPETINA CONGELADA
- Muito frio, frio demais, solicitam aumentar temperatura → CONTROLE REMOTO DESCONFIGURADO
- Controle não obedece, controle travado, configurar controle → CONTROLE REMOTO DESCONFIGURADO
- Controle quebrado, controle perdido, sem controle → CONTROLE REMOTO DEFEITUOSO OU EXTRAVIADO
- Disjuntor desarmado, disjuntor caiu → DISJUNTOR DESLIGADO
- Queda de energia, falta de energia, oscilação de tensão → EQUIPAMENTO DESLIGADO DEVIDO A FALTA OU VARIAÇÃO DE ENERGIA
- Sem gás, gás baixo, recarga de gás, vazamento de gás → VAZAMENTO DE FLUIDO REFRIGERANTE
- Compressor travado, compressor queimado → COMPRESSOR DEFEITUOSO
- Motor ventilador com defeito, ventilador não gira → MOTOR VENTILADOR DEFEITUOSO
- Barulho, vibração, ruído → TURBINA MAL POSICIONADA
- Não gela, muito quente, só ventilando, sem refrigeração (sem observação técnica) → NECESSIDADE DE RESET
- Não liga, parou de funcionar, sem resposta → NECESSIDADE DE RESET
- Porta aberta, janela aberta → PORTAS OU JANELAS DO AMBIENTE ABERTAS
- Fora do escopo, responsabilidade de terceiros → NENHUMA CAUSA RELACIONADA AOS SERVIÇOS DA UNIAR

ATENÇÃO:
- "Condensando" é TERMOSTATO DESREGULADO, não SUJEIRA NO DRENO
- "Muito frio" é CONTROLE REMOTO DESCONFIGURADO, não TERMOSTATO
- "Quente/não gela" sem detalhe técnico é NECESSIDADE DE RESET, não DISJUNTOR
- Se o técnico anotou na mão de obra, isso vale mais que a reclamação

FORMATO: responda SOMENTE com as causas, uma por linha, na mesma ordem das O.S. Nenhuma explicação.`;

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
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Classifique cada O.S. Responda APENAS com as causas, uma por linha, na mesma ordem:\n\n${userMsg}` }],
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      return res.status(502).json({ erro: 'Erro na API Anthropic: ' + errText });
    }

    const apiData = await apiResp.json();
    const texto   = (apiData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const linhas  = texto.split('\n').map(l => l.trim()).filter(Boolean);

    const resultado = textos.map((_, i) => {
      const candidata = (linhas[i] || '').toUpperCase().trim();
      const match = causas.find(c => c.toUpperCase() === candidata);
      return match || 'NECESSIDADE DE RESET';
    });

    res.json({ causas: resultado });

  } catch (err) {
    res.status(500).json({ erro: 'Erro interno: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Neovero Classificador IA rodando na porta ${PORT}`);
});
