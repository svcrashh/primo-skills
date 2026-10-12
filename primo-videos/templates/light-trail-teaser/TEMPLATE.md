# Template light-trail-teaser

Dark background. A **line of light** comes in, sweeps a **piece of the interface** in close-up (which appears behind
it), runs along its edge as a point of light and jumps to the next piece. After 2 to 5 pieces, it sweeps the **whole
product** on a phone (the camera pulls back), and at the closing it goes to where the button sits and **becomes the
button** with the address. It is the "made to be remembered" template: little text, the light as its signature. By
default the skill closes a video with the brand's logo alone: here that is `fecho.soLogo: true`, and the three format
examples use it. The catchphrase line, the date and the button with the address are for when the brand has them and
the person wants them.

It combines the "light line", "fragment teaser" and "reveal in parts" style cards from the catalog.

## When to use
- Big release, new theme, season, "coming soon": an app or SaaS with an interface that looks good up close.
- Reels/TikTok, event big screen, launch opening. 12 to 20 s.
- A brand of any color: the interface can be light (the pieces become light cards over the brand's dark background,
  as in the format examples).

## When not to use
- Tutorial, step by step, explanation (go with real-screen-camera).
- Conservative or lay audience (bank, school, public service): it looks like a party.
- Cold first B2B contact: the person needs to understand what it is before getting interested.
- A product with nothing pretty up close, or a small update (go with rolling-list).

## Structure (D = duration, N = number of fragments)
| Time | What happens |
|---|---|
| 0 | the **promise** written large in the center (rule 1: frame 0 never empty); the light rises from the bottom of the frame |
| 0.55–1.15 | the promise shrinks into the overline at the top |
| 0.9 + i·FR | fragment i: the light grows from a dot to a bar, **sweeps** (0.15–0.8 s), the outline draws itself; "NOVO · name" rises on the empty side (16:9, 19:9, 21:9) or above (9:16); the fragment's micro-action (number counts, field types itself, lines come in, button lights up); the light runs along the edge; in the last 0.4 s the fragment blurs and the light jumps to the next one |
| T_REV = 0.9 + N·FR | **reveal**: the light sweeps the phone, the screen appears, the camera pulls back from 1.18× to 1×, the screen scrolls slowly |
| T_FECHO = T_REV + 3.8 | **closing**: logo, line and date; the light goes to where the button sits and becomes the button with the address. With `fecho.soLogo`, the light sweeps the frame and the logo comes in alone |

`FR = (D − 0,9 − revelação − fecho) / N`; `assemble.mjs` rejects FR < 1.8 s. With D = 16 and 3 fragments, FR ≈ 2.6 s.

## Parameters
Format examples, with no brand (greys, placeholder texts, the placeholder logo): `example.json` (flat, three fragments
with a number, a list and a real screen, closing with the logo only), `example-steps.json` (four fast steps, one of each
drawn kind, and the giant symbol) and `example-photo.json` (a photo fragment and the closing that opens in a circle).
Their screenshots come from the sample page `assets/example/page.html`, captured by the `capture-guide.cjs` in the
folder of the same name.

