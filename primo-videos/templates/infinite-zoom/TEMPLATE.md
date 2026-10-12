# Template: infinite zoom

Continuous zoom across 3 or 4 levels, **with no cut**: the camera dives into a detail of the screen (a link, an icon, a
card, a cell), and that detail becomes the next screen, which is born from it while it grows. The last detail becomes
the closing, with the logo only. The screens are real screenshots (the page in the skill's Playwright) inside a window;
the text sits in a column or a strip outside it, never on top.

## When to use
- Showing layers, from the overview to the detail: the guide → a section → a card → a rule.
- Navigation: "from here you get there", across 3 or 4 screens of a site, dashboard or document.
- Opening or closing a piece with a dive into the product's screen (5 to 15 s).

## When not to use
- Teaching the click path: the dive does not show the tap. That is `real-screen-camera` or `phone-3d`.
- Screens without a small detail linking one to the next: without the "this piece becomes that screen", it is just zoom.
- More than 5 levels: it gets tiring, and each level needs ~2.5 s to be read.
- The whole screen, to be read slowly: the first level is in passing (the small text lasts at most ~2 s).

## What the video looks like (timeline, `medio` pace)
| part | what you see |
|---|---|
| 0 → 1.0 s | the overview screen covering the window, already with the level 1 text beside it (frame 0) and the camera pushing in slowly |
| dive (1.5 s) | the camera goes to the detail (zoom on a logarithmic scale, center at 1/z: the detail grows in place); the next screen appears over it (from 15% to 60% of the way), with a rounded corner, and grows until it covers the window; the text changes midway |
| each level (1.1 s) | the screen covers the window and the camera pushes in slowly toward the next detail (it never stops: the refinement check rejects frozen frames) |
| last dive (1.6 s) | the last level's detail becomes the closing: a rectangle in the closing color, with the logo inside, grows until it covers the frame |
| closing (2.4 s) | logo only, centered and still |

`ritmo`: `calmo` (overview 0.9 s, each level 1.7 s, dive 2.0 s), `medio`, `rapido` (0.7 / 0.7 / 1.0 s). Four
levels at medium or three at calm give ~12.8 s.

## How the dive stays continuous
Each level k+1 lives **inside** level k, in a rectangle centered on the detail, with the proportions of screen k+1 and
10% larger than the detail. Everything lives in a single coordinate system (level 1's): level k has its own origin and
scale. The camera is a center and a zoom; the zoom moves on a logarithmic scale and the center moves at 1/z (that is
what makes the detail grow in place, like a zoom on a fixed point). When the next screen covers the window, the previous
one disappears. That is why the detail has to be much smaller than the screen (up to 70%; the capture rejects a larger
one) and be entirely inside it.

## Layout
| layout | 16:9 (19:9 and 21:9 by width) | 9:16 and 1:1 |
|---|---|---|
| `left-column` (default) | text in a column on the left (27% of the width); the window takes the rest, at the height of the safe area | text in a strip below the window |
| `right-column` | the mirror | same |
| `bottom-strip` | the window centered, with the `aspectoJanela` proportion (1.6), and the text in a strip below it, aligned with it | same |
| `faixa-em-cima` | the text on top, the window below | same |

Capture each level (except the overview) with the window's proportions and at half its width: that way the page's
16 px text reaches ~32 px in the video. Column in 16:9: window 1154×972, screens of 580×492. Strip (1.6): ~1237×773,
screens of 618×386. In another format the screen is cropped to cover the window (the camera keeps the detail in view).

## Flow
1. **Capture:** `render.mjs` captures on its own if `<capture>/niveis.json` does not exist, if the JSON's capture
   or levels changed (the signature saved in it) or with `--recapture`, through `capture.mjs`: one screenshot per
   level (JPG, DSF from `captura.dsf`, 4 by default) and the detail's rectangle. A detail that does not exist, falls
   outside the screen or is too large to dive into stops the capture with what to change.
2. **Parameters:** copy `example.json` or `example-bottom-strip.json` and change the `captura` and the `niveis`.
3. **Build, check and render** (from `$SKILL`):
   ```sh
   node templates/infinite-zoom/render.mjs meu.json --out <folder> --assemble-only           # capture (if needed) and build
   node scripts/frames.cjs --project <folder>/.work-<name> --times 0,1.8,4,7 [--format 9x16]
   node templates/infinite-zoom/render.mjs meu.json --out <folder>                       # 30 fps draft
   node templates/infinite-zoom/render.mjs meu.json --out <folder> --mode final
   ```
   Before the render it runs `scripts/frames.cjs --check` on each format (text over the screen, collision, safe area)
   and stops if anything is flagged (`--no-check` skips it). Outputs `<folder>/<name>-<format>.mp4` and the contact
   sheet: **look at the contact sheet**.
   For the format examples, first: `node scripts/example-fonts.mjs <folder>/.work-<name>` (the examples' Inter, no
   network).

## Parameters
| field | what it is |
|---|---|
| `nome` | name of the output files |
| `formatos` | `["16x9"]` (default); accepts `16x9`, `19x9`, `21x9`, `9x16`, `1x1` |
| `leiaute` | `left-column` (default), `right-column`, `bottom-strip`, `faixa-em-cima` |
| `ritmo` | `calmo`, `medio` (default), `rapido` |
| `indice` | `true`: one pill per level (each one's `nome`) with the current one lit. Default `false` |
| `aspectoJanela` | in the strips, the window's width ÷ height in landscape (1 to 2.4; default 1.6) |
| `captura.pagina` / `captura.url` | the page: a local HTML file (relative to the JSON) or a URL |
| `captura.tema` | `claro` (default) or `escuro` (the page's `prefers-color-scheme`) |
| `captura.dsf` | pixels per CSS px (1 to 5; default 4: the deep dive does not soften) |
| `captura.margem` | px from the top where `rolar` places the element (default 76: the page's fixed bar + breathing room) |
| `niveis[]` | 2 to 5 (3 or 4 is best), from the overview to the detail |
| `niveis[].texto` | the sentence beside the screen (up to 10 words, lines of up to 7) |
| `niveis[].nome` | with `indice`, the pill (up to 3 words) |
| `niveis[].tela` | `largura`, `altura` (the browser window); `rolar` (selector placed at the top, at `margem` px), `clicar` (selector or list, before the screenshot: open an item), `esperar` (ms, 450) |
| `niveis[].entrar` | the selector of the detail the camera dives into: it becomes the next screen (on the last level, the closing). Entirely on screen and up to 70% of it |
| `textos.rotulo` | the pill above the text (optional) |
| `marca.fonte` | the family (the build's `fonts.css`; without it, the system's) |
| `marca.cores` | `fundo`, `texto`, `pilulaFundo`, `pilulaTexto` (the label and the lit pill of the index), `janela` (behind the screen) |
| `marca.corpo` / `marca.pesos` | `titulo` (72), `rotulo` (30), `indice` (30), in px; minimum 28 |
| `fecho` | `logo` (PNG, required), `fundo`, `largura` (640), `dur` (2.4 s) |
| `trilha` | `semente` and `identidade` (v2 schema from `assets/audio/API.md`): a whoosh on each dive and the accent on the logo |

Each parameter error comes out with what to do (`leiaute "centro" does not exist: use …`)
and nothing is built.

## Format examples
Greys, placeholder texts and the placeholder logo, no brand: they show the parameters, not a finished video.
- `example.json`: left column, medium pace, index, 4 levels of the sample page in the light theme (the whole page →
  the four features → the four steps → the details table → the closing, which is born from a cell of the table).
- `example-bottom-strip.json`: bottom strip, calm pace, no index, 3 levels of the sample page in the dark theme (the
  whole page → the install command → the plans table → the closing, which is born from the highlighted row).

Both capture `assets/example/page.html` (the neutral sample page that ships with the skill). That page changes theme
by its Theme button and does not follow the system's `prefers-color-scheme`, so in the dark example each level also
has `"clicar": "#theme"`; on a page that follows the system, `captura.tema` alone is enough.

## Limits (what the template does not do)
- Still screenshots: inside each level nothing moves except the camera (no recorded scroll or tap).
- In the dive, the screen behind appears zoomed around the new one until the new one covers the window; in a very deep
  dive (a 40 px detail) it softens in that stretch. Prefer details of 60 to 300 px.
- In the dark theme with `janela` in the background color, the window's border does not show: the page looks "loose"
  in the frame.
- The closing is born from the last detail with the logo inside, already at scale: the logo grows with it and stops at
  its final size.
- The closing is the logo only: there is no field for a catchphrase, an address or any other text in it.
- No narration: this template has no voice. For a video with voice (opt-in, `references/voice-script.md`), the closest style that
  takes it is `real-screen-camera` (the camera going to the detail on the real screen).
