// explicação desenhada · a marca vira o tema do motor: cores, fontes, forma, entradas, sons e fundo.
// Portado do explainroo (https://github.com/vincentsch/explainroo, engine/themes.js, commit 5347905),
// MIT, © 2026 Vincent Schmalbach: licença em templates/drawn-explainer/LICENSE-explainroo.txt.
// Mudanças para a skill: os cinco visuais do motor original (paper, clean, chalk, blueprint, midnight) não são mais o
// visual do vídeo. As cores, as fontes e a forma vêm da marca (a leitura do produto); o que sobrou de cada visual é
// uma TEXTURA opcional por cima da marca: "papel" (traço à mão e grão de papel), "giz" (traço de giz e pó de lousa),
// "planta" (linha de planta técnica e quadriculado), "noite" (traço limpo com brilho) e "nenhuma" (limpo). Os sons
// de cada entrada são os nomes do assets/audio/sounds.py da skill.
import { mulberry32, mixColor, withAlpha, parseColor, luminance } from './util.js';

// O que cada textura muda no traço, nas entradas, na transição e nos sons. Nada aqui é cor.
export const TEXTURAS = {
  nenhuma: {
    stroke: { rough: false, width: 3.5 },
    radius: 22, tintStrength: 0.12, shadow: 'suave',
    enter: { shape: 'pop', text: 'rise', title: 'rise', icon: 'pop', image: 'pop', list: 'rise', code: 'rise', chart: 'grow', number: 'rise', arrow: 'draw', line: 'draw' },
    transition: 'slide',
    sfx: { shape: 'pop', arrow: 'whoosh', line: 'whoosh', icon: 'pop', image: 'pop', text: null, title: null, list: 'blip', number: 'tique', annotate: 'whoosh', chart: 'whoosh', code: 'digitacao', terminal: 'digitacao', burst: 'brilho', transition: 'whoosh' },
  },
  papel: {
    stroke: { rough: true, roughness: 1.15, bowing: 1.2, width: 4.5, fillStyle: 'solid', hachureGap: 11, fillWeight: 2.4 },
    radius: 14, tintStrength: 0.2, shadow: null,
    enter: { shape: 'draw', text: 'write', title: 'write', icon: 'draw', image: 'pop', list: 'write', code: 'fade', chart: 'grow', number: 'fade' },
    transition: 'brush',
    sfx: { shape: 'rabisco', arrow: 'rabisco', line: 'rabisco', icon: 'pop', image: 'pop', text: null, title: null, list: 'blip', number: 'tique', annotate: 'rabisco', chart: 'rabisco', code: 'digitacao', terminal: 'digitacao', burst: 'brilho', transition: 'whoosh' },
  },
  giz: {
    stroke: { rough: true, roughness: 1.35, bowing: 1.1, width: 5, fillStyle: 'solid', hachureGap: 13, fillWeight: 2.6, texture: 'chalk' },
    radius: 12, tintStrength: 0.16, shadow: null,
    enter: { shape: 'draw', text: 'write', title: 'write', icon: 'draw', image: 'fade', list: 'write', code: 'fade', chart: 'grow', number: 'fade' },
    transition: 'brush',
    sfx: { shape: 'giz', arrow: 'giz', line: 'giz', icon: 'giz', image: 'pop', text: null, title: null, list: 'blip', number: 'tique', annotate: 'giz', chart: 'giz', code: 'digitacao', terminal: 'digitacao', burst: 'brilho', transition: 'whoosh' },
  },
  planta: {
    stroke: { rough: true, roughness: 0.55, bowing: 0.6, width: 3.5, fillStyle: 'solid', hachureGap: 14, fillWeight: 1.4 },
    radius: 6, tintStrength: 0.14, shadow: null,
    enter: { shape: 'draw', text: 'write', title: 'write', icon: 'draw', image: 'fade', list: 'write', code: 'fade', chart: 'grow', number: 'fade' },
    transition: 'wipe',
    sfx: { shape: 'rabisco', arrow: 'whoosh', line: 'rabisco', icon: 'clique', image: 'pop', text: null, title: null, list: 'blip', number: 'tique', annotate: 'rabisco', chart: 'rabisco', code: 'digitacao', terminal: 'digitacao', burst: 'brilho', transition: 'whoosh' },
  },
  noite: {
    stroke: { rough: false, width: 3, glow: 14 },
    radius: 18, tintStrength: 0.16, shadow: 'forte',
    enter: { shape: 'pop', text: 'rise', title: 'rise', icon: 'pop', image: 'pop', list: 'rise', code: 'rise', chart: 'grow', number: 'rise', arrow: 'draw', line: 'draw' },
    transition: 'zoom',
    sfx: { shape: 'pop', arrow: 'whoosh', line: 'whoosh', icon: 'pop', image: 'pop', text: null, title: null, list: 'blip', number: 'tique', annotate: 'whoosh', chart: 'whoosh', code: 'digitacao', terminal: 'digitacao', burst: 'brilho', transition: 'whoosh' },
  },
};

