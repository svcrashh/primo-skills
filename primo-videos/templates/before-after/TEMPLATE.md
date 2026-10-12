# Template: before and after

The **same screen, in the same framing, in two states**, cut on the click. The eye compares on its own.
It merges the style cards *before and after on screen*, *with and without side by side*, *matched split screen* and *zoom-out that reveals*
(catalog, section 3, item 5). Rules 6 and 10 of the catalog: proof > promise, and the product is the mechanism.

## When to use
- A feature that transforms something **visible** in **one step**: painted photo → natural, messy list → by
  aisle, spreadsheet → chart, background → no background, raw statement → categorized.
- Reels/WhatsApp (12–15 s hook), ad, launch reveal, one-tap tutorial.

## When NOT to use
- The feature is invisible (security, performance, integration): use Counting number.
- The difference is subtle or the "before" is already good: nobody sees the switch.
- A multi-step process: that is a tutorial (Real screen with camera).
- Comparing with a named competitor.

## How the video runs (the timings come from the lines)
| when | what |
|---|---|
| 0 s | written **promise** (title) + the screen in the "before" state, with the BEFORE label in the fixed corner. No empty frame. |
| 0.5 s | "before" line; the camera pushes in slowly (1.00 → 1.06) |
| end of the line − 0.6 s | the **trigger** enters: the product's control with the exact labels (e.g. "Theme · Light / Dark") and the cursor goes to the option |
| end of the line + 1.1 s | **click = hard cut** to the "after", same framing; the label turns into AFTER/NOW in the accent color; the switch word ("Dark.", "Easy.") in the opposite corner |
| click + 0.25 s | "after" line |
| after the line | **curtain**: the divider enters from the left and stops in the middle — before on the left, after on the right, held still ~2.6 s |
| curtain + 2.6 s | **closing**: scrim + blur over the screen, catchphrase, logo and address (3.2 s); with `fecho: "logo"`, the brand's logo alone on a flat background |

Duration = lines + breathing room, minimum 12 s; the script warns above 20 s. Without voice-over, the timing of each line comes
from the text (0.38 s per word), and the line appears only as a caption.

## Variations
- `"variacao": "corte"` (default) — the one described above.
- `"variacao": "zoom-out"` — starts zoomed in (`zoomDetalhe`, 2–3×) on the before's `detalhe`; the click cut
  happens while still zoomed in, and only then does the camera pull back to the whole screen: the detail changes meaning when
  the whole appears. Good for "this number… was your bill". Also from the command line: `--variation zoom-out`.
- **Formats:** 16:9 (title and caption in a column on the left, screen on the right), 9:16 (title on top, screen in the
  middle, caption in a pill at the bottom — use the **phone** capture), 1:1 (title on top, caption over the screen).
  Recomposed, not cropped: each format has its own `foco` and can use another capture.
