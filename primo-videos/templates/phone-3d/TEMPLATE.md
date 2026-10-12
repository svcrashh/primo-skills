# Template: 3D phone

A phone in CSS 3D (rounded corners, thickness, sides that catch the light and the buttons, no manufacturer brand)
with **the real screen recorded** inside: the page on a 390 px phone, scrolling and with a tap. The phone turns and orbits
(`orbita` camera) or the camera comes close to it (`dolly`); up close, the app's type is readable (the app's 16 px become
32 px in the video). The text sits beside it, in a column, in the other half of the frame or in a strip at the top, **never over the
screen**. Closing with the logo only.

## When to use
- Mobile app or responsive page: show that it works on the phone, with the real screen.
- Vertical piece (9:16): the phone fills the frame naturally, with the text in a strip on top.
- A short path on the phone: scroll to a part and tap one thing (2 or 3 steps).

## When not to use
- A tutorial with more than 3 steps, or one the person will repeat: that is `real-screen-camera` (or the skill's tutorial).
- A product that only exists on the computer: the phone would be decoration. Use `real-screen-camera` or `infinite-zoom`.
- A screen that cannot be recorded (customer data, real account): record on a demo account or do not use it.
- An ad with no screen at all: `kinetic-typography`, `typing-text`, `counting-number`.

## What the video looks like (timeline, `medio` pace)
| segment | what you see |
|---|---|
| 0 → opening (1.4 s) | the whole phone entering (turning in the orbit; coming from afar in the dolly), already with the title beside it on frame 0 |
| each step | the camera comes close (scale `zoomLeitura`) to the middle of the screen, the recording plays (the real scroll); the step's sentence rises in place of the title |
| tap | the camera reaches the tap point 0.3 s before; a dot appears, presses and releases a ripple (inside the screen, in 3D with it) |
| success | the camera goes to the result (`{ "sucesso": "#selector" }`) |
| pull back + orbit (0.9 + 1.0 s) | the camera returns to the whole phone, which keeps turning |
| switch (0.7 s) | `mascara` (a circle that grows from the phone), `push` (the closing pushes everything) or `corte` |
| closing (2.4 s) | just the logo, centered, entering and still |

`ritmo`: `calmo` (opening 1.8 s, recording at 0.9×), `medio`, `rapido` (opening 1.0 s, recording at 1.2×). The whole
phone with small type never stays on screen for more than ~2.2 s in a row (the refinement check accepts 2.6 s of wide shot); the rest is up close.

## The phone's window (why it never leaves it)
The phone lives in a rounded-corner window **16 px inside the format's safe area**: up close it covers it from top to
bottom and is clipped by it, so the type of the recorded screen never touches the edge of the frame (the refinement check fails text outside
the safe area). With `marca.cores.painel`, the window is a flat card in that color; without it, it only clips.

| layout | 16:9 (19:9 and 21:9 by width) | 9:16 and 1:1 |
|---|---|---|
| `right-column` (default) | window on the left, text in a column on the right (30% of the width) | text in a strip on top, window below |
| `left-column` | the mirror image | same |
| `dividido` | window in the left half, text in the right half | same |

## Flow
1. **Record:** `render.mjs` records on its own if `<capture>/output/<device>/events.json` does not exist, if the JSON's
   capture changed (the signature in `<capture>/assinatura.txt`) or with `--recapture`, through `capture.mjs`, which uses the skill's recorder (`scripts/tutorial/record.mjs`: screencast at DSF 3,
   an "is something in front?" check before each tap). Recording of 5 to 8 s.
