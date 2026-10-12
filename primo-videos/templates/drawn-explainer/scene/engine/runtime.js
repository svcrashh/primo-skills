// explicação desenhada · o palco: carrega a obra (params.js, scenes.js, media.js, ícones, fontes), desenha cada quadro
// em função do tempo, e expõe à página o contrato do render da skill (scripts/render.cjs e scripts/frames.cjs):
// FMT, VIDEO, CENAS, TRANSICOES, renderAt(t), checarQuadro(t) e __ready.
// Portado do explainroo (https://github.com/vincentsch/explainroo, engine/runtime.js e engine/frame.html,
// commit 5347905), MIT, © 2026 Vincent Schmalbach: licença em templates/drawn-explainer/LICENSE-explainroo.txt.
// Mudanças para a skill: nada de servidor nem fetch (a obra abre por file:// no Chromium do scripts/playwright.cjs);
// a linha do tempo vem pronta do render.mjs (voz da skill ou cenas por duração); o som não é mixado aqui:
// cada entrada vira um marco da folha de sincronia (assets/audio, arrange_series.py + sounds.py + mix_voz.py); a
// checagem fala português e usa a área segura da skill; sem marca d'água.
import rough from '../vendor/rough.esm.js';
import { Stage, SceneError } from './stage.js';
import { temaDaMarca, makeBackground, fontString } from './brand.js';
import { Pen } from './pen.js';
import { drawTransition } from './transitions.js';
import { buildPhrases, drawCaptions } from './captions.js';
import { hashStr, mulberry32, contrast, opaque, withAlpha, clamp } from './util.js';
import { layoutAreas, FORMATOS } from './layout.js';
import { UI } from './ui.js';
import { playbackTextIssue } from './readability.js';

Stage.UI = UI;

export { FORMATOS };
// Os nomes do assets/audio/sounds.py. O render.mjs manda o catálogo de verdade (lido do Python) em params.sonsCatalogo.
export const SONS_PADRAO = ['toque', 'clique', 'digitacao', 'virada', 'whoosh', 'sucesso', 'riser', 'impacto', 'acento', 'pop', 'tique', 'blip', 'rabisco', 'giz', 'brilho', 'baque', 'erro'];
// Marca que recusa sino: o som de sino vira um destes.
const SEM_SINO = { brilho: 'pop', sucesso: 'acento' };
const COM_DUR = ['rabisco', 'giz', 'digitacao', 'riser', 'whoosh'];

const seg = (t) => t.toFixed(2);

