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

const REGRAS = [
  { causa: 'SUJEIRA NO DRENO E BANDEJA',
    palavras: ['pingando','gotejando','agua caindo','dreno entupido','bandeja suja','sujeira no dreno','dreno sujo','bandeja cheia','dreno cheio','vazando agua'] },
  { causa: 'DRENO DESCONECTADO',
    palavras: ['dreno solto','dreno desconectado','dreno desprendido','dreno caiu','dreno fora'] },
  { causa: 'FILTRO SECADOR OBSTRUIDO',
    palavras: ['filtro secador','secador obstruido','secador entupido'] },
  { causa: 'NECESSIDADE DE MANUTENCAO PREVENTIVA TIPO 1 (NAO PROGRAMADA)',
    palavras: ['filtro sujo','filtro entupido','aleta suja','limpeza de filtro','filtro obstruido','lavagem de filtro','filtro cheio'] },

  { causa: 'TERMOSTATO DESREGULADO',
    palavras: ['condensando','condensacao','suando','ambiente condensando','equipamento suando','gotejando condensacao'] },
  { causa: 'EQUIPAMENTO COM SERPETINA CONGELADA',
    palavras: ['congelado','soltando gelo','gelo na serpentina','serpentina congelada','congelou','cheio de gelo'] },
  { causa: 'CONTROLE REMOTO DESCONFIGURADO',
    palavras: ['muito frio','frio demais','aumentar temperatura','controle desconfigurado','controle travado','controle nao obedece','configurar controle','temperatura desregulada','desconfigurado','configuracao do controle','configurar temperatura','reclamando de frio','ambiente frio','frio excessivo'] },
  { causa: 'CONTROLE REMOTO DEFEITUOSO OU EXTRAVIADO',
    palavras: ['controle quebrado','controle perdido','sem controle','controle extraviado','controle defeituoso','controle sumiu','sem controle remoto','perca do controle'] },
  { causa: 'DISJUNTOR DESLIGADO',
    palavras: ['disjuntor desarmado','disjuntor desligado','disjuntor aberto','disjuntor caiu','disjuntor'] },
  { causa: 'EQUIPAMENTO DESLIGADO DEVIDO A FALTA OU VARIACAO DE ENERGIA',
    palavras: ['queda de energia','falta de energia','variacao de energia','oscilacao de energia','sem energia','energia caiu','falta de luz'] },
  { causa: 'VAZAMENTO DE FLUIDO REFRIGERANTE',
    palavras: ['sem gas','gas baixo','recarga de gas','vazamento de gas','carga de gas','gas acabou','falta de fluido','fluido refrigerante','falta de gas','carregando gas'] },
  { causa: 'COMPRESSOR DEFEITUOSO',
    palavras: ['compressor travado','compressor queimado','compressor defeituoso','compressor parou','compressor com defeito'] },
  { causa: 'CAPACITOR DO COMPRESSOR DEFEITUOSO',
    palavras: ['capacitor do compressor','capacitor queimado','capacitor defeituoso','capacitor'] },
  { causa: 'MOTOR VENTILADOR DEFEITUOSO',
    palavras: ['motor ventilador','ventilador nao gira','motor queimado','ventilador defeituoso','ventilador parou','motor do ventilador'] },
  { causa: 'TURBINA MAL POSICIONADA',
    palavras: ['barulho','vibracao','ruido','fazendo barulho','muito barulho','barulho excessivo','vibrando'] },
  { causa: 'PLACA ELETRONICA DEFEITUOSA',
    palavras: ['placa eletronica','placa defeituosa','placa queimada','placa com defeito'] },
  { causa: 'SENSOR DE TEMPERATURA DEFEITUOSO',
    palavras: ['sensor de temperatura','sensor defeituoso','sensor queimado','termistor'] },
  { causa: 'BOMBA DE DRENAGEM DEFEITUOSA',
    palavras: ['bomba de drenagem','bomba drenagem defeituosa','bomba parou','bomba de dreno'] },
  { causa: 'BOTAO DE ACIONAMENTO DEFEITUOSO',
    palavras: ['botao defeituoso','botao de acionamento','botao nao funciona'] },
  { causa: 'ISOLAMENTO TERMICO DANIFICADO OU ENCHARCADO',
    palavras: ['isolamento danificado','isolamento encharcado','isolamento termico','isolamento molhado'] },
  { causa: 'GRELHA OU DIFUSOR DESAJUSTADO',
    palavras: ['grelha desajustada','difusor desajustado','grelha solta','difusor solto','grelha caindo'] },
  { causa: 'VELOCIDADE DO MOTOR VENTILADOR DESAJUSTADA',
    palavras: ['velocidade do motor','velocidade desajustada','rotacao desajustada','rpm desajustado'] },
  { causa: 'DEFLETOR DE AR DESAJUSTADO',
    palavras: ['defletor desajustado','defletor solto','defletor de ar','deflator'] },
  { causa: 'REDE ELETRICA DO COMPRESSOR DANIFICADA',
    palavras: ['rede eletrica do compressor','fiacao do compressor','cabo do compressor'] },
  { causa: 'REDE ELETRICA DE INTERLIGACAO NECESSITANDO DE REPARO OU SUBSTITUICAO',
    palavras: ['rede de interligacao','interligacao danificada','fiacao de interligacao'] },
  { causa: 'REDE ELETRICA NECESSITADO DE REPARO OU SUBSTITUICAO (PONTO DE FORCA)',
    palavras: ['ponto de forca','rede eletrica danificada','fiacao danificada','cabo danificado'] },
  { causa: 'REGISTRO DE AGUA FECHADO',
    palavras: ['registro fechado','registro de agua fechado','registro de agua'] },
  { causa: 'PROBLEMA NO ATUADOR DE VALVULA DE CONTROLE DE AGUA GELADA',
    palavras: ['atuador','valvula de controle','agua gelada'] },
  { causa: 'PORTAS OU JANELAS DO AMBIENTE ABERTAS',
    palavras: ['porta aberta','janela aberta','portas abertas','janelas abertas','porta do ambiente'] },
  { causa: 'NECESSIDADE DE REPOSICIONAMENTO DE EQUIPAMENTO',
    palavras: ['reposicionamento','reposicionar equipamento','mudar equipamento','mover equipamento'] },
  { causa: 'NECESSIDADE DE SUBSTITUICAO DO EQUIPAMENTO COMPLETO',
    palavras: ['substituicao do equipamento','trocar equipamento','equipamento obsoleto','fim de vida util'] },
  { causa: 'O.S. AGUARDANDO PROGRAMACAO DE PREVENTIVA',
    palavras: ['aguardando preventiva','programacao de preventiva','preventiva pendente'] },
  { causa: 'NENHUMA CAUSA RELACIONADA AOS SERVICOS DA UNIAR',
    palavras: ['fora do escopo','responsabilidade de terceiros','empresa externa','terceiros'] },
  { causa: 'CORREIA QUEBRADA',
    palavras: ['correia quebrada','correia partida','correia solta'] },
  { causa: 'NECESSIDADE DE RESET',
    palavras: ['reset','reiniciar','reinicializar','nao liga','nao gela','parou de funcionar','so ventilando','muito quente','desligar e ligar','nao esta gelando','nao resfria'] },
];

