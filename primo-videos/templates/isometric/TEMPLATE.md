# Template: Isometric

Blocks **modelled in 3D** (WebGL, with the skill's three.js in `assets/3d/three.bundle.js`) under an orthographic
isometric camera (no perspective, as in isometric drawing) that **stack up in layers**. Every block is a box with
rounded edges and corners, and every face is **one flat brand color**: the exact `topo` / `frente` / `lado` hex of the
JSON. Each layer comes in from above the frame already solid, lands with a small squash and settles; then its label
comes in **beside it, outside the blocks**, tied to the layer by a thread. The camera orbits slowly (or rises and pulls
back along with the stack) and keeps turning through a short hold on the whole stack. The closing is only the logo (a
limit of this template: no sentence, slogan or address).
With `"modo": "aparelho"` the same three parts become a 3D device under a soft studio light (see "Device mode").
Style card: `references/catalog/styles/isometric.md`.

## What the look guarantees
- **Flat color, no gradient, no shadow, no border:** the faces are not lit. The shader writes the JSON hex as it is
  (no light, specular, ambient occlusion, fog or tone mapping), so the frame shows exactly the brand's colors; the
  depth comes from the three faces in three shades of the same family.
- **Generously rounded corners:** every edge and corner of a block is rounded (radius 13% of the block's smallest
  side). On the rounded edge the color switches hard at the 45° line, by the face that dominates there (top → `topo`,
  front → `frente`, side → `lado`): a flat brand color with a rounded 3D silhouette, never a shaded bevel.
- **No floor, no shadow plane, no translucency:** the stack stands on the background; the layer that falls is solid.
- **Only the JSON's colors in every frame:** the highlight (`destaque`) switches in one frame instead of blending (a
  blend of two brand colors is a third color outside the palette); the edges are antialiased (MSAA, drawn at 2× and
  reduced).
- Text only on the background (`texto` on `fundo`: a pair that reads), in one font family; the closing logo is not
  altered.

## When to use
- The layers of a system, a package or a platform: what sits at the base, what sits on top of what.
- The steps of a process that rest on one another (each step is the floor of the next).
- A "stack" of 2 to 6 parts, each one with a short name and one line of detail.

