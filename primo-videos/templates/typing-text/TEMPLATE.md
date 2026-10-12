# Template: typing text

The request appears written on screen from frame 0, inside a large field of the product itself. It is typed
(or pasted), the product answers right there, and the video closes with a typed sentence and the address. It combines
six styles that the study's windows found without coordinating: field that types itself, prompt that becomes product,
typed text leads, typed text in color, story told by the interface and the screen answers (catalog §3, item 2).

## When to use
- The product has a text box: search, AI, chat, sign-up, a field that cleans or converts what you paste.
- Launch or "what the app does" in 10–30 s, for Reels, WhatsApp and site. It works without sound, because the text
  on screen already tells the story.
- A script idea that fits into requests: the [journey through what you type] (a story in 4–6 requests).

## When not to use
- The product's value is visual and nobody types anything (action game, camera, fashion): use before and after or
  light-trail teaser.
- A list of many new features: use rolling list or chapters with index.
- A step-by-step tutorial, where the person needs to see where to click on the real screen: use real screen with camera.

## What it looks like (blocks)
The video is a queue of blocks (`cenas`). Each one lasts `dur` seconds, and all of them sit on the same background, so
the passage from one to the next does not flicker: the block leaves rising and blurring in 0.35 s.

| block | what it does | fields |
|---|---|---|
| `pergunta` | title + field with label and placeholder already on screen in frame 0; a roulette of blurred examples that rise up to the field; the request typed (`modo: "digita"`, seeded human pace) or pasted (`"cola"`, with a blinking selection); optional cleanup (the leftover letters shrink and a prefix comes in); send: the field rises and the answer appears below | `titulo`, `destaque` (word of the title in the highlight color), `rotulo`, `placeholder`, `roleta[]`, `texto`, `modo`, `em`, `vel` (letters/s), `teclado` (`notebook`/`mecanico`/`tela`), `icone` (`seta`/`busca`), `limpa {fica, prefixo, em, selo}`, `resposta` |
| `numeros` answer | cards with a counting number and a large total in the highlight color, with a three-word label | `em`, `itens[{rotulo, valor}]`, `total {rotulo, valor}` (value in Brazilian format, "7.199" or "2,7") |
| `cartao` answer | the product answers: title, tags, and numbered lines that write themselves word by word | `em`, `titulo`, `chips[]`, `linhas[]` |
| `frase` | large text typed with a cursor (the "narrator"), highlight word, yes/no pills that pop up afterwards | `texto`, `destaque`, `pilulas[{t, tipo: "sim"/"nao"}]`, `apaga`, `em`, `vel`, `fs`, `y` |
| `fecho` | the address types itself into a field, the field turns into the logo, the catchphrase and the address rise. By default the video closes with the brand's logo alone: leave `digita`, `bordao` and `endereco` out (a catchphrase only when the brand has one and the person wants it) | `digita`, `em`, `logoEm`, `bordao`, `endereco` |

The sounds are automatic: each block marks its own keystrokes, the paste or send click, a whoosh on the
passages and a "success" sound when the answer closes. Without voice, these sounds become markers in the skill's
soundtrack (`assets/audio/arrange_series.py`), which is the protagonist: it opens up until the first request writes
itself and resolves when the closing logo comes in.

