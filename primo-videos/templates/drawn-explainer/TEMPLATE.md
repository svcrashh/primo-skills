# Template: drawn explainer

It explains a concept, a flow or "how it works" with drawing that is born on the word of the line: the box enters when the line
says its name, the arrow links one thing to another on the verb, the number counts on the "total", the hand-drawn stroke underlines what
matters. In the same template, the **interface demo**: the product's screen redrawn big, with the cursor that moves in a curve and
clicks, the field that types itself, the notice that pops up. It is the skill's 8th style.

The engine is a **port of [explainroo](https://github.com/vincentsch/explainroo)** (commit 5347905, MIT, © 2026 Vincent
Schmalbach; license in `LICENSE-explainroo.txt`, credit at the top of each file in `scene/engine/`), with
[Rough.js](https://roughjs.com) 4.6.6 (MIT, Preet Shihn) and the [Lucide](https://lucide.dev) 1.48 icons (ISC)
vendored in `scene/vendor/` with their licenses. Nothing comes from a CDN at render time. From the original engine came the drawing, the API
of the scenes and the interface kit; the voice, the soundtrack, the sounds, the mix, the brand, the safe areas and the render are the
skill's own.

## When to use
- **Teaching an idea, not where to click:** how the data moves, why the number comes out that way, what happens when the person
  pays, the stages of a process. The product may not even have a nice screen (API, infra, finance, B2B).
- An explanation for laypeople, conceptual onboarding, "what is this" before the tutorial.
- Website, help center, YouTube (16:9); phone held sideways, ultrawide monitor and big screen (19:9, 21:9); feed and LinkedIn
  (4:5, 1:1); Reels with the scenes stacked (9:16).
- A short interface demo in the middle of the explanation (the field, the button, the result), redrawn with the real media.

## When not to use
- A tutorial of where to click on the real screen: `real-screen-camera`.
- A list of new features: `rolling-list` or `chapters-with-index`.
- A product whose appeal is visual (game, fashion, photo): `before-after`, `light-trail-teaser`.
- A launch that feels like an event: `light-trail-teaser`.

## How it runs
The video is a queue of scenes (`roteiro` in `video.json`), each with a function of the same `id` in `scenes.js`. The function
draws the whole frame as a function of the time `s.t`, and each element enters at an `at`:

- **seconds** (`at: 1.2`), **a word of the line** (`at: 'Instagram'`; `s.cue('fila', 2)` for the second time) or
  **a marker** (`at: '#cola'`, with `"marcas": { "cola": "Cole" }` in the scene in `video.json`).
- **Without voice** (the default: no `voz` in `video.json`, or `--no-voice`): the scene lasts `min` (3 s) or the time it takes to read its
  `texto`, at 2.6 words per second. A scene that has `fala` also carries the `texto` (the same words), so it runs
  without the voice-over. The `at` words still apply: the same `scenes.js` serves both.
- **With voice** (optional and paid: "With voice (optional)", below): the scene uses a line of the `narration.json`,
  whole or an excerpt (`"fala": "c04", "de": 3.52, "ate": 6.4`, in seconds of the line, cut between words). It lasts
  `lead` (0.35 s before the voice) + the excerpt + `hold` (0.7 s; the last scene gets 1.4 s more), and each word enters
  at its time in `narration.json`. The excerpt cut, the voice on the video's clock and the caption come from
  `voice/narracao.mjs`.
- Whatever enters plays the texture's sound (below), and each sound becomes a **marker in the sync sheet**. The soundtrack and the effects
  are the skill's: `assets/audio/arrange_series.py` composes the bed in the identity's genre, the markers play the sounds of
  `assets/audio/sounds.py` at the exact sample. `verify.py` measures, `scripts/finalize.mjs` checks the delivery already in AAC.
- With voice, `mix_voz.py` makes the soundtrack give way before each line (`references/voice-mix.md`), and the caption is
  the line, the word lighting up on the voice's time, inside the safe area (`references/catalog/rules.md`,
  rule 4).