- **19:9 (2280×1080) and 21:9 (2520×1080):** the 16:9 recomposed for the width. The title-and-caption column sits at the
  left margin (5% + 4 px) with 27% of the width; the screen window runs from the column to the right margin and grows with
  the width. The type sizes are the 16:9 ones (the height is the same). With the spare width, the window gives up 60 px
  at the top and the BEFORE/AFTER labels move off the capture into that strip; the switch word goes to the
  column, below the title. Without `formatos.19x9`/`21x9` in the JSON, the `16x9` one applies, with the `foco` recomposed: it
  widens to the window's aspect ratio (at most the whole capture) and, if the capture is narrower than the window,
  it becomes a strip pinned to the top of the focus (the screen's header stays), moving down only as much as needed to keep the `detalhe` within
  3/4 of the height. The bottom of the capture is cut off: on a 1440×900, ~4% in 19:9 and ~14% in 21:9; on a 1120×800,
  ~16% and ~25%. If what matters is at the bottom, give a `formatos.21x9` (or `19x9`) with its own `foco`.

## Parameters (`example.json`, `example-side.json` and `example-blade-wipe.json`)
- `marca`: `nome`, `logo` (PNG, or `null` = the name written in the title font), `url`,
  `cores` { `fundo`, `superficie`, `texto`, `apagado`, `linha`, `acento`, `sobreAcento` } (accent and background in hex),
  `fontes` { `titulo`, `tituloPeso`, `tituloCaixaAlta`, `tituloInclinacao` (degrees), `texto`, `mono` } — Google
  Fonts families; the render downloads them into the project.
- `textos`: `promessa` (the promise) and `bordao` (the catchphrase), as lines of `{t, k}` parts (`k: true` = accent color), `antes`, `depois`
  (the labels), `virada` (the switch word, one word).
- `gatilho`: `titulo`, `opcoes` (the product's **exact** labels), `escolha` (index of the clicked option).
- `falas`: `antes` and `depois` (the caption text).
- `trilha` (no voice): `semente` and `identidade` (the audience's genre, schema v2 of `assets/audio/API.md`); without
  `identidade`, a neutral one comes out.
- `captura`: `url` (or the path of a local HTML), `bloquear` (aborted routes: analytics, device registration),
  `esperar`, `telas` { name: { w, h, escala } }, `depois` { `clicar` selector | `css` | `js` | `url` }.
- `formatos` { `16x9` | `19x9` | `21x9` | `9x16` | `1x1`: { `tela` (name of the capture), `foco` [x, y, w, h] in the capture's CSS px,
  `detalhe` [x, y], `zoomDetalhe` } }. The focus is scaled up to cover the window; if it ends up **below**
  1×, the console shouts `SCREEN SHRUNK` (rule 2: never the whole screen shrunk). `19x9` and `21x9` are optional:
  without them, they inherit `16x9` (the script warns) with the focus recomposed for the width. A format outside the list
  (`16x9`, `19x9`, `21x9`, `9x16`, `1x1`, `4x5`) is rejected with the list of accepted ones.
- Optional, off by default (the format example `example.json`, with its screens in `example/`, turns all three
  on): `marca.plano` (flat color: no glow, shadow or border; labels in normal
  case in the text font, the active one inverted surface ↔ text; cursor in the accent; the column's caption in a box of the
  surface color), `fecho: "logo"` (the closing is just the logo, centered on `cores.fechoFundo` or the background, with no catchphrase,
  address, scrim or blur) and `respiro: true` (the camera keeps pushing in slowly during the curtain, which otherwise holds still
  ~1.5 s and fails the refinement check). And `textoFora: true` (landscape formats): no text over the capture. The labels go to
  the strip above the window, as in 19:9 (including during the curtain, each one above its half), and the column carries, from top
  to bottom, title, caption, switch word and the trigger, with its base on the window's base; the window is marked as an
  image and `video.js` comes out with `texto: 'fora-da-imagem'`, so `scripts/frames.cjs --project <output>/project
  --check` fails text that crosses the capture. The window loses 60 px at the top: give the `foco` in the 1180×840 ratio.
- More optional ones, also off by default (without them the video comes out the same as before). The format examples
  `example-side.json` (the search of the sample page) and `example-blade-wipe.json` (the contents menu that opens)
  show each one:
  - `"lado": "direita"` (landscape formats): the 16:9 mirrored. Text column on the right, window at the left margin; during the
    curtain the divider enters from the right and the after stays on the left, near the column (the before's label goes to the
    right). With the camera pushing in, leave ~40 CSS px of slack between the capture's text and the left edge of the `foco`
    (and the `detalhe` further to the left): otherwise the screen's text crosses the 5% safe area and the refinement check fails it.
  - `"transicao": "mascara"`: on the click, the after opens in a circle (with a ring in the accent color) from
    `formatos.<f>.origem` [x, y] (the capture's CSS px; without it, `gatilho.alvo` or `detalhe`). Good for coming out of the
    control that changed (the search field). `"transicao": "lamina"`: a blade in the accent color crosses the window from
    left to right and leaves the after behind; label, switch word and selected option swap when it
    passes the middle. Both are registered as transitions (the collision check does not flag inside them).
  - `"camera": "estatica"`: the screen neither pushes in nor pulls back (overrides `variacao` and `respiro`). To avoid failing on
    frozen frame, give life to the background (`fundo` with the turning symbol) or keep the lines short.
  - `"ritmo": "calmo"`: the gaps (end of the line to the click, click to the curtain, curtain to the closing) get 30%
    longer and the passages slower (curtain 1.6 s, mask 0.9 s, blade 1.1 s). Watch the duration: it goes past 15 s
    with long lines.
  - `"fundo"`: behind everything, never under text (place it away from the column). `{ "tipo": "formas", "formas": [{ "x", "y",
    "r", "cor" }] }`: stacked flat circles, `x`/`y` as fractions of W and H (they can leave the frame),
    `r` as a fraction of H, from bottom to top; they enter growing and float slowly. Colors from the palette's family.
    `{ "tipo": "simbolo", "png", "x", "y", "tamanho", "giro" }`: the brand's symbol PNG (copied to `media/` as it is,
    not recolored nor made transparent), center as fractions of W and H, `tamanho` as a fraction of H, `giro` in degrees per second
    (default 6; it enters with an extra quarter turn). Use a large file (about 2000 px) so it can be big.
    The positions apply to the format's frame: they were designed for 16:9.
  - `gatilho` without a drawn control: `"gatilho": { "alvo": [x, y] }` (the capture's CSS px) and the cursor clicks on the screen
    itself, at that point; the switch word stays in the column, just below the caption. Or a search field:
    `"gatilho": { "campo": "Search this page", "termo": "install" }` (the empty field's text, exactly as in the product, and the
    term): the field enters the column, the cursor taps it and the term is typed letter by letter until the cut.
  - In the capture: `"rolar"` (px) scrolls the page before both screens; `depois.js` can be async (in
    `example-side.json` it types the term in the search and waits for the filter); `depois.esperar` (ms) before the shot.

## How to render
```sh
M=$SKILL/templates/before-after
# 1. the two screens (same viewport); Playwright found via scripts/playwright.cjs or PLAYWRIGHT_PATH
node $M/capture.mjs meu.json --out <folder>/telas
```
```sh
# 2. the video (draft = 30 fps without motion blur; final = 60 fps, 4 subframes)
node $M/render.mjs meu.json --screens <folder>/telas --out <folder> --formats 16x9,9x16,1x1 --mode draft
# big screen/cinema: --formats 19x9 or 21x9 (the contact sheet comes out with 6×4 frames, like the 16:9 one)
```
Without voice, the sound is the skill's soundtrack (`arrange_series.py`) in the lead role, with the click on the cut, the
curtain's whoosh and an accent on the closing, checked by `finalize.mjs`; `--no-soundtrack` comes out silent, and so does a run without a Python with numpy and
scipy (the one from `scripts/environment.mjs --fix`) (the script warns). Out come `<name>-<format>.mp4` and `sheet-<name>-<format>.png`. **Look at the
contact sheet** before delivering.
Preview frozen at an instant: `<folder>/project/index.html?f=9x16&t=4.3`.

Format examples (greys, placeholder texts and the placeholder logo, no brand): `example.json` (theme switch: column on
the left, hard cut, drawn trigger), `example-side.json` (search that filters: column on the right, mask, circles in the
background, search field as the trigger) and `example-blade-wipe.json` (contents menu that opens: the cursor clicks the
capture, blade, still camera, calm pace, symbol in the background). Their screens come from the neutral sample page
(`assets/example/page.html`) and are stored beside them, in `example/`, `example-side/` and `example-blade-wipe/`, so
each one renders without capturing:
```sh
node $SKILL/scripts/example-fonts.mjs <folder>/project      # the examples' Inter, no network
node $M/render.mjs $M/example.json --screens $M/example --out <folder> --formats 16x9 --mode draft
node $M/capture.mjs $M/example.json --out $M/example        # only to capture the two screens again
```

## Limits
- Title and catchphrase **adjust** to the width (the type size shrinks); below 70% of the planned size the console asks for shorter
  text. A wide font (Unbounded) needs 2–3 words per line.
- Only **two** states. Three (background → transparent → new background) not yet.
- The trigger is **drawn** by the template (with the product's labels), not recorded: the real click happens in the
  capture (`depois.clicar`) when the screen has the button visible. With `gatilho.alvo`, nothing is drawn and the cursor
  clicks the capture's own button; the `gatilho.campo` field is drawn (the term does not appear typed on the "before"
  screen, only on the captured after).
- No platform safe-area check (`plataforma: null`): in 9:16 for Reels, the caption sits at
  y ≈ 1670–1760, inside the strip the Reels interface covers. For Reels, move the caption up.
- `zoomDetalhe` gets soft above the capture's `escala` ÷ the focus scale; capture at 2×–3×.
- In 19:9 and 21:9, the trigger (the drawn control) stays over the capture, in the corner, as in 16:9, and the closing
  stays over the scrimmed, blurred window. Only the labels and the switch word moved off the capture.
