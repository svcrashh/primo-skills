# Template: card stack

Stacked cards, one per tip, step or rule. The top one stays long enough to be read and leaves: **swipe** (slides to the
side, rotating) or **flip** (flips up like a notepad sheet). The one below rises into its place, changes to the top
color, and the "2/5" counter rolls. The closing is the logo only. Style card: `references/catalog/styles/card-stack.md`.

## When to use
- Short steps of a process (how to order, how to get started), usage tips, rules of a brand or a team.
- 2 to 8 items read in sequence, each with a title and one line.
- Reels and WhatsApp (9:16), feed (1:1, 4:5) and site, without voice: the text tells everything.

## When NOT to use
- The click path on a screen (that is a tutorial: real screen with camera).
- Long text: the title takes up to 7 words and the line up to 14 (the template rejects more).
- More than 8 cards (split into two videos) or a single item.
- Numbers that need emphasis (counting number) or comparison (before and after).

## What the video looks like
| Part | What it has | Time (medium pace) |
|---|---|---|
| Entry | the first three cards arrive from below, the back one first; the header (series title and "1/N" counter) rises | 0.9 s |
| Each card | the title and the line rise word by word and stay long enough to be read (0.8 s + 0.17 s per word, between 1.9 and 3.1 s); the card leaves (0.5 s); halfway through the exit the next one is already on top and the counter rolls | 2.4–3.6 s |
| Closing | the last card leaves and the transition (`whip`, `virada`, `push`, `mascara`, `zoom-through` or `corte`) leads to the logo, still | 0.25 + 0.6 + 2.0 s |

While the text is being read nothing stands still: with `camera` `estatica` the stack floats slightly (6 px, 0.35°);
with `aproxima` it grows 5% slowly and returns on the exit. Each exit is registered as a transition (the check does not
flag the card that passes over the header).

## Parameters (`example-split.json`)
```jsonc
{
  "nome": "card-stack-example-split", "formatos": ["16x9", "9x16"],
  "marca": {
    "nome": "Your brand",
    "cores": { "fundo", "cartao", "texto",                        // required
               "titulo",                                          // the card title (default: texto)
               "cabecalho",                                       // series title and large counter, over the background
               "contador", "contadorTexto",                       // the counter pill (centro layout)
               "ponto", "pontoApagado", "ladrilho" },             // progress dots (dividido); behind the icon
    "pilha": ["#…", "#…"],                                        // the back cards, from nearest to farthest
    "fontes": { "titulo": { "familia", "peso" }, "texto": { "familia", "peso" } },
    "raio": 32
  },
  "titulo": "How it works",                        // optional: the series name in the header
  "leiaute": "centro" | "dividido",                // default centro
  "saida": "swipe" | "flip",                       // default swipe
  "camera": "estatica" | "aproxima",               // default estatica
  "inclina": 3,                                    // rotation in degrees of the back cards (default 0, aligned)
  "ritmo": "calmo" | "medio" | "rapido" | { "base", "porPalavra", "min", "max", "saida", "entrada", "transicao", "logo" },
  "cartoes": [{ "titulo", "texto", "icone": "x.png", "cor", "tinta", "dur" }],
  "fecho": { "logo": "x.png", "fundo": "#…", "transicao": "whip", "largura": 620, "dur": 2.0, "cor": "#…" },
  "trilha": { "semente", "identidade" }            // assets/audio/API.md, identity v2
}
```
- Card `titulo`: up to 7 words, up to 3 lines; `texto`: up to 14 words, up to 3 lines. The template picks the largest
  type size that fits (title from 76 px in 16:9 down to 40; text from 34 px down to 28); text that does not fit is
  dropped, with a warning.
- The icon sits at the top left; title and text sit against the bottom. Marked image: no text may cross it.
- `dur` on a card replaces its computed reading time. `cor`/`tinta` change the background and the title color of that
  card only.
- `dividido` layout in landscape: series title (one line up to 80 px; otherwise two) and large counter on the left,
  with progress dots; the stack on the right, and the swipe exits to the right (away from the header). In portrait and
  1:1, both layouts put the header on top; `dividido` uses the large counter, `centro` the pill.
- Without `fecho.logo`, the closing writes `marca.nome` in the title font, in the `fecho.cor` color.
- No brand color, font or logo in the code. Format examples: `example.json` (4 cards, centro, flip, camera that
  moves in, closing by virada) and `example-split.json` (4 cards, dividido, the cards behind rotated, swipe, still
  camera, closing by whip). Both are in greys, with placeholder texts, icons and logo: they show the parameters, not
  a brand.

## Formats
16:9, 19:9 (2280×1080), 21:9 (2520×1080), 9:16, 1:1 and 4:5, **recomposed**: header and stack are positioned in the safe
area of each format (the engine's `areaSegura()`).
- **19:9 and 21:9**: through the engine's `L()`, the 16:9 type sizes apply; the card and column widths are fractions of W.
- **9:16**: header at the top of the Reels area (y 260), card at 96% of its width, taller than wide.
- **1:1 and 4:5**: like 9:16, with a shorter card.

## How to render
```sh
node scripts/example-fonts.mjs <output>/.work-<name>     # examples only: their Inter, no network (a real video uses the brand's font)
node templates/card-stack/render.mjs <params.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound] [--assemble-only]
```
- Checks the parameters (each error says what to change) and the images before building anything.
- Builds `<output>/.work-<name>/`; `--assemble-only` stops there (preview at `<build>/index.html?f=9x16&play`, frames with
  `node scripts/frames.cjs --project <build> --format 9x16 --check`).
- Soundtrack: the skill's own (`assets/audio/arrange_series.py`, protagonist role). Each exit is an effect in the sync
  sheet: `whoosh` on the swipe (optional, the peak in the middle of the exit) and card `virada` on the flip (dry attack,
  required); the closing logo is a required accent. Checked by `verify.py` (−14 LUFS; if rejected, it remixes at −16)
  and muxed by `scripts/finalize.mjs`. Without Python with numpy and scipy, or with `--no-sound`, it comes out silent.
- Outputs `<output>/<name>-<format>[-draft].mp4` and `…-sheet.png`: **look at the contact sheet**.
- Refinement check: `node scripts/refine.mjs <build> --video <output>/<name>-16x9.mp4 --format 16x9 --channel site`.

## Limits
- One card at a time: there is no "hand" or cursor dragging; the swipe is the card leaving on its own.
- The back of the card on the flip does not show (it disappears after 90°).
- The color of the back cards changes to the top color as they rise (color blend): use shades of the same family, or
  the blend passes through a muddy color.
- The closing is only the logo (or `marca.nome`, when there is no logo): there is no field for a slogan or an address.
- Icon and logo in PNG or JPEG; using a single icon set per piece is the brand's choice, not a template rule.