export class Engine {
  constructor({ canvas, params, scenes, icons, iconTags, images, formato, scale = 1 }) {
    const P = params;
    if (!FORMATOS[formato]) throw new Error(`format "${formato}" does not exist. Use: ${Object.keys(FORMATOS).join(', ')}`);
    this.params = P;
    this.marca = P.marca;
    this.timeline = P.linha;
    this.formato = formato;
    [this.W, this.H] = FORMATOS[formato];
    this.idioma = P.idioma || 'en-US';
    this.numero = /^(pt|es|de|it|fr|nl)/i.test(this.idioma) ? { milhar: '.', decimal: ',' } : { milhar: ',', decimal: '.' };
    const temVoz = this.timeline.scenes.some((s) => s.voice);
    const legenda = P.legenda === undefined || P.legenda === 'auto' ? temVoz : P.legenda === 'texto' ? true : !!P.legenda;
    this.config = { formato, plataforma: P.plataforma ?? null, captions: legenda, sfx: P.sons ?? true, boil: P.boil ?? 0, seed: P.semente ?? 1 };
    const areas = layoutAreas(this.config, this.W, this.H);
    this.safeArea = areas.safe;
    this.livreArea = areas.livre;
    this.captionArea = areas.captions;
    this.captionBand = areas.band;
    this.appArea = areas.app;
    this.fps = this.timeline.fps;
    this.scale = scale;
    this.theme = temaDaMarca(P.marca, P.textura || 'nenhuma');
    if (P.transicao) this.theme.transition = P.transicao;
    if (P.legendaPeso) this.theme.legendaPeso = P.legendaPeso;
    this.pen = new Pen({ rough, theme: this.theme });
    this.icons = icons;
    this.iconTags = iconTags;
    this.iconCache = new Map();
    this.images = images;
    this.catalogo = P.sonsCatalogo || null;
    this.sfxNames = this.catalogo ? Object.keys(this.catalogo) : SONS_PADRAO;
    this.sfxMode = this.config.sfx;
    this.semSino = P.marca.sino === false || P.semSino === true;
    this.recorder = null;
    this.textLog = null;
    this.canvas = canvas;
    canvas.width = 2 * Math.round((this.W * scale) / 2);
    canvas.height = 2 * Math.round((this.H * scale) / 2);
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.background = makeBackground(this.theme, this.W, this.H, this.config.seed);
    // A legenda é a fala. Cena sem voz só ganha legenda com "legenda": "texto" (o vídeo inteiro sem voz).
    const comLegenda = { ...this.timeline, scenes: this.timeline.scenes.filter((s) => s.voice || P.legenda === 'texto') };
    this.phrases = this.config.captions ? buildPhrases(comLegenda, this.H > this.W ? 28 : 46) : [];
    this.buffers = [0, 1].map(() => {
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
      return c;
    });
    this.scenesModule = scenes;
    const ids = new Set(this.timeline.scenes.map((s) => s.id));
    this.extraScenes = Object.keys(scenes).filter((k) => !ids.has(k));
    for (const sc of this.timeline.scenes) {
      if (typeof scenes[sc.id] !== 'function') throw new SceneError(`scenes.js has no function for the scene "${sc.id}". Scenes in the file: ${Object.keys(scenes).join(', ') || 'none'}`);
    }
  }

  formatarNumero(v, casas = 0) {
    const s = Math.abs(v).toFixed(casas);
    const [int, dec] = s.split('.');
    return (v < 0 ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, this.numero.milhar) + (dec ? this.numero.decimal + dec : '');
  }

  image(src) {
    const key = String(src).replace(/^\.?\//, '');
    const img = this.images.get(key) || this.images.get('media/' + key);
    if (!img) throw new SceneError(`the image "${src}" is not in the build. Put the file in "midia" in video.json. Available: ${[...this.images.keys()].join(', ') || 'none'}`);
    return img;
  }

  sceneAt(T) {
    const list = this.timeline.scenes;
    let i = list.length - 1;
    while (i > 0 && T < list[i].start) i--;
    return i;
  }

  transitionFor(sc) {
    const name = !sc.transition || sc.transition === 'auto' ? this.theme.transition : sc.transition;
    return name || 'fade';
  }

  transicoes() {
    const out = [];
    this.timeline.scenes.forEach((sc, i) => {
      if (i === 0 || sc.transition === 'none') return;
      const nome = this.transitionFor(sc);
      if (nome === 'cut') return;
      out.push({ nome, t0: sc.start, dur: Math.min(this.timeline.transitionSeconds, sc.dur * 0.5) });
    });
    return out;
  }

  drawScene(ctx, index, t) {
    const sc = this.timeline.scenes[index];
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.background, 0, 0, this.W, this.H);
    if (this.config.boil > 0) this.pen.seedOffset = Math.floor((sc.start + t) * this.config.boil) % 997;
    const saved = Math.random;
    Math.random = mulberry32(hashStr(`random:${sc.id}`));
    const s = new Stage(this, ctx, sc, t);
    ctx.save();
    try {
      this.scenesModule[sc.id](s);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      err.scene = sc.id;
      err.sceneTime = t;
      throw err;
    } finally {
      Math.random = saved;
      ctx.restore();
    }
    return s;
  }

