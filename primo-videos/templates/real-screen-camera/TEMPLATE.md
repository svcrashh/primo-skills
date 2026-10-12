# Template: real screen with camera (tutorial)

A tutorial of 3 to 8 steps with **the real recorded screen**: the camera zooms and slides to the current field, the rest
gets a scrim and blur, a card states the step, a 2–3 word intertitle separates the stages and the video closes
on a "Done!". It combines the style cards *from notebook to detail*, *camera that roams the UI*, *real screen with step
card* and, in 9:16, *lightning tutorial with karaoke captions* (catalog, section 3, template 1).
Without voice, the skill's soundtrack is the protagonist, with a click on each tap, and the step card carries the text.

## When to use
- Teaching **one task** the person will repeat: "how to send the link", "how to build the basket", "how to register
  a student". Help center, YouTube, WhatsApp (9:16), inside the app.
- A computer product (dashboard, SaaS, site) where the whole screen would be illegible: the camera solves it.
- Lay audience: the card carries the whole sentence of the step, at a calm pace.

## When not to use
- Announcing something new or selling: there is no hook (use *rolling list*, *chapters with index*, *typing text*).
- A flow with more than 8 steps: split it into videos.
- Event big screen or feed with no sound and no patience: a tutorial does not work there.
- An app that only exists on the phone and a screen that already fits legibly: the skill's tutorial mode
  (`references/tutorial.md`) with a phone mockup frame is enough.

## What the video looks like (timeline)
| part | what you see |
|---|---|
| 0 → `abertura` (1.8 s) | **frame 0 already with the promise**: label + large title over the screen under the scrim; the opening line starts at 0.25 s with a karaoke caption |
| +1.0 s | wide shot: the whole screen in a browser mockup frame (only to set the scene; no text cited here) |
| each step | the "Step N of M" card + sentence comes in; the camera reaches the field **a little before the tap** (zoom 1.9–3.3× in 16:9, 3–3.3× in 9:16), scrim + blur outside the field, thin outline in the highlight color, cursor and tap ring |
| between stages | 2–3 word intertitle alone on the brand background (1.1 s, hard cut) |
| scroll | the focus moves down/up along with the page |
| success | the camera opens on the result (`g.sucesso(alvo)`) |
| end | a circle in the end color grows from the last field: logo, "Done!", support line, closing line with caption |

16:9: card on the left, field centered in the free area on the right. 9:16: card at the top (inside the Reels safe
area), field in the middle, karaoke caption at the bottom. Both are **recomposed** from the same computer
recording (not one cropped from the other). 1:1 is not asked for by the style card and was not made.

