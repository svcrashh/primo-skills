# Template: Photo mosaic

Approved photos in a grid that rearranges itself in time with the soundtrack: the mosaic, the highlight of one photo
(the others become a strip beside it) and a new mosaic, with another order and other large photos. An informative
label changes at each beat, in a strip or in a panel of its own, **never over the photo**. Video of 8 to 15 s.

The photos mark the image for the engine's check (`marcarImagem`) and the build comes out with
`VIDEO.texto = "fora-da-imagem"`: text that crosses a photo fails `frames.cjs --check`.

## When to use
- Institutional: people, places, the brand's world, no product screen.
- Opening of an internal event, a welcome, a team's "who we are" (with approved photos).
- Presenting an image library (the brand's photo bank, a team's photos).

## When NOT to use
- No approved photos: the mosaic takes only the brand's own approved photos, never stock images or people without
  authorization. With no photo, use Kinetic typography or Counting number.
- Teaching how to use a tool (that's a real screen).
- A photo of a real person without authorization, client data, a screenshot with information: the label doesn't cover
  anything, it stays outside.
- More than 12 photos: the grid turns into wallpaper. Choose.

## Structure
| Time | What happens |
|---|---|
| 0 | the photos of the 1st beat come in one by one (scale + opacity); the tag (pill) and the 1st label are already in the strip |
| `mosaico` beat | the grid (`grade`, with 2×2 `grandes` and the `ordem` of the photos); each photo breathes slowly inside its crop |
| `destaque` beat | one photo (`foto`) goes to the large spot and the others become a column beside it (16:9) or a row below it (vertical) |
| beat change | on a beat, the photos fly from the old spot to the new one, one after the other, in the reading order of the new spot; the old label leaves over the top and the new one rises |
| closing | the photos shrink one by one, the closing color opens up (from the center in `mosaico`; from the panel, in `dividido`) and the logo rises on a beat and stays still for ~2 s. **Logo only** |

Every beat and the logo start on a musical beat; the soundtrack (`arrange_series.py`) is composed with the BPM from the
JSON. The logo is the final accent of the music.

## Parameters (`example.json`, `example-split.json`)
```jsonc
{
  "nome": "photo-mosaic-example", "titulo": "…", "formatos": ["16x9"],   // 16x9, 19x9, 21x9, 9x16, 1x1, 4x5
  "plataforma": null,                       // optional: "reels", "feed"… (the right safe area)
  "bpm": 96,                                // the grid of the beats AND of the soundtrack (60 to 180)
  "ritmo": "calmo",                         // calmo | medio (default) | rapido: how long the photos take to change places
  "leiaute": "mosaico",                     // mosaico (label in a strip at the bottom) | dividido (label in a panel beside it)
  "camera": "estatica",                     // estatica | travelling (the grid moves slowly, larger than the window) | guided-zoom
  "fonte": { "familia": "Inter" },
  "raio": 40, "vao": 18,                    // the corner radius of the photos and the gap between them (px)
  "pares": [["#F5F5F5", "#1D1D1D", "AAA"], …],   // optional: with it, a label or tag outside the pairs is an error (and so is AA18)
  "cores": { "fundo": "#…", "rotulo": "#…", "faixa": "#…", "painel": "#…", "etiqueta": { "fundo": "#…", "texto": "#…" } },
  "etiqueta": "Your brand",                 // optional: the fixed pill (up to 4 words)
  "fotos": ["…/foto.jpg", { "arquivo": "…/foto.jpg", "foco": [50, 35] }],      // 3 to 12; foco in % (the crop keeps it)
  "etapas": [                                                                     // 1 to 6
    { "tipo": "mosaico", "grade": [5, 2], "grandes": [1], "ordem": [1, 0, 2, 3, 4, 5, 6], "rotulo": "128 photos of your brand" },
    { "tipo": "destaque", "foto": 0, "rotulo": "What this photo shows, in short", "batidas": 6 }
  ],
  "fecho": { "logo": "…/logo.png", "fundo": "#F5F5F5", "largura": 620, "batidas": 4 },
  "trilha": { "semente": 6101, "identidade": { "genero": "acustico", … } }   // assets/audio/API.md
}
```
- **Label:** informative (name, number, fact), up to 7 words and 48 characters, no exclamation mark. In the strip
  (16:9) it comes out on one line next to the tag (up to 2 lines if it doesn't fit); in the panel, in up to 4 lines. The
  type size shrinks until it fits (minimum 40 px in 16:9, 38 in 9:16); if it still doesn't fit, an error in the
  console: shorten the label.
- **Colors:** `fundo` is the video's background (behind the photos); `faixa` (optional) paints the label strip as a
  rounded card; `painel` is the color of the `dividido` panel (without it, the background). The pair that gets checked
  is `rotulo` over the strip (or the panel).
- **Grid:** `[colunas, linhas]` in landscape; in vertical (9:16, 4:5 and a window taller than it is wide) it is
  transposed. Each `grandes` takes 4 cells; with `grade` in the JSON, the photos must fill the grid with no gap (the
  template says how many cells are left over). Without `grade`, the template picks one. `ordem` gives the sequence in
  which the photos go into the cells (each large one in the 1st free cell where it fits).
- **Camera:** `estatica` (only the photos breathing), `travelling` (the grid is 1.6× the window and moves from start to
  end; in `dividido`, it bleeds past the edge of the frame) and `guided-zoom` (the highlighted photo moves in on its
  focus point).
- **Closing:** only `logo`, `fundo`, `largura` and `batidas`. In this template the closing is just the logo: a
  sentence, catchphrase, date or address in it is an error.

What the JSON can get wrong and the message that comes out: a value outside the list, a photo that doesn't exist,
`foco` outside 0–100, a grid that leaves a gap or where a large photo doesn't fit, `ordem` without all the photos,
`destaque` without `foto`, a long label or one with an exclamation mark, a color pair outside `pares`, text in the
closing. `render.mjs` stops with exit code 2 and the list.

Format examples: `example.json` (mosaic layout: label strip below the photos, one large photo, static camera, calm)
and `example-split.json` (split layout: label panel beside the photos, travelling camera, two large photos, medium).
Both are brand-free: greys, placeholder texts, the placeholder photos and the placeholder logo of `assets/example/`.

## How to render
```zsh
# from the skill folder; for the examples, their Inter goes in first (no network)
node scripts/example-fonts.mjs <output>/.work-<name>
node templates/photo-mosaic/render.mjs my.json --out <output> [--mode draft|final] [--formats 16x9,9x16] [--no-sound]
```
It does: `assemble.mjs` (checks, computes beats and placements and assembles the build in `<output>/.work-<name>`, with
the photos in `media/`) → the soundtrack (`arrange_series.py`, lead, with the BPM from the JSON) → `render.cjs` for each
format → `finalize.mjs` → contact sheet `<output>/<name>-<format>-sheet.png`. The default is `draft` (draft,
30 fps); `final`, 60 fps with motion blur. Without Python with numpy and scipy, it comes out silent and warns.

To look without rendering: `node templates/photo-mosaic/assemble.mjs my.json <build>` and
`node scripts/frames.cjs --project <build> --check --qps 10 [--format 9x16]` (text over a photo, covered or outside
the safe area).

## Formats
- **16:9, 19:9, 21:9:** `mosaico`: photos in the safe area, label strip at the bottom (150 px). `dividido`: panel with
  36% of the width on the left, photos on the right. The wide ones inherit the 16:9 through the engine's `L()`.
- **9:16, 1:1, 4:5:** `mosaico`: strip at the bottom (tag above the label), photos on top; the grid transposed.
  `dividido`: the panel goes to the top (34–36% of the height) and the photos to the bottom. In 9:16 the strip stays
  inside the Reels area (`areaSegura()`).
Recomposed, not cropped.

## Limits
- Still photos only (JPG/PNG). A video clip in the mosaic: no.
- The highlight puts the other photos in a column of thumbnails; with more than 6, they become two small columns.
- In `travelling`, the grid moves through the whole video at a single speed; going back to the mosaic shows another
  part of it.
- No voice: this is a video skill without narration. The soundtrack is the lead.