## When NOT to use
- A path with branching or a loop back (that's `drawn-flow`: arrows, not a stack).
- Teaching where to click (that's `real-screen-camera`).
- More than 6 layers, or parts that don't rest on each other (a loose list is `rolling-list` or `card-bento`).
- Showing the real product: the blocks are abstract, with no screenshot or photo inside.

## What the video looks like
| Part | What it has | Time (medium pace) |
|---|---|---|
| Frame 0 | the call to action (pill) and the base already landing | 0 s |
| Each layer | comes in from above the frame, already solid in its colors, falls (accelerating), lands with a small squash (~9%) and settles in about half a second, with the thud; right after, the thread draws itself and the label rises | 1.5 s per layer (fall 0.5 s) |
| Highlight (optional) | with `destaque`, the layer takes the highlight colors the moment it is named and goes back to its own colors when the next one is named (a hard switch) | — |
| End | a short hold on the whole stack, the camera still turning slowly | 1.4 s |
| Closing | hard cut or mask (a circle that grows from the top of the stack) and the logo, centered and still | 0–0.6 + 2.4 s |

Camera:
- **`orbita`**: circles the stack while it is built (by default from 18° to 70° with the labels on the right, from 72°
  to 20° with them on the left; `giro: [de, até]` changes it), fixed tilt (`inclinacao`, 30°), zoom almost still. The
  turn never brakes to a stop: a little faster in the middle, and still turning slowly in the hold until the cut.
- **`dolly-3d`**: starts low and close to the base and, with each layer that lands, rises and pulls back to frame the
  part already built (zoom up to 1.8, or less: the stack never pushes the labels out of the safe area); the tilt goes
  from 14° to 34° and the rotation sways a little and keeps going in the hold. At the end, the whole stack.

## Device mode (`"modo": "aparelho"`, `example-device.json`)
The same three parts as a device, in soft 3D (rounded, matte, a gentle studio light and a short, light contact shadow;
the stack mode stays flat). From the bottom up, the 3 layers of the JSON are:
1. **the tray** (`cor.topo` = the tray, `cor.frente` = the wells): thick, very rounded, with one shallow well per key;
2. **the keys** (`pecas`: 2 to 6, each `{ "cor", "icone" }`): soft keys with a slightly concave top; the brand's icon
   is printed on the top face as it is (never recolored);
3. **the monitor** (`cor.frente` = the frame, `cor.topo` = the hinge and the buttons): a thick rounded frame on a metal
   hinge, two buttons on top and one on the side; the screen shows `tela.carregando` with the percentage and a
   segmented bar, then `tela.pronto` with a drawn check mark.

| Part | What it has | Time (scene; the example adds the 1 s logo opening) |
|---|---|---|
| Frame 0 | the pill and the tray already falling | 0 s |
| Tray | lands with a small squash; its label and line appear | lands 0.3 s, named 0.5 s |
| Keys | drop one by one into the wells, each with a small squash | land 1.16–1.58 s (4 keys), named 1.8 s |
| Monitor | the hinge grows, the monitor opens on it with a small overshoot | 1.9–2.75 s, named 2.85 s |
| Typing | 10 key presses, one every 0.2 s; each takes the bar 10% further and the number climbs | 3.0–4.8 s |
| Done | the screen switches to `tela.pronto` and the check mark | 5.05 s |
| Hold | the whole device, the camera still turning slowly | to 6.6 s |
| Closing | hard cut to the logo, centered and still | 6.6 + 2.4 s |

- **Labels:** one column on the right, the same left margin, the same space between them (top to bottom: the monitor,
  the keys, the tray). Each line is horizontal, at the height of its label; its dot keeps a small gap from the edge
  of its own object and follows that edge as the camera turns (read from an ID map of the 3D scene, frame by frame);
  the heights are chosen so no line runs along an edge. The line appears ready with its label (it does not draw).
- **Screen:** neutral colors and no glow: `"tela": { "fundo": "#EBEBEB", "texto": "#1D1D1D", "cheio": "#1D1D1D",
  "vazio": "#DEDEDE", "carregando": "Loading…", "pronto": "Checked" }` (the defaults); short status texts (up to 4
  words), no slogan.
- **Camera:** a slight perspective, turning slowly the whole time (from 23° to 37°). `ritmo`, `camera`, `rotulos`,
  `transicao`, `explodido` and `destaque` don't apply in this mode (its timing is the table above).
- **Formats:** horizontal only (16x9, 19x9, 21x9): the renderer refuses the others.
- **Brand:** the light shades the matte faces, so the 3D colors are the brand's colors under light (not the exact hex);
  the screen, the text and the background are the exact hexes. The icons are never altered.

## Parameters (`example.json`)
```jsonc
{
  "nome": "isometric-example", "titulo": "…", "formatos": ["16x9", "9x16"],
  "chamada": "Your product",                      // the pill on frame 0 (optional)
  "rotulos": "direita" | "esquerda",              // which side of the stack the labels go on
  "camera": "orbita" | "dolly-3d",
  "giro": [18, 70], "inclinacao": 30,             // optional (degrees)
  "transicao": "cut-on-beat" | "mascara",
  "ritmo": "calmo" | "medio" | "rapido" | { "passo", "queda", "nomeia", "final" },   // seconds
  "modo": "pilha" | "aparelho",                   // the stack (default) or the device (see "Device mode")
  "explodido": true,                              // layers spread apart (default in 9:16, 4:5 and 1:1; false packs them together)
  "pilha": 0.54,                                  // optional: the fraction of the width for the stack
  "marca": {
    "nome": "…", "fonte": "Inter",                // one family
    "pesos": { "rotulo": 700, "detalhe": 500, "chamada": 600 },
    "cores": { "fundo", "texto", "linha",                                  // required, #RRGGBB (linha = the thread and the dot)
               "apoio", "chamadaFundo", "chamadaTexto" },                  // optional
    "linhaAlfa": 0.85
  },
  "camadas": [                                    // from bottom to top, 2 to 6
    { "rotulo": "The base", "detalhe": "what everything else rests on",
      "cor": { "topo": "#F5F5F5", "frente": "#EBEBEB", "lado": "#DEDEDE" },   // the three visible faces, exact on screen
      "partes": 1, "largura": 1, "altura": 1 }    // blocks side by side (1–9, in a grid); fraction of the base; thickness
  ],
  "destaque": { "topo", "frente", "lado" },        // optional: the color of the layer just named
  "fecho": { "logo": "caminho/logo.png", "fundo": "#F5F5F5", "dur": 2.4, "largura": 640 },
  "trilha": { "semente": 3086, "identidade": { "genero": "acustico", … } }
}
```
- `rotulo` up to 5 words, `detalhe` up to 9 (wraps into balanced lines in the label column).
- Without `largura`, the layers narrow toward the top (1, 0.87, 0.74…). The three colors of each layer are **flat** (no
  gradient or border): three shades of the same color family of the brand read best, from the lightest (top) to the
  darkest (side).
  `frente` is the face turned to the +z side (on the right of the stack with the default angles), `lado` the others.
- Old JSON keeps working: `marca.cores.chao`, `marca.chaoAlfa` and `marca.fantasma` (the floor and the translucent
  falling layer of the earlier CSS version) are accepted and ignored.
- The closing rejects `texto`, `bordao`, `slogan`, `url`, `frase`, `titulo`: in this template it is just the logo.
- Everything not in the JSON has a default: labels on the `direita` (right), `orbita`, `cut-on-beat`, `medio`.

Format examples: `example.json` (a stack of three layers with 1, 4 and 2 blocks; orbit, labels on the right, calm,
hard cut), `example-exploded.json` (five steps as five layers; dolly-3d, labels on the left, exploded, highlight, fast,
mask) and `example-device.json` (the device mode: a tray, four keys and a monitor). All three are brand-free: greys,
placeholder texts, the placeholder icon and the placeholder logo of `assets/example/`.

## How to render
```zsh
node scripts/example-fonts.mjs <output>/.work-<name>        # examples only: their Inter, no network
node templates/isometric/render.mjs <parameters.json> --out <output> [--mode draft|final] [--formats 16x9,9x16] [--no-sound] [--no-check] [--assemble-only]
```
Formats: `16x9`, `19x9`, `21x9`, `9x16`, `1x1`, `4x5`. It does, in order: checks the JSON (stops before creating any
folder) → assembles the build in `<output>/.work-<name>/` (with `three.bundle.js`) → `scripts/frames.cjs --check` on
each format (text covered, outside the safe area or crossing a landed layer: exit code 4; the check cannot see inside
WebGL, so each face of a landed block is also an invisible rectangle it reads) → the soundtrack via
`assets/audio/arrange_series.py` (lead: the thud of each layer that lands, a blip that rises with each layer that is
named, a whoosh on the transition, an accent on the logo), measured by `verify.py` → `scripts/render.cjs` →
`scripts/finalize.mjs` → the contact sheet.
The render prints a `WebGL:` line: it must be the GPU (on a Mac, `ANGLE Metal Renderer: Apple …`), never
SwiftShader (on a Mac, `render.cjs` stops with code 5 if it falls back to the CPU).
Out come `<output>/<name>-<format>[-draft].mp4` and `…-sheet.jpg`: **look at the sheet**.

Refinement check of the rendered video: `node scripts/refine.mjs <output>/<name>-16x9.mp4 --project <output>/.work-<name> --format 16x9 --channel site`.

## Formats
- The stack and the label column form a group centered across the width; the scale comes from fitting the whole stack
  in its region (54% of the width in landscape) in every camera pose.
- **16:9, 19:9, 21:9:** the stack on one side, the labels on the other; the wide ones stretch the region (the type
  size is the 16:9 one).
- **9:16 and 4:5:** the stack exploded (layers spread well apart, to fill the height: 1.3 of the base in the orbit, 0.8
  in the dolly, which comes close), labels beside it, inside the Reels safe area (x 70–940, y 250–1450). **1:1:**
  slightly exploded.
- The label follows the height of its own layer and is pushed so it doesn't touch its neighbor; it never sits on top
  of a block.

## Limits
- Boxes with rounded edges (no freeform shapes), no photo or icon on the faces, no shadow, floor or lighting (the
  stack mode is flat; the icons and the light belong to the device mode).
- The falling layer is solid and comes in from above the frame, so it may pass behind the call to action for an
  instant; only the landed one counts for the text-over-image check.
- Up to 6 layers; with 5 or more, the stack gets tall and narrow in 16:9 (the dolly-3d makes up for it by coming close
  at the start).
- Needs WebGL 2 in the render's Chromium (the skill's `scripts/playwright.cjs` opens it on the GPU).
- No narration: this template has no voice. For a video with voice (opt-in, `references/voice-script.md`), the closest style that
  takes it is `drawn-explainer` (how a system works inside).
