# The product kit

The kit stores what gets reused between videos of the same product, so the next one starts ready: with a kit, the preview comes out in
**≤ 10 min** (from the request to the draft open for the owner); without a kit, the product's first video takes **≤ 25 min** and, once approved,
becomes the kit. The script is `node $SKILL/scripts/kit.mjs`.

## Where it lives

`~/Documents/VideoStudio/Brands/<slug>/kit/` (`VIDEOSTUDIO_BRANDS` changes the root). The slug comes from the product
name ("My Product" → `my-product`). `Brands/<slug>/` is the brand's data folder, and everything the skill remembers
about a brand lives in it:

| In `Brands/<slug>/` | What it is | Who writes it |
|---|---|---|
| `kit/` | the product kit (this page) | `kit.mjs save` |
| `profile/` | the reference profile: the brand's fonts, the rules and the approved videos (`references/refine.md` §4) | `refine.mjs profile` |
| `videos.json` | the variety history: the direction of each delivered video (`references/catalog/variety.md`) | `variety.mjs record` |
| `brand.json` | the brand's options: opening logo, closing logo, slogan, call to action, language (`references/brand.md`, "The brand's options") | `brand.mjs set` |

```
kit/
  kit.json                 the index (below)
  reading.md               the product reading (the basis of every image and sound decision)
  thesis.md                  the base thesis: what the product sells, who buys; the proof scene changes per video
  series/<id>/             each whole series (series.json, brand.js, visual.js, fonts/, identity.json, _logo/,
                           and its reading copied: the relative path does not survive the copy)
  voice/_takes/<chave>/      the approved takes: the voice cache (the same line, with the same voice and the same neighbors, comes out at no cost)
  recipe/                  the recording recipe files (base.mjs, barreira.mjs…), which every new video copies
```

## The `kit.json`

