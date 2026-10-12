# Chapter video template

Unbranded structure: the tokens, the fonts, the name and the numbers here are made up. The method is in
`references/chapters.md`; this is only how to use the files.

## Create

```sh
node $SKILL/scripts/chapters/new.mjs <video folder> --fonts "Title,Text,Mono"
```

Creates `template/` (engine, `kit.js`, `index.js`, `chapter.html`, `fonts/`), `scenes/00-opening`, `scenes/01-example`,
`scenes/99-closing`, `media/`, `audio/` and `tools/`. Playwright is found as in the rest of the skill
(`PLAYWRIGHT_PATH`, the `~/.videostudio/environment.json` from `scripts/environment.mjs --fix`, `node_modules` in the folder or its
parents, global npm).

## Switch to the brand (once, before the first chapter)

- `template/kit.js`: `TOK` (background, card, field, text, support, highlight, ok), `FONTE`, `INCLINA` and, if the shape calls for it,
  `celular()` and `fundo()`. All from the project reading (§3, the product's look).
- `template/index.js`: `MARCA_NOME`, `ENDERECO`, `INDICE` (n, card name, label section, folder) and `NUMEROS`
  (only the true ones).
- `logo()` in the kit writes the name as text: replace it with the brand's SVG (`scripts/logo.mjs`) or with `foto(…)`.
- Each scene's `video.js`: the same `fontes` as `FONTE` and the `fundo` from `TOK.fundo`.

## One chapter

Copy `scenes/01-example` to `scenes/NN-nome` (NN = the index's `n`). Edit only `video.js` (the `duracao`) and
`scene.js`:

```js
cena(0, VIDEO.duracao, (root) => {
  const cap = capitulo(root, { n: 2, dur: VIDEO.duracao,
    titulo: [[{ t: 'New ' }, { t: 'colors', k: true }]],           // 2–3 words; k = highlight color
    apoio: [{ t: 'Ready-made palette or color by color.', em: 2.8 }] })   // em = the script's time, on the bar grid
  const c = celular(cap.palco, { x: …, y: …, h: PALCO.h * 0.94 })    // draw on c.tela, in phone px
  return (t) => { cap.update(t); sobe(c.el, t, ENTRA_PALCO, 80) /* … the stage's before → after … */ }
})
```

- The chapter frame (background, the passing index card, the `NN · SECTION` label, title, support line, exit) comes ready. Your
  job is the stage: nothing before `ENTRA_PALCO` (0.9 s), nothing outside `PALCO`, no exit at all (the frame does it).
- Recompose the stage per format with `L({ '16x9': …, '9x16': … })` or `VERTICAL`.
- **19:9 (2280×1080) and 21:9 (2520×1080)** (`new.mjs <folder> --formats 16x9,21x9`): `L` falls back to the `16x9` value and the
  kit stretches the 16:9 composition across the width (`KX` = W/1920: wider text column and stage, same height and same
  text size). The stage stops being square: position things in fractions of `PALCO.w` (like `01-example`), never in fixed
  px, or the object ends up pushed against the left of the stage with empty space on the right. In frame px, use `* KX`.
- The first support line comes in at `FALA_EM` (1.4 s) and the last beat ends before `duracao − 0,8`. Duration:
  `max(5, 1,4 + etapas + 0,8)`, rounded to the soundtrack's bar.
- The times are fixed: the support line's `em` and each stage beat use the numbers from the script's table, on the bar
  grid (240/BPM s). Changed one? Change the marker in the soundtrack's sync sheet too.
- Forbidden: `Math.random`, `Date.now`, CSS `transition`/`animation`, `<video>`, images from the internet, colors outside
  `TOK`, fonts outside `FONTE`. Rendering is frame by frame: everything has to be a function of `t`.
- The console warns `TITLE TOO WIDE`, `SUPPORT LINE TOO WIDE` and `CHAPTER n NOT IN THE INDEX`; the render exits with code 3 when there is an error in the console.

## Render and look

```sh
node $SKILL/scripts/chapters/render.mjs <video folder> NN-nome --mode draft   # 30 fps, to look at
node $SKILL/scripts/chapters/render.mjs <video folder> NN-nome                   # final, 60 fps
node $SKILL/scripts/chapters/render.mjs <video folder> all
```

Out come `scenes/NN-nome/out/<format>.mp4` (16x9, 9x16, 19x9, 21x9…, the ones in `video.js`) and a 24-frame contact sheet of each
(`out/sheet-*.png`). Open each format's contact sheet before saying the chapter is done. Live preview:
`scenes/NN-nome/index.html?f=9x16&t=4.5`.

## Assemble

```sh
node $SKILL/scripts/chapters/assemble.mjs <video folder>
```

Joins the scenes in order (`00-` opening, `99-` closing), per format, into `out/assembled-<format>.mp4`, and writes one
whoosh per chapter transition into `audio/sheet.json`. Then, the soundtrack over the sync sheet (`references/soundtrack.md` §4) and
`tools/finalize.mjs` for each format.