  renderFrame(T, ctx = this.ctx) {
    const i = this.sceneAt(T);
    const sc = this.timeline.scenes[i];
    const t = T - sc.start;
    const trName = this.transitionFor(sc);
    const trDur = Math.min(this.timeline.transitionSeconds, sc.dur * 0.5);
    if (i > 0 && sc.transition !== 'none' && trName !== 'cut' && t < trDur) {
      const prev = this.timeline.scenes[i - 1];
      const [a, b] = this.buffers;
      this.drawScene(a.getContext('2d', { alpha: false }), i - 1, T - prev.start);
      this.drawScene(b.getContext('2d', { alpha: false }), i, t);
      drawTransition(trName, ctx, a, b, t / trDur, this.W, this.H, hashStr(sc.id));
    } else {
      this.drawScene(ctx, i, t);
    }
    if (this.phrases.length) {
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      drawCaptions(ctx, this.phrases, T, this.theme, this.W, this.H, this.captionArea);
    }
  }

  // Roda cada cena pela duração inteira sem guardar pixels e junta o que entra (para os sons) e os erros de cena.
  collectEvents(step = 0.1) {
    const scratch = document.createElement('canvas');
    const save = { scale: this.scale };
    this.scale = 0.25;
    scratch.width = Math.round(this.W * 0.25);
    scratch.height = Math.round(this.H * 0.25);
    const ctx = scratch.getContext('2d', { alpha: false });
    const events = [];
    const errors = [];
    try {
      for (const sc of this.timeline.scenes) {
        const seen = new Map();
        this.recorder = { push: (e) => { if (!seen.has(e.key)) seen.set(e.key, e); } };
        const n = Math.ceil(sc.dur / step);
        for (let k = 0; k <= n; k++) {
          const t = Math.min(sc.dur, k * step);
          try {
            this.drawScene(ctx, sc.index, t);
          } catch (e) {
            errors.push({ scene: sc.id, t, message: e.message });
            break;
          }
        }
        for (const e of seen.values()) {
          if (e.at > sc.dur + 0.001) continue;
          events.push({ ...e, scene: sc.id, T: sc.start + e.at });
        }
      }
    } finally {
      this.recorder = null;
      this.scale = save.scale;
    }
    return { events, errors };
  }

  // Os marcos da folha de sincronia: cada entrada com som, cada s.sfx() e cada transição, rareados como no motor original
  // (o mesmo som a menos de 0,12 s some, o tique a menos de 0,045 s; no máximo 3 sons sozinhos a cada 0,5 s),
  // para nenhum momento ter três sons em cima da voz. Um som por momento.
  marcos() {
    if (this.sfxMode === false) return { marcos: [], erros: [] };
    const { events, errors } = this.collectEvents();
    const cues = [];
    const cat = this.catalogo || {};
    const troca = (nome) => (this.semSino && cat[nome] && cat[nome].sino ? SEM_SINO[nome] || 'pop' : nome);
    for (const e of events) {
      if (!e.sfx || !this.sfxNames.includes(e.sfx)) continue;
      const som = troca(e.sfx);
      const cue = { som, t: e.T, ganho: e.gain ?? 1, explicito: !!e.explicit, evento: `${e.scene}: ${e.kind}${e.label ? ' ' + String(e.label).slice(0, 30) : ''}` };
      if (e.pitch !== undefined && e.pitch !== null) cue.passo = Math.round(e.pitch);
      if (COM_DUR.includes(som) && e.dur) cue.dur = +clamp(e.dur, 0.15, 3).toFixed(3);
      // whoosh tem o pico no instante do marco: a seta ou a linha corre do `at` em diante, o pico vai para o meio
      if (som === 'whoosh' && !e.explicit) cue.t = e.T + Math.min(0.25, (cue.dur || 0.5) / 2);
      cues.push(cue);
    }
    for (const tr of this.transicoes()) {
      const som = this.theme.sfx.transition;
      if (som) cues.push({ som, t: tr.t0 + tr.dur / 2, dur: +Math.max(0.3, tr.dur).toFixed(3), ganho: 0.8, explicito: true, evento: `transition ${tr.nome}` });
    }
    cues.sort((a, b) => a.t - b.t);
    const out = [];
    const last = new Map();
    let windowStart = -1;
    let inWindow = 0;
    for (const c of cues) {
      if (this.sfxMode === 'minimo' && !c.explicito) continue;
      const prev = last.get(c.som);
      if (!c.explicito && prev !== undefined && c.t - prev < (c.som === 'tique' ? 0.045 : 0.12)) continue;
      if (c.t - windowStart > 0.5) {
        windowStart = c.t;
        inWindow = 0;
      }
      if (!c.explicito && inWindow >= 3 && c.som !== 'tique') continue;
      inWindow++;
      last.set(c.som, c.t);
      out.push(c);
    }
    const dur = this.timeline.duration;
    const marcos = out.filter((c) => c.t >= 0 && c.t < dur - 0.05).map((c, i, todos) => {
      const info = cat[c.som] || {};
      const vizinho = Math.min(...todos.filter((o) => o !== c).map((o) => Math.abs(o.t - c.t)), Infinity);
      const m = { t: +c.t.toFixed(4), evento: c.evento, som: c.som, efeito: c.som };
      if (c.dur) m.dur = c.dur;
      if (c.passo !== undefined) m.passo = c.passo;
      if (Math.abs(c.ganho - 1) > 0.01 && info.nivel_db !== undefined) m.nivel = +(info.nivel_db + 20 * Math.log10(Math.max(0.05, c.ganho))).toFixed(1);
      // obrigatório (o verify.py exige o ataque em ±10 ms) só o som de ataque seco e sozinho; o resto é opcional
      m.opcional = !(info.ataque_seco && info.ancora === 'inicio' && vizinho >= 0.3);
      return m;
    });
    return { marcos, erros: errors };
  }