// Normaliza texto removendo acentos e colocando em minúsculo
function norm(txt) {
  return String(txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function tentarClassificar(texto) {
  if (!texto || !texto.trim()) return null;
  const t = norm(texto);
  for (const regra of REGRAS) {
    for (const palavra of regra.palavras) {
      if (t.includes(palavra)) return regra.causa;
    }
  }
  return null;
}

// Classifica com prioridade: maoObra > observacao > rawText
function classificar(maoObra, observacao, rawText) {
  return (
    tentarClassificar(maoObra) ||
    tentarClassificar(observacao) ||
    tentarClassificar(rawText) ||
    PADRAO
  );
}

// Aceita tanto { itens: [{maoObra, observacao, rawText}] }
// quanto o formato antigo { textos: ["..."] }
app.post('/classificar', (req, res) => {
  const { itens, textos } = req.body;

  // Formato novo: campos separados
  if (Array.isArray(itens) && itens.length > 0) {
    const causas = itens.map(item =>
      classificar(item.maoObra, item.observacao, item.rawText)
    );
    return res.json({ causas });
  }

  // Formato antigo: texto único (retrocompatível)
  if (Array.isArray(textos) && textos.length > 0) {
    const causas = textos.map(t => tentarClassificar(t) || PADRAO);
    return res.json({ causas });
  }

  res.status(400).json({ erro: 'Envie "itens" ou "textos" no body.' });
});

app.listen(PORT, () => {
  console.log(`Neovero Classificador rodando na porta ${PORT}`);
});