// Cores de série (gráficos, selos, ícones) quando a marca não traz `paleta`: neutras, uma para fundo claro e outra
// para fundo escuro. A cor de destaque é sempre a da marca.
const SERIE_CLARO = { red: '#d64545', orange: '#e07b2e', yellow: '#d9a521', green: '#1f9d63', teal: '#0f9a96', blue: '#3b6cf6', purple: '#7c5cff', pink: '#d94a8c', gray: '#8a93a3' };
const SERIE_ESCURO = { red: '#fb7185', orange: '#fb923c', yellow: '#fcd34d', green: '#34d399', teal: '#22d3ee', blue: '#60a5fa', purple: '#a78bfa', pink: '#f472b6', gray: '#94a3b8' };

const hex = (c, nome) => {
  if (!parseColor(c)) throw new Error(`the brand color "${nome}" is not a color (${JSON.stringify(c)}): use hex, like "#FF7900"`);
  return c;
};

export function escuro(c) {
  return luminance(c) < 0.18;
}

// marca: { nome, cores: { fundo, superficie, texto, apoio, destaque, ok, erro, aviso }, paleta: { blue, green, … } | [hex…],
//          fontes: { titulo, texto, mao, mono, ui }, pesoTitulo, pesoTexto, caixaAlta, forma: { raio, traco, sombra } }
// textura: nenhuma | papel | giz | planta | noite
export function temaDaMarca(marca, textura = 'nenhuma') {
  const T = TEXTURAS[textura];
  if (!T) throw new Error(`textura "${textura}" does not exist. Use: ${Object.keys(TEXTURAS).join(', ')}`);
  const c = marca.cores || {};
  const bg = hex(c.fundo, 'fundo');
  const ink = hex(c.texto, 'texto');
  const dark = escuro(bg);
  const accent = hex(c.destaque, 'destaque');
  const surface = c.superficie ? hex(c.superficie, 'superficie') : dark ? mixColor(bg, ink, 0.08) : '#ffffff';
  const muted = c.apoio ? hex(c.apoio, 'apoio') : mixColor(bg, ink, 0.6);
  const base = dark ? SERIE_ESCURO : SERIE_CLARO;
  let serie = { ...base };
  if (Array.isArray(marca.paleta)) {
    const nomes = ['blue', 'green', 'yellow', 'purple', 'orange', 'teal', 'pink', 'red', 'gray'];
    marca.paleta.forEach((cor, i) => { if (nomes[i]) serie[nomes[i]] = hex(cor, `paleta[${i}]`); });
  } else if (marca.paleta && typeof marca.paleta === 'object') serie = { ...serie, ...marca.paleta };
  if (c.ok) serie.green = hex(c.ok, 'ok');
  if (c.erro) serie.red = hex(c.erro, 'erro');
  if (c.aviso) serie.yellow = hex(c.aviso, 'aviso');
  const f = marca.fontes || {};
  if (!f.titulo || !f.texto) throw new Error('the brand needs fontes.titulo and fontes.texto (the product fonts, from the reading)');
  const forma = marca.forma || {};
  const stroke = { ...T.stroke, ...(forma.traco ? { width: forma.traco } : {}) };
  const sombra = forma.sombra === false ? null : forma.sombra ?? T.shadow;
  const shadow = sombra === 'suave' ? { color: dark ? 'rgba(0,0,0,0.38)' : 'rgba(16,24,40,0.12)', blur: 30, y: 12 }
    : sombra === 'forte' ? { color: 'rgba(0,0,0,0.45)', blur: 34, y: 14 } : null;
  // O bloco de código e o terminal: uma superfície escura tirada da marca (no fundo claro, o texto escurecido).
  const codeBg = dark ? mixColor(bg, '#000000', 0.35) : mixColor(ink, '#000000', 0.25);
  const codeFg = dark ? ink : mixColor(bg, '#ffffff', 0.4);
  const S = SERIE_ESCURO;
  return {
    name: textura,
    textura,
    marca: marca.nome || '',
    dark,
    bg,
    ink,
    muted,
    surface,
    accent: 'accent',
    caixaAlta: !!marca.caixaAlta,
    colors: { accent, ...serie, ink },
    fonts: {
      display: { family: f.titulo, weight: marca.pesoTitulo ?? 700 },
      body: { family: f.texto, weight: marca.pesoTexto ?? 400 },
      hand: { family: f.mao || f.texto, weight: 400 },
      mono: { family: f.mono || f.texto, weight: 400 },
    },
    stroke,
    radius: forma.raio ?? T.radius,
    tintStrength: T.tintStrength,
    shadow,
    enter: { ...T.enter },
    transition: T.transition,
    sfx: { ...T.sfx },
    code: { bg: codeBg, fg: codeFg, comment: mixColor(codeBg, codeFg, 0.45), keyword: accent, string: S.green, number: S.yellow, fn: S.blue, punct: mixColor(codeBg, codeFg, 0.7), lineNo: mixColor(codeBg, codeFg, 0.35), highlight: withAlpha(accent, 0.2), border: dark ? mixColor(bg, ink, 0.2) : ink },
    terminal: { bg: mixColor(codeBg, '#000000', 0.15), fg: codeFg, prompt: accent, muted: mixColor(codeBg, codeFg, 0.6), bar: mixColor(codeBg, codeFg, 0.08) },
    caption: { bg: withAlpha(dark ? mixColor(bg, '#000000', 0.3) : ink, 0.86), fg: dark ? ink : bg, active: accent },
    fundo: marca.fundo || {},
  };
}