  // Corre as cenas e devolve os problemas de layout e de tempo: [{ nivel: 'erro'|'aviso'|'dica', cena, t, msg }].
  check(step = 0.25, viewWidth = null) {
    const issues = [];
    const add = (nivel, scene, t, msg) => issues.push({ nivel, cena: scene, t: t === null ? null : Math.round(t * 100) / 100, msg });
    for (const id of this.extraScenes) add('aviso', id, null, `scenes.js has the function "${id}", but video.json has no such scene: it never appears`);
    const scratch = document.createElement('canvas');
    scratch.width = this.canvas.width;
    scratch.height = this.canvas.height;
    const ctx = scratch.getContext('2d', { alpha: false });
    const reported = new Set();
    const once = (key, fn) => {
      if (reported.has(key)) return;
      reported.add(key);
      fn();
    };
    this.cueNotes = [];
    for (const sc of this.timeline.scenes) {
      const entrances = [];
      this.recorder = { push: (e) => entrances.push(e) };
      const n = Math.ceil(sc.dur / step);
      for (let k = 0; k <= n; k++) {
        const t = Math.min(sc.dur - 0.001, k * step);
        let probs;
        try {
          probs = this._problemas(ctx, sc, t, viewWidth);
        } catch (e) {
          once(`err:${sc.id}:${e.message}`, () => add('erro', sc.id, t, e.message));
          break;
        }
        for (const p of probs) once(`${p.chave}:${sc.id}`, () => add(p.nivel, sc.id, t, p.msg));
      }
      this.recorder = null;
      const times = [...new Set(entrances.map((e) => Math.round(e.at * 100) / 100))].sort((a, b) => a - b);
      for (const e of entrances) {
        if (e.at > sc.dur) once(`late:${sc.id}:${e.key}`, () => add('erro', sc.id, e.at, `a ${e.kind} comes in at ${seg(e.at)} s, but the scene ends at ${seg(sc.dur)} s: lengthen the scene ("min" or "hold") or move the "at" earlier`));
      }
      if (!times.length) {
        add('aviso', sc.id, null, 'nothing comes in during this scene: give at least one element an "at"');
      } else {
        const marks = [0, ...times.filter((x) => x >= 0 && x <= sc.dur), sc.dur];
        for (let i = 1; i < marks.length; i++) {
          const gap = marks[i] - marks[i - 1];
          if (gap > 4) add('dica', sc.id, marks[i - 1], `nothing new comes in for ${seg(gap)} s (since ${seg(marks[i - 1])} s): something should change every 2–4 s (an arrow, a highlight, the camera)`);
        }
      }
    }
    const repeated = new Map();
    for (const c of this.cueNotes) repeated.set(`${c.scene}|${c.word.toLowerCase()}`, c);
    for (const c of repeated.values()) add('dica', c.scene, null, `the word "${c.word}" is said ${c.count} times in this scene and the cue takes the first one; for another, use s.cue("${c.word}", 2) or a mark`);
    this.cueNotes = null;
    return issues;
  }