| Field | What it is |
|---|---|
| `marca`, `titulo`, `duracao`, `formatos` | `formatos`: `16x9`, `9x16` (recomposed, not cropped), `19x9` (2280×1080) and `21x9` (2520×1080): the 16:9 layout stretched in width (fragment, name, phone, closing and caption move with the width; type size and heights the same as 16:9; text within the 5%) |
| `plataforma` | optional; `reels`/`youtube`… turns on the right safe area in the check |
| `cores` | `fundo` (the brand's dark), `luz` (the color of the line and the button), `noLuz` (text over the light), `texto`, `etiqueta` (optional: the label color; default, the light's) |
| `ui` | the fragments' interface: `superficie`, `superficie2`, `borda`, `texto`, `texto2`, `destaque`, `noDestaque`, `raio` |
| `fontes` | `titulo`, `texto`, `mono` (Google Fonts names; `assemble.mjs` downloads them) · `tituloCaixaAlta` |
| `logo` | `{ arquivo, altura }` (PNG/SVG) or `{ texto }` |
| `promessa` | 3–6 words, appears in frame 0 |
| `etiqueta` | the word before the fragment name (`NOVO`) |
| `fragmentos[]` | 1–5 (3 is right). `nome` (2–3 words) + a `tipo`: |
| · `numero` | `titulo`, `valor`, `rotulo`, `casas` — the number counts |
| · `campo` | `rotulo`, `texto` (types itself), `ajuda` |
| · `lista` | `titulo`, `itens` (`"texto"` or `["texto", "valor"]`), up to 3 |
| · `botao` | `acima`, `texto`, `depois` — the button lights up in the highlight color ("tap") |
| · `imagem` | **real screen**: `arquivo`, `largura` (px of the file), `recorte` `[x, y, w, h]` — the close-up of a screenshot |
| · `cartao` | `titulo`, `texto` |
| `revelacao` | `{ imagem: { arquivo, largura, altura, rolar: [de, até] } }` (phone screenshot, real screen) **or** `{ fundo, blocos: [...] }` drawn: `cabecalho`, `numero`, `lista`, `chips`, `botao` |
| `fecho` | `frase` (1–2 lines; `*assim*` comes out in the light color), `data`, `botao` (the address) · **or** `soLogo: true` (off by default): the light runs down the phone's edge, becomes a blade and sweeps the frame from right to left, opening the closing `fundo`; the `logo` comes in at the center and stays still (height `logoAltura`, or the `logo`'s); no line, date or button. With `tempos.fecho: 3`, the logo stays still ~1.9 s |
| `falas[]` | `{ id, texto, em, ate }`: the caption shows the `texto` between `em` and `ate` (with or without voice) |
| `tempos` | optional: `{ revelacao: 3.8, fecho: 3.6 }` · `zoomFragmento` (1.35) · `grade` (true) · `grao` |
| `liso` | optional, off by default: flat brand, without the glow drifting in the background, the vignette, the shadows and the border of the cards and the phone, and the overline without fading (the light and the outline it draws remain) |
| `fundoSimbolo` | optional, off by default: `{ arquivo, altura, x, y, gira }` puts the brand symbol, giant, behind everything, cropped by the edge and rotating `gira` degrees per second (`x`/`y` = the center as a fraction of the frame; `altura` in px). The PNG goes in as it is, not recolored: put it in a corner where the fragment name does not pass over it (`example-steps.json` uses the bottom right corner) |
| `fecho.abre` | optional, with `soLogo`: `"circulo"` takes the light to the center of the phone and opens the closing `fundo` in a circle from it, instead of the blade that sweeps from right to left |

Media paths are relative to the JSON itself (or start with `~`); `assemble.mjs` copies them to `media/`.

## How to render
```zsh
# 1. project + loose frames to look at (fast)
node templates/light-trail-teaser/assemble.mjs meu.json ~/Desktop/teaser/project
node scripts/frames.cjs --project ~/Desktop/teaser/project --times 0,1.5,4,7,10,13 [--format 9x16]
node scripts/frames.cjs --project ~/Desktop/teaser/project --check --qps 10 [--format 9x16]
```
```zsh
# 3. everything: soundtrack (no voice), 60 fps render of each format, sound muxed in, contact sheet
templates/light-trail-teaser/render.sh meu.json ~/Desktop/teaser 16x9 9x16 [19x9 21x9]
```
The soundtrack (`soundtrack.py`) follows the template's timing: a dark bed that opens up until the reveal, a breath on each
sweep, a low impact on the reveal, a shimmer when the light becomes the button. This skill makes videos without
narration, so the soundtrack is the protagonist, alone, at −14 LUFS; without a Python with numpy
and scipy, the video comes out silent (and the script warns).

## Variations
- **Real or drawn screen:** `imagem` fragment (close-up of a screenshot recorded with Playwright) or drawn
  fragments; reveal with a scrolling screenshot or with drawn blocks.
- **Dark interface** (dark `ui.superficie`, night-colored cards) or **light** (light cards over the brand's dark
  background: the three format examples).
- **Drier / longer:** 2 fragments and D = 12 (12 s teaser), or 4–5 fragments and D = 20.

## Limits
- No 3D glass, particles or wall of screens (outside the engine).
- Fragment text does not wrap: long labels (> ~22 characters in field/list) overflow the box in 9:16.
  The button shrinks itself to fit; so does the fragment name.
- The reveal screenshot is the whole page shrunk into a phone: it works as an impact image, not for reading.
  Whatever the captions (`falas`) mention has to be in a fragment (close-up), not only in the reveal.
  In the refinement check, the phone with the whole page is a "wide shot": up to 2.6 s is a warning, above that it is a
  legibility error. With `fecho.soLogo`, `tempos.revelacao` of 2.4 s stays at ~2 s (as in `example.json`); with the other
  closing, the phone stays in frame during the closing and counts too.
- With `liso` (no background glow), between 0.9 and 1.2 s the frame only has the overline shrinking and the light: a
  two-word promise fails the refinement's "empty frame". A full line (as in `example.json`) passes.
- 1:1 and 4:5 not implemented (the style card does not ask for them).
- At the closing, the `falas` caption sits centered at the bottom and can pass over the phone's lower corner (16:9 and
  wide formats): end the line before the closing or keep it short.
