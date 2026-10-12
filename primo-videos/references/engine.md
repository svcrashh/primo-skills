# Engine (`engine.js`)

> The `drawn-explainer` template uses another engine (canvas, a port of an open engine, MIT): its API (`s.box`, `s.arrow`,
> `s.annotate`, `s.ui`…) is in `templates/drawn-explainer/TEMPLATE.md`. This file is the `engine.js` (HTML/SVG).

## Contents
1. How the engine works
2. API
3. Scene recipes
4. Pitfalls (each one has already cost time)

---

## 1. How the engine works

- Each scene is plain HTML/SVG. `cena(t0, t1, build)` registers the scene. `build(root)` builds the DOM **once** and returns `update(t)`, which only adjusts transform, opacity and attributes from the time `t`.
- `renderAt(t)` turns on the scenes active in `[t0, t1)` and calls their `update`. Scenes can overlap in time; the one registered later goes on top.
- The render (`render.cjs`) opens N Chromium tabs, calls `renderAt(t)` in each one and captures frame by frame, sending everything to ffmpeg. With no clock, no CSS animation and no unseeded randomness, the result is identical on every render. That is what allows motion blur through subframes.
- Format through the URL: `index.html?f=9x16`. `W`, `H`, `CX`, `CY` and `VERTICAL` already come right, and `L({ '16x9': a, '9x16': b })` picks the value per format.
- Live preview: `index.html?play` plays with the soundtrack (`VIDEO.audio`); space pauses, ←/→ skips 1 s. `index.html?t=12.5` opens frozen at an instant.
- Load order: `video.js` (configuration) → `brand.js` (brand) → `engine.js` → `scenes.js` → `iniciar()`. `start` waits for the fonts in `VIDEO.fontes`, builds all the scenes visible (so it can measure) and only then hides them.

## 2. API

**Time and easing**
- `P(t, a, b)`: 0→1 progress, clamped.
- `E.outExpo`, `E.inOutCubic`, `E.outBack(x, s)`, `E.inExpo`…: easings.
- `spring(dt, f, z)`: 0→1 spring with overshoot. Use `f` 1.3–2.8 and `z` 0.35–0.6.
- `pulse(dt, amp, f, d)`: a scale that starts at 1+amp and settles.
- `wob(dt, f, d)`: damped oscillation starting from 0 (squash, shake).
- `bez(x1, y1, x2, y2)` (also `E.bez`) is a real cubic-bezier, the same as in CSS and After Effects. Use it when the brand manual gives the curves: `const acende = bez(0.16, 1, 0.3, 1)`.
- `lerp`, `clamp`, `rng(seed)` (seeded random), `mix(hexA, hexB, t)`, `rgba(hex, a)`.

**DOM**
- `el(tag, props, parent)` and `sv(tag, attrs, parent)` create HTML and SVG.
- `svgQuadro(parent)` creates an SVG the size of the frame.
- `camada(root, fundo)` creates a full-screen div with a background, inside the root. That is where the transitions act, and the root stays without a background.
- `place(e, x, y, w, h)`, `T(e, transform)`, `O(e, opacity)`.
- `rectOf(e)` and `centrarX(e, x)`: measure at build time, before transforming.

**Text**
- `textLine(parent, [{t, style}], style)` → `{ line, words, chars }`: one mask per word and one span per letter. The line already comes out marked as a target of the collision check (`data-colisao="texto"`).
- `bloco(parent, [[parts], [parts]], { top, entrelinha, style, alinhar, x })` builds several centered lines. `palavras(ls)` and `letras(ls)` gather the words and letters of the lines.
- Entrances and exits: `riseWords(words, t, t0, stagger, dur)`, `riseChars(...)`, `exitWords(...)`, `quedaLetras(words, chars, t, t0)`.
- `digita(chars, t, t0, t1)` reveals letter by letter; `conta(el, t, t0, t1, de, ate, casas)` makes the number count.