## Parameters (`example*.json`)
Nothing of the brand is in the code. A file has:
- `nome`, `formatos` (`16x9`, `9x16`, `1x1`, `19x9` and `21x9`; each format has its own composition, nothing is cropped;
  19:9 (2280×1080) and 21:9 (2520×1080) are the 16:9 stretched in width: field, title, answer, sentence and caption
  grow with the width, type size and heights stay the same as in 16:9), `plataforma`
  (optional, the engine's safe area), `grao`.
- `marca`: `nome`; `cores` (`fundo`, `superficie`, `campo`, `borda`, `texto`, `apoio`, `destaque`, `ok`,
  `sobreDestaque`, `sombra`, all in hex); `fontes` (`titulo`, `texto`, `mono`: Google Fonts, downloaded into
  the build by `scripts/fonts.mjs`); `caixaAlta`; the field's `raio` (default: pill); `raioCartao`;
  `fundo` (`grade` in px, `brilho` 0–1, `cor2` for a second light); `logo`, which can be
  `{ "arquivo": "x.png", "arquivo_origem": "media/x.png", "proporcao": 5.33 }` or `{ "texto": "marca", "ponto": "." }`
  (the name written in the title font).
- Optional, all off by default: `marca.borda: false` (transparent outline, same geometry),
  `marca.sombra: false`, `cores.etiqueta`/`sobreEtiqueta` (the 1st tag and the answer's numbers; default:
  `destaque`/`sobreDestaque`), `cores.rotulo`, `rotuloFs` in the block (fixed px of the field label), `respira` (0–0.1:
  the block grows slowly from the top; the closing does not breathe) and `areaSegura: true` (in 16:9, caption within the
  bottom 5%). Format example with all of them: `example.json`.
- More optional ones, also off by default: `leiaute: "lado"` (in the horizontal formats, the title and the field sit in
  a column on the left, 760 px wide in 16:9, and the answer in the right column, vertically centered; the field does not
  rise); `passagem: { "tipo": "whip" | "push" | "mascara" | …, "dur": 0.45, "dir", "forma", "angulo" }` (the switch
  between blocks through an engine transition, `TR`, with the brand background in each block, instead of the
  rise-and-blur); `fundo` in the `fecho` block (the closing's own color, e.g. a light background for the logo when the
  video is in another color); and `cores.sobreCampo` (the text of the "no" pill over the `campo`; default: `texto`).
  Examples: `example-side.json` (two requests next to the answer, diagonal mask) and
  `example-phrases.json` (sentences only, do's and don'ts, whip).
- The three `example*.json` are format examples, with no brand: greys, placeholder texts and the placeholder logo
  stand for the person's brand and content.
- `voz`: belongs to narration; here it is left out (the render warns), and the video comes out with the soundtrack.
- `trilha` (without voice): `semente` and `identidade` (the audience's genre, v2 schema from `assets/audio/API.md`).
  Without `identidade`, a neutral one comes out (epiano/piano, 100–112 BPM): declare the brand's.
- `cenas`: the blocks above.

## How to render
```sh
node templates/typing-text/render.mjs meu.json \
  --out ~/Desktop/output [--formats 16x9,9x16,19x9,21x9] [--mode draft|final] [--no-sound] [--no-soundtrack]
```
- Outputs `<output>/<name>-<format>.mp4` (with sound) and `<output>/<name>-<format>-sheet.png`. **Look at the contact
  sheets before delivering.** The draft (30 fps, no motion blur) takes seconds; the final (60 fps, 8 subframes) takes
  ~1–2 min per 15 s format.
- The assembled build stays in `<output>/.work-<name>/`: open `index.html?f=9x16&t=4.2` to see a frozen instant, or
  `?play` to see it live.
- The sound needs a Python with numpy and scipy (the one from `scripts/environment.mjs --fix`, found automatically).
  Without it, the video comes out silent and the script warns. Without voice, the delivery is muxed and checked by
  `scripts/finalize.mjs` (duration, loudness, peak); `--no-soundtrack` leaves only the keystrokes and the effects, with no
  music.
- An error in the scene console (unknown block, font that did not load) stops the render with code 3.

## Variations that already come out with parameters alone
- **Request → answer in numbers** (the field cleans a pasted link and the total counts): `modo: "cola"` with `limpa` and
  a `numeros` answer (the answer in numbers is in `example-side.json`).
- **Example roulette → typed request → the product answers** (AI launch, search, generator): `roleta[]`
  and a `cartao` answer (the typed request with the card is in `example.json`).
- **Text that leads**: only `frase` blocks in sequence, with "it's not X / it's Y" pills.
- **Journey in requests**: several `pergunta` blocks in a row, each with its own request and its own answer (each
  block 2.5–4 s), and a turning-point `frase` before the `fecho`.

## Limits
- Two boxes side by side with a number (the A/B) and the final grid of many results (v0) do not have a
  block yet: they were left for the second version.
- The answer is redrawn (cards, numbers, lines). A proof on a recorded real screen does not go into the card yet.
- The caption wraps to at most two lines. A very long spoken line becomes several caption blocks in a row.
- A field with text longer than the box scrolls left, like a real field. Below 70% of the type size the
  text does not shrink any further: prefer requests of 2 to 8 words.
- Without voice there are no captions: the on-screen text (field, answer, sentence, closing) tells the story.
