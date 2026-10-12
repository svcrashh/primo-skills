# Transitions (`TR` in `engine.js`)

## Contents
1. How to set one up (applies to all)
2. Catalog: when to use, call, duration and sound
3. Quick sound table
4. Hand-made transition
5. Pitfalls

---

## 1. How to set one up (applies to all)

Every transition has two sides. Each side is called in the `update` of one of the two scenes, which overlap in time:

```js
const T0 = 12.0, D = 0.5                              // on the grid: D = 1 beat at 120 BPM
cena(8.0, T0 + D, (root) => {                         // A ends at the END of the transition
  const cam = camada(root, C.escuro)                  // the background goes on the layer, never on the root
  // … content inside cam …
  return (t) => { TR.whip.sai(cam, t, T0, D); /* animate what's inside cam */ }
})
cena(T0, 18.0, (root) => {                            // B starts at the START of the transition and is registered after (sits on top)
  const cam = camada(root, C.claro)
  return (t) => { TR.whip.entra(cam, t, T0, D) }
})
```

- **Signature:** `TR.<name>.sai(camada, t, t0, dur, opts)` and `TR.<name>.entra(camada, t, t0, dur, opts)`.
- **Layer:** `camada(root, fundo)` creates a full-screen div with the scene's background. The root stays without a background, because it gets the shake and would cover the other scene. If the root has a background, the engine prints `TRANSITION …: the root of scene … has its own background` and the script exits with code 3.
- **Always call it, without an `if`.** Before `t0`, `entra` hides the layer. After `t0 + dur`, `sai` hides it. Outside the window, nothing is painted.
- **The layer belongs to the transition.** On every frame the engine resets its `transform`, `filter`, `clip-path`, `opacity`, `display` and `z-index` to the original value. Animate only what's **inside** it. The same layer can have an `entra` at the start and a `sai` at the end of the scene.
- **Who sits on top:** the scene registered later. That's B, in the normal order. The exception is the page flip, where the engine puts A on top by itself.
- **Registration:** each call registers `{ nome, t0, dur }` in `TRANSICOES`. That's how the `frames.cjs --auto` sheet finds the cuts, and how the collision check stops flagging coverage inside the window (there, covering is the effect itself).
- **On the grid:** `tempo = 60 / BPM`. Pick `t0` and `dur` so the strong moment (the middle of the whip, the blade's cut, B's birth in the zoom) lands on a beat of the music, preferably on the downbeat.
- **Review:** run `frames.cjs --strip t0-0.1:t0+dur+0.1:8` in each format and look at the images. The draft already generates the `--auto` sheet by itself.

## 2. Catalog

### whip · fast pan
- **When:** a change of subject with energy, a feature list, "and there's more". It links two scenes of the same weight. Don't use it twice in a row.
- **Call:** `TR.whip.sai(camA, t, t0, dur, { dir: 'esquerda' })` and `TR.whip.entra(camB, t, t0, dur, { dir: 'esquerda' })`. `dir` says where the content goes: `'esquerda' | 'direita' | 'cima' | 'baixo'` (left, right, up, down). Options: `ease` (`E.inOutExpo`), `blur` (factor, 1), `blurMax` (70 px).
- **What it does:** a directional blur (SVG filter `stdDeviation "bx 0"`) proportional to the speed, measured by the derivative of the position. The draft already comes out looking like a whip, and the final render's motion blur adds on top. The bottom layer extends its own background behind the seam, so the stage doesn't leak between the two blurred edges.
- **Duration:** 1 beat (0.5 s at 120 BPM). With the speed peak in the middle, the middle of the transition lands on the next beat.
- **Sound:** `whoosh` with `dur` = the transition's duration and the peak in the middle: `{'t': t0 + dur/2, 'som': 'whoosh', 'dur': dur, 'direcao': -1}`. Use `direcao` -1 when the content goes left.

### push · shove
- **When:** a logical sequence ("then", "step 2"), a carousel, a scrolling feed. It's calmer than the whip. In 9:16, `dir: 'cima'` mimics the scroll gesture.
- **Call:** `TR.push.sai(camA, t, t0, dur, { dir: 'cima' })` and `TR.push.entra(camB, t, t0, dur, { dir: 'cima' })`. Options: `ease` (`E.inOutCubic`); `recuo` (only on `sai`), where `0.3` makes A move only 30% and darken while B passes over it, like a stacked card.
- **Duration:** 1 beat.
- **Sound:** a short, low `whoosh`, peaking in the middle: `{'t': t0 + dur/2, 'som': 'whoosh', 'variante': 'curto', 'nivel': -9}`. In a tutorial, swap it for `toque` at the start, if the push comes from a gesture.

