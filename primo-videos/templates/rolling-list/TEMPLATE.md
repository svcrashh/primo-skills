# Template: Rolling list

What's new, **without an index**. Each item is a **short sentence + the on-screen proof**: the interface redesigned,
large, doing what the sentence promises. A speed knob changes the whole video: **burst** (`rajada`), **list**
(`lista`) or **poster card** (`cartaz`). Closes with the **wall** (the size of the update) and the brand with the
catchphrase. It combines the style cards feature burst, lightning list, numbered list, phrase card and flash, features
in the feed, deconstructed UI and wall, poster card and proof, and the "new" tag in the corner (catalog §3,
template 3).

## When to use / when not

**Use** it for an update, patch notes and "what's new" with 3 to 10 items, for people who already know the product:
Reels and TikTok (burst), site, YouTube and WhatsApp (list), launch and silent feed (poster card). It is also the
template for when the last video was "Chapters with index" and the next one can't repeat the look.

**Don't use** it to teach the click path (use Real screen with camera), for a single new feature (use Before and after
or Counting number), or for people who have never seen the product (the burst turns into noise; at most, poster card).

## What the video looks like

| Part | What it has | Time |
|---|---|---|
| Opening | the big number + "updates …" + badge (date/version) + brand, **already written on frame 0** | 1.6–2.2 s |
| Items | panel with the proof in the same place on every item (the hard cut doesn't jump); in the corner, **always the same**, the item number on a colored tag + the short name; the sentence beside it (16:9) or below it (portrait) | 1.1 / 2.4 / 4.4 s per item |
| Wall | the total counting, the names of **all** the new features in pills (the ones shown get highlighted) | 2.4–2.6 s |
| Closing | phrase cards (optional) → brand, catchphrase and address, still for ≥ 1.2 s | 2.2 s (+0.9 per card) |
| Caption | the line, word by word, with the current word in the highlight color | whenever a line plays |

Background: the brand color with a light spot in the highlight color that moves with each part (and a fine grid, if
`gradeFundo`).

## Speeds (the knob)

| `velocidade` | Per item | What changes | For |
|---|---|---|---|
| `rajada` | 1.1 s | no sentence (the item name becomes the big text), flat-color background changing with every item (`marca.paleta`), sped-up proofs, phrase cards in the closing | Reels, TikTok, young consumers |
| `lista` | 2.4 s | numbered tag + sentence; live proof (tap, count, switch) | site, YouTube, WhatsApp, B2B |
| `cartaz` | 4.4 s | 1.5 s of a full-screen **poster card** (the big sentence, keyword in the highlight color) → the proof comes in over a color block | launch, silent feed, big screen |

`ritmo` in the JSON overrides any timing (`{ "item": 2.0, "muro": 3 }`); `itens[n].dur` changes just one item.

## Parameters (`example.json`)

- `marca`: `nome`, `tema` (`escuro`/`claro`), `logo` (PNG; without a logo, the name is written in the title font),
  `cores` (`fundo`, `superficie`, `campo`, `texto`, `destaque`, `tinta` = text over the highlight, `ok`), `paleta`
  (background colors of the burst and of the poster card blocks: light enough for the highlight tag to show), `fontes`
  (`titulo`, `texto`, `mono`, downloaded by `scripts/fonts.mjs`), `pesoTitulo`, `caixaAlta`, `inclina` (degrees of
  title slant), `gradeFundo`, `luz` (strength of the light spot, 0–0.2), `grao`.
- `velocidade`, `semente` (changes the path of the light), `ritmo`.
- New options, off by default (`example.json` uses all of them): `marca.plano: true` (flat color: panel with no
  shadow or outline, background with no vignette, lines with no outline); `marca.paleta` with objects `{ fundo, texto,
  destaque, tinta }` (in the burst, the item name and the numbered tag use the text pair of that background);
  `marca.cores.trilho` (track of the bar and of the switch when off, instead of the transparent text) and
  `marca.cores.pino` (the switch knob, instead of white); `respira: true` (the opening and the panel grow slowly
  through the whole part, so a proof that ends before the cut doesn't leave the frame still); `fecho.fundo` (closing
  background color). Closing with the logo only, no lines: the logo sits centered in the frame.
- `transicao` (off by default): `{ "tipo": "push" | "whip", "dur": 0.5, "dir": "esquerda" }` replaces the hard cut
  between one item and the next with an engine transition (`TR`): the outgoing item stays in frame `dur` s longer,
  leaving, while the next one comes in. Opening → 1st item and last item → closing stay as cuts.
- At the poster card speed, the item's sentence stays hidden while the poster card covers the screen and appears with
  the proof (before, it sat under the poster card without showing, and the collision check flagged it).
- Format examples (greys, placeholder texts and logo, sample numbers): `example.json` (burst: four features, a
  flat color per item), `example-poster.json` (poster card: three points, each with its poster and the proof over a
  color block) and `example-list.json` (list: four steps, items with push). An empty tag (`""`) leaves just the number
  and the sentence in the corner.
- `abertura`: `numero`, `linhas` (or `titulo`, split into 2), `selo`.
- `itens[]`: `etiqueta` (2–3 words: the name in the corner and on the wall), `frase` (≤ 6 words), `cartaz` and
  `palavraChave` (poster card speed), `cor` (poster card block), `dur`, `proof`.
- `muro`: `rotulo`, `extras` (the new features that didn't become an item), `total` (if it isn't items + extras).
  **Without `muro`, the video skips the wall.**
- `fecho`: `bordao`, `endereco`, `cartoes` (a sentence split into 2–3 cards) and `cartoesEm` (at which speeds).
- `falas[]`: `id`, `onde` (`abertura`, `muro`, `fecho` or `{ "item": n }`), `atraso` (s after the start of the
  part), `texto`.
- Without narration, the `falas` show up only as captions, at the time estimated from the text, and the JSON's `voz`
  block is left out: this skill makes videos without narration.
- `trilha`: `semente` (one per video; without it, the JSON's `semente` applies) and `identidade` (the audience's genre,
  in the v2 schema of `assets/audio/API.md`: `genero`, `bpm`, `modos`, `tons`, `instrumentos`…). Without `identidade`,
  a neutral one comes out (epiano/piano, BPM set by the speed): declare the brand's (`house` in `example.json`, `acustico` in `example-list.json`).

### Proofs (`itens[].prova.tipo`)

Redesigned interface with the product's **exact labels**. Every proof accepts `titulo` (the panel bar).

| type | fields | what happens |
|---|---|---|
| `grade` | `itens[{nome, cor, cor2, tinta, botao}]`, `selecionado`, `colunas`, `contador{de, ate, rotulo}` | thumbnails come in, a tap picks one, the counter counts |
| `paleta` | `paletas[{nome, cores[4], previa[4]}]`, `ordem` | a tap on each palette repaints the preview |
| `numeros` | `cartoes[{rotulo, valor}]`, `total{rotulo, valor}` | the numbers count, the total last in the highlight color |
| `campo` | `rotulo`, `dica`, `de`, `para`, `resultado` | the messy text turns into the clean one, with the ✓ |
| `lista` | `linhas[]` (text or `{t, destaque}`) | lines come in with ✓ |
| `foto` | `src`, `posicao`, `titulo`, `corTitulo`, `chips[]`, `chipAtivo` | photo or cropped screenshot, covering the panel, with a slow zoom |
| `interruptores` | `itens[{nome, ligado}]`, `troca`, `aviso` | a tap flips a switch, a notice confirms |
| `barra` | `rotulo`, `de`, `para`, `max`, `unidade`, `casas`, `nota` | the number and the bar go from `de` to `para` |
| `escolha` | `pergunta`, `opcoes[]`, `ativa`, `colunas`, `botao` | a tap picks the option, the button lights up |

## Formats

16:9, 19:9 (2280×1080), 21:9 (2520×1080), 9:16, 1:1 and 4:5, **recomposed** (not cropped): in landscape the sentence
sits to the right of the tag and the wall on both sides of the number; in portrait the brand goes small at the top, the
sentence wraps into 2 lines below the tag and the wall sits above and below the number.

- **19:9 and 21:9** use the 16:9 layout stretched across the width, not the 16:9 with leftover space: margin (W/16),
  panel (centered, ~79% of the width), tag strip and poster card block are fractions of W; type size and heights stay
  as in 16:9 (the height is 1080 in all three). To fit the 5% safe area (x 114–2166 in 19:9, 126–2394 in 21:9;
  y 54–1026), the caption moves up 38 px, the strip moves up 24 px (the panel loses 24 px of height, so the strip
  doesn't touch the sentence) and the wall's pills keep 5% away from the edge. The opening stays left-aligned, as in 16:9: in 21:9 about 1/3 of the width is left over to the right of the title.
- 16:9, 9:16, 1:1 and 4:5 have not changed (same position, size and style for each element). In 16:9 the caption is
  still at 1004 px and goes 33 px past the 5% safe area (an old issue, kept so 16:9 doesn't change).
- With `foto`, the wider panel crops more of the top and bottom of the image (`object-fit: cover`): prefer a landscape
  photo.

## How to render

```sh
node templates/rolling-list/render.mjs <params.json> --out <folder> [--name x] [--formats 16x9,19x9,21x9,9x16,1x1,4x5]
     [--mode draft|final] [--sub 2] [--speed rajada|lista|cartaz] [--items 1,2,3] [--no-voice] [--no-soundtrack]
```
Example (quick draft, ~15 s; the examples' Inter first, so it runs with no network):
```sh
node scripts/example-fonts.mjs ~/Desktop/list-test/rolling-list-example
node templates/rolling-list/render.mjs templates/rolling-list/example.json \
     --out ~/Desktop/list-test --name rolling-list-example --formats 16x9 --mode draft
```

- Assembles `<output>/<name>/` (template + `assets/template/engine.js` + `params.js` + fonts + media), renders each
  format and takes the contact sheet. Out come `<output>/<name>-<format>.mp4` and `<output>/sheet-<name>-<format>.png`.
  **Look at the sheet.**
- `--speed` and `--items` change the speed and pick items without editing the JSON; the items left out go to the
  wall, so the total stays true.
- **Soundtrack** (with the Python with numpy/scipy from `scripts/environment.mjs --fix`, found automatically): writes
  `audio/sheet.json` (sections = the parts of the plan; a **marker at every cut**: item comes in, wall, closing) and
  `audio/identity.json`, runs `assets/audio/arrange_series.py` (each cut becomes a musical accent at the exact sample,
  **mandatory in the burst**: the beat of the cut) and measures with `assets/audio/verify.py`. Each format is joined
  by `scripts/finalize.mjs`, which checks duration, loudness and peak, already in AAC. Without voice, the soundtrack
  is the lead (`papel: "protagonista"`, with no `voz` block in the sync sheet), at −14 LUFS.
- Without Python, or with `--no-soundtrack`, the video comes out silent (and the render warns about it).
- Preview: `<proj>/index.html?f=9x16&t=5.2`.
- Playwright is found as in the rest of the skill (`node_modules` of the folder or its parents, `PLAYWRIGHT_PATH`).

## Limits

- The cuts are musical accents (a chord note), not effects (whoosh, impact): for an effect, put `efeito` on the sync
  sheet marker.
- The proof is a **redesigned interface**, not a recording: for a recorded screen, use `foto` with a cropped
  screenshot, or the real-screen-camera template. There is no video clip (`clipe`) here.
- Logo only as PNG (or declare `logoAspecto`).
- The wall was made for 8–40 names; with more than ~40 the pills get too small to read (on purpose, in the original,
  but check it on the sheet).
- The caption stays on one line; a long sentence shrinks down to 70% and then gets cut: write short lines.