- A scene without voice has no caption; `"legenda": "texto"` shows the scenes' text, for the whole video without voice.

### The scene API (`s`)
Measurements are in the format's frame (1920×1080, 2280×1080, 2520×1080, 1080×1920, 1080×1350, 1080×1080); `x, y` is the center,
except where stated. The landscape formats (16:9, 19:9, 21:9) have the same height: write the layout in fractions of `s.safe`/`s.livre`
(or `s.W`) and it grows with the width, with no empty leftover space on the sides.

| Call | What it draws |
|---|---|
| `s.title(t, o)`, `s.subtitle`, `s.text(t, { x, y, size, font, color, enter, maxWidth, bg })`, `s.note` | text; `*word*` in the highlight color; `enter`: `write`, `type`, `words`, `sync` (word by word with the voice), `rise`, `pop`, `fade`…; the title follows the brand's all-caps setting |
| `s.box(label, { id, icon, color, w, h, shape })`, `s.circle({ id, r, label })` | box and circle, hand-drawn (Rough.js) or clean, with an icon; `fillStyle` `hachure`/`cross-hatch`/`dots` in the hand-drawn stroke |
| `s.arrow(from, to, { label, bend, dashed, head })`, `s.line`, `s.path` | arrow from one `id` to another (it stops at the edge), with a curve and a label; line and SVG path that draw themselves |
| `s.icon(name, { size, color, bg, label })` | the 1,854 Lucide icons; search with `node templates/drawn-explainer/icons.mjs <word>` (it also accepts common Portuguese words such as "dinheiro", "servidor"…) |
| `s.annotate(id or {x,y,w,h}, { type })` | hand-drawn annotation: `underline`, `circle`, `box`, `highlight` (highlighter), `strike` (strike-through), `cross`, `bracket` |
| `s.list`, `s.number(v, { prefix, suffix, dur })`, `s.bars`, `s.lineChart`, `s.pie` | a list that goes up one note with each item, a number that counts with a tick, bars, line and pie that draw themselves; the number in the language's format (7,199 in English, 7.199 in `pt-BR`) |
| `s.code(source, { lang, title })`, `s.terminal(['$ command', 'output'])` | code and terminal that type themselves, in the brand's colors |
| `s.camera([{ at, x, y, zoom }])` (first in the scene), `s.group`, `s.draw`, `s.burst` | camera, a group that enters together, free drawing on the canvas, confetti |
| `s.sfx(name, at, { gain, dur })` | a sound from `sounds.py` (`pop`, `tique`, `blip`, `rabisco`, `giz`, `brilho`, `baque`, `erro`, `clique`, `whoosh`, `sucesso`…) |
| `s.dados`, `s.marca`, `s.formato`, `s.vertical`, `s.horizontal`, `s.L({ '16x9': a, '9x16': b, padrao: c })`, `s.safe`, `s.cx`, `s.cy` | the `video.json` data, the brand, the current format and the safe area, to recompose each format. In `s.L`, 19:9 and 21:9 without their own key use the `16x9` value; 4:5 and 1:1 without a key, the `padrao` one |

### The interface demo kit (`s.ui`)
It draws the product's interface, big, in the brand's colors, fonts and logo; the real media (avatar, photo, logo) comes in
through `midia` in `video.json` (rule 15: never a still screenshot in a panel). Draw the cursor last.

