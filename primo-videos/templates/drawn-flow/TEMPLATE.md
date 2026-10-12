# Template: Drawn flow

A diagram of nodes and arrows that draws itself on screen (the outline of each node and each arrow are strokes that
travel), and a **packet** that travels the path: each node **lights up** when the packet reaches it, and the arrow it
went through stays lit with little dots running along it. The graph (nodes, arrows, branches) comes from the JSON and
is laid out in layers automatically. Each node can carry one of the brand's icons. The closing is only the logo (a
limit of this template: no sentence, slogan or address).
Style card: `references/catalog/styles/drawn-flow.md`.

## When to use
- Architecture, process, "where the data comes from": 3 to 8 pieces that connect in an order.
- Showing the path of a request, a file or a piece of information, from start to end.
- Showing where the path **stops** (a rule, a missing approval): the arrow with a lock.

## When NOT to use
- Teaching where to click (that's a tutorial: `real-screen-camera`).
- Explaining an idea that calls for freehand drawing, a counting number or a chart alongside (that's `drawn-explainer`).
- More than 8 pieces, or more than 3 side by side in the same layer: the text gets tiny. Split or merge steps.
- A cycle (A → B → A): the flow moves in one direction only; the template rejects it and says which arrow to remove.

## What the video looks like
| Part | What it has | Time (medium pace) |
|---|---|---|
| Frame 0 | the call to action (pill) and the first node already drawing itself | 0 s |
| Drawing | layer by layer: the node's outline traces itself, the tile fills in dimmed, the icon comes in, the label rises; then the arrows leaving it draw themselves and the arrowhead appears | 0.22 s per layer + 0.45 s per arrow |
| Journey | the packet leaves the sources; at each node it waits out the pause and travels to the next; the node lights up (pulse, ring, full color) and its detail appears | pause 0.45 s + travel 0.75 s per hop |
| Lock | on an arrow with `"trava": true`, the packet stops at the gate (middle of the arrow, dashed) and the node after it never lights up | travel × 1.15 |
| End | the camera pulls back to the whole diagram, everything lit, dots running | 1.2 s |
| Closing | transition (hard cut, mask or zoom through the last node) and the logo, centered and still | 0.6–0.7 + 2.4 s |

Two or more nodes connected to the same previous node: the packet splits and travels both arrows at the same time
(branching). Two arrows arriving at the same node: it lights up with the first one that arrives (join).

## Parameters (`example.json`)
```jsonc
{
  "nome": "drawn-flow-example", "titulo": "…", "formatos": ["16x9", "9x16"],
  "chamada": "How your product works",            // the pill on frame 0 (optional)
  "leiaute": "full-screen" | "dividido",           // dividido: column on the left with the pill, the "titulo" and the list of details
  "direcao": "horizontal" | "vertical",           // in landscape formats; in 9:16, 1:1 and 4:5 the flow always goes down
  "camera": "estatica" | "travelling",            // estatica opens pulling back (1,06 → 1) and breathes (up to 1,035); travelling follows the packet (zoom 1,45 in 16:9)
  "transicao": "cut-on-beat" | "mascara" | "zoom-through",
  "ritmo": "calmo" | "medio" | "rapido" | { "desenho", "traco", "pausa", "viagem", "final" },   // seconds
  "zoom": 1.45,                                   // optional: the zoom of the travelling camera
  "marca": {
    "nome": "…", "fonte": "Inter",                // one family (Google Fonts, or the examples' Inter via example-fonts.mjs)
    "pesos": { "titulo": 700, "rotulo": 700, "detalhe": 500, "chamada": 600 },
    "cores": { "fundo", "texto", "ladrilho", "linha", "aceso",          // required, #RRGGBB
               "apoio", "pacote", "trava", "chamadaFundo", "chamadaTexto" },   // optional
    "apagado": 0.45, "linhaAlfa": 1                // the tile before it lights up; the opacity of the unlit arrows
  },
  "nos": [{ "id": "first", "rotulo": "First step", "detalhe": "what starts the path", "icone": "caminho/icone.png" }],
  "setas": [{ "de": "first", "para": "second" }, { "de": "product", "para": "outside", "trava": true }, { "de": "a", "para": "b", "tracejada": true }],
  "fecho": { "logo": "caminho/logo.png", "fundo": "#F5F5F5", "dur": 2.4, "largura": 640, "de": "result" },   // "de": the node the transition starts from
  "trilha": { "semente": 4122, "identidade": { "genero": "house", … } }   // assets/audio/API.md, identity v2
}
```
- `rotulo` up to 5 words, `detalhe` up to 9 (wraps into balanced lines). In the `dividido` layout, the detail goes to
  the column's list, in the order the nodes light up (the locked one with the hollow bullet).
- A node without `icone` gets a dot on its tile. The icons work best as **a single-color set** of the brand, on a tile
  that contrasts with them (the examples use `assets/example/icon-placeholder.png` on a light tile).
- The closing rejects `texto`, `bordao`, `slogan`, `url`, `frase`, `titulo`: in this template it is just the logo.
- Everything not in the JSON has a default: `full-screen`, `horizontal`, `estatica`, `cut-on-beat`, `medio`.

Format examples: `example.json` (five nodes in a row: horizontal, full screen, camera that follows, zoom through,
medium pace) and `example-vertical.json` (four nodes: split, vertical, branched, with a lock, static, mask, calm).
Both are brand-free: greys, placeholder texts, the placeholder icon and the placeholder logo of `assets/example/`.

## How to render
```zsh
node scripts/example-fonts.mjs <output>/.work-<name>        # examples only: their Inter, no network
node templates/drawn-flow/render.mjs <parameters.json> --out <output> [--mode draft|final] [--formats 16x9,9x16] [--no-sound] [--no-check] [--assemble-only]
```
Formats: `16x9`, `19x9`, `21x9`, `9x16`, `1x1`, `4x5`. It does, in order: checks the JSON (stops before creating any
folder, saying what to fix) → assembles the build in `<output>/.work-<name>/` → `scripts/frames.cjs --check` on each
format (text covered, outside the safe area or over a node's tile: exit code 4) → the soundtrack via
`assets/audio/arrange_series.py` (lead: a blip that rises with each node that lights up, a tap on the lock, a whoosh on
the transition, an accent on the logo), measured by `verify.py` → `scripts/render.cjs` → `scripts/finalize.mjs` →
the contact sheet.
Out come `<output>/<name>-<format>[-draft].mp4` and `…-sheet.jpg`: **look at the sheet**. `--assemble-only` stops after
assembling the build (`index.html?f=9x16&t=4.2` shows a frozen instant; `?play` plays it).

Refinement check of the rendered video: `node scripts/refine.mjs <output>/<name>-16x9.mp4 --project <output>/.work-<name> --format 16x9 --channel site`.

## Formats
- **16:9, 19:9, 21:9:** landscape (layers from left to right, the text below the tile) or vertical; the wide ones
  stretch the cells across the width (the type size is the 16:9 one). In `dividido`, the column takes 38% of the width.
- **9:16, 1:1, 4:5:** the flow goes down, the text beside the tile; in 9:16 everything sits inside the Reels safe area
  (x 70–940, y 250–1450). With the camera that follows, the call to action leaves when the packet sets off (the diagram
  rises to the top) and the camera aims at the middle of the safe area, not the middle of the frame.
- Text the camera pushes to the edge fades out instead of getting cut; the tile disappears under the call to action.

## Limits
- Graph with no cycle, up to 8 nodes and 3 per layer. An arrow that skips layers passes behind the nodes in between
  (rare; reorder).
- Arrow without a label: what the arrow means goes in the node's `detalhe` (text on top of the arrow would clash with
  the drawing).
- Node with a PNG icon only; no photo inside the node.
- A single font family (label, detail, call to action and title).
- No narration: this template has no voice. For a video with voice (opt-in, `references/voice-script.md`), the closest style that
  takes it is `drawn-explainer` (the idea or the flow drawn by hand, scene by scene).
