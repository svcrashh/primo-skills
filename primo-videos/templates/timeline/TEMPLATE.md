# Template: Timeline

An axis with milestones that **light up in sequence**. Each milestone has a **step or date** (in a pill) and **one line
of text**, and can have an icon on a tile, next to the text. The axis is **horizontal or vertical**, and the camera
**travels along the axis** (tracking: it reaches each milestone as it lights up) or stays **still** with the whole axis
in frame. The title stays still at the top from the first frame. Closes with the logo only, centered. Video of 8 to
20 s, no voice, with the skill's soundtrack as the lead. Style card: `references/catalog/styles/timeline.md`.

## When to use
- The steps of a process ("how a request goes out", "from sign-up to live"), in the order they happen.
- A history with dates (what changed and when), a roadmap with what's coming.
- "A day with": the routine of a team or a tool, hour by hour.

## When NOT to use
- Teaching where to click (that's a tutorial: Real screen with camera or the Panel tutorial series).
- Items with no order among them (that's Rolling list) or one number that proves everything (Counting number).
- More than 10 milestones: the video turns into a list; cut down to the ones that change the story.
- Made-up dates or steps: the timeline states that this happened (or will happen) in that order.

## Parameters (`params.json`)
```jsonc
{
  "nome": "linha",                              // name of the output files
  "formatos": ["16x9", "9x16"],
  "titulo": "The path of a request",            // optional, up to 7 words, still at the top
  "orientacao": "horizontal",                   // horizontal (default) | vertical
  "camera": "travelling",                       // travelling (default: travels along the axis) | estatica (the whole axis in frame)
                                                //   | guiada (the whole axis, and the camera moves in on the current milestone);
                                                //   estatica and guiada: up to 4 milestones horizontal and 6 vertical
  "passo": 1.4,                                 // s between one milestone and the next (1 to 4)
  "final": 1.4,                                 // s of the last milestone lit before the closing (default: the larger of 1,4 and passo)
  "transicao": "corte",                         // corte (default) | push | whip | mascara | zoom — into the closing, from the last point
  "marca": {
    "nome": "…", "logo": "caminho/logo.png",   // PNG; the aspect ratio comes from the file
    "cores": {
      "fundo": "#…", "texto": "#…",             // required
      "eixo": "#…",                              // the axis track (default: a mix of fundo and texto)
      "ponto": "#…",                             // the unlit milestone (default: eixo)
      "progresso": "#…",                         // the part of the axis already covered (default: texto)
      "aceso": "#…",                             // the lit milestone (default: progresso)
      "etiqueta": "#…", "etiquetaTexto": "#…",   // the pill and its text (default: texto and fundo)
      "etiquetaAtiva": "#…", "etiquetaAtivaTexto": "#…",   // optional (off): the pill of the current milestone in this color
      "ladrilho": "#…"                           // icon background (without it, the icon floats free)
    },
    "fontes": { "titulo": "…", "texto": "…" },  // Google Fonts (the brand's font)
    "pesos": { "titulo": 700, "texto": 500, "etiqueta": 700 },
    "grao": 0
  },
  "marcos": [                                   // 2 to 10
    { "etapa": "Request", "texto": "What to show and to whom", "icone": "caminho/icone.png" },
    { "data": "Jan 2025", "texto": "…" }        // "etapa" or "data" (up to 3 words); texto up to 7 words
  ],
  "fecho": { "fundo": "#…", "logo": "…", "dur": 2.4, "largura": 640 },   // logo only; text here is rejected
  "trilha": { "semente": 1005, "identidade": { "genero": "house", … } }  // assets/audio/API.md, identity v2
}
```
Everything is optional apart from marca and marcos; without the options, the default is: horizontal, travelling, 1.4 s
per milestone, hard cut, colors derived from `fundo` and `texto`, a 2.4 s closing on the brand background with
`marca.logo`.

Format examples (greys, placeholder texts, icon and logo, sample steps and dates):
- `example.json`: seven steps with an icon each, horizontal, travelling, zoom through the last point into the
  closing.
- `example-vertical.json`: four dates on a light background, vertical, guided camera, the current pill in its own
  color, push upward into the closing, acoustic soundtrack.

## What the video looks like
| Part | What it has | Time |
|---|---|---|
| Opening | the title already written; the axis track appears and the progress runs to the 1st milestone; the camera (and the title) moves 8% closer over 1.4 s | 0.4 s |
| Each milestone | the point lights up (hops and settles), the pill rises, the text rises, the icon hops; while traveling, the camera reaches the milestone the instant it lights up (0.75 s of movement) | `passo` |
| Last milestone | still so it can be read, the camera breathing (+2.5% until the transition); with zoom and mask, the text (title and milestones) leaves at the start of the transition | `final` |
| Closing | logo only, centered, still for ≥ 1.5 s | 2.4 s |

While traveling, the lit milestone sits a little to the right of center (horizontal) or at mid-height (vertical): the
previous one stays readable, the next one shows up as a dot. A milestone that leaves the safe area fades out
gradually; in vertical, the title strip cuts off whatever rises (the text never passes under the title).
**Guided camera** (`"camera": "guiada"`, off by default): the whole axis laid out as in the static one, with a lens on
top. It opens with the whole axis (frame 0), moves in on the 1st milestone in the first second (up to 35%, whatever
fits the width), goes from milestone to milestone arriving as the next one lights up and, at the end, pulls back to
the whole axis before the closing. In vertical, the text wraps at up to 45% of the width and the block (and the title)
stays centered; a neighboring milestone that crosses the edge while the lens is close fades out, and the title strip
cuts off whatever rises.

In vertical, the pill sits to the left of the axis and the text to the right; when that would leave the text with
less than 45% of the width (portrait with a long step or with an icon), the axis moves to the edge and the pill moves
up above the text.

## How to render
```sh
node scripts/example-fonts.mjs <output>/.work-<name>          # the format examples only: their Inter, no network
node templates/timeline/render.mjs <params.json> --out <output> [--mode draft|final]
     [--formats 16x9,19x9,21x9,9x16,1x1,4x5] [--no-sound] [--no-check] [--assemble-only]
```
- Checks the parameters **before** creating any folder: each error names the field and what to put in its place (an
  orientation or camera that doesn't exist, a milestone with neither step nor date, text over 7 words, too many
  milestones for the still camera, text in the closing…).
- Assembles `<output>/.work-<name>/`, composes the soundtrack (`assets/audio/arrange_series.py`, lead: a pop when each
  milestone lights up and a mandatory accent when the logo settles), runs the **frame check** for each format
  (`scripts/frames.cjs --check`: collision, safe area and text over image), renders, joins and checks via
  `scripts/finalize.mjs` and takes the contact sheet. Out come `<output>/<name>-<format>[-draft].mp4` and
  `…-sheet.png`. **Look at the sheet.** Live preview: `<build>/index.html?f=9x16&play`.
- Refinement check: `node scripts/refine.mjs <mp4> --project <build> --format 16x9 --channel site --fonts Inter` (the
  `--format` is required: `video.js` lists the six formats).

## Formats
16:9, 19:9 (2280×1080), 21:9 (2520×1080), 9:16, 1:1 and 4:5, **recomposed**: in landscape the margin is 120/1920 of
the width and the type sizes are the 16:9 ones (the engine's `L()`); 19:9 and 21:9 show more of the axis, not bigger
letters. In 9:16 the horizontal travel shows one readable milestone at a time (the previous one fades as it leaves the
safe area); vertical fits better. The still camera spreads the milestones across the width (horizontal) or the
height (vertical) of the area below the title.

## Limits (what the template doesn't do)
- Proportional time scale (uneven intervals between dates): the milestones are evenly spaced.
- Branches, parallel milestones or two axes: not done.
- More than one line of text per milestone (the text wraps into up to 2 lines by width, but it is a single sentence).
- There is only one transition into the closing (from the last point); between milestones there is no cut, it is one
  continuous shot.
- The closing is the logo only, centered: a slogan, a sentence or an address in `fecho` is rejected. A brand that
  closes with its slogan needs another template for the closing.
- No narration: this template has no voice. For a video with voice (opt-in, `references/voice-script.md`), the closest style that
  takes it is `rolling-list` (numbered items, in order).