  // Os problemas de texto de um instante (t na cena sc): fora do quadro, fora da área segura, debaixo da legenda,
  // pequeno demais, contraste baixo, um texto em cima do outro. Lê o que as cenas registraram ao desenhar.
  _problemas(ctx, sc, t, viewWidth = null) {
    const { W, H } = this;
    const a = this.appArea;
    const vertical = H > W;
    // o mínimo legível de references/formats.md: 9:16 e 19:9 (celular, em pé ou deitado) 34 px; 16:9 e 21:9 28 px; 4:5 e 1:1 30
    const minSize = vertical || this.formato === '19x9' ? 34 : W > H ? 28 : 30;
    const uiMinSize = 16;
    const out = [];
    let log;
    this.textLog = [];
    try {
      this.drawScene(ctx, sc.index, t);
    } finally {
      log = this.textLog;
      this.textLog = null;
    }
    for (const pr of log.filter((x) => x.problem)) out.push({ nivel: 'erro', chave: `problema:${pr.problem}`, tipo: 'texto', msg: pr.problem });
    const texts = log.filter((x) => !x.problem && x.alpha > 0.5);
    for (const tx of texts) {
      const label = tx.text.length > 40 ? tx.text.slice(0, 37) + '...' : tx.text;
      if (viewWidth !== null) {
        const m = playbackTextIssue(tx, W, H, viewWidth);
        if (m) out.push({ nivel: 'aviso', chave: `player:${tx.text}`, tipo: 'texto', msg: m });
      }
      // O texto do kit de interface pode sair do quadro de propósito enquanto a câmera aproxima.
      const framed = !(tx.ui && tx.zoomed);
      if (tx.x0 < -1 || tx.y0 < -1 || tx.x1 > W + 1 || tx.y1 > H + 1) {
        if (framed) out.push({ nivel: 'erro', chave: `fora:${tx.text}`, tipo: 'fora', msg: `OUT OF FRAME t=${seg(sc.start + t)} s: "${label}" leaves the frame (${Math.round(tx.x0)},${Math.round(tx.y0)} to ${Math.round(tx.x1)},${Math.round(tx.y1)} in ${W}×${H})` });
      } else if (framed && (tx.x0 < a.left - 2 || tx.y0 < a.top - 2 || tx.x1 > a.right + 2 || tx.y1 > a.bottom + 2)) {
        const por = tx.y1 > a.bottom + 2 ? `y ${Math.round(tx.y1)} > ${a.bottom}` : tx.y0 < a.top - 2 ? `y ${Math.round(tx.y0)} < ${a.top}` : tx.x1 > a.right + 2 ? `x ${Math.round(tx.x1)} > ${a.right}` : `x ${Math.round(tx.x0)} < ${a.left}`;
        out.push({ nivel: 'erro', chave: `area:${tx.text}`, tipo: 'area', msg: `SAFE AREA t=${seg(sc.start + t)} s: text "${label}" leaves the ${a.nome} safe area (${por})` });
      }
      // a faixa da legenda só conta na cena que fala (ou com "legenda": "texto")
      const b = sc.voice || this.params.legenda === 'texto' ? this.captionBand : null;
      if (b && tx.y1 > b.top + 2 && tx.y0 < b.bottom - 2 && tx.x1 > b.left && tx.x0 < b.right) out.push({ nivel: 'aviso', chave: `legenda:${tx.text}`, tipo: 'legenda', msg: `"${label}" is in the caption band (y ${Math.round(b.top)} to ${Math.round(b.bottom)}); put it above s.safe.bottom (${Math.round(this.safeArea.bottom)})` });
      const least = tx.ui ? uiMinSize : minSize;
      if (!tx.block && Math.round(tx.size) < least) out.push({ nivel: 'aviso', chave: `pequeno:${tx.text}`, tipo: 'texto', msg: `"${label}" is ${Math.round(tx.size)} px, hard to read (at least ${least} px${tx.ui ? ' in the interface kit; move the camera closer' : ''})` });
      const bg = opaque(tx.bg || this.theme.bg, this.theme.bg);
      if (typeof tx.fg === 'string' && contrast(tx.fg, bg) < 3) out.push({ nivel: 'aviso', chave: `contraste:${tx.text}`, tipo: 'texto', msg: `"${label}" has low contrast with the background` });
    }
    // Sobreposição só conta com os dois inteiros na tela, não no meio de um fade.
    const solid = texts.filter((x) => x.alpha > 0.95);
    for (let i = 0; i < solid.length; i++) {
      for (let j = i + 1; j < solid.length; j++) {
        const A = solid[i];
        const B = solid[j];
        if (A.block && B.block) continue;
        if ((A.ui || 1) !== (B.ui || 1)) continue;
        const ix = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
        const iy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        if (ix <= 4 || iy <= 4) continue;
        const small = Math.min((A.x1 - A.x0) * (A.y1 - A.y0), (B.x1 - B.x0) * (B.y1 - B.y0)) || 1;
        if ((ix * iy) / small > 0.15) out.push({ nivel: 'erro', chave: `sobre:${A.text}:${B.text}`, tipo: 'sobreposicao', msg: `OVERLAP t=${seg(sc.start + t)} s: "${A.text.slice(0, 30)}" on top of "${B.text.slice(0, 30)}"` });
      }
    }
    return out;
  }

