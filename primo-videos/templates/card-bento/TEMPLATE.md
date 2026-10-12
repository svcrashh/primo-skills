# Template: bento grid

A bento grid (cards of different sizes, fitted together with no gaps) that builds itself piece by piece. Each card has an
icon, a short title and a **drawn mini-visual** (bars, color dots, number, page, slides, player, sound
wave, letters or images). The camera tours: it reaches each card, that card's mini-visual animates, and at the end it pulls back to the
whole grid. The closing is the logo only. Style card: `references/catalog/styles/card-bento.md`.

## When to use
- Overview of a product with several functions: one function per card (3 to 7 is best).
- What comes in a package or in a new version, item by item, with the number of each one.
- Opening of a bigger video or a "what it is" page, when the person needs to see the whole before the detail.

## When NOT to use
- Teaching the click path (that is a tutorial: Real screen with camera).
- A single function, or a single number (use Counting number).
- More than 9 items: the grid gets tiny and the tour goes past 15 s. Split it, or pass `visitar` with the ones the camera visits.
- Comparing two states (that is Before and after).

## What the video looks like
| Segment | What it has | Time (medium pace) |
|---|---|---|
| Build | the cards enter one by one (`entrada`: `pop` or `sobe`), the camera slowly pulls back from 1.06 to 1 | 0.12 + 0.16 per card + 0.6 s |
| Visit (each card) | the camera goes to the card (0.65 s), the mini-visual animates, the camera slowly pushes in; the neighbors' text fades out (only the shapes remain, nothing cut at the edge) | 1.6 s |
| Pull back | the camera returns to the whole grid, all mini-visuals done | 1.4 s |
| Closing | transition to the closing background, logo centered and still | 0.7 + 2.0 s |

`montagem: "no-caminho"` changes the order: there is no build beforehand; each card enters when the camera reaches it, and the whole
grid only appears on the pull-back (that is the reveal). A card the camera does not visit (`visitar`) enters on the pull-back.

A card that does not fit at zoom 1.3 (one that takes the whole height or the whole width of the grid) is **traversed**: the camera stops
at the header and moves down (or to the right) to the visual, and the header fades out on the way, so it does not stop cut at the
edge; it comes back on the pull-back.

## Parameters (`example.json`)
```jsonc
{
  "nome": "card-bento-example", "formatos": ["16x9", "9x16"],
  "marca": {
    "nome": "Your brand",
    "cores": { "fundo", "texto", "destaque", "ladrilho", "vazio" },   // destaque = the visual's shape; ladrilho = behind the icon;
                                                                      // vazio = the visual's skeleton before the camera arrives
    "cartoes": [{ "fundo": "#…", "texto": "#…" }, …],                // the card colors, in a cycle (or "#hex")
    "fontes": { "titulo": { "familia", "peso" }, "texto": { "familia", "peso" } },
    "raio": 32
  },
  "camera": { "modo": "zoom" | "travelling", "zoom": 1.8, "zoomMax": 2.6 },
  "montagem": "antes" | "no-caminho", "entrada": "pop" | "sobe",
  "ritmo": "calmo" | "medio" | "rapido" | { "entrada", "visita", "movimento", "recuo", "transicao", "logo" },
  "colunas": { "16x9": 4, "9x16": 2 },        // optional; default 4 in landscape, 2 in 9:16, 3 in 1:1 and 4:5
  "visitar": [0, 2, 3],                       // optional; default: all, in order
  "cartoes": [{ "titulo", "texto", "icone": "x.png", "tamanho": "pequeno|largo|alto|grande", "cor", "tinta",
                "visual": { "tipo": "…", … } }],
  "fecho": { "logo": "x.png", "fundo": "#…", "transicao": "zoom-through|push|whip|mascara|virada|corte",
             "cartao": 0, "largura": 620, "dur": 2.0, "cor": "#…" },
  "trilha": { "semente", "identidade" }      // assets/audio/API.md, identity v2
}
```
- `titulo`: up to 7 words; `texto`: up to 14 (2 lines). The template picks the largest type size that fits in 2 lines on the card;
  text that does not fit even at the minimum (28 px in landscape) is dropped from that format, with a warning in the console.
- `tamanho`: `pequeno` 1×1, `largo` 2×1, `alto` 1×2, `grande` 2×2 cells. The grid packs in order, in the first free
  spot, and stretches the neighbor into each gap (to the right, otherwise downward): `plan.js` → `empacotar`.
- A card with `width ÷ height ≥ 1.75`: icon and text on the left, visual on the right; otherwise, header on top and visual below.
- `fecho.transicao`: `zoom-through` dives into the icon tile of card `fecho.cartao` (a flat color fills the screen, the logo
  is born from inside); `push` and `whip` push to the left; `mascara` opens in a circle; `virada` flips the frame.