// Resolves a color name ("blue", "accent", "ink", "muted") or passes a CSS color through.
export function colorOf(theme, c, fallback) {
  if (c === undefined || c === null) return fallback === undefined ? theme.ink : colorOf(theme, fallback);
  if (c === 'accent' || c === 'destaque') return theme.colors.accent;
  if (c === 'ink' || c === 'texto') return theme.ink;
  if (c === 'muted' || c === 'apoio') return theme.muted;
  if (c === 'bg' || c === 'fundo') return theme.bg;
  if (c === 'surface' || c === 'superficie') return theme.surface;
  if (c === 'none' || c === false) return 'none';
  if (theme.colors[c]) return theme.colors[c];
  return c;
}

// A light fill for a color on light themes, a translucent one on dark themes.
export function tintOf(theme, c) {
  const base = colorOf(theme, c, 'accent');
  if (base === 'none') return 'none';
  if (theme.dark) return withAlpha(base, theme.tintStrength);
  return mixColor(theme.surface, base, theme.tintStrength);
}

export function fontString(theme, role = 'body', size = 48, weight) {
  const f = theme.fonts[role] || theme.fonts.body;
  const w = weight ?? f.weight;
  const fallback = role === 'mono' ? 'monospace' : 'sans-serif';
  return `${w} ${Math.round(size * 100) / 100}px "${f.family}", ${fallback}`;
}