| Call | What it draws |
|---|---|
| `u.backdrop()`, `u.floaters()` | the brand's background and blurred cards floating at the edges |
| `u.panel(x, y, w, h, { at }, fn)`, `u.card`, `u.browser(…, { url })`, `u.modal(…)`, `u.over(fn)` | a card that rises, a browser, a window over the darkened background, a layer on top (menu) |
| `u.toast(text, { at, tone, icon })` | the notice that pops up (`sucesso` sound) |
| `u.headline(t, x, y, { size, at })` | a title that enters word by word, coming out of the blur, with `*highlight*` |
| `u.input(…, { value, placeholder, focus, caret, icon })`, `u.textarea`, `u.typed(text, at, cps)`, `u.stream(text, at)` | a field with the typed text (typing sound) and the text cursor; an answer that comes out word by word |
| `u.select(…, { open, options, hover, selected })` | a menu that opens |
| `u.toggle`, `u.checkbox`, `u.radio` (0→1 animates), `u.chip`, `u.pill(t, x, y, tone)`, `u.button(t, …, { press })` | switch, checkbox, radio, chips, status badges, a button that sinks |
| `u.spinner`, `u.progress`, `u.avatar(…, { image })`, `u.icon`, `u.lines`, `u.logo(x, y, w, { montar })` | loading, progress, an avatar with the real photo, icon, text bars, the brand's logo; with the traced logo and `montar: at`, the letters rise one by one and the symbol drops into place with the `baque` |
| `u.cursor([{ at, x, y, arc }, { at, click: true }])`, `u.press(at)`, `u.wipe(at)`, `u.count(to, at)`, `u.pop(at, cx, cy, fn)` | the mouse that moves in a curve and clicks with a ripple (`clique` sound), the press, the brand color that fills the frame, the counter, anything that pops |

The drawn app follows the brand's surface: dark on a dark brand, light on a light one; `marca.ui` swaps any color
(`{ "escuro": false, "surface": "#ffffff", "text": "#141413" }` when the app is light and the video is dark).
What the demo wants to show (the field, the typed text, the badge, the notice) is ~80 px in the video, 16 px on a 390 px
player; if it does not fit, the camera dives into the field (zoom ~2) in 16:9.

## Parameters (`video.json`; the examples are the `example*.json` files)
- `nome`, `idioma` (the on-screen language: English by default, unless the briefing asks for another language; set it, because the
  engine falls back to `en-US`), `formatos` (`16x9`, `19x9`, `21x9`, `9x16`, `4x5`, `1x1`; each one recomposed by the
  scene itself; 19:9 and 21:9 with a 5% margin, like 16:9),
  `plataforma` (`reels`, `tiktok`, `shorts`, `stories`, `feed`, `youtube`, `app`, or per format), `cenas` (the file
  of the functions), `semente`.
- `marca` — **copied from the product reading, never a visual from the original engine**: `nome`; `cores` (`fundo`, `superficie`,
  `texto`, `apoio`, `destaque`, `ok`, `erro`, `aviso`, in hex); `paleta` (the series colors for charts and badges, by
  name `{ "blue": … }` or as a list); `fontes` (`titulo`, `texto`, `mono`, `mao`, `ui`: Google Fonts, downloaded into
  the build by `scripts/fonts.mjs`); `pesoTitulo`; `caixaAlta`; `forma` (`raio`, `traco`, `sombra`); `logo` (PNG/SVG, or
  the traced path in a JSON `{ "viewBox", "partes": [{ "d", "fill" }] }`, the format of the tutorial's `MARCA.logo`: sharp at
  any size and assembled piece by piece); `slogan` (the website's, copied as it is: `scripts/writing.mjs review`
  accepts text identical to it);
  `ui` (colors of the drawn app); `sino: false` for a brand that refuses bell sounds (`brilho` becomes `pop`, `sucesso`
  becomes `acento`).
- `textura` — on top of the brand's colors: `nenhuma` (clean stroke, pops in, `pop`/`whoosh` sounds), `papel`
  (hand-drawn stroke, paper grain in the ink color, draws itself in, `rabisco` sound), `giz` (chalk stroke, blackboard dust,
  `giz` sound), `planta` (technical blueprint line and grid, `rabisco`/`clique` sound), `noite` (clean stroke with
  glow, highlight-colored light). `transicao` swaps the texture's transition (`fade`, `slide`, `wipe`, `zoom`, `brush`, `cut` and the
  optional `push`, below);
  `boil` (redraws per second of the hand-drawn stroke; 0 = still).