- Without `fecho.logo`, the closing writes `marca.nome` in the title font, in the `fecho.cor` color.
- No brand color, font or logo in the code: everything comes from the JSON. Format examples: `example.json` (4
  cards, guided zoom, the grid builds first, closing by zoom through) and `example-travelling.json` (7 cards on a
  dark background, travelling camera, build along the way, image, color, letter and number mini-visuals, closing by
  push). Both are in greys, with placeholder texts, images and logo: they show the parameters, not a brand.

### Mini-visuals (`visual.tipo`)
| type | fields | what happens when the camera arrives |
|---|---|---|
| `cores` | `cores` (list, or list of rows), `colunas` | the dots leave the skeleton and take on their color, one by one |
| `barras` | `valores`, `cores` | the bars grow to the value, and then breathe |
| `numero` | `valor`, `sufixo`, `inicio`, `de` (progress ring), `rotulo`, `cor` | the number counts; with `de`, the ring fills up to `valor` ÷ `de` |
| `linhas` | `linhas` (3–6), `busca` (false removes the search bar) | the search bar and the text lines draw themselves; the cursor blinks |
| `slides` | `fundo` | three slide thumbnails fan out |
| `play` | `tela`, `icone` | the play button appears and the progress bar moves (and keeps moving) |
| `onda` | `barras`, `travada` | the sound wave moves; with `travada`, it fades out and a padlock appears |
| `letras` | `texto` ("Aa"), `pesos` | the big letters rise and the weights appear one by one |
| `imagens` | `imagens` (up to 6: a path or `{ src, fundo, respiro, posicao }`), `fundo`, `ajuste` (`cobre`), `forma` (`livre`), `proporcao`, `colunas` | the tiles appear one by one; an image is marked: no text may cross it |

## Formats
16:9, 19:9 (2280×1080), 21:9 (2520×1080), 9:16, 1:1 and 4:5, **recomposed**: the grid is packed again in each
format (4 columns in landscape, 2 in 9:16, 3 in 1:1 and 4:5), inside the safe area.
- **19:9 and 21:9**: through the engine's `L()`, the 16:9 numbers apply; the grid area has a 6% margin of the width (the
  cells get wider, up to 2× the height; what is left over becomes margin, with the grid centered).
- **9:16**: the grid sits in the Reels safe area (x 80–940, y 270–1430) and the camera brings each card to its center,
  away from the buttons on the right.
- The text in the wide shot is small on purpose (it is the whole grid); it is readable on the visit. The refinement check warns ("plano geral", wide shot).

## How to render
```sh
node scripts/example-fonts.mjs <output>/.work-<name>     # examples only: their Inter, no network (a real video uses the brand's font)
node templates/card-bento/render.mjs <parameters.json> --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound] [--assemble-only]
```
- It checks the parameters (each error says what to change) and the images before building anything.
- It builds `<output>/.work-<name>/` (template + `assets/template/engine.js` + `params.js` + fonts + media). `--assemble-only` stops
  there: preview at `<build>/index.html?f=9x16&play`, frames with `node scripts/frames.cjs --project <build> --format 9x16 --check`.
- Soundtrack: the skill's (`assets/audio/arrange_series.py`, lead role), an accent on each camera arrival and on the logo
  (mandatory), checked by `verify.py` (−14 LUFS; if rejected, it recomposes at −16) and joined by `scripts/finalize.mjs`.
  Without a Python with numpy and scipy, or with `--no-sound`, it comes out silent.
- Out come `<output>/<name>-<format>[-draft].mp4` and `…-sheet.png`: **look at the contact sheet**.
- Refinement: `node scripts/refine.mjs <build> --video <output>/<name>-16x9.mp4 --format 16x9 --channel site`.

## Limits
- Icon and image in PNG or JPEG only (the logo's size is read from the file; another format needs `fecho.logoAspecto`).
- The mini-visual is a generic drawing: it is not the product's screen. To show the screen, use Real screen with camera or Rolling list.
- The closing is only the logo (or `marca.nome`, when there is no logo): there is no field for a slogan or an address.
- Using a single icon set per piece is the brand's choice, not a template rule: the template accepts any PNG.
- 9 cards at most; with many cards in 9:16 the cells get short and the text may drop out of some cards (warning
  in the console, `card "…": the text did not fit in this format`). Look at that format's contact sheet.
- The transition from one card to another is always the camera's movement; `fecho.transicao` is only the one from the grid to the logo.
