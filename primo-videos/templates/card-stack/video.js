// Configuração do vídeo, tirada dos parâmetros (params.js, escrito pelo render.mjs a partir do JSON).
const PLANO = PILHA.planejar(PARAMS)
const VIDEO = {
  titulo: `${PARAMS.marca.nome || ''} · card stack`,
  duracao: PLANO.dur,
  formatos: ['16x9', '19x9', '21x9', '9x16', '1x1', '4x5'],
  plataforma: null,
  fontes: [...new Set([PARAMS.marca.fontes.titulo.familia, (PARAMS.marca.fontes.texto || PARAMS.marca.fontes.titulo).familia])],
  fundo: PARAMS.marca.cores.fundo,
  grao: PARAMS.marca.grao || 0,
  impactos: [],
  selo: null,
  // a checagem de quadros reprova texto que cruza imagem marcada (o ícone do cartão)
  texto: 'fora-da-imagem',
  audio: 'audio/soundtrack.wav',
}
