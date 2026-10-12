// Configuração do vídeo, tirada dos parâmetros (params.js, escrito pelo render.mjs a partir do JSON).
const PLANO = planejarIso(PARAMS)
const VIDEO = {
  titulo: PARAMS.titulo || `${PARAMS.marca.nome || ''} · isometric`,
  duracao: PLANO.dur,
  bpm: 120,
  formatos: PARAMS.formatos || ['16x9'],
  plataforma: PARAMS.plataforma ?? null,
  fontes: [PARAMS.marca.fonte],
  fundo: PARAMS.marca.cores.fundo,
  grao: 0,
  impactos: [],
  selo: null,
  // o rótulo fica fora dos blocos: a checagem de quadros reprova texto que cruza uma face
  texto: 'fora-da-imagem',
  audio: 'audio/soundtrack.wav',
}