2. **Parameters:** copy `example.json` or `example-orbit.json` and change the `captura` and the texts.
3. **Build, check and render** (from `$SKILL`):
   ```sh
   node templates/phone-3d/render.mjs meu.json --out <folder> --assemble-only              # records (if needed) and assembles the build
   node scripts/frames.cjs --project <folder>/.work-<name> --times 0,2,5,9 [--format 9x16]   # individual frames
   node templates/phone-3d/render.mjs meu.json --out <folder>                          # draft 30 fps
   node templates/phone-3d/render.mjs meu.json --out <folder> --mode final --formats 16x9,9x16
   ```
   Before the render, it runs `scripts/frames.cjs --check` on each format (text over the screen, collision, safe area) and
   stops if anything is flagged (`--no-check` skips it). Out come `<folder>/<name>-<format>.mp4` and the contact sheet `-sheet.png`: **look at the contact sheet**.
   For the format examples, first: `node scripts/example-fonts.mjs <folder>/.work-<name>` (the examples' Inter, no network).

## Parameters
| field | what it is |
|---|---|
| `nome` | name of the output files |
| `formatos` | `["16x9"]` (default); accepts `16x9`, `19x9`, `21x9`, `9x16`, `1x1` |
| `camera` | `orbita` (default: the phone turns from one side to the other, constant perspective) or `dolly` (the camera comes from afar and comes close, almost without turning, strong perspective up close) |
| `leiaute` | `right-column` (default), `left-column`, `dividido` |
| `transicao` | for the closing: `mascara` (default), `push`, `corte` |
| `ritmo` | `calmo`, `medio` (default), `rapido` |
| `zoomLeitura` | how close the camera comes (1.2 to 3; default 2: the app's 16 px type at 32 px in the video) |
| `captura.pagina` / `captura.url` | the screen: a local HTML (relative to the JSON; accepts `#anchor`) or a URL |
| `captura.tema` | `claro` (default) or `escuro` (the page's `prefers-color-scheme`) |
| `captura.aparelho` | `phone` (390×844, DSF 3; default) or another one from `scripts/tutorial/devices.mjs`; `captura.viewport` + `captura.dsf` for a custom one |
| `captura.inicio` | optional: where the recording starts (`"#how-it-works"`) |
| `captura.jornada` | the list of actions: `{ "passo": "sentence" }` (becomes the text beside it; up to 10 words), `{ "rola": "#selector", "bloco": "start" }` or `{ "rola": 320 }`, `{ "toque": "#selector" }`, `{ "pausa": 600 }`, `{ "sucesso": "#selector" }` |
| `textos.rotulo` | the pill above the text (optional) |
| `textos.titulo` | the promise, on frame 0 (optional; up to 10 words, broken into lines of up to 7) |
| `textos.passos` | optional: `{ "2": "Another sentence" }` swaps a step's sentence without re-recording |
| `fundo` | `{ "tipo": "liso" }` (default) or `{ "tipo": "simbolo", "imagem": "png", "tamanho": 1100, "x": 0.1, "y": 0.9, "giro": 7 }` (a giant shape slowly turning; with a panel, inside the card) |
| `marca.fonte` | the family (the build's `fonts.css`; without it, the system one) |
| `marca.cores` | `fundo`, `painel` (the window's card; optional), `texto`, `rotuloFundo`, `rotuloTexto`, `toque` (the tap dot) |
| `marca.corpo` / `marca.pesos` | `titulo` (84), `texto` (64), `rotulo` (30), in px; and the weights (700, 700, 600). Minimum 28 |
| `aparelho` | `corpo`, `borda` (the side, which the light brightens), `vidro` (behind the screen) |
| `fecho` | `logo` (PNG, mandatory), `fundo`, `largura` (640), `dur` (2.4 s) |
| `trilha` | `semente` and `identidade` (the audience's genre, schema v2 of `assets/audio/API.md`) |

Each parameter error comes out with what to do (`camera "zoom" does not exist: use "orbita", "dolly"`) and nothing is built.

## Format examples
Greys, placeholder texts and the placeholder logo, no brand: they show the parameters, not a finished video.
- `example.json`: dolly, split, push, calm pace, the phone on a light card; it starts at How it works, scrolls to the plans table and lands on the highlighted row.
- `example-orbit.json`: orbit, column on the right, mask, the phone on a card with the symbol turning behind it; it scrolls to the four features and taps Theme, which turns the page dark.

Both record `assets/example/page.html` (the neutral sample page that ships with the skill).

## Limits (what the template does not do)
- One recording only, from a phone. A computer inside the phone makes no sense; a 3D laptop does not exist here.
- The closing is the logo only: there is no field for a catchphrase, an address or any other text in it.
- No voice: the text beside it tells the story. The skill's soundtrack is the lead, with the tap, the scroll and the logo marked.
  For a video with voice (opt-in, `references/voice-script.md`), the closest style that takes it is `real-screen-camera` (the real screen, in 9:16).
- The phone has no drawn rear camera and no brand; the side is flat with light (no glass reflection).
- Up close, the window clips the phone at the top and bottom (that is what keeps the screen's type in the safe area).
- `orbita` passes through the phone's front view in the middle of the video (the turn goes from −22° to +32°, in a single curve from the end of the opening to the closing); anyone who wants the phone always
  at an angle needs another curve (not exposed in the JSON).