// O fundo é sempre a cor de fundo da marca. A textura desenha por cima, uma vez só, nas cores da marca (o grão do
// papel é a tinta da marca a 5%, o quadriculado da planta é a tinta a 8%/20%, o brilho da noite é o destaque).
export function makeBackground(theme, W, H, seed = 1) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const rand = mulberry32(seed * 7919 + theme.textura.length);
  const noise = (count, alphaMax, color, sizeMax = 1.6) => {
    for (let i = 0; i < count; i++) {
      g.fillStyle = withAlpha(color, rand() * alphaMax);
      const s = 0.5 + rand() * sizeMax;
      g.fillRect(rand() * W, rand() * H, s, s);
    }
  };
  const fundo = theme.fundo || {};
  g.fillStyle = theme.bg;
  g.fillRect(0, 0, W, H);
  const luz = (x, y, r, color, a) => {
    const s = g.createRadialGradient(x, y, 0, x, y, r);
    s.addColorStop(0, withAlpha(color, a));
    s.addColorStop(1, withAlpha(color, 0));
    g.fillStyle = s;
    g.fillRect(0, 0, W, H);
  };
  switch (theme.textura) {
    case 'papel': {
      noise(Math.round(W * H * 0.05), 0.07, theme.ink);
      noise(Math.round(W * H * 0.02), 0.08, theme.dark ? theme.ink : '#ffffff', 2);
      g.lineWidth = 0.7;
      for (let i = 0; i < 90; i++) {
        g.strokeStyle = withAlpha(theme.ink, 0.04 + rand() * 0.04);
        const x = rand() * W;
        const y = rand() * H;
        const a = rand() * Math.PI;
        const l = 8 + rand() * 26;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rand() * 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, withAlpha(theme.ink, 0));
      v.addColorStop(1, withAlpha(theme.ink, 0.08));
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
      break;
    }
    case 'giz': {
      for (let i = 0; i < 26; i++) {
        const x = rand() * W;
        const y = rand() * H;
        const r = 80 + rand() * 320;
        const s = g.createRadialGradient(x, y, 0, x, y, r);
        s.addColorStop(0, withAlpha(theme.ink, 0.035));
        s.addColorStop(1, withAlpha(theme.ink, 0));
        g.fillStyle = s;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      noise(Math.round(W * H * 0.03), 0.06, theme.ink);
      break;
    }
    case 'planta': {
      const minor = Math.round(Math.min(W, H) / 34);
      g.lineWidth = 1;
      for (let x = 0; x <= W; x += minor) {
        g.strokeStyle = withAlpha(theme.ink, x % (minor * 5) === 0 ? 0.16 : 0.07);
        g.beginPath();
        g.moveTo(x + 0.5, 0);
        g.lineTo(x + 0.5, H);
        g.stroke();
      }
      for (let y = 0; y <= H; y += minor) {
        g.strokeStyle = withAlpha(theme.ink, y % (minor * 5) === 0 ? 0.16 : 0.07);
        g.beginPath();
        g.moveTo(0, y + 0.5);
        g.lineTo(W, y + 0.5);
        g.stroke();
      }
      noise(Math.round(W * H * 0.01), 0.04, theme.ink);
      break;
    }
    case 'noite': {
      luz(W * 0.12, H * 0.08, Math.max(W, H) * 0.6, theme.colors.accent, 0.1);
      luz(W * 0.92, H * 0.95, Math.max(W, H) * 0.55, theme.colors.purple, 0.08);
      noise(Math.round(W * H * 0.01), 0.05, '#ffffff');
      break;
    }
    default: {
      if (fundo.grade) {
        g.fillStyle = withAlpha(theme.ink, theme.dark ? 0.06 : 0.045);
        const step = fundo.grade;
        for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) g.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      }
    }
  }
  if (fundo.brilho) luz(W * 0.5, H * 0.32, Math.max(W, H) * 0.7, theme.colors.accent, fundo.brilho);
  return c;
}
