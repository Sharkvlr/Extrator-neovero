const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Neovero Classificador' });
});

const PADRAO = 'O.S. IMPOSSIBILITADA DE CONCLUSÃO';

// Normaliza: minúsculo + sem acento
function norm(txt) {
  return String(txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Regras em ordem de prioridade
// causa: o que vai na coluna CAUSA
// servico: se preenchido, vai também na coluna SERVIÇO
const REGRAS = [
  // ── FILTRO SUJO → causa=FILTRO SUJO, servico=NECESSIDADE DE MANUTENÇÃO PREVENTIVA TIPO 1 (NÃO PROGRAMADA)
  { causa: 'FILTRO SUJO',
    servico: 'NECESSIDADE DE MANUTENÇÃO PREVENTIVA TIPO 1 (NÃO PROGRAMADA)',
    palavras: [
      'filtro sujo','filtro esta sujo','filtro do ar esta sujo','filtro do apartamento esta sujo',
      'filtro entupido','filtro obstruido','filtro cheio','filtro do ar sujo',
      'aleta suja','aletas sujas',
      'limpeza de filtro','limpeza do filtro','limpeza no filtro','solicito limpeza do filtro',
      'solicito limpeza no filtro','solicito limpeza para ar condicionado','limpeza do ar',
      'limpeza do exaustor','lavagem de filtro','lavagem do filtro',
      'limpeza de equipamento','limpeza no equipamento',
    ]
  },

  // ── FILTRO SECADOR — causa própria, sem servico
  { causa: 'FILTRO SECADOR OBSTRUÍDO',
    palavras: ['filtro secador','secador obstruido','secador entupido'] },

  { causa: 'SUJEIRA NO DRENO E BANDEJA',
    palavras: ['pingando','gotejando','agua caindo','dreno entupido','bandeja suja',
      'sujeira no dreno','dreno sujo','bandeja cheia','dreno cheio','vazando agua'] },

  { causa: 'DRENO DESCONECTADO',
    palavras: ['dreno solto','dreno desconectado','dreno desprendido','dreno caiu','dreno fora'] },

  { causa: 'TERMOSTATO DESREGULADO',
    palavras: ['condensando','condensacao','suando','ambiente condensando','equipamento suando'] },

  { causa: 'EQUIPAMENTO COM SERPETINA CONGELADA',
    palavras: ['congelado','soltando gelo','gelo na serpentina','serpentina congelada','congelou','cheio de gelo'] },

  { causa: 'CONTROLE REMOTO DESCONFIGURADO',
    palavras: ['muito frio','frio demais','aumentar temperatura','controle desconfigurado',
      'controle travado','controle nao obedece','configurar controle','temperatura desregulada',
      'desconfigurado','configuracao do controle','configurar temperatura',
      'reclamando de frio','ambiente frio','frio excessivo'] },

  { causa: 'CONTROLE REMOTO DEFEITUOSO OU EXTRAVIADO',
    palavras: ['controle quebrado','controle perdido','sem controle','controle extraviado',
      'controle defeituoso','controle sumiu','sem controle remoto','perca do controle'] },

  { causa: 'DISJUNTOR DESLIGADO',
    palavras: ['disjuntor desarmado','disjuntor desligado','disjuntor aberto','disjuntor caiu','disjuntor'] },

  { causa: 'EQUIPAMENTO DESLIGADO DEVIDO A FALTA OU VARIAÇÃO DE ENERGIA',
    palavras: ['queda de energia','falta de energia','variacao de energia','oscilacao de energia','sem energia','energia caiu'] },

  { causa: 'VAZAMENTO DE FLUIDO REFRIGERANTE',
    palavras: ['sem gas','gas baixo','recarga de gas','vazamento de gas','carga de gas','gas acabou',
      'falta de fluido','fluido refrigerante','falta de gas','carregando gas'] },

  { causa: 'COMPRESSOR DEFEITUOSO',
    palavras: ['compressor travado','compressor queimado','compressor defeituoso','compressor parou'] },

  { causa: 'CAPACITOR DO COMPRESSOR DEFEITUOSO',
    palavras: ['capacitor do compressor','capacitor queimado','capacitor defeituoso','capacitor'] },

  { causa: 'MOTOR VENTILADOR DEFEITUOSO',
    palavras: ['motor ventilador','ventilador nao gira','motor queimado','ventilador defeituoso','ventilador parou'] },

  { causa: 'TURBINA MAL POSICIONADA',
    palavras: ['barulho','vibracao','ruido','fazendo barulho','muito barulho','barulho excessivo','vibrando'] },

  { causa: 'PLACA ELETRÔNICA DEFEITUOSA',
    palavras: ['placa eletronica','placa defeituosa','placa queimada','placa com defeito'] },

  { causa: 'SENSOR DE TEMPERATURA DEFEITUOSO',
    palavras: ['sensor de temperatura','sensor defeituoso','sensor queimado','termistor'] },

  { causa: 'BOMBA DE DRENAGEM DEFEITUOSA',
    palavras: ['bomba de drenagem','bomba drenagem defeituosa','bomba parou','bomba de dreno'] },

  { causa: 'BOTÃO DE ACIONAMENTO DEFEITUOSO',
    palavras: ['botao defeituoso','botao de acionamento','botao nao funciona'] },

  { causa: 'ISOLAMENTO TÉRMICO DANIFICADO OU ENCHARCADO',
    palavras: ['isolamento danificado','isolamento encharcado','isolamento termico','isolamento molhado'] },

  { causa: 'GRELHA OU DIFUSOR DESAJUSTADO',
    palavras: ['grelha desajustada','difusor desajustado','grelha solta','difusor solto','grelha caindo'] },

  { causa: 'VELOCIDADE DO MOTOR VENTILADOR DESAJUSTADA',
    palavras: ['velocidade do motor','velocidade desajustada','rotacao desajustada'] },

  { causa: 'DEFLETOR DE AR DESAJUSTADO',
    palavras: ['defletor desajustado','defletor solto','defletor de ar'] },

  { causa: 'REDE ELÉTRICA DO COMPRESSOR DANIFICADA',
    palavras: ['rede eletrica do compressor','fiacao do compressor','cabo do compressor'] },

  { causa: 'REDE ELÉTRICA DE INTERLIGAÇÃO NECESSITANDO DE REPARO OU SUBSTITUIÇÃO',
    palavras: ['rede de interligacao','interligacao danificada','fiacao de interligacao'] },

  { causa: 'REDE ELÉTRICA NECESSITANDO DE REPARO OU SUBSTITUIÇÃO (PONTO DE FORÇA)',
    palavras: ['ponto de forca','rede eletrica danificada','fiacao danificada','cabo danificado'] },

  { causa: 'REGISTRO DE ÁGUA FECHADO',
    palavras: ['registro fechado','registro de agua fechado','registro de agua'] },

  { causa: 'PROBLEMA NO ATUADOR DE VÁLVULA DE CONTROLE DE ÁGUA GELADA',
    palavras: ['atuador','valvula de controle','agua gelada'] },

  { causa: 'PORTAS OU JANELAS DO AMBIENTE ABERTAS',
    palavras: ['porta aberta','janela aberta','portas abertas','janelas abertas','porta do ambiente'] },

  { causa: 'NECESSIDADE DE REPOSICIONAMENTO DE EQUIPAMENTO',
    palavras: ['reposicionamento','reposicionar equipamento','mudar equipamento','mover equipamento'] },

  { causa: 'NECESSIDADE DE SUBSTITUIÇÃO DO EQUIPAMENTO COMPLETO',
    palavras: ['substituicao do equipamento','trocar equipamento','equipamento obsoleto','fim de vida util'] },

  { causa: 'O.S. AGUARDANDO PROGRAMAÇÃO DE PREVENTIVA',
    palavras: ['aguardando preventiva','programacao de preventiva','preventiva pendente'] },

  { causa: 'NENHUMA CAUSA RELACIONADA AOS SERVIÇOS DA UNIAR',
    palavras: ['fora do escopo','responsabilidade de terceiros','empresa externa','terceiros'] },

  { causa: 'CORREIA QUEBRADA',
    palavras: ['correia quebrada','correia partida','correia solta'] },

  { causa: 'NECESSIDADE DE RESET',
    palavras: ['reset','reiniciar','reinicializar','nao liga','nao gela','parou de funcionar',
      'so ventilando','muito quente','desligar e ligar','nao esta gelando','nao resfria'] },
];

function tentarClassificar(texto) {
  if (!texto || !texto.trim()) return null;
  const t = norm(texto);
  for (const regra of REGRAS) {
    for (const palavra of regra.palavras) {
      if (t.includes(norm(palavra))) {
        return { causa: regra.causa, servico: regra.servico || '' };
      }
    }
  }
  return null;
}

// Prioridade: maoObra → observacao → rawText
function classificar(maoObra, observacao, rawText) {
  return (
    tentarClassificar(maoObra) ||
    tentarClassificar(observacao) ||
    tentarClassificar(rawText) ||
    { causa: PADRAO, servico: '' }
  );
}

app.post('/classificar', (req, res) => {
  const { itens, textos } = req.body;

  if (Array.isArray(itens) && itens.length > 0) {
    const resultados = itens.map(item =>
      classificar(item.maoObra, item.observacao, item.rawText)
    );
    // Retorna causas e servicos separados
    return res.json({
      causas:   resultados.map(r => r.causa),
      servicos: resultados.map(r => r.servico),
    });
  }

  if (Array.isArray(textos) && textos.length > 0) {
    const resultados = textos.map(t => tentarClassificar(t) || { causa: PADRAO, servico: '' });
    return res.json({
      causas:   resultados.map(r => r.causa),
      servicos: resultados.map(r => r.servico),
    });
  }

  res.status(400).json({ erro: 'Envie "itens" ou "textos" no body.' });
});

app.listen(PORT, () => {
  console.log(`Neovero Classificador rodando na porta ${PORT}`);
});