| Field | What it stores |
|---|---|
| `produto`, `slug`, `criado`, `atualizado` | who it is |
| `leitura`, `tese` | the files above |
| `series.<id>` | `pasta`, `versao` (the recorder's device), `formato`, `idioma`, `aparelho` (viewport, dsf, touch), `cinema`, `padrao` (the one `new-video` uses without `--series`). One series per format and language: `computer-16x9-pt`, `phone-9x16-en`… |
| `voz` | the approved voice: `id`, `nome`, `modelo`, `ajustes`, `perfil`, `idioma`, `pronuncia` (the decided map) and `takes` (the cache). Filled by `save` only when the approved video has voice (`voice/<version>/script.json`, `references/voice-script.md`); a kit saved from a video without voice keeps it `null` |
| `trilha` | the `identidade` (the series' `identity.json`), `genero`, `papel`, `bpm`, the approved `semente`, `sem_sino`, `trocar` |
| `receita` | the recording (below) and `arquivos` (the `recipe/*.mjs`) |
| `videos` | the videos that fed the kit (folder and title) |

### The recording recipe

Everything that was written from scratch in the first video and applies to all of them: `recipe.json` describes it as data, and `base.mjs`
does it. `base.mjs` exports `base({ origem, inicio, pasta, versao })` (the common fields of `video.mjs`: language, time zone,
device, `url`, `privacidade`, `entrar`, `inicio`) and `fechar(res)` (the end: the barrier report and the exit code).

| `recipe.json` field | What it is |
|---|---|
| `url`, `inicio` | the live website and the first screen of the recording |
| `login` | `pagina`, `email` (the test account) and `senha`: **the NAME of the vault variable** (e.g. `PRODUTO_E2E_PASSWORD`), plus the `cofre` (the file `base.mjs` reads it from, without printing). Never the password: `save` refuses it |
| `aparelho` | viewport and DSF |
| `idioma_tela`, `tours` | how the screen looks in the video's language and without the welcome tours |
| `barreira` | what passes, what is answered here (writes), what is aborted (analytics, visit, device) and where the report comes out; leak = the recording fails |
| `dados_de_exemplo` | the authorized sample account that appears in place of the test account, and what becomes a sample (e-mail, phone) |
| `privacidade` | what stays readable and what the recorder blurs |
| `antes` | how to capture the before of a previous version (below) |

## The commands

```sh
node $SKILL/scripts/kit.mjs list
node $SKILL/scripts/kit.mjs show "<product>"
node $SKILL/scripts/kit.mjs save "<product>" --from <folder of the approved video> [--recipe <folder with base.mjs and recipe.json>] [--reading <product reading>] [--series-id <id>] [--default]
node $SKILL/scripts/kit.mjs new-video "<product>" <new folder> --request "<the request, in the owner's words>" [--start <route of the first screen>] [--series <id>] [--seed N]
```

- **`save`** can run again without breaking anything: the series with the same id is replaced, the new takes join the ones already there, the
  video goes into the list. Run it when the owner approves a video (together with `refine.mjs profile … --approved`).
- **`new-video`** creates the folder and wires everything up:
  - `video.mjs`: the kit's series, the seed, the recipe base, the title and the ending taken from the lines (the opening is the title; the closing, the `fimLinhas`), and `--antes`;
  - `recording/`: the recipe files and the skeleton of `journey.mjs` (the only code of this video);
  - `texts.json` with the lines in `TODO` (`video.mjs` does not load until they are written). That is the video without
    voice, the default: a kit with no approved voice never adds one;
  - **with voice** (only when the kit holds an approved voice, saved from a video with voice): `voice/v1/script.json` in
    place of `texts.json`, with the kit's voice, settings and pronunciation and the lines in `TODO`; `voice/_takes/` with
    the kit's cache (a line already approved with the same voice and neighbors is not paid for again); and in `video.mjs`
    the voice (`voice/v1/narration.json`, with the script next to it for `--check`). The voice is generated after the
    lines are written and approved (`references/voice-script.md`, `references/voice-tutorial.md`);
  - the kit's `reading.md` and `thesis.md`; `REQUEST.md` with the request and the fast path already with the paths;
  - the stopwatch: `progress.mjs start --kit` (10 min target; `--voice` too when the video has voice), with the reading and the soundtrack already done.

## The before (optional)

In an update video, the short before of each change goes in through the journey's `g.antes(<png|mp4>, { ms, regiao })`
(`references/tutorial.md`). The image is the **whole screen of the previous version, on the same device** (any DSF). To
take it from the real website at a previous commit:

1. A worktree at the previous commit, without touching `main`: `git -C <repo> worktree add --detach <before-folder> <commit>`.
2. The `node_modules` through a symlink (`ln -s <repo>/node_modules <before-folder>/node_modules`) and the `.env` copied.
3. An **isolated** dev server: the symlink makes both servers share the bundler cache, and the real path of
   `node_modules` falls outside the root. In Vite, a `vite.config.isolado.ts` in the worktree:
   ```ts
   import { defineConfig, type UserConfig } from "vite";
   import { realpathSync } from "node:fs";
   import path from "node:path";
   import base from "./vite.config";
   const cfg = base as UserConfig;
   export default defineConfig({ ...cfg, cacheDir: "/tmp/<product>-antes-cache",
     server: { ...cfg.server, fs: { allow: [__dirname, realpathSync(path.resolve(__dirname, "node_modules"))] } } });
   ```
   and `npx vite --config vite.config.isolado.ts --port <port> --strictPort --host ::1`. Without the `cacheDir`, the pages
   return 504; without the `fs.allow`, the fonts return 403 and the screen opens in the system font.
4. Open it at `http://[::1]:<port>` (the video's mockup frame shows the production domain, the series' `endereco`).
5. The same journey in before mode: `ANTES_ORIGEM=http://[::1]:<port> node video.mjs --antes`. The journey receives
   `antes = true`: it does only the taps up to each old state and takes a `g.foto('antes-1')` at each one (they go to
   `antes/antes-1.png`). The barrier and the sample data apply the same way (the API is the production one).
6. In the video, `await g.antes('antes/antes-1.png', { regiao: { x, y, w, h } })` in the step: the regiao (app px) is what
   changed, up close, and the same regiao shows the now in the cut.

The product recipe stores the worktree, the port and the commands in `receita.antes` (`kit show` lists them).
