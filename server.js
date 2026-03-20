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

// ✅ NOVO: Endpoint de diagnóstico para testar a chave Gemini
app.get('/diagnostico', async (req, res) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      erro: 'GEMINI_API_KEY não está configurada nas variáveis de ambiente do Railway.'
    });
  }

  try {
    const testResp = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responda apenas: ok' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 10 },
        }),
      }
    );

    const data = await testResp.json();

    if (!testResp.ok) {
      return res.status(502).json({
        erro: 'Chave inválida ou sem permissão.',
        detalhe: data
      });
    }

    res.json({ status: 'Gemini OK', resposta: data.candidates?.[0]?.content?.parts?.[0]?.text });
  } catch (err) {
    res.status(500).json({ erro: 'Falha na conexão com Gemini: ' + err.message });
  }
});

const CAUSAS_OFICIAIS = [
  'BOMBA DE DRENAGEM DEFEITUOSA',
  'BOTÃO DE ACIONAMENTO DEFEITUOSO',
  'DRENO DESCONECTADO',
  'FILTRO SECADOR OBSTRUÍDO',
  'FILTRO SUJO',
  'PORTAS OU JANELAS DO AMBIENTE ABERTAS',
  'REDE ELÉTRICA DO COMPRESSOR DANIFICADA',
  'REGISTRO DE ÁGUA FECHADO',
  'NECESSIDADE DE SUBSTITUIÇÃO DO EQUIPAMENTO COMPLETO',
  'COMPRESSOR DEFEITUOSO',
  'CONTROLE REMOTO DEFEITUOSO OU EXTRAVIADO',
  'NECESSIDADE DE REPOSICIONAMENTO DE EQUIPAMENTO',
  'SENSOR DE TEMPERATURA DEFEITUOSO',
  'CORREIA QUEBRADA',
  'DISJUNTOR DESLIGADO',
  'GRELHA OU DIFUSOR DESAJUSTADO',
  'TURBINA MAL POSICIONADA',
  'PROBLEMA NO ATUADOR DE VÁLVULA DE CONTROLE DE ÁGUA GELADA',
  'REDE ELÉTRICA DE INTERLIGAÇÃO NECESSITANDO DE REPARO OU SUBSTITUIÇÃO',
  'EQUIPAMENTO DESLIGADO DEVIDO A FALTA OU VARIAÇÃO DE ENERGIA',
  'CAPACITOR DO COMPRESSOR DEFEITUOSO',
  'REDE ELÉTRICA NECESSITADO DE REPARO OU SUBSTITUIÇÃO (PONTO DE FORÇA)',
  'MOTOR VENTILADOR DEFEITUOSO',
  'ISOLAMENTO TÉRMICO DANIFICADO OU ENCHARCADO',
  'O.S. IMPOSSIBILITADA DE CONCLUSÃO',
  'VAZAMENTO DE FLUIDO REFRIGERANTE',
  'VELOCIDADE DO MOTOR VENTILADOR DESAJUSTADA',
  'DEFLETOR DE AR DESAJUSTADO',
  'EQUIPAMENTO COM SERPETINA CONGELADA',
  'PLACA ELETRÔNICA DEFEITUOSA',
  'O.S. AGUARDANDO PROGRAMAÇÃO DE PREVENTIVA',
  'NECESSIDADE DE RESET',
  'NENHUMA CAUSA RELACIONADA AOS SERVIÇOS DA UNIAR',
  'SUJEIRA NO DRENO E BANDEJA',
  'CONTROLE REMOTO DESCONFIGURADO',
  'TERMOSTATO DESREGULADO',
];