- `roteiro` — the scenes in order: `{ id, fala, de, ate, texto, min, lead, hold, transicao, marcas }`.
- `voz` — optional, off by default: `{ "locucao": "<folder>/narration.json", "perfil": "calmo" | "reels" }` (the path
  relative to `video.json`; `perfil` is the mix profile, default `calmo`). Without `voz`, the video runs on the reading
  time of each scene's `texto` and the soundtrack is the lead.
- `trilha` — `{ "semente": N, "identidade": { … } }` (the audience's genre: `assets/audio/API.md`); without an identity, one
  per texture; `"trilha": false` leaves the video without the bed. `sons`: `true`, `"minimo"` (only the explicit sounds and the transitions) or
  `false`.
- `midia` — the list of images the scenes use (`s.image('media/foto.jpg')`, `u.avatar(…, { image })`); they are embedded.
- `legenda` — `"auto"` (with voice), `true`, `false` or `"texto"`; `legendaPeso`. `dados` — everything the scene writes
  (texts, numbers, names), so the same `scenes.js` serves another brand by swapping only the JSON.

## How to render
```sh
node templates/drawn-explainer/render.mjs <video.json> \
  --out ~/Desktop/explicacao [--formats 16x9,19x9,21x9,9x16,4x5,1x1] [--mode draft|final] [--no-voice] [--no-sound] \
  [--from 13 --to 18.5] [--check-only] [-- --sub 4 --workers 6]
```
- Out come `<output>/<name>-<format>[-draft].mp4` and the contact sheet `…-sheet.jpg` (24 instants, scene and time
  at the bottom). **Look at the contact sheet before showing it:** nothing empty, nothing cut, nothing illegible, something changing every 2–4 s.
- **Draft** (default): 30 fps, no motion blur, takes seconds. **Final** (`--mode final`): 60 fps with 8 motion-blur subframes
  through `scripts/render.cjs`; ~3–4 min per 20 s format on the M5. `--from/--to` renders only a segment
  (the sound is cut along with it; `finalize.mjs` only checks the whole video).
- Chromium is the one from `scripts/playwright.cjs`: on a Mac, drawing on the GPU (`--use-angle=metal --enable-gpu
  --ignore-gpu-blocklist`). The script prints `GPU (UNMASKED_RENDERER_WEBGL): …`; it must say Apple/Metal on a Mac. If it says
  SwiftShader (always, on Windows), the render comes out the same, just slower. Playwright not found: `PLAYWRIGHT_PATH=<folder>/node_modules/playwright`.
- **The refinement check runs on the build:** `node $SKILL/scripts/refine.mjs <output>/.work-<name> --channel <channel>` finds the MP4 with
  sound in the folder above (the newest between the final and the draft), takes the formats and the platform from the build
  (`out/assembly.json`, `params.js`) and, with voice, measures the build's voice-over (`voice/obra/narration.json`, the segments of each
  scene). The page check is left out: it cannot see the canvas, and the one in `render.mjs` already measured the text.
- Before the render, the **check** of each format: text out of frame, outside the skill's safe area (9:16 for
  Reels/TikTok/Shorts: x 70–940, y 250–1450), under the caption, overlapping, small (< 28 px in 16:9, < 34 px in
  9:16), with low contrast, and a scene that goes more than 4 s with nothing new. An error exits with code 4 at the end (the video comes out
  anyway, so you can see it). `--check-only` stops there.
- The build stays in `<output>/.work-<name>/`: `index.html?f=9x16&t=4.2` opens a frozen instant, `?play` plays without sound;
  `scripts/frames.cjs --project <build> --format 9x16 --check` also works on it. `audio/sheet.json`,
  `audio/verifica.log` and `marcos.json` show each sound and where it landed.

