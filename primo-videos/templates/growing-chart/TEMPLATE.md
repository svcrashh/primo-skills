# Template: Growing chart

One to four charts, one per scene, that draw themselves on screen with the numbers counting: **horizontal bars**,
**columns**, **line** or **donut**. The title and the data source stay still from the first frame; axis, labels and
values always stay **outside** the bars. Between scenes and into the closing, a transition from the engine (or a hard
cut). Closes with the logo only, centered. Video of 6 to 20 s, no voice, with the skill's soundtrack as the lead. Style
card: `references/catalog/styles/growing-chart.md`.

## When to use
- Showing metrics, a dashboard, the results of a quarter or a project: 2 to 8 numbers in the same unit, compared.
- A true proportion ("96 of 128"): the donut.
- A series over time (by month, by week): the line.
- Opening or closing a bigger video with the data that justifies it.

## When NOT to use
- A single number, with no comparison: use `counting-number`.
- A made-up number, with no source, or internal data that cannot leave the company (revenue, negotiated price, client).
- More than 8 bars or 12 points: the label shrinks until it is unreadable. Cut or group ("other").
- Teaching how to use a screen (tutorial) or showing what's new (Rolling list).

## Scenes (`cenas[]`, from 1 to 4)
| `tipo` | fields | what happens | default duration |
|---|---|---|---|
| `barras` | `itens[{rotulo, valor, icone?}]` (2–8), `destaque` | the axis drops in, each bar grows from the left (one after the other) with the value counting at its tip; the label sits to the left of the axis (in portrait and square, above the bar) | 0.3 + 0.28 × (n−1) + 1.2 + 2 s |
| `colunas` | `itens[{rotulo, valor, icone?}]` (2–8), `destaque` | the axis extends, each column rises with the value counting on top; the label sits below the axis | same as the bars |
| `linha` | `itens[{rotulo, valor}]` (3–12), `zero` (false = the axis starts at the lowest value), `destaque` | the line draws itself from left to right; each point lights up when the line reaches it, with the value counting above it (below, if the point is a dip) | 0.3 + 0.25 × n + 1.2 + 2 s |
| `rosca` | `valor`, `total`, `rotulo` | the ring grows and the track appears, the arc runs from 0 to `valor ÷ total` with the number counting in the center and "de `total`" (of `total`) below it; the label (up to 2 lines, large) comes in beside the ring (wide chart) or below it | 4.1 s |

Every scene takes `titulo` (up to 7 words) and can take `nota` (the data source, up to 7 words), `dur` (s; anything
shorter than the drawing time + 0.6 s is rejected), `leiaute` and `lado` (overriding the general ones), and the number
format: `prefixo`, `sufixo` ("%", " px"), `casas` (decimal places), `decimal` ("." by default; "," for Portuguese) and `milhar` ("," by default; "" for
"1920").
`destaque`: the index (starting at 0) of the item that gets the highlight color, or a list of them. The transition to
the closing starts from it (mask and zoom).
`percorrer: true` (bars and columns; **off by default**): after growing, the highlight moves from item to item
(0.55 s each, the color switches sharply and the number jumps by 22%) and at the end goes back to the usual `destaque`.
It keeps the finished chart from sitting still: the scene now lasts as long as the run (0.15 + 0.55 × n + 0.45 s more
by default, and the minimum `dur` goes up with it).