**Stroke and shapes**
- `traco(path)` → `p => …`: draws a path from 0 to 1.
- `STAR`: a unit 4-point star (scale it via transform).
- `makeBlob(parent, size, cor, corDoTraco?)` and `breathe(blob, t, x, y, escala, rot, formaA, fase, cor?, opacidadeTraco?)`: organic shapes that breathe in the corners.
- `FORMAS`: uses `MARCA.formas` if there are any, otherwise procedural shapes. `formaOrganica(seed)` generates others.
- `samplePath`, `alignPts`, `ptsToPath`: generic morph between any two paths (resamples to 96 points).

**Photos and recordings**
- `imagem(parent, src, style)` creates an absolute `<img>`, and the engine waits for the image to decode before the first frame.
- `kenBurns(img, t, t0, t1, [escala, x%, y%], [escala, x%, y%])` does a slow zoom and pan between two framings.
- `camera(chaves, { cw, ch, vw, vh, zmax })` → `cam(t) = { x, y, z }` is the keyframe-guided camera over a `cw×ch` content seen through a `vw×vh` window.
  - Each key is `{ t, x, y, z, dur?, ease? }`: at instant `t`, the camera is centered on `(x, y)` of the content, with zoom `z` (1 = the content covers the window). `dur` is how long it takes to get there (default 0.7 s); the default easing is `E.inOutCubic`, and the zoom is interpolated on a logarithmic scale.
  - The zoom is held within `[1, zmax]` and the center is locked, so the window never shows outside the content.
  - `zmax` = source resolution ÷ size on screen; above that the image softens.
- `aplicarCamera(el, cam, t)` applies the camera to an element (with `transformOrigin 0 0`) that contains the `cw×ch` content and returns `{x, y, z}`.
- `clipe(parent, arquivos, fps, style)` → `{ el, set(t, t0) }` shows a video segment frame by frame, deterministically. Extract it first with `ffmpeg -i gravacao.mp4 -vf "fps=30,scale=1080:-1" media/clipe/q%04d.jpg`. Keep the segments short (≤ 5 s, ~150 frames) and at the resolution they will appear at: everything stays in memory.
- `sequencia(parent, [[arquivo, tempo], …], style)` → `{ el, set(tv) }` is for long sequences (recorded screen, hundreds of large frames). It is a single `<img>` that swaps files according to time: `set(tv)` shows the last frame with time ≤ `tv`. The decoding goes into `ESPERA_QUADRO`, and `renderAt(t)` returns a Promise that the render and `frames.cjs` wait for before capturing. Nothing stays in memory besides the current frame.
- The `<video>` tag does not work for the render: its time is not deterministic.

**Logo**
- `logoPartes(g, MARCA.logo.partes)` → animatable parts.
- `medirPartes(ps)`: call it after building the SVG.
- `setParte(q, dx, dy, rot, sx, sy)` moves the part around its own center, in viewBox units.
- `pontoInterno(path)` → `{x, y, r}`: the "fattest" point inside a shape, to dive the camera into it.

**Transitions** (catalog, durations and sounds in `references/transitions.md`)
- `TR.<name>.sai(camada, t, t0, dur, opts)` in the update of the scene going out and `TR.<name>.entra(camada, t, t0, dur, opts)` in the update of the scene coming in. The two scenes overlap in `[t0, t0+dur]`.
- The names are `whip` and `push` (with `dir`), `zoom` (`x, y, raio`), `mascara` (`forma`: `'circulo' | 'diagonal' | 'barras' | 'lamina'`), `virada` (`tipo`: `'cartao' | 'pagina'`) and `morph` (`de`: a measured rectangle or a path).
- Always call it, without an `if`. The layer belongs to the transition: the engine restores its `transform`, `filter`, `clip-path`, `opacity`, `display` and `z-index` on every frame.
- `TRANSICOES` is the `{ nome, t0, dur }` list that the calls register. A hand-made transition registers itself with `registrarTransicao(nome, t0, dur)`. `tocar(el, prop, valor)` writes a style that goes back to the original on the next frame.

