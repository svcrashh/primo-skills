# Variety: the matrix of directions

Videos from the same brand that always come out with the same style, the same layout and the same transitions turn into a
template: the second one already looks repeated. Always starting from the same series or from the previous video gives
exactly that. This matrix says **what changes** from one video to the next; `scripts/variety.mjs` keeps the brand's
history and rejects the direction that repeats the previous ones.

## The axes (one direction = one value on each axis)

| Axis | Values |
|---|---|
| `style` | `panel-tutorial` (computer tutorial series) · `real-screen-camera` · `drawn-explainer` · `chapters-with-index` · `rolling-list` · `counting-number` · `before-after` · `light-trail-teaser` · `typing-text` · `typing-terminal` · `kinetic-typography` · `card-bento` · `card-stack` · `chat-bubbles` · `ticking-checklist` · `growing-chart` · `timeline` · `phone-3d` · `infinite-zoom` · `drawn-flow` · `isometric` · `photo-mosaic` |
| `structure` | `step-by-step` · `chapters` · `problem-solution` · `before-after` · `questions-answers` · `a-day-with` · `top-n` · `single-scene` · `dos-and-donts` |
| `layout` | `left-column` · `right-column` · `bottom-strip` · `full-screen` · `split` · `mosaic` · `object-3d` |
| `transition` | `flip` · `whip` · `mask` · `zoom-through` · `push` · `cut-on-beat` · `morph` · `blade-wipe` |
| `topic` (how each topic comes in) | `chapter-card` · `big-number` · `index-pill` · `list` · `diagram` · `typed-text` · `caption` |
| `camera` | `guided-zoom` · `tracking` · `dolly-3d` · `orbit` · `static` |
| `palette` (which of the brand's colors dominates the frame) | `main-color` (the brand's main color) · `secondary-color` · `accent-color` (the highlight color) · `light-neutral` · `dark-neutral` |
| `background` | `plain` · `shapes` · `giant-symbol` · `photo` · `grid` |
| `pace` | `calm` · `medium` · `fast` |
| `soundtrack` | free text: genre and BPM (e.g. `electronic pop 116`, `house 124`, `lo-fi 84`) |

## The rule

- A new direction differs from **each of the brand's last 3 videos on at least 3 axes**, and never repeats the
  `style` + `layout` + `transition` trio of the last video.
- The only exception is an explicit request ("same as the previous one", "same series"), and then the prompt says so.
  The natural case is a **series of the same product** (tutorial 1, 2, 3 of the same tool): the identical identity is on
  purpose; register it with `--allow-repeat` and say so in the prompt. Videos of different products are never a series with
  each other.
- The script checks, not the agent's memory:
  ```sh
  node $SKILL/scripts/variety.mjs check --brand <brand> --direction <direction.json>   # exit code 1 = repeats; says on what
  node $SKILL/scripts/variety.mjs record --brand <brand> --direction <direction.json> --video <mp4> --title "…"
  node $SKILL/scripts/variety.mjs list --brand <brand>
  ```
  The history lives in `~/Documents/VideoStudio/Brands/<brand>/videos.json` (the brand's data folder, next to its kit and
  its reference profile; `VIDEOSTUDIO_BRANDS` changes the root).
- `direction.json` is an object with the ten axes above (plus `name` and `why`, optional).

## Where to see each style in the brand: stills, on demand

The skill ships no sample gallery and no brand. `catalog.mjs list` gives the styles the engine can make (what each one
is, what it is for and what it needs), and each proposed direction is shown as a **still made in the person's brand**
before anything is animated:

```sh
node $SKILL/scripts/catalog.mjs list --format md                                   # the styles, for the chat
node $SKILL/scripts/catalog.mjs open --folder <video-folder> [--brand <brand>]      # the styles as a page, with this project's stills and the brand's delivered videos
node $SKILL/scripts/catalog.mjs open --directions direction-1.json,direction-2.json --folder <video-folder>
```

With `--directions`, it writes `<video-folder>/directions.html`: the proposed directions side by side, each with its
still (a picture or a clip with the same name as its JSON: `direction-1.png`, next to it or in `stills/`) and its ten
axes. A direction without a still is marked "no still yet". The chat does not always show images: the page opens in the
browser, and the chat gets the table.
