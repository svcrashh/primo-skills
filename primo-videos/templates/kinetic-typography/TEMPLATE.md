# Template: kinetic typography

Large words, alone on screen, that come in on the soundtrack's beat, stack, rotate and rearrange themselves, with the
brand's shapes beside them. Each sentence is a frame with its own background; the passage from one sentence to the next
is a hard cut on the beat or an engine transition (mask, push, whip). A 6 to 15 s video, or the opening of another video.

**By default the text is informative: name, number, fact.** This is the style where it is easiest to slip into a
slogan; a slogan goes in only when the brand has one and the person wants it. Yes: "4 features", "Website and mobile
app", "128 items · 24 categories", "6 options". Not by default: "faster", "transform", "the future is now". The
template rejects exclamation marks and lines with more than 7 words (a limit of the template), but it does not know
what a slogan is: whoever writes the JSON does.

## When to use
- Opening of a video or of an internal event: 2 to 4 short facts before the subject.
- Short internal announcement: what has arrived, in names and numbers ("4 features", "Website and mobile app").
- Summing up 3 facts from a package, a quarter or a delivery, without a product screen.

## When NOT to use
- Teaching how to use something (that is a tutorial: real screen with camera, panel tutorial).
- A subject that needs a long sentence or an explanation: here every line has to fit large.
- No fact to show: a loose word with no number or name becomes a slogan. Use another style.
- A video with more than ~5 sentences: it gets tiring. Cut, or split it into two videos.

