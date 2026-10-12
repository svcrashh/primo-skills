# Template: ticking checklist

Items that get checked (✓) or crossed out (✕), one at a time, with a counter that goes up ("4 of 6"). In a single list, checked
off item by item with the highlight strip on the current item, or in two columns ("Does" / "Doesn't"), each with its own counter.
The closing is the logo only.

## When to use
- What a product does and what it does not do (the limit stated head-on: "offline mode: not in this version").
- Requirements, preconditions, what needs to be ready before starting.
- The check before delivering or publishing: the team's list, item by item.

## When NOT to use
- New features to show with screen proof: `rolling-list` (the list here is text only, no screen).
- Step by step of where to click: `real-screen-camera` or the panel tutorial.
- More than 8 items per list (nobody reads them in the video's time): split it, or summarize.
- An item that is a catchphrase ("faster", "hassle-free"): an item is a verifiable fact.

## What it looks like
| Time | What happens |
|---|---|
| 0 | the title and the cards already on screen, rising; the items enter right behind, with the empty circle |
| `entrada` (0.9 / 1.0 / 1.2 s) | the first item checked: the filled circle grows with a spring and the ✓ draws itself (a `blip` that rises in pitch with each ✓); on ✕, the double stroke and the strike line that passes behind the text (a firm tap) |
| each `passo` (0.5 / 0.8 / 1.25 s) | the next item; when switching columns, `troca` s more; the counter goes up and pulses with each mark, stronger when complete |
| camera | `parada`: everything in view, with a slow drift that stops before the composition touches the edge; `segue`: a light zoom that follows the current item and pulls back at the end to show the complete counter |
| after the last one | `final` s (1.0–1.2) of breathing room; the transition (`corte`, `push` upward, `mascara` in a circle born from the counter) |
| closing | just the logo (PNG), centered, enters with a spring and stays still ~2 s |

The three paces (`rapido`, `medio`, `calmo`) change `entrada`, `passo`, `troca` and `final`. The items' type size is the largest
that fills the height and fits the width (up to 64 px in 16:9, never under 28): a short list comes out big.

## Parameters (`example.json`)
```jsonc
{
  "nome": "ticking-checklist-example", "formatos": ["16x9"],
  "estrutura": "lista",            // lista (default) | colunas
  "ritmo": "calmo",                // medio (default) | rapido | calmo | { "passo": 0.7, "entrada": 1, "troca": 0.4, "final": 1.1 }
  "camera": "segue",               // parada (default) | segue
  "transicao": "mascara",          // corte (default) | push | mascara
  "titulo": "…",                   // optional, above everything
  "lista": { "titulo": "Title of the list", "marca": "ok", "itens": ["…", { "t": "…", "marca": "nao" }] },     // lista structure
  "colunas": [                                                                                                  // colunas structure (2)
    { "titulo": "Does", "marca": "ok", "itens": ["…"], "cores": { "cartao", "sobreCartao", "ok", "sobreOk", "vazio" } },
    { "titulo": "Doesn't", "marca": "nao", "risca": true, "itens": ["…"], "cores": { "cartao", "sobreCartao", "nao", "sobreNao", "vazio", "risco" } }
  ],
  "contador": { "rotulo": "checked", "modo": "total" },   // total (default in the list: big, beside or below; list only) | coluna (default in columns: "N of M" in each card's header) | false
  "zoom": 1.12, "respiro": 1,
  "marca": {
    "nome": "…", "logo": "caminho/logo.png",                 // PNG (the aspect ratio comes from the file); the closing is just the logo
    "cores": {
      "fundo", "texto", "cartao", "sobreCartao", "ok", "sobreOk",              // required
      "nao", "sobreNao", "vazio", "destaque", "contador", "titulo", "risco"     // optional
    },
    "fontes": { "texto": "Inter" }, "grao": 0
  },
  "fecho": { "fundo": "#F5F5F5" },    // logo only: "bordao", "endereco" and "texto" are rejected
  "trilha": { "semente": 4092, "identidade": { "genero": "acustico", "bpm": [92, 92] } }   // assets/audio/API.md, identity v2
}
```
- The item's `marca` (`ok` or `nao`) overrides the list's or the column's. `risca: false` removes the ✕'s strike line.
- `cores.destaque` (optional) turns on the current item's strip in the list; without it, there is no strip.
- The ✕'s strike line sits **behind** the text: it strikes through without covering the letters (the engine's collision check still applies).
- The template puts no image in the content; `VIDEO.texto = "fora-da-imagem"` stays on for anyone who adds one.
- A wrong parameter stops before building, with what to do: structure, pace, camera, transition, mark, number of columns,
  item without text, more than 8 items, a color that is not `#rrggbb`, missing logo, closing with a phrase. A list that does not fit the
  format (even with the type size at 28 px) stops the render and says what to shorten.