**"Is there something in front?" check**
- `marcar(el, tipo, nome?)` marks a target, with `tipo` `'texto' | 'logo' | 'legenda'`. `textLine`/`bloco` already mark each line. Mark logos (`marcar(svg, 'logo', MARCA.nome)`), `conta` numbers and captions. `marcar(el, false)` unmarks, for decorative text that passes underneath on purpose (a giant background word, for example).
- `checarQuadro(t)` (on `window`, it is async) returns `[{ tipo: 'colisao' | 'area', t, msg, … }]` and leaves the page rendered at `t`. Each target that is **still** (the rectangle moves ≤ 2 px until `t + 1/30`) and **opaque** (effective opacity ≥ 0.9) is tested in two ways:
  - **Coverage:** a 5×3 grid of points with `elementsFromPoint`. Counted as coverage: a painted SVG shape, `img`/`canvas`/`video`, HTML with a background of alpha ≥ 0.35, a background image or gradient, and text from another element. The grain, the root `<svg>`, elements with opacity < 0.05 and HTML with no paint at the point do not count, and a clipped point (mask, `clip-path`) is left out of the count. It is an error if ≥ 20% of the points are covered. Inside the window of a registered transition, coverage is not flagged.
  - **Safe area:** the rectangle has to fit in `areaSegura()`, which comes from `VIDEO.plataforma` (see `formats.md`).
- The target's rectangle is what it **shows**: the visible letters clipped by the mask, the shapes of an SVG or the text of an HTML element. It is not the whole box.
- Who runs the check: `frames.cjs` on every frame, `frames.cjs --check` over the whole timeline, and the `--auto` sheet that the draft generates. The messages come out like this: `COLLISION t=3.20 s: text "No more spreadsheets." covered by div (background #FF6B4A) at 40% of the points` and `SAFE AREA t=…: text "…" leaves the reels safe area (y 1520 > 1450)`.

**Camera and frame**
- `iris(el, r, x, y)` clips to a circle.
- `raioCobre(x, y)`: the radius that covers the frame from (x, y).
- `VIDEO.impactos = [[t, intensidade]]` generates an automatic shake.
- `VIDEO.selo` puts the small symbol on top in the inner scenes.
- `VIDEO.grao` controls the grain.

## 3. Scene recipes

Skeleton:
```js
cena(4.0, 10.0, (root) => {
  root.style.background = MARCA.cores.escuro
  const ls = bloco(root, [[{ t: 'Planilha' }], [{ t: 'nunca mais.', style: { color: MARCA.cores.acento, fontStyle: 'italic' } }]],
    { top: L({ '16x9': 380, '9x16': 760 }), entrelinha: L({ '16x9': 170, '9x16': 180 }), style: { font: `800 ${L({ '16x9': 150, '9x16': 140 })}px "Fonte"`, color: '#fff' } })
  return (t) => {
    riseWords(palavras(ls), t, 4.0, 0.08)
    exitWords(palavras(ls), t, 9.7)
  }
})
```

**Dive into a shape of the logo (zoom-through):**
```js
const alvo = partes[2].p, best = pontoInterno(alvo)          // in viewBox units
const k = alturaPx / alturaViewBox                             // px per unit
const fx = svgLeft + (best.x - vbX) * k, fy = svgTop + (best.y - vbY) * k
const zmax = (1.12 * raioCobre(fx, fy)) / (best.r * k)
// in the update: camera = container with transformOrigin '0 0'
const z = Math.exp(Math.log(zmax) * E.inCubic(P(t, 3.45, 3.97)))
T(cam, `translate(${fx}px,${fy}px) scale(${z}) translate(${-fx}px,${-fy}px)`)
```
At the exact end time, a hard cut to the next scene, with the background in the shape's color or a strong contrast on the downbeat.

