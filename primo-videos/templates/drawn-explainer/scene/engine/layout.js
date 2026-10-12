// explicação desenhada · onde o conteúdo pode ficar e onde a legenda senta.
// Portado do explainroo (https://github.com/vincentsch/explainroo, engine/layout.js, commit 5347905),
// MIT, © 2026 Vincent Schmalbach: licença em templates/drawn-explainer/LICENSE-explainroo.txt.
// Mudanças para a skill: as áreas seguras são as da skill (references/formats.md, as mesmas do areaSegura() do
// engine.js): no 9:16 de Reels/TikTok/Shorts o texto fica em x 70–940, y 250–1450; nos stories x 60–1020,
// y 250–1580; feed, app, 4:5 e 1:1 com 60 px; os horizontais (16:9, 19:9, 21:9) com 5%. Sem marca d'água.
const LINES = 2;

// Os formatos do molde (largura × altura), os mesmos do engine.js. 19:9 e 21:9 são horizontais com a altura do 16:9.
export const FORMATOS = { '16x9': [1920, 1080], '19x9': [2280, 1080], '21x9': [2520, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '4x5': [1080, 1350] };

// O retângulo seguro do formato, como o areaSegura() do motor da skill.
export function areaSegura(formato, plataforma, W, H) {
  const pl = plataforma && typeof plataforma === 'object' ? plataforma[formato] || null : plataforma || null;
  const m = (mx, my, nome) => ({ left: Math.round(mx), top: Math.round(my), right: Math.round(W - mx), bottom: Math.round(H - my), nome });
  if (formato === '9x16' && (pl === 'reels' || pl === 'tiktok' || pl === 'shorts')) return { left: 70, top: 250, right: 940, bottom: 1450, nome: `${pl}`, app: true };
  if (formato === '9x16' && pl === 'stories') return { left: 60, top: 250, right: 1020, bottom: 1580, nome: 'stories', app: true };
  if (pl === 'feed') return m(60, 60, 'feed (60 px)');
  if (pl === 'app') return m(60, 60, 'app (60 px)');
  if (pl === 'youtube') return m(W * 0.05, H * 0.05, 'youtube (5%)');
  if (W > H) return m(W * 0.05, H * 0.05, `${String(formato).replace('x', ':')} (5%)`);
  if (formato === '9x16') return { left: 70, top: 250, right: 940, bottom: 1450, nome: '9:16 (reels/tiktok/shorts)', app: true };
  return m(60, 60, `${String(formato).replace('x', ':')} (60 px)`);
}

// safe: onde as cenas põem conteúdo (o retângulo seguro com folga; acima da legenda quando ela está ligada).
// app: o retângulo seguro em si (a checagem acusa texto fora dele). captions/band: onde a legenda senta.
export function layoutAreas(config, W, H) {
  const area = areaSegura(config.formato, config.plataforma, W, H);
  const capSize = H > W ? 58 : 44;
  const capBoxH = Math.round(capSize * 1.3 * LINES + capSize * 0.55);
  let { left, right, top, bottom } = area;
  if (!area.app) {
    // Fora das plataformas verticais, o conteúdo respira mais que o mínimo legal: 7% como o motor original.
    const m = Math.round(Math.min(W, H) * 0.07);
    left = Math.max(left, m);
    right = Math.min(right, W - m);
    top = Math.max(top, m);
    bottom = Math.min(bottom, H - m);
  }
  let captions = null;
  if (config.captions) {
    const maxWidth = Math.min(right - left, W * (H > W ? 0.8 : 0.7) + capSize * 1.1);
    captions = { cx: (left + right) / 2, bottom: area.app ? area.bottom - 10 : H - Math.round(Math.min(W, H) * 0.06), maxWidth };
  }
  // livre: a mesma área sem descontar a legenda, para cena que não fala (a legenda não aparece nela)
  const livre = { x: left, y: top, w: right - left, h: bottom - top, left, top, right, bottom };
  let band = null;
  if (captions) {
    band = { left: captions.cx - captions.maxWidth / 2, right: captions.cx + captions.maxWidth / 2, top: captions.bottom - capBoxH, bottom: captions.bottom };
    bottom = Math.min(bottom, band.top - 24);
  }
  return {
    safe: { x: left, y: top, w: right - left, h: bottom - top, left, top, right, bottom },
    livre,
    captions,
    band,
    app: area,
  };
}
