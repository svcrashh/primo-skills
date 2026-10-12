# Template: Counting number

A big number, on its own, that rises to its final value, and only then the three-word label that says what it
counts. It is rule 5 of the catalog ("one number, big, with a 3-word label proves more than any adjective") turned
into a 6 to 20 s video, or into an opening/closing block for another template.

It combines, from the catalog: counting number, number as a refrain, before → after tag, running number and rising
count. Full style card: `references/catalog/` (style "Counting number").

## When to use
- Closing a quarter, a year or an update with a true number: "12 new features", "1,248 requests", "50+ improvements".
- Reporting back to a client, an investor or a community (Reels, 1:1 feed, silent big screen).
- A parameter change that has a number: limit, deadline, price, weight, time ("2,739 KB → 1,060 KB").
- A 2 s hook before another template (Rolling list, Chapters with index).

## When NOT to use
- A new product with no number of its own, or a small number that sounds like an excuse.
- A made-up number. Never: with no true number, use another style.
- Client money, health, any subject where counting sounds like bragging.
- Teaching how to use something (that's a tutorial: Real screen with camera).

## Blocks (the order is free, 2 to 5 per video)
| type | what it does | default duration |
|---|---|---|
| `contador` | the number alone counts from `de` to `ate` (1.35 s, with motion blur), stays alone until `sozinho` (1.6 s), shrinks and the `rotulo` rises below it. With `lista`, the items scroll beside it (16:9, 1:1) or below it (9:16), the middle one lit in the highlight color | 4.6 s; with a list 2.9 s + 0.28 s per item |
| `cartoes` | 2 to 4 numbers, one per flat-color card (palette `cores.cartoes`), coming in like ink from a corner; the text picks a readable color on its own (or `tinta` on the item fixes the text color, to land on an approved brand pair) | 0.25 s + `cada` (1.5 s) per item |
| `before-after` | `NAME` tag, the old value that gets struck through and fades, arrow, the new value counting up to the final one, two proportional bars and the pill label (`2.6× lighter`) | 4.4 s |
| `refrao` | the number repeated in strips running in opposite directions, the middle one filled in the highlight color | 2.6 s |
| `fecho` | logo (image) or the brand name in the number font, catchphrase and address (without those two, only the logo, centered); `fundo` gives the closing its own color, on a hard cut | 2.8 s |

On top of everything: the **call to action** (`chamada`) written on frame 0 — the promise — until the end of the first
block; and the **caption** of each line, word by word, timed to the narration.

Each block grows on its own to fit the line: `em + line duration + 0.5 s`.

## Parameters (`example.json`)
```jsonc
{
  "titulo": "…", "idioma": "pt-BR", "formatos": ["16x9", "9x16", "1x1"],
  "chamada": "Brand · what this video promises",        // frame 0
  "lista_numerada": true,                                // "01 Layouts" in the counter's list
  "milhar": ".",                                         // thousands separator
  "marca": {
    "nome": "…", "logo": "caminho/logo.png", "logoProporcao": 5.33,   // no logo: the name written in the number font
    "cores": { "fundo", "texto", "acento", "legendaFundo", "cartoes": ["#…", "#…"] },
    "fontes": { "numero": { "familia", "peso", "caixaAlta", "espaco" }, "texto": {…}, "etiqueta": {…} },  // Google Fonts
    "grade": true, "brilho": 0.13, "grao": 0.06
  },
  "voz": { "id", "nome", "perfil": "reels", "ajustes": { "speed": 1.06 }, "pronuncia": { "app": "ép" } },
  "trilha": { "semente": 1001, "identidade": { "genero": "house", … } },   // assets/audio/API.md, identity v2
  "blocos": [
    { "tipo": "contador", "de": 0, "ate": 12, "prefixo": "", "sufixo": "+", "casas": 0, "rotulo": "new features live",
      "lista": ["…"], "sozinho": 1.6, "fala": "Twelve new features live." },
    { "tipo": "cartoes", "cada": 1.5, "itens": [{ "valor": 33, "rotulo": "ready-made layouts", "sufixo": " min", "casas": 1, "cor": "#…" }] },
    { "tipo": "before-after", "nome": "Page weight", "de": 2739, "ate": 1060, "unidade": "KB", "rotulo": "2.6× lighter", "fala": "…" },
    { "tipo": "refrao", "texto": "1,248 requests" },
    { "tipo": "fecho" }   // by default the logo alone; "bordao" and "url" only when the brand has them and the person wants them
  ]
}
```
`fala` accepts text or `{ "texto", "em" }` (`em` = seconds after the start of the block; default: in the counter, right
after the number is left alone; in the others, 0.45 s).
Without narration, the lines and the `voz` block are left out (`prepare.mjs` warns about it): no captions, each block
with its default duration, and the call to action, the numbers and the labels tell the story.

`marca.fontes.etiqueta.caixaAlta: false` leaves the call to action as it was written (no uppercase and without its
letter spacing).

Options off by default (without them, the video comes out as before):
- `marca.simbolo`: `{ "arquivo", "altura", "x", "y", "gira", "proporcao" }` puts the brand's symbol, giant, in the
  background, cropped by the edge, rotating `gira` degrees per second (`x`/`y` = the center, as a fraction of the
  frame; `altura` in px). It is the brand's PNG as it is, not recolored; the cards and the closing with `fundo` cover it.
- `marca.fontes.texto.pesoRotulo`: the weight of the counter's and the cards' label (600 without it). Use 700 when the
  color pair only passes for large text (AA18, e.g. a light text on the brand's mid-tone color), which only holds for
  a large title in Bold.
- `passagem`: `{ "tipo": "whip" | "push" | "mascara" | …, "dur": 0.45, "dir": "esquerda" }` replaces the rise-and-fade
  at the end of each block with an engine transition (`TR`): the outgoing block stays `dur` s longer, leaving, while
  the next one comes in.
- `camera`: `{ "zoom": 0.07, "origem": [x, y] }` makes each block (except the closing) move in slowly, from `1 − zoom`
  to the layout size, starting from `origem` (fraction of the frame; without it, the center of the area).
- in the `cartoes` block, `entrada`: `"whip"` or `"push"` instead of the ink that opens from a corner (`dir` changes
  the side).

Format examples (greys, placeholder texts and logo, sample numbers; run `node scripts/example-fonts.mjs <video-folder>`
before the render so the examples' Inter is there with no network): `example.json` (three formats, a counter with a
scrolling list, three color cards, closing with the logo only), `example-whip.json` (the brand-color background with
the giant symbol, whip between blocks and cards) and `example-push.json` (dark background, one number per screen, push
between them and the camera moving in).

## How to render
```zsh
templates/counting-number/render.sh <parameters.json> <video-folder> 16x9,9x16 final
```
Formats: `16x9`, `19x9`, `21x9`, `9x16`, `1x1`, `4x5`.
It does, in order: `prepare.mjs` (copies the template and the skill's `engine.js`, downloads the fonts, writes
`params.js`, `audio/sheet.json` and `audio/identity.json`) → `arrange_series.py` (the soundtrack; without voice, in
the lead role) → `render.cjs` per format → `finalize.mjs` (checks duration, loudness and peak in the AAC) → contact
sheet in `delivery/`. Without a Python with numpy and scipy, the video comes out silent (and the script warns).

To look at single frames without rendering: `node scripts/frames.cjs --project <folder> --format 9x16 --times 0,2,5`.

## Formats
16:9 (number up to ~70% of the usable height, list on the right), 19:9 (2280×1080) and 21:9 (2520×1080), 9:16 (Reels
safe area, number on top and list below, caption above the button strip), 1:1 (like 16:9, narrower) and 4:5
(like 9:16). Recomposed, not cropped.

- **19:9 and 21:9**: the content area is the 16:9 one stretched across the width (margin of 110/1920 of W: x 131–2149
  in 19:9, 144–2376 in 21:9, inside the 5%), centered. Of the extra width over 16:9 (360 px in 19:9, 600 in 21:9), half
  goes inside the composition: between the number and the scrolling list, in the arrow of `before-after` and in the
  length of the bars; the other half stays in the margins. Number and text sizes as in 16:9 (the height is 1080 in all
  three).
- 16:9, 9:16, 1:1 and 4:5 have not changed (same position, size and style for each element).

## Limits (what the template doesn't do)
- **Offer sign** (price/deadline in a stamp with an outline) and **sheet coming out of the slot**: not
  done. Today they fall back to `before-after` (deadline, price) or to `contador` with `prefixo: "R$"`.
- **Screen proof**: the number doesn't bring the product screen along. To show where the number lives, use the
  Before and after or Rolling list template after this block.
- **Block inside another template**: the code is one block per scene (`BLOCOS[tipo](root, b)` in `template.js`), but
  other templates don't import it yet (a request for the integrator).
- "Ink" transition with texture: here it is a circle that grows from a corner.
- A number with more than ~7 characters in 9:16 gets smaller (it fits the width, not the height). Prefer "1.2M".