  // Para o frames.cjs: os problemas no instante T do vídeo, no formato do checarQuadro() do engine.js.
  checarQuadro(T) {
    const i = this.sceneAt(T);
    const sc = this.timeline.scenes[i];
    const scratch = this._scratch || (this._scratch = Object.assign(document.createElement('canvas'), { width: this.canvas.width, height: this.canvas.height }));
    const probs = this._problemas(scratch.getContext('2d', { alpha: false }), sc, T - sc.start).filter((p) => p.nivel === 'erro');
    this.renderFrame(T);
    return probs.map((p) => ({ tipo: p.tipo, t: T, chave: p.chave, msg: p.msg }));
  }

  // A folha de quadros: uma imagem com vários instantes e o tempo de cada um embaixo.
  folha({ tempos, rotulos, cols, largura }) {
    const tw = largura;
    const th = Math.round((tw * this.canvas.height) / this.canvas.width);
    const labelH = 30;
    const rows = Math.ceil(tempos.length / cols);
    const sheet = document.createElement('canvas');
    sheet.width = cols * (tw + 8) + 8;
    sheet.height = rows * (th + labelH + 8) + 8;
    const g = sheet.getContext('2d');
    g.fillStyle = '#16181d';
    g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = '600 17px sans-serif';
    g.textBaseline = 'middle';
    for (let i = 0; i < tempos.length; i++) {
      this.renderFrame(tempos[i]);
      const x = 8 + (i % cols) * (tw + 8);
      const y = 8 + Math.floor(i / cols) * (th + labelH + 8);
      g.drawImage(this.canvas, x, y, tw, th);
      g.fillStyle = '#e6e9ef';
      g.fillText(rotulos[i], x + 4, y + th + labelH / 2);
    }
    return sheet.toDataURL('image/jpeg', 0.9);
  }
}