Format examples: `example.json` (`lista`: a single list with the big counter, calm pace, `segue` camera, `mascara`,
acoustic soundtrack) and `example-columns.json` (`colunas`: does and doesn't, a counter in each header, fast pace,
`parada` camera, `corte`). Both are in greys, with placeholder items and the placeholder logo: they show the
parameters, not a brand.

## How to render
```sh
node scripts/example-fonts.mjs <output>/.work-<name>            # examples only: their Inter, no network (before the render)
node templates/ticking-checklist/render.mjs templates/ticking-checklist/example-columns.json \
     --out <output> [--name x] [--formats 16x9,9x16,1x1,19x9,21x9,4x5] [--mode draft|final] [--no-sound] [--assemble-only]
```
- It builds `<output>/.work-<name>/`, opens the scene in Chromium in each format (a console error stops everything), composes the soundtrack
  of the skill (`arrange_series.py`, lead role: a `blip` that rises with each ✓, a firm tap on each ✕, an accent when the
  logo enters) and measures it (`verify.py`), renders each format, joins and checks the delivery (`scripts/finalize.mjs`) and takes
  the contact sheet.
- Out come `<output>/<name>-<format>.mp4` and `<output>/<name>-<format>-sheet.png`. **Look at the contact sheet.**
- Refinement (the video of one format at a time; the font is passed because `video.js` pulls it from the JSON):
  `node scripts/refine.mjs <output>/<name>-16x9.mp4 --project <output>/.work-<name> --format 16x9 --channel site --fonts Inter`.
  Without `--format`, the refinement check tests the same MP4 against the safe area of every format in `video.js` and raises false alarms.
- Preview: `<output>/.work-<name>/index.html?f=9x16&t=3.2` (or `?play`). Check without rendering:
  `node scripts/frames.cjs --project <output>/.work-<name> --format 9x16 --check`.

## Formats
16:9, 19:9, 21:9, 9:16, 1:1 and 4:5, recomposed:
- **16:9:** `colunas` side by side (margin of 7.5% of the width); `lista` with the card at 52% of the width on the left and the
  big counter on the right.
- **19:9 and 21:9:** through the engine's `L()`, with the 16:9 type size and heights; the widths are fractions of W.
- **9:16:** everything inside the Reels area (x 90–920, y 270–1440): `colunas` one below the other, `lista` with the
  counter below.
- **1:1 and 4:5:** like 9:16, with an 80 px margin.

## Limits
- The closing is only the logo: `bordao`, `endereco`, `texto` and `frase` in `fecho` are rejected (no slogan, no address).
- Up to 8 items per list or column; the item's text stays on one line (it shrinks down to 28 px to fit; if it still does not fit,
  the render stops with "ITEM TOO LONG" and the item to shorten).
- Two columns, no more and no less, in the `colunas` structure.
- The counter counts marked items (✓ and ✕ together); there is no separate "does" and "doesn't" counter besides the column one.
- With `camera: "segue"` in portrait, the counter (at the bottom) leaves the frame while the camera is on the items and comes back at the end.
