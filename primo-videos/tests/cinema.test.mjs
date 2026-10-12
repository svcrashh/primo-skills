// node --test tests/cinema.test.mjs   (sem rede, sem ffmpeg, sem navegador)
// Vídeo de venda com miolo de app usa o cinema inteiro, com ou sem a pessoa na câmera. O que este arquivo trava:
//   · o visual aceita a moldura "aparelho", a legenda "nenhuma", a abertura "pouso" e o fecho com o logo em cima;
//   · o compor recusa as combinações em que o aparelho some (celular sem corpo com a pessoa, pouso sem o aparelho);
//   · a folha de sincronia ganha o som de cada prova, do placar, da lupa e da saída do aparelho;
//   · a legenda única fica no mesmo lugar (--fixed) e palavra curta não pisca.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { resolverVisual } from '../scripts/tutorial/visual.mjs'
import { conferirAparelho, folhaDoVideo, TEMPO_PLACAR, PLACAR_MIN } from '../scripts/tutorial/compose.mjs'
import { semPiscar, PALAVRA_MIN } from '../scripts/captions/words.mjs'
import { planejar } from '../scripts/captions/caption.mjs'

const MARCA = { cores: { fundo: '#F7F8FA', tinta: '#14171C', marca: '#1E3A58', acento: '#D8F35A' } }
const visual = (troca = {}) => ({
  fundo: { tipo: 'liso', cor: 'marca', tinta: 'marca' },
  moldura: { tipo: 'aparelho', cor: '#15171C', raio: 0, sombra: 'longa' },
  legenda: { tipo: 'nenhuma', lado: 'baixo' },
  selo: { tipo: 'nenhum' },
  titulo: { caixa: 'normal', peso: 700, espaco: -0.01, entrada: 'palavras', tinta: '#FFFFFF' },
  abertura: { saida: 'pouso' },
  fechamento: { entrada: 'iris', fundo: 'marca', tinta: '#FFFFFF', logo: 'cores', ordem: 'logo' },
  realce: { tipo: 'contorno', cor: 'acento', espessura: 3, raio: 12 },
  indicador: { tinta: 'marca', contorno: '#FFFFFF' },
  ...troca,
})
const resolve = (troca) => resolverVisual({ versao: 2, visual: visual(troca) }, MARCA).visual

describe('o visual do vídeo de venda com miolo de app', () => {
  test('aceita moldura "aparelho", legenda "nenhuma" (só o lado), abertura "pouso" e fecho com o logo em cima', () => {
    const v = resolve()
    assert.equal(v.moldura.tipo, 'aparelho')
    assert.equal(v.legenda.tipo, 'nenhuma')
    assert.equal(v.abertura.saida, 'pouso')
    assert.equal(v.fechamento.ordem, 'logo')
  })
  test('a ordem do fecho é "frase" quando a série não diz', () => {
    assert.equal(resolve({ fechamento: { entrada: 'corte', fundo: 'marca', tinta: '#FFFFFF', logo: 'cores' } }).fechamento.ordem, 'frase')
  })
  test('as legendas que o motor desenha continuam exigindo tinta, rótulo e troca', () => {
    assert.throws(() => resolve({ legenda: { tipo: 'solta', lado: 'cima' } }), /"tinta"/)
    assert.throws(() => resolve({ legenda: { tipo: 'cartao', lado: 'cima', fundo: '#FFFFFF', borda: 'nenhuma', raio: 8, tinta: '#111111', rotulo: 'ponto' } }), /"troca"/)
  })
  test('a legenda "nenhuma" ainda diz de que lado a da montagem vai ficar', () => {
    assert.throws(() => resolve({ legenda: { tipo: 'nenhuma' } }), /"lado"/)
  })
})

