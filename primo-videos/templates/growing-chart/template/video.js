// Configuração do vídeo, tirada dos parâmetros (params.js, escrito pelo render.mjs a partir do JSON).
const PLANO = GRAFICO.planejar(PARAMS)
const VIDEO = {
  titulo: `${PARAMS.marca.nome} · growing chart`,
  duracao: PLANO.dur,
  formatos: ['16x9', '19x9', '21x9', '9x16', '1x1', '4x5'],
  plataforma: null,
  fontes: [...new Set(Object.values(PARAMS.marca.fontes))],
  fundo: PARAMS.marca.cores.fundo,
  grao: PARAMS.marca.grao != null ? PARAMS.marca.grao : 0,
  impactos: [],
  selo: null,
  texto: 'fora-da-imagem',
  audio: 'audio/soundtrack.wav',
}