// Espera cada fonte da marca carregar (fonts/fonts.css da obra). Fonte que não veio para o render com erro no
// console, como os outros moldes: o render.cjs sai com código 3 e diz qual.
async function carregarFontes(theme, marca) {
  const f = marca.fontes || {};
  const pedidos = new Set();
  const pede = (fam, pesos) => { if (fam) for (const w of pesos) pedidos.add(`${w} 48px "${fam}"`); };
  pede(theme.fonts.display.family, [theme.fonts.display.weight, 400]);
  pede(theme.fonts.body.family, [theme.fonts.body.weight, 400, 500, 600, 700]);
  pede(theme.fonts.hand.family, [400]);
  pede(theme.fonts.mono.family, [400, 700]);
  pede(f.ui, [400, 500, 600, 700]);
  await Promise.all([...pedidos].map((p) => document.fonts.load(p).catch(() => null)));
  await document.fonts.ready;
  const faltam = [...new Set([theme.fonts.display.family, theme.fonts.body.family, theme.fonts.mono.family, f.ui].filter(Boolean))].filter((fam) => !document.fonts.check(`400 48px "${fam}"`) || ![...document.fonts].some((ff) => ff.family.replace(/"/g, '') === fam && ff.status === 'loaded'));
  for (const fam of faltam) console.error(`FONT DID NOT LOAD: "${fam}" (run render.mjs again with network access, or put the font in the build's fonts/)`);
}

async function carregarImagens(midia) {
  const images = new Map();
  await Promise.all(Object.entries(midia).map(async ([nome, url]) => {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => { throw new Error(`the image ${nome} did not decode`); });
    images.set(nome, img);
  }));
  return images;
}

function descrever(e) {
  const onde = e.scene ? ` (scene "${e.scene}" at ${Number(e.sceneTime).toFixed(2)} s)` : '';
  return (e.message || String(e)) + onde;
}

export async function iniciar() {
  const Q = new URLSearchParams(location.search);
  const [{ default: P }, { default: cenas }, { default: midia }, lucide] = await Promise.all([
    import('../params.js'), import('../scenes.js'), import('../media.js'), import('../vendor/lucide.js'),
  ]);
  const formato = Q.get('f') || P.formatos[0];
  const icons = { ...lucide.default.icones };
  for (const [alias, alvo] of Object.entries(lucide.default.aliases || {})) if (!icons[alias]) icons[alias] = icons[alvo];
  const theme = temaDaMarca(P.marca, P.textura || 'nenhuma');
  await carregarFontes(theme, P.marca);
  const images = await carregarImagens(midia);
  const canvas = document.getElementById('c');
  const engine = new Engine({ canvas, params: P, scenes: cenas, icons, iconTags: lucide.default.tags, images, formato });
  const tl = P.linha;
  window.FMT = formato;
  window.VIDEO = { titulo: P.nome, duracao: tl.duration, formatos: P.formatos, plataforma: P.plataforma ?? null, fundo: engine.theme.bg };
  window.CENAS = tl.scenes.map((sc) => ({ t0: sc.start, t1: sc.start + sc.dur, nome: sc.id }));
  window.TRANSICOES = engine.transicoes();
  window.renderAt = (t) => {
    try {
      engine.renderFrame(Math.max(0, Math.min(t, tl.duration - 1e-6)));
    } catch (e) {
      throw new Error(descrever(e));
    }
  };
  window.checarQuadro = async (t) => engine.checarQuadro(Math.max(0, Math.min(t, tl.duration - 1e-6)));
  window.explicacao = {
    engine,
    info: () => ({ duracao: tl.duration, formato, W: engine.W, H: engine.H, cenas: window.CENAS, safe: engine.safeArea, area: engine.appArea }),
    marcos: () => engine.marcos(),
    checar: (passo, vw) => engine.check(passo, vw),
    folha: (o) => engine.folha(o),
    renderer: () => {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) return 'no WebGL';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    },
  };
  if (Q.has('play')) {
    const t0 = performance.now();
    const passo = () => { window.renderAt(((performance.now() - t0) / 1000) % tl.duration); requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  } else window.renderAt(Q.has('t') ? Number(Q.get('t')) : 0);
  window.__ready = true;
}
