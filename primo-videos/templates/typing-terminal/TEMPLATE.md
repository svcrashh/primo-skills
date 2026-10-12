# Template: typing terminal

What was typed and what a command-line program answered, for real, in a clean terminal window.
Command typed at a human pace (seeded: the same video always comes out the same), cursor, output line by line, short
caption at the bottom. It is part of product type 4 (`references/product.md`).

## When to use
- Command-line product: the person lists 1 to 4 commands and the video shows each one running.
- API or library with no screen (`curl` + JSON; an example running), as a type 5 proposal.

## When not to use
- Interactive program (TUI, questions and answers): the recorder has no keyboard. Record the Terminal window (type 3).
- Output with secrets or real data: change the environment before recording.

## How to do it
```sh
node scripts/product/record-terminal.mjs --commands commands.json --out terminal.json --folder <repo>
node templates/typing-terminal/render.mjs video.json --out <folder> [--mode draft|final] [--formats 16x9,9x16] [--no-sound]
```
Formats: `16x9`, `9x16`, `1x1`, `4x5`, `19x9` (2280×1080) and `21x9` (2520×1080). In the two wide ones the window is
the 16:9 one stretched in width (side margin of 110 px × width/1920; same type size) and 12 px shorter, so the caption
fits within the bottom 5%.

`video.json`: `{ "nome": "…", "formatos": ["16x9","9x16"], "gravacao": "terminal.json", "cps": 11, "pausa": 1.2, "duracao": 9.6, "cores": { … } }`.
`cores` (all optional, neutral by default): `fundo`, `janela`, `barra`, `texto`, `comando`, `prompt`, `cursor`, `legenda`.
`cps` = keystrokes per second; `pausa` = silence after each command's output; `duracao` = minimum video duration.
`teclado` (`notebook`, `mecanico`, `tela`) and `trilha` (`semente`, `identidade`: the audience's genre, v2 schema from
`assets/audio/API.md`; without it, a neutral one comes out), optional.
Optional, all off by default: `titulo` (replaces the recording's; `""` = bar without a title), `moldura: false`
(no shadow and no three buttons), `areaSegura: true` (in 16:9, window 12 px shorter and caption within the bottom 5%),
`linhaMin` (s between the output lines; default 0.05), `mono` (installed terminal family, e.g. `Menlo`), `fonte`
(for the caption and the title) and `fecho: { "logo": "x.png", "fundo": "#hex", "dur": 2.2, "largura": px }` (cut to
the background with the logo centered and still; the soundtrack resolves on it). Example with all of them: `example.json`.
Two more, also off by default: `coluna: "esquerda"` (in the horizontal formats, each command's caption becomes a large
column on the left, at 64 px, and the window sits on the right, with the terminal text at 46 px: commands of up to ~32
characters) and `camera: { "de": 0.84, "origem": [x, y] }` (the window starts at that scale and reaches its own size at
the end of the terminal, from `origem`, as a fraction of the window; it never goes past the layout).

Format examples, with no brand (greys, placeholder commands and captions, the placeholder logo): `example.json` (dark
terminal, one command with six lines of output), `example-column.json` (column, three short commands) and
`example-light.json` (light terminal, two commands, the camera moving closer). Each has, in the folder of the same
name, its `commands.json` (placeholder commands that only print text: `echo`, `printf`) and the `terminal.json`
recorded from it. To re-record one (the commands need no particular folder):
`node scripts/product/record-terminal.mjs --commands templates/typing-terminal/example/commands.json --out templates/typing-terminal/example/terminal.json`.

Outputs `<output>/<name>-<format>-draft.mp4` and the contact sheet: **look at the contact sheet**.

## Limits
- The sound is the skill's soundtrack (`arrange_series.py`, protagonist role) with each command's keystrokes marked in it,
  checked by `finalize.mjs`; it needs a Python with numpy and scipy (the one from `environment.mjs --fix`), and
  `--no-sound` comes out silent.
- Basic ANSI colors (16 colors and bold). Long output scrolls up like a real terminal, and the top line
  can get cut by the window bar: prefer outputs that fit in the window (~9 lines in landscape).
- No brand: name and colors come from the project.
