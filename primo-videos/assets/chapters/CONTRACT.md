# Chapter contract

Write this file (replace the <…>) BEFORE sending chapters to subagents or parallel windows. Without it, each
one invents its own transition, its own background and its own title size, and the video turns into a collage.

## Quality reference
<the video the owner approved, if any (path) and the stretch that matches each chapter>. What every
chapter must do: **it builds up in beats** ("it starts by doing one thing, then does another, and keeps adding"), and each beat
comes in **at the time marked** below, on the soundtrack's bar grid. No static panel.

## Reference chapter
`scenes/<01-…>/` (approved on the contact sheet). Copy its structure: `video.js` (`formatos`, `duracao`) and `scene.js` with
`capitulo(...)` + stage. See how it uses `camPalco` (a camera that moves in on the action with the stage faded), `toque`,
`sobe`, and the kit's components.

## Rules
- **Do not edit** `template/` or another chapter's folder. Missing a component? Write it in your `scene.js`. A defect in the
  template? Note it in your `DONE.md` (whoever looks after the template fixes it for everyone).
- Tokens and fonts only from the kit (`TOK`, `F.*`). The product's shape (<chamfered corners / radius X / 1 px ring…>) on every
  card and chip.
- Everything a function of `t`. Forbidden: `Math.random`, `Date.now`, CSS `transition`/`animation`, `<video>` (real video
  comes in as a `sequencia` of frames from `media/`), images from the internet. A number or text that changes over time uses
  `conta()` or `quadroDe(t)` (without it, the final render's motion blur smears the digits).
- Stage <9:16: x 90–990, y 740–1740 / 16:9: x 900–1800, y 90–990>. Nothing before `ENTRA_PALCO` (0.9 s), nothing outside the
  stage. Text on the object **≥ 28 px in the final frame** (count the phone's and the camera's scale).
- Title: 1–2 short lines, keyword with `k: true`; support line ≤ 2 lines of ≤ 32 characters, with `em` = the time in the
  table, and each line held long enough to be read.
- Data: only the real data from the authorized example account and the product's exact labels. A number that does not exist does not appear.
- Traps: `.abs` ignores `right` (compute the left); `font:` resets `lineHeight` (center with flex).

## Chapters
| folder | n | duration | title | support line (em) | the stage, beat by beat | sounds (sheet markers) |
|---|---|---|---|---|---|---|
| <02-…> | 2 | <s> | <…> | <…> | <1. … @t · 2. … @t> | <whoosh @0 · toque @t …> |

## Render and look (required)
```sh
node <SKILL>/scripts/chapters/render.mjs <project> NN-nome --mode draft
```
Open `scenes/NN-nome/out/sheet-<format>.png` and look for an empty frame, unreadable text, something cut off, overlap,
a beat that does not show. Fix it and render again. Code 3 = an error in the console (TITLE TOO WIDE / SUPPORT LINE TOO WIDE): solve it.
At the end, `scenes/NN-nome/DONE.md` (5–10 lines): what the stage does and at what time, duration, what was left out,
template defects.