### zoom · dive (zoom-through)
- **When:** "let's go into this", when the detail becomes the next scene, or when diving into a shape of the logo, a button or an icon. It's the most cinematic. Save it for once or twice in the video.
- **Call:** `TR.zoom.sai(camA, t, t0, dur, { x, y, raio })` and `TR.zoom.entra(camB, t, t0, dur, { x, y })`.
  - `x, y` is a point **with meaning**: for a shape, use `pontoInterno(path)` converted to the frame; for an element, the center of `rectOf`.
  - `raio` is the radius in px of the shape around the point. With it, the engine computes `zmax = 1,25·raioCobre/raio` so the shape's color fills the screen; without it, `zmax` stays at 14.
  - Other options: `nasce` (0.6, the scale B is born at), `blur` (6 px) and `ease` (`E.inCubic`, on A only).
- **What it does:** A grows exponentially until it fills the screen at half the duration. Then B is born from inside, on top, with opacity, scale `nasce → 1` and a blur that clears. B's background matching the shape's color gives the perfect dive.
- **Duration:** 1 to 1.5 beats. The middle (B being born) lands on the downbeat.
- **Sound:** a long `whoosh` peaking in the middle (`{'t': t0 + dur/2, 'som': 'whoosh', 'dur': dur}`). For a big dive, use a `riser` that ends in the middle (`{'t': t0 + dur/2, 'som': 'riser', 'dur': 1.5}`) and a light `impacto` at the same instant.

### mascara · shape reveal
B sits on top and is revealed by a shape. Call only `entra`: `TR.mascara.entra(camB, t, t0, dur, { forma, … })`. `sai` is the reverse (the outgoing scene shrinks back into the same shape) and only works when the outgoing scene is on top.

- **`forma: 'circulo'`** (iris from `x, y`)
  - **When:** the next scene is born from something: a tapped button, a notification, a word. Never from the center for lack of an idea.
  - **Duration:** 1 beat.
  - **Sound:** if it's born from a tap, `toque` at `t0`. Otherwise, a short `whoosh` peaking in the middle.
- **`forma: 'diagonal'`** (straight wipe)
  - **Options:** `angulo` is the direction of travel in degrees: 0 goes left to right, 90 top to bottom; the default is 20.
  - **When:** a dry editorial change, typography, before → after.
  - **Duration:** 1 beat.
  - **Sound:** a short `whoosh` peaking in the middle.
- **`forma: 'barras'`** (`n` staggered strips)
  - **Options:** `n` (5); `direcao` `'horizontal'` (stacked strips, each sweeping left to right) or `'vertical'`; `escalonar` (0.45); `alterna` (strips alternating direction).
  - **When:** a list, a marked pace, graphic energy. It pairs with the soundtrack's sixteenth notes.
  - **Duration:** 1 to 2 beats.
  - **Sound:** a short `whoosh` peaking in the middle. For a more rhythmic effect, one `clique` per strip, spaced by `escalonar·dur/(n−1)`.
- **`forma: 'lamina'`** (double slanted blade)
  - **Options:** `cor` (the wide blade, which covers the whole frame exactly at the cut), `cor2` (the thin accent blade, which goes in front), `angulo` (30), `dir` (`'direita'` or `'esquerda'`) and `atraso` (7% of the duration).
  - **What it does:** A disappears and B appears **at the cut**, which is the instant the curve passes 0.5 (the middle, with the default curve). The blades sit on scene B's root. That's why **scene B starts at `t0`**, not at the cut.
  - **When:** an impact cut, a section turn, the brand color slashing across the screen. It can be the signature move when the logo has a diagonal.
  - **Duration:** 1 beat, with `t0 = downbeat − dur/2`, so the cut lands on the downbeat.
  - **Sound:** `impacto` at the cut (`{'t': t0 + dur/2, 'som': 'impacto'}`) plus a short `whoosh` peaking at the same instant. Also put the cut in `VIDEO.impactos`, to get the shake.

### virada
- **`tipo: 'cartao'`** (the screen flips like a card)
  - **Call:** `TR.virada.sai(camA, t, t0, dur, { tipo: 'cartao' })` and `TR.virada.entra(camB, t, t0, dur, { tipo: 'cartao' })`. A is the front and B the back.
  - **What it does:** pulls back in the middle (`recuo` 0.35) and darkens with the angle.
  - **Options:** `dir` (`'direita'` or `'esquerda'`), `eixo` (`'y'` or `'x'`), `perspectiva` and `fundo`, the color behind the card (default: the stage background, `VIDEO.fundo`).
  - **When:** before → after, question → answer, front and back of the same thing (technical × family).
  - **Duration:** 1.5 beats. The flip (90°) lands on the beat.
  - **Sound:** `virada` with `variante: 'cartao'` at `t0` (`{'t': t0, 'som': 'virada', 'variante': 'cartao'}`).