**Logo pieces arriving on time, with a guide outline:** first draw the outline of each part with `traco` (thin stroke, opacity 0.4). Each part comes in from outside the frame along an arc: `pos = off*(1-e) + normal*sin(πe)*0.22*|off|`, with `e = E.inOutCubic(P(t, L-0.58, L))`. It arrives exactly at the music's time `L` and gets squash with `wob(t-L, 3.2, 7)`, plus a ripple (a stroked circle that grows and fades) at the center of the part.

**Strike and swap:** a coral stroke over the sentence (`traco` in 0.22 s). Then `quedaLetras` on the old letters, and the new sentence rises with `riseChars(..., E.outBack)` over a pill that grows with `scaleX` from 0 to 1 (`transformOrigin: 0 50%`). Safe timings in a 2 s bar: sentence at T, strike at T+0.5, fall at T+0.75, new one at T+1.0, exit at T+1.85.

**Pill or card that becomes the screen:** animate `left/top/width/height` of the measured rectangle up to `0, 0, W, H` with `E.inOutCubic`. The radius goes from `h/2` to 0 with `Math.pow(x, 3)`, so it stays rounded until the end. The color goes to the background of the next scene.

**Iris from something meaningful:** measure the source element (`rectOf`) and, in the next scene, do `iris(root, raioCobre(cx, cy) * E.inOutCubic(P(t, a, b)), cx, cy)`. To invert the text color in the middle of the iris, put a copy of the text in the new scene (with the other color), in the same position.

**Whip-pan, push, iris, wipe, blade wipe, flip and morph:** these are now `TR.*` (`references/transitions.md`). Build by hand only what the catalog does not have.

**Keyframe-guided Ken Burns (photo, screenshot or recorded screen):** the camera follows the action instead of a fixed zoom.
```js
const FOTO = [4000, 2667]                                    // source resolution
cena(10, 16, (root) => {
  const cam = camada(root, '#000')
  const conteudo = el('div', { cls: 'abs', style: { width: px(FOTO[0]), height: px(FOTO[1]) } }, cam)
  imagem(conteudo, 'media/foto.jpg', { width: px(FOTO[0]), height: px(FOTO[1]) })
  const cmr = camera([
    { t: 10.0, x: 2000, y: 1333, z: 1 },                     // opens on the whole
    { t: 12.0, x: 2750, y: 870, z: 1.8, dur: 1.2 },          // reaches the detail at 12.0 (on the beat)
    { t: 14.5, x: 1500, y: 1650, z: 1.4, dur: 0.9 },         // travels to the second point
  ], { cw: FOTO[0], ch: FOTO[1], vw: W, vh: H, zmax: Math.min(FOTO[0] / W, FOTO[1] / H) })   // 2.08: above this it softens
  return (t) => { aplicarCamera(conteudo, cmr, t) }
})
```
The keys fall on the grid: the key's `t` is when the camera **arrives**, so what moves during the previous beat is the `dur`. On a recorded screen, swap `imagem` for `sequencia(conteudo, quadros)` and call `.set(t - inicio)` in the update.

**Collapse into dots:** each panel animates `w/h` to ~130 and `borderRadius` to 65. Then they all go to the center along arcs and vanish, while a circle in the next scene's color grows from the center up to `raioCobre`.

**3D flip of a card INSIDE the scene** (the whole screen flipping is `TR.virada`): a container with `perspective: 2400px`, inside it a flipper with `transformStyle: preserve-3d`, and two faces with `backfaceVisibility: hidden` (the back with `rotateY(180deg)`). Animate `rotateY(180*e)` with a slight `scale(1+0.07*sin(πe))`.

**Particle dissolve:** each letter gets staggered `translateY`, `blur` and opacity. From each letter, 6–8 round divs are born with a seeded velocity (`rng`), which rise and fade in 0.9 s.