## With voice (optional)
Only when the person asks for a voiceover and the ElevenLabs key is set up (`references/voice-choice.md` §12): it is
paid, up to about 900 credits per minute of narration, checked against the video's cap before any call. Without `voz`
in `video.json`, nothing below runs and the video is the one above.

```json
"legenda": "auto",
"voz": { "locucao": "voice/v1/narration.json", "perfil": "calmo" },
"roteiro": [
  { "id": "pergunta", "texto": "What happens when you pay?" },
  { "id": "fluxo", "fala": "c1", "de": 0, "ate": 2.1, "texto": "The order goes to the kitchen." },
  { "id": "total", "fala": "c1", "de": 2.1, "texto": "The total adds up on its own." },
  { "id": "fecho", "min": 3 }
]
```

- **The voice comes before the render** (the template doesn't generate voice). Write
  `<video folder>/voice/v1/script.json` (`references/voice-script.md` §6) with one line per stretch of speech, `onde`
  `{ "capitulo": n }` in the video's order: the render reads only the `id`, through each scene's `fala`. Show the
  approval table (§5) and choose the voice (`references/voice-choice.md`) before spending, then
  `node $SKILL/scripts/voice.mjs generate <video folder>/voice/v1/script.json --out <video folder>/voice/v1` and
  `node $SKILL/scripts/voice.mjs listen <video folder>/voice/v1/narration.json --words "<risk words>"`. `voz.locucao`
  points to that `narration.json`.
- **One line can feed several scenes:** `de` and `ate` (seconds of the line) cut an excerpt between two words; without
  `ate`, the excerpt runs to the line's last word. A scene without `fala` is silent and runs on its `texto` or its
  `min`. The voice speaks about half the time, not the whole video (`references/catalog/rules.md`, rule 8): silent
  scenes between the spoken ones.
- **The voice sets the clock:** each spoken scene lasts `lead` + the excerpt + `hold` (per scene, or for the whole
  video in `ritmo`), and the `at` words and the `marcas` land when the voice says them. The render cuts each excerpt
  and measures its first sound, so the scene starts where the voice actually sounds.
- **The caption is the speech:** with `"legenda": "auto"` (the default) each spoken scene gets the caption, the word
  lighting up on the voice. The format examples set `"legenda": false`: change it when starting from one. A
  `<name>-<format>[-draft].srt` comes out next to each MP4 (not with `--from/--to`).
- **Sound:** `audio/voz.wav` and the `voz` block of `audio/sheet.json` (with `voz.perfil`) come out in the build; the
  soundtrack ducks under the voice (`mix_voz.py`) and the effects that are not gestures go down 6 dB under it
  (`references/voice-mix.md`). It aims at −14 LUFS and, if `verify.py` fails, recomposes at −16. `finalize.mjs` also
  checks each line on time and the voice standing out from what plays under it. Without the Python, or with
  `"trilha": false`, the video comes out with the voice only, at −16 LUFS.
- **No narration yet:** with `voz` and no `narration.json`, the render stops and says what to do; `--no-voice` renders
  the same video without voice, at reading pace.
- With the final MP4 (paid, a few credits):
  `node $SKILL/scripts/voice.mjs listen --mix <mp4> --script <output>/.work-<name>/voice/obra/narration.json --project <video folder>`
  (`references/voice-mix.md` §6). The build's narration has exactly the excerpts that play in the video.

## Variations that come out with parameters alone
- **Hand-drawn whiteboard** (`textura: papel`, `nenhuma` for the clean one), **blackboard** (`giz`), **technical blueprint** (`planta`),
  **night** (`noite`): the same scene, five textures, always in the brand's colors.
- **Flow with arrows:** boxes in the order of the line, arrows on the verb, an annotation at the point that matters.
- **Drawn before and after:** the old way crossed out (`annotate strike`) and the new one entering in its place.
- **The number explained:** the number counts, the bars or the pie show where it comes from.
- **Code or terminal that types itself** for a technical product (API, CLI), in the brand's colors.
- **Explanation + demo:** the drawn scenes explain, one `s.ui` scene shows the product doing it.
- **Without voice** (the default): the same video timed by duration (no `voz` in the JSON, or `--no-voice`).
  **With voice:** the same `scenes.js`, timed by the lines ("With voice (optional)", above).

### Optional (off by default)
- **Clean push** (`"transicao": "push"`, in the scene or in the whole JSON): the two scenes move together to the left,
  with no shadow and no darkening (`slide` stacks a card with a shadow: `push` is for a brand that uses no shadow). A `whoosh` sound in the middle, like the
  others. Duration via `"ritmo": { "transicao": 0.5 }` (the default is 0.7 s). No texture uses `push` on its own: it only comes in
  when asked for. Text that crosses the edge during the push becomes a "só de relance" (just a glimpse) warning in the refinement check (safe area), not an error.
- With no new option, only in `scenes.js` (see the examples below): **split layout with tracking** (the panel
  fixed and the wall of pieces moving `v` px/s beneath it) and **guided camera with a dive** (`s.camera` pulls back on the
  first topic, breathes, and at the end goes into the frame until its color fills the screen; the next scene is born from that color with
  `"transicao": "cut"`; leave less than 0.3 s of plain screen, or the refinement check flags an empty frame).

## The examples
Three format examples, without voice and with no brand: greys, placeholder texts and the placeholder logo, symbol,
icon, illustration and photos of `assets/example/`, pointed to directly, in Inter (`node scripts/example-fonts.mjs
<output>/.work-<name>` before the render puts it in the build, so no network is needed). They show the parameters and
the structure; the brand and the content are the person's. By default the video closes with the brand's logo; a
sentence or a slogan only when the brand has one and the person wants it.
- `example.json` + `example-scenes.js`: a cover in the brand color with the giant symbol, a content scene with
  three flat cards, hard cut, closing with the logo; 16:9 and 9:16.
- `example-counts.json` + `example-counts-scenes.js`: four counting numbers (sample values: 128 items, 24 features,
  256 photos, 12 page layouts), split layout, tracking on the wall of pieces, `push` between the scenes, stacked shapes
  in the opening, fast pace, house 124; 16:9.
- `example-pull-back.json` + `example-pull-back-scenes.js`: a single frame that takes six formats in the right
  aspect ratio, full screen, guided camera that starts close and pulls back, dive between the scenes, plain background,
  calm pace, acoustic ~90; 16:9.
```sh
node scripts/example-fonts.mjs <output>/.work-drawn-explainer-example-counts
node templates/drawn-explainer/render.mjs templates/drawn-explainer/example-counts.json --out <output> --formats 16x9
node scripts/refine.mjs <output>/.work-drawn-explainer-example-counts --channel site
```

## Limits
- **No 3D and no recorded video inside the scene:** the real screen in motion belongs to `real-screen-camera`; here the interface
  is redrawn (`s.image` accepts a photo or a screenshot, still, with Ken Burns).
- **The check reads text:** arrows, shapes, icons and what is drawn with `s.draw` are not part of it; look at the contact sheet.
- **One sound per moment:** the markers are thinned out (the same sound less than 0.12 s apart is dropped; at most three every 0.5 s), and
  with voice, under the line, the effects that are not gestures (`pop`, `tique`, `blip`, `toque`, `clique`, typing) drop 6 dB
  (mix_voz). Long typing: `u.typed(…, { gain: 0.3 })`.
- The list's `blip` goes up one note with each item, through the `passo` the template sends (a second list starts again from the tonic). It
  and the `brilho` play on the soundtrack's tonic (`arrange_series.py` tunes them; the sheet's `tonica` key is kept in reserve).
- The caption breaks into up to two lines; a long line (`fala`) becomes several captions in a row.
- The title and `u.headline` in all caps follow `marca.caixaAlta`; `caixa: false` in a call turns it off.
- Fonts come from Google Fonts on the first build (network); after that they stay in the build.