- **`tipo: 'pagina'`** (a page turning around the spine)
  - **Call:** `TR.virada.sai(camA, t, t0, dur, { tipo: 'pagina' })` and `TR.virada.entra(camB, t, t0, dur, { tipo: 'pagina' })`.
  - **What it does:** A turns **over** B. The engine raises scene A's `z-index` during the transition; the grain and the badge stay above everything. The page gets a shine at the fold and darkens at the free edge. The page underneath has a shadow next to the edge of the turning page and darkens entirely at the start.
  - **Options:** `dir` (`'esquerda'`, with the spine on the left, is the default), `perspectiva` (4·W) and `ease`.
  - **When:** chapter, step by step, diary, "a day in the life", report, menu.
  - **Duration:** 1.5 to 2 beats.
  - **Sound:** `virada` with `variante: 'pagina'` at `t0`, which is when the page starts turning (`{'t': t0, 'som': 'virada', 'direcao': -1}`).

### morph · the shape becomes the screen
- **When:** the tapped button becomes the next screen, the pill becomes the background, the icon becomes the set. It's the continuous match cut and speaks the product's language.
- **Call:**
  ```js
  let alvo                                          // outside the scenes
  cena(…A…, (root) => { … alvo = rectOf(botao); alvo.el = botao; return (t) => { TR.morph.sai(camA, t, T0, D, { de: alvo, origem: alvo.el }) } })
  cena(…B…, (root) => { const camB = camada(root, C.escuro); return (t) => { TR.morph.entra(camB, t, T0, D, { de: alvo, origem: alvo.el }) } })
  ```
  - `de` is `{x, y, w, h, r?}` (the `rectOf` measured in A's build, before any transform) or a `'M…'` path in frame coordinates.
  - `cor` is the shape's color. The default is the background of B's layer, which gives the perfect seam.
  - `corInicial` is the button's color. The change to `cor` is a hard switch, in the middle of the morph, with no muddy blend.
  - `origem` is the element that disappears while the shape takes its place.
- **What it does:**
  - The shape becomes a circle with the same area, and the direction of the points is aligned so it doesn't twist.
  - The circle grows until it covers the frame, and B appears from inside that color (opacity and scale from 0.94 to 1).
  - A moves 4% toward the shape. Pulling back would open an edge onto the stage.
- **Duration:** 1.5 to 2 beats.
- **Sound:** `toque` or `clique` at `t0`, if it's born from a tap, plus a short `whoosh` peaking at `t0 + 0,45·dur` (when the circle takes off).

## 3. Quick sound table

Names from `assets/audio/sounds.py`. `t` is the instant that goes into `sons.colocar([...])`. See the anchors in `sons.CATALOGO`: `whoosh` peaks at `t`, `riser` ends at `t` and the others start at `t`.

| Transition | Sound | `t` |
|---|---|---|
| whip | `whoosh` (`dur` = dur, `direcao` by the direction) | `t0 + dur/2` |
| push | short `whoosh`, `nivel` −9 | `t0 + dur/2` |
| zoom | long `whoosh`, or `riser` + `impacto` | `t0 + dur/2` |
| mask, circle | `toque` (if it comes from a tap) or short `whoosh` | `t0`, or `t0 + dur/2` |
| mask, diagonal / bars | short `whoosh` (bars: one `clique` per strip, optional) | `t0 + dur/2` |
| blade | `impacto` + short `whoosh` | the cut, `t0 + dur/2` |
| card flip | `virada` with `variante: 'cartao'` | `t0` |
| page flip | `virada` with `variante: 'pagina'` | `t0` |
| morph | `toque`/`clique` + short `whoosh` | `t0`, and `t0 + 0,45·dur` |
| drawn explainer (fade, slide, wipe, zoom, brush between scenes) | `whoosh` peaking in the middle of the transition, `dur` = the transition (the renderer marks it by itself) | `t0 + dur/2` |

Every sound with an event becomes a marker in `sheet.json`. Changed a transition's `t0`? Change the sound with it.

## 4. Hand-made transition

A transition that isn't in `TR` (collapse into dots, particles, match cut) has to register itself in the build of one of the scenes. That way the `--auto` sheet shows the cut and the check understands that the coverage there is intentional:

```js
registrarTransicao('colapso', 20.0, 0.6)
```

`tocar(el, 'prop', valor)` writes a style that the engine resets to the original on every frame. Use it on the elements only the transition moves.

## 5. Pitfalls

- **A root with a background** covers the other scene, and the engine flags it. The background goes on the `camada`.
- **Scene B starting at the cut** (blade, morph) makes the blades or the shape appear only halfway through. It has to start at `t0`.
- **Scene A ending before `t0 + dur`** cuts the transition off in the middle.
- **Animating the layer itself** (`T(cam, …)`) fights the transition and is undone on every frame. Put a wrapper inside it.
- **Transform or clipping on the layer in a scene smaller than the frame:** the mask shapes are computed in frame coordinates. The layer has to be at (0, 0) and cover the frame.
- **Very fast edges in the final render** (blade, long vertical whip): with 8 subframes, the edge moves ~16 px between one and the next and steps show up. In that stretch, render with `--sub 16`.
- **Zoom without `raio`**, on a point far from the center, may not fill the screen, and scene A's corners show when B is born. Pass the shape's `raio`.