**Choreographed product UI:** build the screen with the app's tokens (background, card, border, radius, font). The "finger" is a semi-transparent circle that travels a curve between the targets measured with `rectOf`. On the tap: the finger shrinks to 0.8, the option does `scale(.97)`, a ripple appears and the state changes. A stopwatch can prove "in under 1 minute".

**Shock ring and confetti on the final impact:** a stroked circle grows up to `raioCobre`, with thickness 16→0.5 and opacity 1→0 in 0.7 s. The confetti is 30–40 seeded shapes with `dist = v/k*(1-exp(-k*t))` and gravity `420*t²`, which shrink at the end.

**Charts:** for a line, use `traco` on the path and points with staggered `E.outBack`. In a radar, the vertices come from `R*v[k]`; the values morph with a `spring` per axis, staggered by 0.02 s. For bars, `scaleY` with `transformOrigin: 50% 100%`.

## 4. Pitfalls (each one has already cost time)

- **Measuring too early:** measure (`rectOf`, `getBBox`, `getTotalLength`) only after the fonts load and with the scene visible. `iniciar()` already guarantees this inside `build`. A measurement taken in `update` after transforming comes out wrong.
- **The mask clips what should come out:** a letter that falls or flies needs `mask.style.overflow = 'visible'` (`quedaLetras` already does this).
- **A font that did not load:** the render comes out in the fallback font without telling anyone. The scripts print `FONT DID NOT LOAD`; read the output. A latin subset without `unicode-range` also breaks accents (`fonts.mjs` already takes care of this).
- **Mixing colors between distant hues** passes through brown or gray: swap the color in the middle of a scale "pop".
- **A full-screen flash** turns gray in the middle of the fade: use a shock ring or a hard cut.
- **An iris or expansion that does not cover:** compute the radius with `raioCobre(x, y)`, not with half the diagonal (the center is rarely the point of origin).
- **`clip-path` and `transform` on the same root:** it works, but the camera shake (`VIDEO.impactos`) applies `transform` to the root. Do not use `root.style.transform` in the scene; put a wrapper inside.
- **Text too wide in 9:16:** measure and break it into lines (`bloco`) or reduce the size. Never let the text leave the safe area.
- **`Math.random`, `Date.now`, CSS animation and `transition` in the scenes** break determinism: one subframe diverges from the other and the motion blur turns into a ghost. Use `rng(seed)` and only the time `t`.
- **Many elements with `filter: blur()`** make the render slow; limit it to what is on screen at the moment.
- **Hard cut and motion blur:** the shutter window starts at the frame's instant, so the cut at T lands clean on frame T. Do not shift the window.
- **Video and music out of sync:** the source of truth is `sheet.json`. A time changed in `scenes.js` without changing the sheet leaves the soundtrack out of place.
- **A root with a background in a scene with a transition:** the root's background does not move with the layer and covers the other scene. The engine prints `TRANSITION …: the root of scene … has its own background`. The background goes in `camada(root, cor)`.
- **A transition inside an `if`:** the transition must be called on every frame. Inside an `if`, the layer keeps its last state and the registration for the `--auto` sheet fails. The engine already runs one update of each scene at its start, to register everything.
- **Grain and badge vanishing on a page flip:** the engine raises the `z-index` of the scene that flips, and that is why the grain (`z-index` 20) and the badge (19) stay above. If you touch a scene's `z-index`, stay below 19.
- **Steps in the motion blur of very fast edges** (blade wipe, vertical whip): with 8 subframes, each one moves ~16 px and the edge comes out stepped. Render that segment with `--sub 16`.
- **`elementsFromPoint` only sees inside the viewport:** `checarQuadro` needs a page the size of the frame. `frames.cjs` already opens it that way. On a page with a smaller viewport, the check sees nothing.
- **Safe-area false positive in 9:16:** a centered title in 9:16 fits reels only if it is at most 800 px wide, because the button strip starts at x 940 and the center is at 540. Reduce the size or break the line; do not unmark the text.