## Structure
| Time | What happens |
|---|---|
| 0 | the 1st line of the 1st sentence is already coming in (frame 0 is never empty); the sentence's shapes pop in with it |
| each line | comes in on a beat (`ritmo`: `calmo` = every 2 beats, `medio` = every beat, `rapido` = every half beat), in the current way: `sobe` (from inside the mask), `gira` (rotates into place, from bottom to top), `escala` (drops in large and settles) or `desliza` (comes from the side, with blur). The stack re-centers with each line that arrives |
| hold | the whole sentence on screen for 2 to 3 beats (more if it has many words); the lines pulse slightly on the beat (`pulso`), the shapes rotate and breathe; with `camera: "guided-zoom"`, the stack grows slowly |
| `reorganiza: "linha"` | after the last line, the lines of the stack become a single line (at most 7 words together) |
| sentence change | on a beat: `cut-on-beat` (hard cut), `mascara` (the next sentence's color opens in a circle from the largest shape), `push` (the next one pushes the current one up), `whip` (whip to the left) |
| closing | the closing background comes in through the same transition, the logo rises on a beat and stays still ~2 s. **Logo only** |

The whole timeline sits on the soundtrack's grid: every sentence, transition and the logo start on a beat, and the
soundtrack (`arrange_series.py`) is composed at the JSON's BPM, with no adjustment. The logo is the music's final accent.

## Parameters (`example-left-column.json`, `example.json`)
```jsonc
{
  "nome": "kinetic-typography-example",          // name of the output files
  "titulo": "…", "formatos": ["16x9"],            // 16x9, 19x9, 21x9, 9x16, 1x1, 4x5
  "plataforma": null,                             // optional: "reels", "feed"… (the right safe area)
  "bpm": 120,                                     // the grid of the words AND of the soundtrack (60 to 180)
  "ritmo": "medio",                               // calmo | medio | rapido
  "transicao": "mascara",                         // cut-on-beat (default) | mascara | push | whip
  "leiaute": "left-column",                   // full-screen (default) | left-column | right-column
  "camera": "estatica",                           // estatica (default) | guided-zoom
  "pulso": 0.03,                                  // how much the lines grow on the beat (0 turns it off)
  "entradas": ["sobe", "gira"],                   // optional: the cycle of entries (default: by the ritmo)
  "fonte": { "familia": "Inter", "peso": 700, "pesoDestaque": 700, "minimo": 64 },
  "pares": [["#F5F5F5", "#1D1D1D", "AAA"], …],    // optional: the approved pairs; with it, any other pair is an error,
                                                  //   and an "AA18" pair is only valid at weight 700
  "cores": { "fundo": "#…", "texto": "#…", "destaque": "#…", "pilula": { "fundo": "#…", "texto": "#…" } },
  "formas": [ … ],                                // the shapes for all sentences (each sentence can change them)
  "frases": [                                     // 1 to 8 sentences, 1 to 5 lines each
    { "cores": { "fundo": "#848484", "texto": "#F5F5F5" },          // the sentence can change the colors
      "linhas": [{ "t": "4", "tamanho": 1.2 }, "product", "features"],
      "formas": [{ "tipo": "imagem", "arquivo": "…/symbol.png", "tamanho": 1.2 }] },
    { "linhas": ["*128* items", { "t": "from a list of 320", "pilula": true, "peso": 600 }],
      "reorganiza": "linha", "ritmo": "rapido", "batidas": 8 }
  ],
  "fecho": { "logo": "…/logo.png", "fundo": "#F5F5F5", "largura": 620, "batidas": 5 },
  "trilha": { "semente": 5101, "identidade": { "genero": "house", … } }   // assets/audio/API.md
}
```
- **Line:** text (up to 7 words and 28 characters) or `{ "t", "peso", "tamanho", "entra", "pilula" }`. `*assim*`
  marks the highlight: it comes out in `pesoDestaque` and in the `cores.destaque` color (e.g. the number in bold, the
  word in the brand's color). `peso`: 400, 500, 600 or 700 (the font must bring that weight). `tamanho` multiplies the
  type size ceiling (a short word can become giant). `pilula: true` puts the line in a `cores.pilula` pill.
- **Type size:** each line fills the width of the text column, up to a ceiling; the stack shrinks along until it fits
  the height. A line that ends up below `fonte.minimo` (64 px) is a console error: shorten the line or remove a line
  from the sentence.
- **Shapes:** `{ "tipo": "circulo" | "pilula" | "losango" | "imagem", "cor": "#…", "arquivo": "…png", "tamanho": 0,42,
  "x": 0,5, "y": 0,5, "angulo": 0, "gira": 8 }`. `tamanho` is a fraction of the frame's shorter side; `x` and `y`, a
  fraction of the shapes zone (in the column) or of the frame (in full screen, where they sit in the corners). The shape
  never touches the text: the template pushes it (column) or shrinks it (corner) until there is breathing room left, and
  it disappears if it does not fit. `imagem` is a brand PNG (the symbol), marked for the text-over-image check; `gira`
  in degrees per second.
- **Closing:** only `logo`, `fundo`, `largura` and `batidas`. A sentence, catchphrase, date or address in the closing
  is an error.

Format examples (greys, placeholder texts, symbol and logo, sample facts): `example.json` (full screen, guided zoom,
hard cut on the beat, fast pace, a sentence that regroups into one line, a line in a pill) and
`example-left-column.json` (left column, static camera, mask transition, the giant symbol beside the text).

What the JSON can get wrong and the message that comes out: a value outside the list ("transicao "girar" does not exist: use cut-on-beat | push | mascara | whip"), a long line, an exclamation mark, a color
pair outside `pares`, AA18 without bold, a file that does not exist, `reorganiza` with more than 7 words together, text
in the closing. `render.mjs` stops with code 2 and the list.

## How to render
```zsh
# from the skill folder; for the format examples, their Inter goes in first (no network)
node scripts/example-fonts.mjs <output>/.work-<name>
node templates/kinetic-typography/render.mjs meu.json --out <output> [--mode draft|final] [--formats 16x9,9x16] [--no-sound]
```
It runs: `assemble.mjs` (checks, computes the timeline and builds the work in `<output>/.work-<name>`) → the soundtrack
(`arrange_series.py`, protagonist, at the JSON's BPM) → `render.cjs` for each format → `finalize.mjs` (checks the
delivery) → contact sheet `<output>/<name>-<format>-sheet.png`. The default is `draft` (30 fps); `final` comes out at
60 fps with motion blur. Without Python with numpy and scipy, it comes out silent and warns.

To look without rendering: `node templates/kinetic-typography/assemble.mjs meu.json <build>` and
`node scripts/frames.cjs --project <build> --check --qps 10 [--format 9x16]` (text outside the safe area, covered or
over an image).

## Formats
- **16:9, 19:9, 21:9:** text column at 58% of the usable width, shapes in the other column bleeding off the edge (or, in
  full screen, the text at 80% of the width and the shapes in the corners). The wide ones inherit the 16:9 layout
  through the engine's `L()`; the safe area (5%) comes from `areaSegura()`.
- **9:16, 1:1, 4:5:** the column becomes a strip: the text on top (64% of the usable height) and the shapes below
  (`right-column`: the other way round). In full screen, the text at 78% of the height. The Reels safe area applies
  with `plataforma: "reels"`.
Recomposed, not cropped.

## Limits
- It does not wrap lines by itself: each line of the JSON is one line on screen. A long sentence becomes two lines (or
  two sentences).
- `reorganiza` only has `"linha"` (the stack becomes a single line). In the column, the line gets small (the width is
  the column's): use it in full screen.
- The template does not know what a slogan is: keeping the text informative is on whoever writes the JSON.
- The closing is the logo only: a slogan, a sentence, a date or an address in `fecho` is rejected, and so is an
  exclamation mark in any line. A brand that closes with its slogan needs another template for the closing.
- No voice: this skill makes videos without narration. The
  soundtrack is the protagonist.