19:9 (2280×1080) and 21:9 (2520×1080): the 16:9 recomposed by width. The card stays on the left margin (the text at
5% + 16 px), with the 16:9 width and type sizes; the free area, where the camera centers the field, and the strip the
zoomed screen covers run from the card to the right edge, so the extra width becomes screen (the zoom on the field goes
up a little, up to the recording's ceiling: DSF × 1.1). Opening, intertitle, "Done!" and wide shot stay centered. The
wide shot is limited by the height and keeps the same width as in 16:9, with background on both sides. A per-format
title (`titulo: { "16x9": [...] }`) applies to both.

## Flow
1. **Record** with the skill's recorder (`scripts/tutorial/record.mjs`, contract in `references/tutorial.md`):
   `versoes: ['computer']`, `aparelhos: { computer: { viewport: { width: 1280, height: 800 }, dsf: 3 } }`
   (DSF 3 = 3840×2400: allows zoom of up to ~3× without softening). One `g.passo('frase')` per step — **the card
   sentence is the step's caption** — and `g.sucesso(alvo)` at the end. Raw recording of 8 to 14 s for a 12–20 s video.
   On a real account, intercept the metrics calls (`p.route(/analytics|record_device/, r => r.abort())`) and do not
   save anything.
2. **Sound**: without voice, the skill's soundtrack is the protagonist, with a click on each tap, the keys on each
   typing, a whoosh on the intertitle and the "success" sound on the Done! (declare `trilha.identidade`, the audience's
   genre).
3. **Parameters**: copy an example and change it. Start from `example.json` (card on the left, hard cut; the
   recorded journey is in `example-journey.mjs`), from `example-card-right.json` (card on the right, push,
   diamonds) or from `example-card-below.json` (bottom strip, mask, tracking, giant symbol), each with its own
   `-journey.mjs`. All three are format examples (greys, placeholder texts and the placeholder logo, no brand:
   they show the parameters, not a finished video) and record the neutral sample page that ships with the skill,
   `assets/example/page.html` (`--page <path>` records another copy of it, `--folder <path>` records elsewhere).
   Recording, fonts and videos go to `~/Documents/VideoStudio/examples/real-screen-camera[-card-right|-card-below]/`:
   change `gravacao`, `saida` and `marca.fontesPasta` in the JSON to use another place. For the examples' font, with
   no network: `node scripts/example-fonts.mjs <that folder>`.
4. **Build and render**:
   ```sh
   node templates/real-screen-camera/assemble.mjs meu.json --no-render     # only builds the project (seconds)
   node scripts/frames.cjs --project <output>/<id>/proj --times 0.1,4,9 [--format 9x16]   # look at loose frames + check
   node templates/real-screen-camera/assemble.mjs meu.json                   # 30 fps draft, the json's formats
   node templates/real-screen-camera/assemble.mjs meu.json --mode final      # 60 fps with motion blur, with sound
   ```
   Outputs `<output>/<id>-<format>.mp4` and `<output>/<id>-<format>-sheet.png`. **Look at the contact sheet** before
   delivering. If Playwright is not found: `PLAYWRIGHT_PATH=<…>/node_modules/playwright`.

## Parameters (`example*.json`)
| field | what it is |
|---|---|
| `id` | name of the output files |
| `gravacao` | the recorder's `output/<version>` folder (events.json, frames.json, frames/) |
| `saida` | where to write the project and the videos |
| `formatos` | `["16x9", "9x16"]`; also accepts `"19x9"` and `"21x9"` |
| `titulo` | lines of the opening title: a list, or `{ "16x9": [...], "9x16": [...] }` to break them differently (19:9 and 21:9 use `16x9` if they do not have their own) |
| `rotulo` | small line above the title ("Brand · step by step") |
| `textoPasso` | the card label, with `{n}` and `{N}` ("Step {n} of {N}" in English) |
| `endereco` | domain in the bar of the browser mockup frame (domain only) |
| `etapas` | `[{ "passos": [1,2] }, { "intertitulo": "The answer", "passos": [3,4] }]` — intertitle before the stage |
| `passos` | optional: `{ "2": { "frase": "…" } }` changes the card sentence without re-recording |
| `fim` | `{ "linha": "Done!", "apoio": "…" }` (`apoio`: the short line below, like the help address) |
| `trilha` | without voice: `semente` and `identidade` (the audience's genre, v2 schema from `assets/audio/API.md`); without `identidade`, a neutral one comes out |
| `marca.cores` | `fundo`, `superficie` (card, mockup frame, caption background), `texto`, `destaque` (label, outline, cursor, spoken word), `sobreDestaque`, `veu` (scrim color), `fimFundo`, `fimTexto` |
| `marca.veu` | scrim opacity (0.6 on a dark brand; ~0.4 with a dark scrim over a light brand) |
| `marca.textura` | `pontos` or `liso` |
| `marca.fontesPasta` | folder with `fonts.css` and local woff2 files (generate it with `scripts/fonts.mjs`) |
| `marca.fontes` | `titulo { familia, peso, caixa: alta|normal }`, `texto { familia, peso, pesoForte }`, `mono { familia, peso }` |
| `marca.logo` | `{ arquivo, w, h }` (PNG or SVG), on the final card |
| `fim.soLogo` | optional: the end is just the logo, centered, without "Done!" or the support line |
| `marca.plano` | optional: flat color (no shadow), labels in normal case and a little larger, opening on a flat background, camera that breathes in the opening and in the wide shot, card coming in together with the scrim, and scrim leaving smoothly under the iris |
| `textoFora` | optional: no text over the recorded screen. The two copies of the screen and the outline are clipped `folga` px (24) from the card's edge in every frame, including in the zoom and while the card comes in and leaves; the screen disappears behind the intertitle (and behind the flat opening of `plano`); the screen is marked as an image and `video.js` comes out with `texto: 'fora-da-imagem'`, so `scripts/frames.cjs --project <proj> --check` fails text that crosses the screen |
| `marca.cores.rotulo` | optional: the color of the labels (default: `destaque`), for when the highlight over the surface is not an approved pair |
| `marca.cores.traco` | optional: the color of the intertitle rule and of the card's progress bar (default: `destaque`), for when the highlight disappears over the background (a highlight in the same color as the background) |
| `cartao` | optional direction setting, horizontal formats only (in 9:16 the card stays at the top as always). `"direita"`: the mirror of the default, card in the right column and the screen on the left (`leiaute` axis `right-column`). `"embaixo"`: a strip 60% of the width resting on the bottom margin (5%), the camera centers the field in the upper part and the zoomed screen covers it edge to edge (`bottom-strip`). With `textoFora`, the screen is clipped `folga` px from the card on the correct side, also while it comes in (from the right, or from below) and leaves. The strip has no room for karaoke captions: it is for video without voice |
| `transicao` | optional direction setting: how the intertitle comes in and leaves (default: hard cut, `cut-on-beat`). `"push"`: comes in from the right pushing screen, card and background to the left, and leaves pushed by the returning screen, 0.35 s each way. `"mascara"`: opens in a circle from the current field and closes on the next field; the words only rise with the frame covered and go down before it opens (no text with the screen in view). In both, the first field of the new stage is already framed while the intertitle covers the frame, the new step changes on the card without animation, and both windows go into `TRANSICOES` (`registrarTransicao`). `intertituloDur` of 1.1 s or more for push and 1.4 s or more for mascara |
| `camera` | optional direction setting: `"travelling"` = a single zoom for all fields (the smallest of them, so that all fit): from one field to the next the camera moves sideways or diagonally, without moving in or out, and when stopped on a field it keeps sliding slowly (18 px/s) toward the middle of the screen, when the screen has room to spare on that side. The opening and the wide shot do not change (default: `guided-zoom`, each field at its own zoom) |
| `fundo` | optional direction setting, the drawing behind everything (default: plain). `{ "tipo": "formas", "cores": ["#…", …], "simbolo": "<png>" }`: diamonds with very rounded corners, stacked, one per color (the first in front, the others going down behind until they leave the frame), on the card's side and below it, rising slowly; `simbolo` (optional) puts the symbol PNG standing on the front diamond. `{ "tipo": "simbolo", "arquivo": "<png>" }`: the brand symbol, giant, cropped by the edge and rotating slowly, far from the card (embaixo: in the right corner of the strip). The brand's PNG whole, in the file's color, no transparency and no recoloring. `x` and `y` (fractions of the frame) change the position; `tamanho` (fraction of the height, 1) the symbol's size. The drawing shows in the background, in the intertitles and in the opening; with `fundo`, the scrim covers only the screen rectangle, and the background stays in the brand color. Check on the contact sheet that no text (intertitle, title) touches the drawing |
| optional | `velocidade` (1), `abertura` (1.8), `planoGeral` (1.0), `intertituloDur` (1.1), `segurarSucesso` (1.4), `segurarFim` (0.4), `fimDur` (2.4), `contexto { w: 420, h: 220 }` (the minimum screen around the target, in CSS px: smaller = more zoom), `plataforma`, `sub` |

## Variations
- **Dark × light brand**: the scrim is always dark (`cores.veu`), the card surface changes (dark in
  `example.json`, light in `example-card-right.json`).
- **Direction** (the axes in `references/catalog/variety.md`): `cartao` changes the `leiaute`, `transicao` the
  `transicao`, `camera` the `camera` and `fundo` the `fundo`; the pace comes from the recording (the journey's
  `leituraMin`) and from `velocidade`. The three format examples (`example.json`, `example-card-right.json` and
  `example-card-below.json`) show the combinations.
- **More or less zoom**: `contexto`.
- **No intertitle**: a single stage.

## Limits (what the template does not do)
- There is a single recording, from a computer; 9:16 recomposes the same screen. A phone recorded in a phone viewport
  has not been tested in this template (use the skill's tutorial mode).
- 14 px app text reaches ~34 px in 16:9 (3.1% of the height) and ~42 px in 9:16 (2.2% of the height; 3.9% of the
  width). For more in 9:16, record with larger text or DSF 4.
- Without voice, the sound is the skill's soundtrack (protagonist role) with the effects on the recording's events;
  `--no-soundtrack` comes out silent, and so does a run without a Python with numpy and scipy (the script warns). Without
  voice there are no captions: the step card tells it.
- The highlight follows the recorded rectangle of the target; an element that moves on its own (app animation) goes
  out of focus.
- The wide shot shows the whole screen for 1 s, on purpose; nothing cited by the voice or by the card appears in it.