describe('em vídeo de app o aparelho aparece (conferirAparelho)', () => {
  const cel = { width: 390, height: 844 }
  const base = { cinema: 'moldura', toque: true, viewport: cel }
  const calado = (f) => { const l = console.log; console.log = () => {}; try { return f() } finally { console.log = l } }
  test('o caso inteiro passa sem aviso', () => {
    assert.deepEqual(calado(() => conferirAparelho({ visual: resolve(), ...base, pessoa: { entrada: { arquivo: 'a.mp4', de: 4.6 } } })), [])
  })
  test('celular em modo cinema com moldura "nenhuma": aviso sem a pessoa na câmera, erro com ela', () => {
    const v = resolve({ moldura: { tipo: 'nenhuma', raio: 28, sombra: 'longa' }, abertura: { saida: 'corte' } })
    assert.match(calado(() => conferirAparelho({ visual: v, ...base }))[0], /no device body/)
    assert.throws(() => calado(() => conferirAparelho({ visual: v, ...base, pessoa: { saida: { arquivo: 'b.mp4' } } })), /With the person on camera this is an error/)
  })
  test('o pouso pede cinema, celular, a moldura "aparelho" e a tela do aparelho do kit', () => {
    assert.throws(() => conferirAparelho({ visual: resolve(), ...base, cinema: 'nenhum' }), /"cinema": "moldura"/)
    assert.throws(() => conferirAparelho({ visual: resolve({ moldura: { tipo: 'janela', cor: '#15171C', raio: 28, sombra: 'longa' } }), ...base }), /needs visual\.moldura "aparelho"/)
    assert.throws(() => conferirAparelho({ visual: resolve(), ...base, viewport: { width: 390, height: 694 } }), /390×844/)
    assert.throws(() => conferirAparelho({ visual: resolve({ moldura: { tipo: 'janela', cor: '#15171C', raio: 8, sombra: 'curta' } }), ...base, toque: false }), /recorded phone/)
  })
  test('a moldura "aparelho" é do celular; a pessoa na entrada pede o pouso', () => {
    assert.throws(() => conferirAparelho({ visual: resolve({ abertura: { saida: 'corte' } }), ...base, toque: false }), /phone body/)
    assert.throws(() => conferirAparelho({ visual: resolve({ abertura: { saida: 'corte' } }), ...base, pessoa: { entrada: { arquivo: 'a.mp4', de: 4 } } }), /"pouso"/)
  })
})

describe('a folha de sincronia do vídeo de venda', () => {
  const log = (eventos) => ({ versao: 'phone', duracao: 20, aparelho: { toque: true, formato: '9x16' }, eventos })
  const ev = [
    { t: 4, tipo: 'aponta', alvo: 'span "IA"', ret: { x: 40, y: 200, w: 34, h: 26 }, dur: 1.3, lupa: 3.4 },
    { t: 8, tipo: 'prova', rotulo: 'Estoque', dur: 1 },
    { t: 12, tipo: 'prova', rotulo: 'Prazo', dur: 1 },
    { t: 15, tipo: 'placar', itens: [{ valor: 2, rotulo: 'perguntas' }, { valor: 0, rotulo: 'atendentes' }] },
  ]
  const folha = (extra = {}) => folhaDoVideo({ id: 'v' }, log(ev), { A: 1.3, F: 3, semente: 1, serie: {}, visual: resolve(), cinema: 'moldura', pecasLogo: 5, ...extra })
  const de = (m, re) => m.filter((x) => re.test(x.evento))
  test('a série troca o som de sino por outro ("trocar": { "sucesso": "baque" }), sem levar as notas do sucesso', () => {
    const m = folha({ serie: { trocar: { sucesso: 'baque' } } }).marcos
    const provas = de(m, /^proof:/)
    assert.deepEqual(provas.map((x) => [x.efeito, x.som, x.notas]), [['baque', 'baque', undefined], ['baque', 'baque', undefined]])
    assert.equal(m.filter((x) => x.efeito === 'sucesso').length, 0)
  })
  test('cada prova ganha um sucesso (a última com uma nota a mais), e a lupa um whoosh curto', () => {
    const m = folha().marcos, provas = de(m, /^proof:/)
    assert.deepEqual(provas.map((x) => [x.efeito, x.t, x.notas]), [['sucesso', 9.4, 2], ['sucesso', 13.4, 3]])
    const lupa = de(m, /the magnifier opens/)[0]
    assert.equal(lupa.efeito, 'whoosh'); assert.equal(lupa.variante, 'curto'); assert.equal(lupa.opcional, true)
  })
  test('o placar conta com um riser de tiques e assenta num impacto', () => {
    const m = folha().marcos, cheio = TEMPO_PLACAR(ev[3])
    assert.equal(cheio, 1.15)
    assert.equal(de(m, /the scoreboard counts/)[0].ticks, true)
    assert.equal(de(m, /the scoreboard settles/)[0].t, +(1.3 + 15 + cheio - 0.15).toFixed(3))
    assert.equal(PLACAR_MIN, 2.5)
  })
  test('o aparelho que entra e o que sai de cena têm whoosh; o logo 3D, riser e impacto', () => {
    const m = folha({ saida: { de: 19.3, dur: 0.7 } }).marcos
    assert.equal(de(m, /the 3D phone spins in/)[0].dur, 1.05)
    assert.equal(de(m, /the device leaves the scene/)[0].t, +(1.3 + 19.3 + 0.12).toFixed(3))
    assert.equal(de(m, /3D logo/).map((x) => x.efeito).join(' '), 'riser impacto')
  })
  test('com a legenda "nenhuma" a troca de passo não tem som (não há legenda do motor para trocar)', () => {
    const m = folhaDoVideo({ id: 'v' }, log([{ t: 0.5, tipo: 'passo', n: 1, legenda: 'a' }, { t: 6, tipo: 'passo', n: 2, legenda: 'b' }]), { A: 1.3, F: 3, semente: 1, serie: {}, visual: resolve(), cinema: 'nenhum' }).marcos
    assert.equal(de(m, /the caption/).length, 0)
  })
  test('o gravador e o desenho conhecem a prova, o placar e a lupa', () => {
    const g = fs.readFileSync(new URL('../scripts/tutorial/record.mjs', import.meta.url), 'utf8')
    assert.match(g, /async prova\(rotulo, \{ alvo = null, ms = 900 \} = \{\}\)/)
    assert.match(g, /async placar\(itens, \{ ms = null \} = \{\}\)/)
    assert.match(g, /lupa = null, margem = null/)
    const d = fs.readFileSync(new URL('../scripts/tutorial/drawing.js', import.meta.url), 'utf8')
    assert.match(d, /const provas = ev\.filter\(\(e\) => e\.tipo === 'prova'\), placar = ev\.find\(\(e\) => e\.tipo === 'placar'\)/)
    assert.match(d, /const POUSO = AB\.saida === 'pouso' && CINE && TOQUE/)
    // o desenho usa os mesmos tempos do placar que a conta do compor (TEMPO_PLACAR)
    assert.match(d, /t0: placar\.t \+ 0\.2 \+ i \* 0\.5/)
  })
})