app.post('/classificar', async (req, res) => {
  const { textos } = req.body;

  if (!Array.isArray(textos) || textos.length === 0)
    return res.status(400).json({ erro: 'Envie um array "textos" não vazio.' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY)
    return res.status(500).json({ erro: 'GEMINI_API_KEY não configurada no servidor.' });

  const prompt = `Você é um técnico especialista em manutenção de ar-condicionado hospitalar. Classifique cada O.S. com exatamente uma das causas abaixo.

CAUSAS PERMITIDAS (retorne EXATAMENTE como escrito):
${CAUSAS_OFICIAIS.join('\n')}

PRIORIDADE:
1. Se houver observação do TÉCNICO (mão de obra) → use ela como base principal
2. Se não houver → use a reclamação do paciente/funcionário

REGRAS:
- Pingando, gotejando, água caindo, dreno entupido, bandeja suja → SUJEIRA NO DRENO E BANDEJA
- Dreno solto, desconectado → DRENO DESCONECTADO
- Filtro sujo, aleta suja, equipamento sujo, limpeza de filtro → FILTRO SUJO
- Condensando, ambiente condensando, equipamento suando → TERMOSTATO DESREGULADO
- Congelado, soltando gelo, gelo na serpentina → EQUIPAMENTO COM SERPETINA CONGELADA
- Muito frio, frio demais, solicitam aumentar temperatura → CONTROLE REMOTO DESCONFIGURADO
- Controle não obedece, controle travado, configurar controle → CONTROLE REMOTO DESCONFIGURADO
- Controle quebrado, controle perdido, sem controle → CONTROLE REMOTO DEFEITUOSO OU EXTRAVIADO
- Disjuntor desarmado → DISJUNTOR DESLIGADO
- Queda de energia, falta de energia → EQUIPAMENTO DESLIGADO DEVIDO A FALTA OU VARIAÇÃO DE ENERGIA
- Sem gás, gás baixo, recarga de gás → VAZAMENTO DE FLUIDO REFRIGERANTE
- Compressor travado, compressor queimado → COMPRESSOR DEFEITUOSO
- Motor ventilador com defeito, ventilador não gira → MOTOR VENTILADOR DEFEITUOSO
- Barulho, vibração, ruído → TURBINA MAL POSICIONADA
- Não gela, muito quente, só ventilando (sem observação técnica) → NECESSIDADE DE RESET
- Não liga, parou de funcionar → NECESSIDADE DE RESET
- Porta aberta, janela aberta → PORTAS OU JANELAS DO AMBIENTE ABERTAS
- Fora do escopo, responsabilidade de terceiros → NENHUMA CAUSA RELACIONADA AOS SERVIÇOS DA UNIAR

ATENÇÃO:
- "Condensando" é TERMOSTATO DESREGULADO, não SUJEIRA NO DRENO
- "Muito frio" é CONTROLE REMOTO DESCONFIGURADO
- "Quente/não gela" sem detalhe técnico é NECESSIDADE DE RESET, não DISJUNTOR
- "Sujo/filtro sujo" é FILTRO SUJO

FORMATO: responda SOMENTE com as causas, uma por linha, na mesma ordem das O.S. Nenhuma explicação.

${textos.map((t, i) => `OS${i + 1}: ${t}`).join('\n')}`;

  try {
    // ✅ CORRIGIDO: modelo atualizado para gemini-1.5-flash
    const apiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
        }),
      }
    );

    if (!apiResp.ok) {
      const errData = await apiResp.json().catch(() => ({}));
      console.error('Erro Gemini:', JSON.stringify(errData));
      return res.status(502).json({
        erro: 'Erro na API Gemini',
        status: apiResp.status,
        detalhe: errData?.error?.message || 'Sem detalhes'
      });
    }

    const apiData = await apiResp.json();
    const texto = apiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);

    const resultado = textos.map((_, i) => {
      const candidata = (linhas[i] || '').toUpperCase().trim();
      const match = CAUSAS_OFICIAIS.find(c => c.toUpperCase() === candidata);
      return match || 'NECESSIDADE DE RESET';
    });

    res.json({ causas: resultado });

  } catch (err) {
    console.error('Erro interno:', err.message);
    res.status(500).json({ erro: 'Erro interno: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Neovero Classificador IA rodando na porta ${PORT}`);
});
