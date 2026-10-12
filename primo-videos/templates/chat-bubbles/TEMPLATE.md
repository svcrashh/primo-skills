# Template: chat bubbles

A chat conversation between the person and the product, with back and forth. The "typing…" indicator appears before the answer, each bubble
enters with a spring, the product's answer can bring a mini card (a file whose thumbnails build up one by one, a list with
a chip on each item, an image) and the camera follows the last bubble. The closing is the logo only.

It is not `typing-text` (a search field and the answer below it): here it is a dialogue, with a question back.

## When to use
- Chatbot, AI assistant, support: show **how to ask** and what comes back.
- A flow that has a question back ("one thing is missing: is it for the team or for a client?") and only then the delivery.
- The product returns something that can be shown small: a file, a list with a choice, an image.

## When NOT to use
- A single request and its answer (no back and forth): `typing-text` is more direct.
- Teaching where to click on a screen: `real-screen-camera` or the panel tutorial.
- A long conversation (more than ~6 messages): nobody reads it. Cut it to the essential or split it.
- A made-up conversation with a client, a real name or real data: never. The bubbles are generic requests and answers.

## What it looks like
| Time | What happens |
|---|---|
| 0.05 s | the first bubble already entering (frame 0 is never empty for more than an instant) |
| before each answer from the product | the "typing…" indicator (three bouncing dots) for `ritmo.digitando` s (0.9), where the bubble will be born |
| each bubble | enters with a spring from the "tail" corner (at the top, on the speaker's side) and stays `leitura` s: 0.4 + 0.12 per word, between 0.8 and 1.8 (or `ler` in the message); the reading time continues while the answer's "typing…" appears |
| card | 0.5 s after the bubble: `arquivo` (label, name, detail and the thumbnails that build up one by one), `lista` (items that rise, with the chip popping in afterwards) or `imagem` (with the caption below, never on top) |
| camera | `segue`: the last bubble stays on the reading line (85% of the body) and the conversation moves up, with a slow drift; `zoom`: close to the conversation (the whole column, centered in the width), rising with each new bubble; when the panel opens, it pulls back to show the conversation and the panel and, after the first items, moves in on the panel; it pulls back again before the closing; `parada`: everything in view, moving down slowly in the space left over |
| end of the conversation | `final` s (0.7) of breathing room; then the transition (`corte`, `push` upward, `mascara` in a circle born from the last bubble or from the panel) |
| closing | just the logo (PNG), centered, enters with a spring and stays still ~2 s |

Line breaks respect the bubble's width and at most 7 words per line (`maxPalavras`), without leaving a single
word alone on the last line. Whatever the camera carries out of the area (the window's body, or the format's safe
area) fades out before touching the edge: nothing stays still and opaque outside the safe area.

## Parameters (`example.json`)
```jsonc
{
  "nome": "chat-bubbles-example", "formatos": ["16x9"],
  "leiaute": "coluna",            // coluna (default) | dividido: the conversation on the left and the card opens in a panel on the right
  "camera": "segue",              // segue (default) | zoom | parada
  "transicao": "push",            // corte (default) | push | mascara
  "janela": { "titulo": "Title of the chat window" },   // optional: the chat's mockup frame; without it, the bubbles sit on the background
  "pessoa": { "nome": "You" }, "produto": { "nome": "Your product" },   // labels (optional)
  "rotulos": "primeira",          // primeira (default: the name on each speaker's 1st message) | sempre | false
  "ritmo": { "digitando": 0.9, "base": 0.4, "porPalavra": 0.12, "leituraMin": 0.8, "leituraMax": 1.8, "pausa": 0.25, "final": 0.7, "transicao": 0.55, "fecho": 2.3 },
  "linhaDeLeitura": 0.85, "zoom": 1.25, "respiro": 1, "maxPalavras": 7,
  "chips": { "tag a": { "fundo": "#…", "texto": "#…" } },   // the color of each list chip, keyed by the chip's text
  "marca": {
    "nome": "…", "logo": "caminho/logo.png",               // PNG (the aspect ratio comes from the file); the closing is just the logo
    "cores": {
      "fundo", "texto", "pessoa", "sobrePessoa", "produto", "sobreProduto",          // required
      "rotulo", "pontos", "janela", "janelaTopo", "janelaTexto", "cartao", "sobreCartao",
      "etiqueta", "sobreEtiqueta", "linha", "sobreLinha", "painel", "sobrePainel"   // optional
    },
    "fontes": { "texto": "Inter" }, "grao": 0
  },
  "mensagens": [
    { "de": "pessoa", "texto": "…" },                                     // pessoa: on the right, no "typing…" (digitando: 0.6 turns it on)
    { "de": "produto", "texto": "…", "digitando": 0.9, "ler": 1.5, "pausa": 0.2 },
    { "de": "produto", "texto": "…", "cartao": { "tipo": "arquivo", "nome": "Name of the file", "detalhe": "File details · 8 slides", "etiqueta": "slides",
        "miniaturas": [{ "modelo": "capa|lista|numero|colunas|grafico|fecho", "fundo": "#…", "tinta": "#…", "tinta2": "#…" }] } },
    { "de": "produto", "texto": "…", "cartao": { "tipo": "lista", "titulo": "List title", "passo": 0.55, "itens": [{ "t": "…", "chip": "tag a" }] } },
    { "de": "produto", "texto": "…", "cartao": { "tipo": "imagem", "src": "foto.png", "legenda": "…", "proporcao": 1.78 } }
  ],
  "fecho": { "fundo": "#F5F5F5" },        // logo only: "bordao", "endereco" and "texto" are rejected
  "trilha": { "semente": 3122, "identidade": { "genero": "house", "bpm": [122, 122] } }   // assets/audio/API.md, identity v2
}
```
- Only the product answers with a card. In `dividido`, the **first** card opens in the panel; the others enter the conversation.
- The file's thumbnails are slides redrawn as flat shapes (no text), marked as images. The card's
  image too. `VIDEO.texto = "fora-da-imagem"`: the engine's check fails text that crosses any of them.
- A wrong parameter stops before building, with what to do (`render.mjs` prints them all at once): layout, camera,
  transition, side, card type, a color that is not `#rrggbb`, missing logo, closing with a phrase, `zoom` with `janela`.
- No voice: the template does not narrate. The bubbles' text tells the story.

Format examples: `example.json` (`coluna` inside a chat window with a title, `segue`, the delivery in an `arquivo` card
with 8 thumbnails, `push`) and `example-split.json` (`dividido`, `zoom`, the delivery in a `lista` card that opens in the
panel, with a colored chip on each item, `mascara`, acoustic soundtrack). In both, the conversation is the same back and
forth in placeholder words (the person asks, the product asks back once, the person answers, the product delivers), in
greys and with the placeholder logo: they show the parameters, not a brand.

## How to render
```sh
node scripts/example-fonts.mjs <output>/.work-<name>            # examples only: their Inter, no network (before the render)
node templates/chat-bubbles/render.mjs templates/chat-bubbles/example.json \
     --out <output> [--name x] [--formats 16x9,9x16,1x1,19x9,21x9,4x5] [--mode draft|final] [--no-sound] [--assemble-only]
```
- It builds `<output>/.work-<name>/` (the scene, the skill's `engine.js`, `params.js`, fonts, logo and images in `media/`), opens the
  scene in Chromium in each format (a console error stops everything, with what to do), composes the skill's soundtrack
  (`arrange_series.py`, lead role: a `pop` on each bubble and card, a `blip` that rises on each chip, an accent when
  the logo enters) and measures it (`verify.py`), renders each format, joins and checks the delivery (`scripts/finalize.mjs`:
  duration, loudness, peak, already in AAC) and takes the contact sheet.
- Out come `<output>/<name>-<format>.mp4` and `<output>/<name>-<format>-sheet.png`. **Look at the contact sheet.**
- Refinement (the video of one format at a time; the font is passed because `video.js` pulls it from the JSON):
  `node scripts/refine.mjs <output>/<name>-16x9.mp4 --project <output>/.work-<name> --format 16x9 --channel site --fonts Inter`.
  Without `--format`, the refinement check tests the same MP4 against the safe area of every format in `video.js` and raises false alarms.
- Preview: `<output>/.work-<name>/index.html?f=9x16&t=4.2` (one instant) or `?play`.
- Check without rendering: `node scripts/frames.cjs --project <output>/.work-<name> --format 9x16 --check`.
- `--assemble-only` only assembles the build (no browser, no sound); `--no-sound` comes out silent.

## Formats
16:9, 19:9 (2280×1080), 21:9 (2520×1080), 9:16, 1:1 and 4:5, recomposed:
- **16:9:** `coluna` with a 1320 px window in the center (or the 1200 px body without a window); `dividido` with the conversation at
  41% of the width on the left and the panel on the right.
- **19:9 and 21:9:** through the engine's `L()`, with the 16:9 body and text (the height is 1080 in all three); `coluna` stays
  centered and `dividido` grows with the width (fractions of W).
- **9:16:** the window fills the Reels safe area (x 70–940, y 250–1450), 46 px bubbles.
- **1:1 and 4:5:** the window with a 60 px margin; 40 and 42 px bubbles.
- In 9:16, 1:1 and 4:5, `dividido` becomes a column (the panel does not fit beside it): the card enters the conversation.

## Limits
- The closing is only the logo: `bordao`, `endereco`, `texto` and `frase` in `fecho` are rejected (no slogan, no address).
- No input field at the bottom (the person does not "type" the message in the field; their bubble enters ready, or with the
  "typing…" if `digitando` > 0). To show the request being written, open with `typing-text`.
- No avatar or photo of whoever speaks: only the name (label). A real person's face, never.
- `camera: "parada"` requires the conversation to fit in the body (otherwise the error says to use `segue`); with a window it does not have the
  slow zoom drift, only the descent in the space left over: with long pauses, the refinement check may flag a frozen frame.
- Only one panel in `dividido` (the first card).
- The `arquivo` card shows up to 8 thumbnails; the list, up to 6 items (the text shrinks down to 28 px to fit whole).