## Parameters (`params.json`)
```jsonc
{
  "nome": "grafico",                            // name of the output files
  "formatos": ["16x9", "9x16"],                 // the ones renderizar makes without --formats
  "leiaute": "em-cima",                         // em-cima (title on top, chart below) | dividido (chart on one side, title on the other, a hairline in between)
  "lado": "esquerda",                           // in dividido, which side the chart goes on
  "transicao": "whip",                          // corte (default) | push | whip | mascara | zoom
  "milhar": ".",
  "marca": {
    "nome": "…", "logo": "caminho/logo.png",   // PNG; the aspect ratio comes from the file
    "cores": {
      "fundo": "#…", "texto": "#…",             // required
      "apoio": "#…",                             // the note and the "of 128" (default: texto)
      "eixo": "#…",                              // the axis (shape; default: texto)
      "serie": ["#…"],                           // bar color, one per item, cycling (default: texto)
      "destaque": "#…",                          // the highlighted item, the donut arc and the line (default: the 1st of the series)
      "trilho": "#…",                            // the ring behind the arc (default: a mix of fundo and texto)
      "divisor": "#…",                           // the hairline of the dividido layout (default: eixo)
      "ladrilho": "#…"                           // icon background (without it, the icon floats free)
    },
    "fontes": { "titulo": "…", "texto": "…", "numero": "…" },   // Google Fonts (the brand's font)
    "pesos": { "titulo": 700, "texto": 500, "rotulo": 600, "numero": 700 },
    "grao": 0
  },
  "cenas": [ { "tipo": "linha", "titulo": "…", "nota": "…", "itens": [{ "rotulo": "jan", "valor": 120 }] } ],
  "fecho": { "fundo": "#…", "logo": "…", "dur": 2.4, "largura": 640 },   // logo only; text here is rejected
  "trilha": { "semente": 1003, "identidade": { "genero": "house", … } }  // assets/audio/API.md, identity v2
}
```
Everything is optional apart from marca and cenas; without the options, the default is: `em-cima` layout, chart on the
left, hard cut, thousands separator ".", colors derived from `fundo` and `texto`, a 2.4 s closing on the brand
background with `marca.logo`.

Format examples (greys, placeholder texts and logo, sample numbers):
- `example.json`: one scene of horizontal bars on a dark background, layout on top, `percorrer` on, circle mask into
  the closing.
- `example-split.json`: two scenes, a donut (96 of 128) and columns (six items), split layout, push between the
  scenes.

## How to render
```sh
node scripts/example-fonts.mjs <output>/.work-<name>          # the format examples only: their Inter, no network
node templates/growing-chart/render.mjs <params.json> --out <output> [--mode draft|final]
     [--formats 16x9,19x9,21x9,9x16,1x1,4x5] [--no-sound] [--no-check] [--assemble-only]
```
- Checks the parameters **before** creating any folder: each error names the field and what to put in its place (a
  type that doesn't exist, a donut with a value greater than the total, a title over 7 words, a short `dur`, text in
  the closing…).
- Assembles `<output>/.work-<name>/` (template + `assets/template/engine.js` + `params.js` + `fonts/` + `media/`),
  composes the soundtrack (`assets/audio/arrange_series.py`, lead: an accent on each cut and a mandatory one when the
  logo settles), runs the **frame check** for each format (`scripts/frames.cjs --check`: collision, safe area and
  text over image, with `VIDEO.texto = 'fora-da-imagem'`), renders, joins and checks via `scripts/finalize.mjs`
  (duration, loudness, peak, already in AAC) and takes the contact sheet.
- Out come `<output>/<name>-<format>[-draft].mp4` and `…-sheet.png`. **Look at the sheet.** Live preview:
  `<build>/index.html?f=9x16&play`.
- Refinement check: `node scripts/refine.mjs <mp4> --project <build> --format 16x9 --channel site --fonts Inter`. Pass
  `--format`: `video.js` lists the six formats and, without it, the refinement measures the MP4 as if it were each
  one of them.

## Formats
16:9, 19:9 (2280×1080), 21:9 (2520×1080), 9:16, 1:1 and 4:5, **recomposed**: in landscape the margin is 120/1920 of
the width and the rest is as in 16:9 (19:9 and 21:9 stretch the chart, not the letters; the engine's `L()` gives them
the 16:9 type sizes). In portrait and square the title goes on top and the chart below (`dividido` becomes `em-cima`),
and in bars the label moves up above the bar. Everything stays inside the engine's safe area (`areaSegura()`), with
room for the camera, which moves 10% closer in the first second and a half of each scene and another 2.5% until the
cut (nothing stays still).

## Limits (what the template doesn't do)
- Stacked, grouped or negative bars, two series on the same line, an axis with scale and grid: not done.
- Color legend (each color a meaning): the template paints per item, with no legend; state the rule in the title or
  the note.
- More than 4 scenes: rejected (one subject per screen). For more, two videos or another style.
- The number counts on a curve (outCubic), with no counting sound; the sound is the accent on the cut.
- Icon only on bars and columns, next to the label (never inside the bar).
- The closing is the logo only, centered: a slogan, a sentence or an address in `fecho` is rejected. A brand that
  closes with its slogan needs another template for the closing.
