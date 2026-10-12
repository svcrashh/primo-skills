// Configuração do vídeo, tirada dos parâmetros (params.js, escrito pelo render.mjs a partir do JSON).
// Parâmetro errado: o erro sai no console com o que fazer (o renderizar para com ele antes do render).
let PLANO
try { PLANO = planejarChecklist(PARAMS) } catch (e) { console.error(e.message); throw e }
const VIDEO = {
  titulo: `${PARAMS.marca.nome} · ticking checklist`,
  duracao: PLANO.dur,
  formatos: ['16x9', '9x16', '1x1', '4x5', '19x9', '21x9'],
  plataforma: { '16x9': 'youtube', '9x16': 'reels', '1x1': 'feed', '4x5': 'feed' },
  // texto nunca sobre a imagem: vale para qualquer imagem marcada que entrar na cena (hoje, só o logo do fecho)
  texto: 'fora-da-imagem',
  fontes: [...new Set([PARAMS.marca.fontes.texto, PARAMS.marca.fontes.titulo].filter(Boolean))],
  fundo: PARAMS.marca.cores.fundo,
  grao: PARAMS.marca.grao ?? 0,
  impactos: [],
  selo: null,
  audio: 'audio/soundtrack.wav',
}