describe('a legenda única do vídeo com a pessoa na câmera', () => {
  test('palavra curta não pisca: aparece antes, no silêncio depois da anterior, nunca em cima dela', () => {
    const ps = [{ texto: 'atende', ini: 1.92, fim: 2.32 }, { texto: 'é', ini: 2.4, fim: 2.42 }, { texto: 'a', ini: 2.44, fim: 2.5 }, { texto: 'Ana…', ini: 2.58, fim: 2.84 }]
    const r = semPiscar(ps)
    assert.equal(r[1].ini, 2.32)                       // 2,44 − 0,12, e não antes do fim de "atende"
    assert.ok(r[2].ini - r[1].ini >= PALAVRA_MIN - 1e-9)
    assert.deepEqual(r.map((p) => p.fim), ps.map((p) => p.fim))
    assert.equal(ps[1].ini, 2.4)                       // a entrada não muda
  })
  test('palavra com tempo de sobra fica onde está; colada na anterior, recua até o fim dela e a seguinte entra até 60 ms depois', () => {
    assert.deepEqual(semPiscar([{ texto: 'Olha', ini: 5.18, fim: 5.4 }, { texto: 'isso.', ini: 5.48, fim: 5.78 }]).map((p) => p.ini), [5.18, 5.48])
    const r = semPiscar([{ texto: 'do', ini: 1, fim: 1.3 }, { texto: 'o', ini: 1.31, fim: 1.33 }, { texto: 'prazo', ini: 1.36, fim: 1.8 }])
    assert.equal(r[1].ini, 1.3)
    assert.equal(r[2].ini, 1.42)                       // 1,36 + 0,06: o "o" fica 120 ms na tela
    // o caso do vídeo: "olha o estoque", com "o" de 20 ms
    const v = semPiscar([{ texto: 'olha', ini: 1.98, fim: 2.1 }, { texto: 'o', ini: 2.14, fim: 2.16 }, { texto: 'estoque', ini: 2.2, fim: 2.8 }])
    assert.deepEqual(v.map((p) => p.ini), [1.98, 2.1, 2.22])
  })
  test('--fixed: toda linha começa no topo da zona, sem procurar a faixa mais quieta', async () => {
    const palavras = ['Sua', 'equipe', 'não', 'dá', 'conta.', 'Olha', 'isso.'].map((texto, i) => ({ texto, ini: i * 0.4, fim: i * 0.4 + 0.3, fala: 'a' }))
    const desenho = { medir: async (linha) => (linha.length > 2 ? 0.098 : 0.049) }
    const { plano } = await planejar({ video: '/nao/existe.mp4', de: 0, ate: 4, W: 1080, H: 1920, palavras, desenho, acento: '#D8F35A', zona: { topo: 0.628, base: 0.756 }, fixa: true })
    assert.ok(plano.length >= 2)
    assert.ok(plano.every((p) => p.topo === 0.628 && p.coluna === 'seguro'))
  })
  test('--fixed recusa a linha que não cabe na zona', async () => {
    const palavras = [{ texto: 'Teste', ini: 0, fim: 0.3, fala: 'a' }]
    await assert.rejects(planejar({ video: '/x.mp4', de: 0, ate: 1, W: 1080, H: 1920, palavras, desenho: { medir: async () => 0.2 }, acento: '#D8F35A', zona: { topo: 0.7, base: 0.756 }, fixa: true }), /does not fit the zone/)
  })
})
