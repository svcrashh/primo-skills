// Configuração do vídeo, tirada dos parâmetros (params.js, escrito pelo render.mjs a partir do JSON).
const PLANO = planejarFluxo(PARAMS)
const VIDEO = {
  titulo: PARAMS.titulo || `${PARAMS.marca.nome || ''} · drawn flow`,
  duracao: PLANO.dur,
  bpm: 120,
  formatos: PARAMS.formatos || ['16x9'],
  plataforma: PARAMS.plataforma ?? null,
  fontes: [PARAMS.marca.fonte],
  fundo: PARAMS.marca.cores.fundo,
  grao: 0,
  impactos: [],
  selo: null,
  // o rótulo nunca cruza o ladrilho do nó (o ícone): a checagem de quadros reprova
  texto: 'fora-da-imagem',
  audio: 'audio/soundtrack.wav',
}
