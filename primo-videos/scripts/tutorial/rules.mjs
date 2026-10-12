// As regras do modo tutorial que o gravador e o compor dividem: o que o compor recusa e já dá para saber antes de
// gravar (o --check do gravador confere tudo isto, sem gastar uma gravação nem uma composição).

/** Quanto o placar leva para ficar inteiro na tela, do g.placar ao último número assentado (o drawing.js usa os mesmos tempos). */
export const TEMPO_PLACAR = (e) => 0.2 + (e.itens.length - 1) * 0.5 + 0.45
/** O mínimo que o placar fica legível: 2,5 s. */
export const PLACAR_MIN = 2.5
/** O ms do g.placar que deixa o placar legível o mínimo: o placar fica até o fim da gravação, e a gravação segura o ms. */
export const msMinimoDoPlacar = (itens) => Math.ceil((TEMPO_PLACAR({ itens }) + PLACAR_MIN) * 1000)
/** O rótulo do marcador do g.prova é lido em menos de 1 s. */
export const PROVA_MAX = 16
/** O nome da seção (g.secao) cabe numa linha da coluna de texto. */
export const SECAO_MAX = 28
/** O relance do antes (g.antes): curto o bastante para não parar o passo, longo o bastante para ler. */
export const ANTES_MS = { min: 500, max: 2500, padrao: 1200 }
export const ANTES_EXT = /\.(png|jpe?g|webp|mp4|mov|webm)$/i
export const ehClipe = (arq) => /\.(mp4|mov|webm)$/i.test(arq)
/** Os rótulos da etiqueta do antes, por idioma do vídeo (a série troca com "antes": { "rotulo", "agora" }). */
export function rotulosDoAntes(idioma = 'en-US', serie = {}) {
  const base = /^pt/i.test(idioma) ? ['Antes', 'Agora'] : /^es/i.test(idioma) ? ['Antes', 'Ahora'] : ['Before', 'Now']
  const s = serie.antes || {}
  return { rotulo: s.rotulo || base[0], agora: s.agora || base[1] }
}
