# Tutorial mode: the real screen, nothing in front

Contract for how a project makes tutorial videos with the skill:

- how it defines a video;
- how it records, checks and composes;
- how it passes on its identity;
- how it copies the engine into its own repository.

The skill depends on no product: the app is just one of its clients.

A tutorial has no narration by default: the step caption, the soundtrack and the sound effects tell it, and everything
runs on the machine. With voice (opt-in and paid: only when the person asks for a voiceover and there is an ElevenLabs
key), `video.voz` turns on a voiceover that sets the time of each step and becomes the caption. What changes is in
`references/voice-tutorial.md`; this file says "with voice" at each place where it matters.

## Contents
1. How it works (and why)
2. Structure of a tutorials project
3. Defining a video: `video.mjs`
4. Script API (`g`)
5. "Is something in front?": the check on every tap
6. Native controls, privacy and plausible data
7. Record, check and compose (commands)
8. What comes out: `events.json`, frames and sheets
9. Identity of the series (brand, fonts, soundtrack)
10. Copying the engine into a repository
11. Re-recording when the screen changes
12. Pitfalls (each one has already cost a round)
13. The series' look: the nine elements, each type, when to use it (and the optional `secao` and `painel`)
14. Formats: any of them, by orientation (19:9, 21:9, `--format`)
15. 3D panel for computer recordings (cinema mode) and sections (`g.secao`)
16. Logo as PNG (`MARCA.png`)
17. Text outside the image
18. The example computer tutorial series (and the visual variants)
19. Recipe: tutorial of a web tool on the computer (and with voice, when asked)

---

## 1. How it works

```
video.mjs ──record.mjs──▶ output/<device>/frames/*.jpg + frames.json + events.json + taps-sheet.png
                                   │
                         compose.mjs ▼
      engine project (engine.js + tutorial.js + data.js) ──render.cjs──▶ video
      sheet.json (sounds on the events) ──arrange_series.py──▶ soundtrack.wav (the video's seed)
      finalize.mjs (mix + duration, loudness, peak) ──▶ <id>-<device>.mp4  +  event sheet
```

- **Real screen, nothing recreated.** The recorder drives the app with Playwright and captures the actual screen.
- **Indicators in the composition, not in the app.** Finger, cursor, highlight, zoom, captions and sounds come from `events.json`. That is why:
  - the capture stays clean;
  - the indicator stays sharp at any zoom and in proportion to the screen (finger at 22 CSS px, cursor at ~22 CSS px);
  - you can recompose without re-recording.
- **Capture.** Screencast in new-headless Chromium (`channel: 'chromium'`), with `--force-device-scale-factor` equal to the device's DSF:
  - real pixels (phone 1170×2532, computer 2880×1800) at 50–60 fps, even with `backdrop-filter`;
  - measured: 47 fps with a blurred dialog open and a spinner running, at 2880×1800;
  - a still screen produces no frame: the previous frame is held;
  - without the `chromium` channel, it falls back to `captureScreenshot`, which is much slower (7–20 fps).
- **Voice, only when asked.** Without `voz` in `video.mjs`, the pipeline above is the whole story. With it, the recorder
  holds each step for its line (`voice/<device>/narration.json`, generated beforehand by `scripts/voice.mjs`), the
  caption becomes the spoken line, and `arrange_series.py` mixes the voice over the soundtrack
  (`references/voice-tutorial.md`, `references/voice-mix.md`).

## 2. Structure of a tutorials project

```
<repo>/docs/videos/                 (or any folder)
  _motor/                           copy of the engine (section 10) — or use the installed skill
  _serie/                           series identity (section 9)
    brand.js  fonts/  series.json  identity.json  .venv/ (numpy+scipy, outside git)
  01-agendar-aula/
    video.mjs                       the definition (section 3) — versioned
    script.md / NOTAS.md           optional, the project's own
    voice/                          only with voice: <device>/script.json, narration.json, lines/*.wav and
                                    _takes/ (the paid takes, the cache) — versioned (references/voice-script.md §7)
    costs.jsonl                     only with voice: what the video spent (costs.json, if its cap was changed; scripts/costs.mjs)
    output/  *.mp4  *-sheet.png      output — do NOT version (with voice, also <id>-<device>.srt)
```

## 3. Defining a video: `video.mjs`

```js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rodar, principal } from '../_motor/scripts/tutorial/record.mjs'   // or <skill>/scripts/tutorial/record.mjs

const video = {
  id: '01-agendar-aula',                 // name of the folder and of the files
  titulo: 'Agendar uma aula',            // the video's opening (wraps on its own; or tituloLinhas: ['…', '…'])
  url: 'https://app.exemplo/',           // where it starts (if there is no `entrar`)
  versoes: ['phone', 'computer'],    // devices (section 7); each version is a video
  pasta: path.dirname(fileURLToPath(import.meta.url)),
  serie: '../_serie',                    // identity (section 9)
  idioma: 'pt-BR', fuso: 'America/Sao_Paulo',
  dados: { perfil: 'escola', feriados: 'br' },            // plausible data (section 6)
  privacidade: { seletores: ['.token'], emailsPermitidos: '@escola-modelo\\.demo$' },
  borrar: ['[data-cpf]'],                // shortcut: extra selectors to blur
  esconder: { seletores: ['#tour'], textos: ['Visita guiada', 'com IA'] },  // never appear
  avisos: ['.minha-notificacao'],        // extra notice/toast selectors (the defaults already cover role=status etc.)
  semente: 4242,                         // optional: pins the soundtrack (default: derived from id + version)
  cortarEsperas: { acima: 3, antes: 1, depois: 0.6 },  // optional: hard cut in the middle of long waits (loading, publishing)
  // only with voice (opt-in, paid; references/voice-tutorial.md §1):
  // voz: { locucao: 'voice/{versao}/narration.json', roteiro: 'voice/{versao}/script.json', perfil: 'calmo' },
  // hooks (all optional) — they run OUTSIDE the recording
  async entrar({ p, v, ap, dados, check }) { /* demo login or test account; never a password in the code */ },
  async preparar({ p, v, dados, check }) { /* creates the data the video needs, through the screen itself or a test API */ },
  inicio: '/agenda',                     // optional: page where the recording starts
  async roteiro(g) { /* section 4 */ },
}
export default video
if (principal(import.meta.url)) await rodar(video)
```

- **One task per video.** Three tasks are three videos in the series.
- `entrar`: use demo mode or a documented test account. A password never goes in the chat or in the code. If you need one, read it from an environment variable.
- `voz`: leave it out and the video has no voice, exactly as always. Put it in only when the person asked for a
  voiceover: each version in `versoes` then needs its `voice/<device>/script.json` and, after `voice.mjs generate`, its
  `narration.json` (`references/voice-tutorial.md` §1–§2).

## 4. Script API (`g`)

Each call produces one or more events. Every tap goes through the check in section 5.

| Call | What it does |
|---|---|
| `g.passo('Tap Save.')` | new caption; makes sure the previous one stayed **≥ 3 s** on screen (`leituraMin`) |
| `g.passo('…', { junto: true })` | with voice: control comes back at the first sound, and the taps run together with the line (without `junto`, it comes back 0.3 s before the end of the sentence). Without voice and in `--check`, it changes nothing |
| `g.na('word', { antes })` | with voice: waits until `antes` (0.6 s) before the word is said, so the next tap lands on it. Takes a sequence (`'New sale'`); a repeated word takes the next occurrence; an instant already past goes on without waiting; a step without a line does not wait. A word that is not in the line is an error, already in `--check`. Without voice, it does nothing |
| `g.toque(alvo, { ponto, depois, realce, rapido })` | moves the indicator to the target, checks, taps/clicks **at the checked point** |
| `g.toque(alvo, { oculto: true })` | the tap of **the person the product serves** (the customer's message, in a sales video): it goes through the same check, but with no finger, ripple, highlight or sound, and the camera does not go to it. On screen you only see what the tap causes. It is not for hiding the hand of whoever operates the product |
| `g.aponta(alvo, { ms, ponto, realce })` | moves the indicator and highlights, without tapping (to show where something is) |
| `g.aponta(alvo, { dedo: false })` | moves only the camera (and the highlight) to the target, with no indicator: shows what the product just did in a sales video, where nobody operates the screen |
| `g.aponta(alvo, { lupa: 3.4, margem })` | on top of that, a **magnifier**: the target leaves the screen in a lens with an accent-colored border, `lupa` times bigger (1.5 to 6), for the `ms` duration. It is for the small detail that is the video's thesis (an "AI" badge). `margem: [top, right, bottom, left]` in app px shows what is around it (the name next to the badge) |
| `g.prova('Stock', { alvo, ms })` | sales video: marks a proof the product just gave. The screen turns slightly in perspective, the shine sweeps across, a **big marker** comes in with the label and the count ("✓ Stock · 1 of 3"), then shrinks into a rail at the top, and a sound plays. Label up to 16 letters. `alvo` takes the camera to the proof |
| `g.placar([{ valor: 3, rotulo: 'questions' }, { valor: 0, rotulo: 'agents' }], { ms })` | sales video: the **scoreboard** of what just appeared. The markers come together, the camera pulls back, the device recedes and goes out of focus, and the number **counts** (one tick per unit). One per video, at the end, with 1 or 2 items. It stays until the end of the recording, which holds `ms`: **without `ms`, the default already leaves 2.5 s readable** (3.15 s with 1 item, 3.65 s with 2). A smaller `ms` is already an error in `--check` (`compor` would reject it) |
| `g.antes('antes/antes-1.png', { ms, regiao, alvo, espera })` | what's-new video: the **glimpse of the previous state**, one per step. The image (PNG/JPG) or the clip (MP4) of the previous version, **the full screen of the same device** (any DSF), takes the place of the recorded screen for `ms` (1200; 500 to 2500), inside the same mockup frame and **in the same framing**: the camera hard-cuts to the `regiao` (`{ x, y, w, h }` in app px: what changed, up close), or to the `alvo` rectangle (a locator on the current screen), or to the target of the step's next action, and stays there until the cut back. The BEFORE label (series mono, no pill) turns into NOW in the brand accent at the cut; indicator and highlight disappear during the glimpse; **the audio does not change**. Call it at the start of the step, or at the moment the current screen shows the same place (after opening the dialog that changed): the cut to NOW is the difference. `espera: false` lets the journey carry on underneath (the screen change disappears under the glimpse). Only in series version 2 |
| `g.foto('antes-1')` | the whole current screen as a PNG, at the device's DSF, in `video.fotos` (or `<folder>/antes/`). It is the before journey (the site in its previous version, `references/kit.md`, "The before") that uses it: the image becomes the `g.antes` |
| `g.digita(alvo, 'text', { privado, atraso, limpar })` | taps the field and types like a person; `privado` keeps the text out of the log |
| `g.escolhe(select, 'Option')` | native `<select>`: goes through the options in the field itself (section 6) |
| `g.data(input, dados.diaUtil(2))` | native date/time field: types into the field; a date on an opening day |
| `g.arquivo(botao, 'caminho.pdf')` | attachment: taps the app's button and hands the file to the picker |
| `g.rola(alvo \| px, { bloco })` | smooth scroll to the target or by px |
| `g.espera(alvo \| ms, { estado, motivo })` | waits for something to appear/disappear (loading) |
| `g.pausa(ms)` | pause (only in the recording) |
| `g.sucesso(alvo?)` | marks the moment of success: sound and the camera opening up |
| `g.secao('Reports and export')` | opens a section (a block of steps on the same subject), before the `g.passo` that opens it: it waits for the previous step to stay up long enough to read, like `g.passo`. In the composition, the section label changes at the top of the text column and, in cinema mode, the chapter card comes in and the panel flips (section 15); with `abertura.indice` and 2 or more sections, the opening shows their index (section 13). Name up to 28 letters |

- **The step's time is reading time:** each caption stays at least `leituraMin` (3 s) on screen before the next one, and
  the step's taps run in sequence, each with its `depois` (0.7 s) so the viewer sees what it caused. A step
  with many taps and a short sentence leaves the caption hanging around; a long sentence with a single tap leaves the screen still: balance it
  in the script.
- **With voice, the line sets the step's time** (`references/voice-tutorial.md` §3), and no stretch of more than
  ~2.5 s goes without voice in the middle of the video. A step with more than one tap uses `junto` + `g.na`, one
  `g.na` before each tap. The recording warns at the end about the step that went past it, and what to do.

  ```js
  const nav = g.p.getByRole('navigation')
  await g.passo('The bottom bar leads to Sales, Network and Wallet.', { junto: true })
  await g.na('Sales'); await g.toque(nav.getByRole('link', { name: 'Sales' }))
  await g.na('Network'); await g.toque(nav.getByRole('link', { name: 'Network' }))
  await g.na('Wallet'); await g.toque(nav.getByRole('link', { name: 'Wallet' }))
  ```
  Each tap takes ~1 s from the `g.na` until it lands, plus its `depois` (0.7 s). Words close together in the line
  (less than ~1.7 s apart) leave the tap late: use `depois: 300` on those taps, or let the sentence breathe between
  them.
- `alvo` is a Playwright locator or a text selector. An ambiguous selector is an error (strict mode): be specific.
- `ponto: { x, y }` taps on a part of the target, relative to its corner.
- Available in `g`: `p` (the page), `v` (version), `ap` (device), `dados`, `check`, `toque` (true on the phone).

## 5. "Is something in front?": the check on every tap

Rule with no exception: **no tap without a check.**

1. The target must be visible and **still**. If it is off screen, or clipped by a container with its own scroll (a dialog's body, a list), it scrolls smoothly to the center and waits for it to stop moving.
2. `document.elementFromPoint(x, y)` at the tap point. If it is the target (or something inside it, or its `<label>`), it goes on.
3. If it is not, it classifies **what covers it** (the outermost element):

| What covers | How it recognizes it | What it does |
|---|---|---|
| notice / toast | `role=status\|alert`, `aria-live`, a toast/snackbar/aviso/notif class or id, or `video.avisos`. A fixed notice with `pointer-events: none` also counts: what matters is its box over the target's box, not `elementFromPoint` (the tap would go through, but the viewer sees the finger underneath) | **waits for it to go away** (up to `limiteAviso`, 10 s), `espera` event |
| fixed bar / floating button | a `position: fixed\|sticky` ancestor that does not contain the target | **scrolls** until the target is above/below it (up to 3 times), `rola` event |
| target also fixed | both fixed: scrolling does not help | **fails**: "nav … covers button \"Finalizar\" (both are fixed on the screen, scrolling does not free it)" |
| modal scrim (> ½ of the screen) | fixed and huge | **fails** |
| anything else | — | **fails**: "X covers Y" |

4. The check runs **again at the moment of the tap** (a notice can pop up during the movement) and the tap fires **exactly at the checked point** (`touchscreen.tap` / `mouse.click`), never through `locator.click()`.
5. On failure, it exits with code 1, the message and `output/<device>/failure.png`, with what covers in red and the target in blue.
6. The same applies in `--check`.

When it fails, the fix is in the script (close the notice, scroll another way, tap another button) or **in the product**: a button behind the navigation is a bug in the app, and it is worth reporting. Never turn the check off.

## 6. Native controls, privacy and plausible data

**Native controls.** Windowless Chromium does not draw the `<select>` list, the calendar, the clock or the file picker.

- `g.escolhe`: the indicator taps the field, the field goes **through the options, one by one** (380 ms each) up to the chosen one, with a highlight, and the composition sticks a "✓ Option" badge on the field. Each step fires `input`/`change`. If the app reacts to every change, use `{ passoAPasso: false }`.
- `g.data`: types day/month/year into the field itself (the order comes from `idioma`) and the badge shows the date. The field's `input`/`change` events are held back during typing and a single one fires at the end: an app that reacts to every change (a multi-date field) does not register the intermediate dates.
- `g.arquivo`: a highlight on the button and a badge with the file name.
- `--check` lists the native controls used. **Mention it in the briefing** and, if the app has its own list component, prefer it in the script.
- The app's own component (its listbox, combobox): use `g.toque` on the option. `g.escolhe` rejects a component that is not a `<select>`.

**Privacy by default.** The items below are blurred **inside the page, before the pixel exists** (the `data-fv-borrar` attribute plus a stylesheet; the app's DOM is not rewritten):

- `input[type=password]` and `[data-privado]`;
- links with a secret parameter (`token`, `key`, `secret`, `convite`, `invite`, `code`, `sig`…) or with a random chunk of 20 or more characters;
- e-mails, except those in `privacidade.emailsPermitidos`;
- the links above, except those in `privacidade.linksPermitidos` (an expression, like the e-mail one: the public profile that may
  appear, e.g. `'^https://perfil\\.exemplo\\.com/'`, without turning off the blur on the others with `links: false`);
- the selectors in `privacidade.seletores` and `borrar`.

`esconder` removes elements and buttons by selector or by text. Measured test: the blurred region keeps 0% of the detail of a title on the same screen.

**Plausible data** (`data.mjs`, `g.dados`):

- opening-hours profiles: `escola` (Mon–Fri, 07:30–17:30), `clinica`, `escritorio`, `comercio` (Mon–Sat), `restaurante`, `sempre`, overridable with `dias`, `inicio`, `fim` and `passo`;
- `feriados: 'br'` includes the national (Brazilian) holidays, with the movable ones computed from Easter;
- `dados.diaUtil(n)`: the n-th opening day from today;
- `dados.horario('manha' | 'tarde' | 'fim' | 'HH:MM')`: a time within opening hours;
- `dados.extenso(d)`: "qua., 30 de set." (in the `idioma` locale, here pt-BR);
- `g.data` **rejects** weekends and holidays (`{ qualquerDia: true }` for an explicit exception).

Never use a raw "today": the recording may fall on a Sunday.

## 7. Record, check and compose

```sh
node <folder>/video.mjs --check                # checks without recording: the same tap check, ~20 s per version, and everything
                                               # compor would reject (below), all at once, each item with what to change
node <folder>/video.mjs [--device phone]     # records → output/<device>/ + taps-sheet.png  (LOOK)
node <engine>/scripts/tutorial/compose.mjs <folder> [--device v] [--mode draft|final] [--format 19x9] [--no-soundtrack] [--no-render]
                                               # → <folder>/<id>-<device>[-draft].mp4 + <id>-<device>-sheet.png (LOOK)
                                               # --format: another format from the same recording; the name gains the format
                                               # --no-render: only the event sheet and the check, in seconds (to get the look right)
```

**What `--check` checks besides the taps** (what `compor` would reject and can already be known; the list comes out whole, the
journey does not stop at the first item): the series (`series.json`, `brand.js`, `identity.json`, the look), `cinema` against the
device, the person, the soundtrack's Python (`environment.mjs --fix`); the `ms` of `g.placar`, the label of `g.prova` and each
`g.antes` (the file, the screen's aspect ratio, the `ms`, the short clip);
with voice, against the `narration.json` or, before the voice is generated, the `script.json` next to it (the text
only): the opening line is the title, the closing line is `fimLinhas`, each `g.na` finds its word in the step's line,
no line is left over;
`g.antes` only in series version 2.

**Devices** (`scripts/tutorial/devices.mjs`). The series overrides with `"aparelhos": { "computer": { "dsf": 3 } }` in
`series.json`, and the video, on top of that, with `video.aparelhos = { celular: { dsf: 2 } }` (field by field). The `formato` column is the
video's format when nothing asks for another (section 14).

| name | viewport | DSF | capture | format |
|---|---|---|---|---|
| `phone` | 390×844 | 3 | 1170×2532 | 9:16 |
| `phone-large` | 430×932 | 3 | 1290×2796 | 9:16 |
| `phone-small` | 360×780 | 3 | 1080×2340 | 9:16 |
| `tablet` | 820×1180 | 2 | 1640×2360 | 4:5 |
| `computer` | 1440×900 | 2 | 2880×1800 | 16:9 |
| `computer-hd` | 1280×800 | 2 | 2560×1600 | 16:9 |

**What `compose.mjs` does:**

1. **Builds the engine project** in `output/<device>/comp/`:
   - `engine.js` and `tutorial.js` come from the skill (plus `drawing.js` in a series version 2, and the series' `visual.js` if it draws some element on its own);
   - `data.js` comes from the events;
   - `brand.js` and `fonts/` come from the series.
2. **Timeline:**
   - opening (2.4 s: badge, title and the exit to the screen);
   - the real screen in the recording's real time;
   - closing (2.8 s: entrance, closing line, logo).
   - With voice, the opening and the closing grow when their line needs it (`references/voice-tutorial.md` §3).
   - What each part looks like is the **series' look** (section 13). A series without `"versao"` uses the old design: a dive in the opening, an iris in the closing, a white card that flips.
3. **Camera** that follows the action:
   - zoom on the target, with a minimum context of half a screen;
   - capped at `capture width ÷ screen width in the video`, so it doesn't go soft;
   - the action stays centered in the part of the frame the caption does not cover;
   - it opens to the full screen on scroll, on a screen change and after loading;
   - it does not open and close between back-to-back steps.
4. **Indicator:**
   - a small finger (translucent circle with a white ring) that only appears around the taps, shrinks on the tap and releases a short ripple;
   - an arrow cursor on the computer, with a subtle ripple on the click, following the same curve the real mouse made.
5. **Highlight:** before each tap and during `aponta`/`escolhe`, in the type the series chose (section 13).
6. **Caption:** outside the camera, with the step label and the sentence, on the side, in the type and with the change the series chose (section 13). The camera centers the action in the part of the frame the caption leaves free. With voice, the sentence is the step's line, and the spoken word is highlighted in the brand accent (`references/voice-tutorial.md` §4).
7. **Sounds** (`sheet.json` generated from the events, in `sounds.py`), each one at the exact sample:

   | Event | Sound |
   |---|---|
   | tap | tap (phone) or click (computer) |
   | typing | typing, with the real duration |
   | new caption | depends on the change: `virar` → flip (card); `subir` → short, low whoosh; `corte` → none |
   | screen change | whoosh |
   | success | success |
   | choice | very soft success |
   | opening → screen | depends on the exit: `mergulho` → whoosh; `deslizar` → whoosh from the right; `cortina` → long whoosh; `corte` → none |
   | closing | depends on the entrance: `iris`, `corte` → impact; `cortina` → impact when it closes; `deslizar` → whoosh |

   In the old series, the new caption is `virada` (page), the opening is `whoosh` and the closing is `impacto`, as it always was.

   With voice, tap, click and typing stay at their level under the speech, and the other effects go down 6 dB
   (`references/voice-mix.md` §4).

8. **Soundtrack:** `arrange_series.py` with the series identity and the **video's seed** (id + version), at the exact duration. `verify.py` has to pass. With voice, the sheet gains the `voz` block and `mix_voz.py` ducks the music under each line: `soundtrack.wav` becomes the final mix (music, effects and voice) at −14 LUFS (`references/voice-mix.md`).
9. **Render:** draft at 30 fps; final at 60 fps with 4 motion-blur subframes (configurable in `series.json`).
10. **Collision/safe-area check** (`frames.cjs`) on every render. A covered caption or title, or one outside the area, fails the composition. With `"texto": "fora-da-imagem"`, the whole timeline also goes through the text-outside-the-image check (section 17).
11. `finalize.mjs` mixes and checks duration, loudness (−18 LUFS) and true peak. With voice, the target is −14 LUFS, and it also checks each line's sync and how far the voice sits above the soundtrack (`references/voice-mix.md` §6).
12. **Event sheet:** before, during and after each tap, each step change, each choice, the opening and the closing.

## 8. What comes out

`output/<device>/events.json`:

- coordinates in viewport CSS px;
- times in seconds since the start of the capture.

```json
{ "id": "01-agendar-aula", "versao": "phone",
  "aparelho": { "nome": "phone", "viewport": {"width":390,"height":844}, "dsf":3, "toque":true, "formato":"9x16" },
  "captura":  { "metodo":"screencast", "qps":8.0, "qpsPico":61, "largura":1170, "altura":2532, "quadros":"frames.json" },
  "duracao": 16.7, "nativos": ["select: select#turma \"Turma\""], "errosDaPagina": [],
  "eventos": [
    { "t":0.0,  "tipo":"passo", "n":1, "legenda":"Toque em Agendar aula." },
    { "t":0.21, "t1":0.73, "tipo":"move", "de":[195,607.7], "para":[92,331] },
    { "t":1.06, "tipo":"toque", "alvo":"button#nova-aula \"Agendar aula\"", "ret":{"x":32,"y":309,"w":120,"h":44}, "ponto":[92,331],
      "realce":true, "checagem":[{"quem":"div[role=status] \"Meta adicionada!\"","tipo":"aviso","acao":"waited 1.8 s"}] },
    { "t":3.1, "t1":4.3, "tipo":"digita", "alvo":"…", "ret":{}, "texto":"…", "teclas":17, "privado":false },
    { "t":4.3, "t1":6.2, "tipo":"escolhe", "alvo":"select#turma \"Turma\"", "ret":{}, "opcoes":["…"], "escolhida":"3º ano A" },
    { "t":7.0, "t1":7.8, "tipo":"rola", "dy":66, "motivo":"free button#salvar \"Salvar\" from button#fab (fixed)" },
    { "t":8.1, "tipo":"tela", "url":"/aulas/12" },
    { "t":9.0, "t1":10.8, "tipo":"espera", "motivo":"notice div[role=status] … over button#…" },
    { "t":12.0, "tipo":"sucesso", "ret":{} }
  ] }
```

- `frames.json`: `[["00001.jpg", 0.012], …]`, with each frame's time on the same clock as the events.
- `taps-sheet.png`: from the raw recording. For each tap, the frames before, at the instant and after, with the point marked, the target's rectangle and what the check did. **Look at it before composing.**
- `<id>-<device>-sheet.png`: from the composed video. **Look at it before showing it.**
- `check.json` (in `--check`): `ok`, `nativos` and events. On failure: `falha.json` and `failure.png`.
- With voice, also: `voz` in `events.json` (which narration was recorded) and `fala` in each `passo`;
  `<id>-<device>.srt` next to the video; `output/<device>/comp/audio/voz.wav`; and the `voz` block in the sync sheet
  (`references/voice-tutorial.md` §5).

## 9. Identity of the series

The `serie` folder is decided once and holds for every video:

| File | What it is |
|---|---|
| `brand.js` | `const MARCA = { nome, cores: { fundo, tinta, marca, acento }, logo: { viewBox, partes: [{ d, fill }], negativo }, simbolo, formas }`. Generate the logo with `node <skill>/scripts/logo.mjs logo.svg --js LOGO`. `negativo: true` paints the logo white over the brand color in the closing. |
| `fonts/` | `node <skill>/scripts/fonts.mjs <series> "Family"`: local woff2, no network in the render. The engine **measures** the width to prove the font rendered. |
| `series.json` | `{ "versao": 2, "leitura": "reading.md", "visual": { … }, "rotulo": "Product · step by step", "fimLinhas": ["Done."], "fontes": ["Família"], "fonteTitulo": "…", "fonteTexto": "…", "abertura": 2.4, "fechamento": 2.8, "loudness_lufs": -18, "fps": 60, "sub": 4, "plataforma": null, "niveis": { "toque": -6 }, "passo": "Passo {n} de {N}", "workers": 3 }`. `passo` is the step label on the caption card (a series in another language, e.g. English: `"Step {n} of {N}"`); `workers` pins how many browsers the render opens (shared machine), otherwise it is cores − 2. `niveis` changes the level of a sound effect in dB (`"toque": -6`) or turns it off (`"sucesso": false`, which also silences the choice sound); `trocar` puts another sound in its place (`"trocar": { "sucesso": "baque" }`: the brand that does not want the bell gets the thud on the proof, on the success and on the choice; the bell sounds are the ones with `sino: True` in `sons.CATALOGO`). `visual` is section 13; `fonteMono` is the font of the `mono` labels (otherwise, the system monospace); `endereco` is the domain in the bar of the `navegador` frame. New optional fields: `formato` (section 14), `texto` (section 17), `aparelhos` (section 7). A family in `fontes` that is not in `fonts/fonts.css` is an error in `--check` and in compor (without it the video would come out in the fallback font) |
| `visual.js` | only if some element is `"proprio"` (section 13) |
| `identity.json` | the series' soundtrack (schema in `assets/audio/API.md` and `references/soundtrack.md` §9): `nome`, `papel` (`fundo`), `estilo`, `bpm` [min, max], `modos`, `tons`, `instrumentos` {harmonia, baixo, percussao, melodia, textura}, `densidade`, `loudness_lufs`, `efeitos.nivel` |
| `.venv/` | Python with numpy and scipy (outside git). Or `VIDEOSTUDIO_PYTHON`. |

**Each video has its own soundtrack**: the same identity with the video's seed. Key, BPM, progression, motif and groove change. Never the same soundtrack stretched. To prove it: `python series.py --compare folhaA.json folhaB.json wavA wavB`.

**With voice**, the series' `loudness_lufs` (in `series.json` and `identity.json`) only holds without voice: the mix
levels the soundtrack (music and effects) as a −18 LUFS bed, ducks it under each line and masters the whole at
−14 LUFS, ceiling −1 dBTP (`references/voice-mix.md` §1).

## 10. Copying the engine into a repository

To run without the skill installed (another machine, Windows, CI):

```sh
node <skill>/scripts/tutorial/copy.mjs docs/videos/_motor
```

- Copies the scripts (tutorial, render, quadros, finalizar, playwright, fontes, logo), the engine template (`engine.js`, `index.html`), the cinema mode 3D kit (`assets/3d/`), the audio library (`synth.py`, `verify.py`, `sounds.py`, `series.py`, `arrange_series.py`) and this contract, **in the same layout as the skill**. Relative paths keep working.
- Writes `MOTOR.md` with the date of the copy.
- **Do not edit the copy.** Improve it in the skill and copy again.
- The `video.mjs` files import from `../_motor/scripts/tutorial/record.mjs`.
- **Windows:** Node 18+, ffmpeg (`winget install --id Gyan.FFmpeg -e`), `npx playwright install chromium` and `py -3 -m venv .venv; .venv\Scripts\pip install numpy scipy`. The scripts use nothing from the Unix shell.
- **.gitignore:** `*/output/`, `*.mp4`, `*-sheet.png`, `.venv/`.
- **With voice:** the copy also takes `scripts/tutorial/locucao.mjs` (it is among the tutorial scripts),
  `assets/audio/mix_voz.py`, `references/voice-tutorial.md` and `references/voice-mix.md`. It does not take
  `scripts/voice.mjs`: the voice is generated with the skill, and the copy only reads each video's
  `voice/<device>/narration.json` and `lines/`. Keep `voice/` in git (`references/voice-script.md` §7).

## 11. Re-recording when the screen changes

1. `node <folder>/video.mjs --check` on each video (at every app release). Broken = the screen changed, or a tap is now covered.
2. Fix the script. If the tap got covered because of a bug in the app, tell whoever looks after the app.
3. Record, **look at the tap sheet**, compose, **look at the event sheet**.
4. The soundtrack does not change if the seed does not change. It only adjusts to the new duration.
5. **With voice:** a screen change that does not touch the lines needs no new voice. A button that changed its name
   changes its line: fix the `script.json` and run `voice.mjs generate` again (only that line and its neighbors are
   paid for, `references/voice-script.md` §7), then record again. The recording is held by the lines, and
   `compose.mjs` refuses a line that no longer fits its recorded step.

## 12. Pitfalls

- **`--lang`:** Chromium needs `--lang=<language>` on the command line, otherwise the date comes out "mm/dd/yyyy". The recorder already passes it.
- **Screencast in CSS pixels:** in the old headless, the screencast ignores the DSF. That is why the recorder uses the `chromium` channel with `--force-device-scale-factor`.
- **`captureScreenshot` with a scrolled page:** the `clip` is in **document** coordinates. Fixed at (0,0), the scrolled screen comes out blank. The fallback follows `cssVisualViewport`.
- **Font from `file://`:** headless without `--allow-file-access-from-files` does not load a local font and silently falls back. The skill's render passes the flag, and the engine **measures** the width against the fallback.
- **Highlight during scroll:** it no longer exists. The highlight is drawn by the composition from the rectangle recorded with the target **still**.
- **The log lies:** "✓ gravado" (recorded) does not prove the tap landed in the right place. Look at the sheets: the log only knows the click was fired, not what it showed. A tap in the wrong place or a covered target passes with "✓".
- **One thing at a time** when the demo app resets data at every login: never record two versions in parallel against the same demo.

## 13. The series' look

**Why it exists.** Up to version 2, the engine drew the same video for any product: two organic
shapes in the background, the window with three dots, a white card that flips, a dive in the opening and an
iris in the closing. The series only swapped four colors and two fonts. So a nightclub, an accounting
office and a kids' app came out with the same structure, and only the color changed. A design nobody
chose becomes everyone's identity. Now the series **declares** each element, and each choice points
to the project reading (`reading.md`). A choice without evidence is a guess, and you say it is a guess.

**Old series.** Without `"versao"` in `series.json`, the frame comes out the same as before, pixel for pixel.
`compose.mjs` warns in one line that this is the engine's old design, not an identity.

**New series.** With `"versao": 2`, the nine elements are mandatory. If one is missing, `compose.mjs` stops and says
which. A default nobody chose becomes everyone's identity. The few optional fields are
marked below with the value they take.

```json
{
  "versao": 2,
  "leitura": "reading.md",
  "visual": {
    "cores":      { "palco": "#07070B", "sinal": "#FF2E63", "osso": "#F4F1EA" },
    "fundo":      { "tipo": "luz", "cor": "palco", "tinta": "sinal", "tinta2": "#3A2BFF" },
    "moldura":    { "tipo": "nenhuma", "raio": 0, "sombra": "nenhuma" },
    "legenda":    { "tipo": "faixa", "lado": "baixo", "fundo": "sinal", "tinta": "palco", "rotulo": "mono", "troca": "corte" },
    "selo":       { "tipo": "mono", "cor": "sinal" },
    "titulo":     { "caixa": "alta", "peso": 400, "espaco": 0.01, "entrada": "corte", "tinta": "osso" },
    "abertura":   { "saida": "corte" },
    "fechamento": { "entrada": "corte", "fundo": "sinal", "tinta": "palco", "logo": "negativo" },
    "realce":     { "tipo": "cantos", "cor": "sinal", "espessura": 4, "raio": 0 },
    "indicador":  { "tinta": "sinal", "contorno": "osso" }
  }
}
```

- **Color** is a hex (`"#FF7A1A"`) or the name of a color in `visual.cores` or in `MARCA.cores`.
- **Contrast** is checked before the render (WCAG). Below 3:1, `compose.mjs` stops. Below 4.5:1 on the caption, it warns. The pairs checked are:
  - the caption over its own background (the frame's, for `solta`);
  - the step label over that same background;
  - the title over `fundo.cor`;
  - the closing;
  - the badge.
- **The collision and safe-area check holds in any combination.** Text that is covered or outside the safe
  area fails the composition, as before.
- **To get the look right fast:** `compose.mjs <folder> --no-render` builds the project and generates only the event
  sheet, with the check, in about 5 s.

Each type exists because it changes the **structure** of the frame, not the color. Two options that differed only in color
would be one option.

### fundo: what sits behind the screen and the title

Fields: `tipo`, `cor` (the surface), `tinta` (the drawing), `tinta2` (optional; the default is `tinta`) and
`forca` (optional: the drawing's opacity, from 0 to 1; the default depends on the type and is in parentheses
below).

| type | what it looks like | when to use | when not to use |
|---|---|---|---|
| `liso` | one flat color, nothing else | minimalist product; when the recorded screen is already busy and the background has to disappear | when the product has its own texture or light (the video ends up with no sense of place) |
| `formas` (0.1) | two organic blobs in the corners, breathing slowly. With the `solta` caption on the right, the blobs switch sides: the sentence reads only over the background color, never over a blob | a brand of soft shapes, friendly, no grid | technical, sober or nighttime product (it is the old design) |
| `grade` (0.14) | graph paper with thin lines, moving slowly | accounting, engineering, spreadsheet, precision tool | kids' or party audience (it reads as "office") |
| `pontos` (0.22) | a regular dot grid | design tool, sketchbook, a technical product lighter than the grid | when the screen has a lot of fine texture (the dots clash with it) |
| `luz` (0.38) | a dark surface with two or three spots of colored light drifting, like a stage with smoke | night, music, event, game, any product with a dark interface | light background (the light vanishes) and a sober brand |
| `faixas` (0.16) | wide diagonal stripes, in two inks, running | kids, sports, promotion, a brand with graphic energy | long reading and a serious brand. With a low `forca` over a strong color, the mix gets muddy: prefer tonal inks with `forca` 1 |
| `simbolo` | the brand symbol as a PNG (`png`: its key in `MARCA.png`, e.g. `"simbolo"`), giant and cropped behind the screen, on the side opposite the text, turning slowly. It comes in whole, in the PNG's color: `forca` is ignored (the brand asset is not made transparent or recolored) | a brand whose identity uses the giant symbol as a background shape; a dark stage with the tonal symbol | a symbol that has no color pairing with the caption: it never passes behind the text, but its color has to work with the background |
| `proprio` | whatever `visual.js` draws | when no type says what the product is (notebook, map, fabric…) | when a ready-made type works: it is code to maintain |

### moldura: what surrounds the recorded screen

Fields: `tipo`, `raio`, `sombra` (`nenhuma` | `curta` | `longa`), `cor` (except in `nenhuma`) and `espessura`
(in `fio`, default 2). Optional: `tinta` (the color of the address in the `navegador` bar; without it, the one that reads over the bar, at
70%). The frame moves with the camera (in the computer's 3D panel, it stays still and the camera moves inside it: section 15).

| type | what it looks like | when to use | when not to use |
|---|---|---|---|
| `nenhuma` | the screen loose on the background, with only the radius | a product that wants to look full screen; a raw nighttime, flyer aesthetic | when the background is the same color as the screen (it disappears); **a phone recorded in cinema mode** (the screen ends up without the device body: `compor` warns, and rejects it if the video has the person on camera, `video.pessoa`) |
| `fio` | an outline of `espessura` px around the screen | a thin, sober outline (1–2 px) or a thick, rounded, toy-like one (10–14 px) | when the product is "a website" and that matters (use `navegador`) |
| `janela` | on the computer, the window bar with the three dots; on the phone, the device's black body | when recognizing "it's an app on my computer/phone" helps the viewer | as a default out of habit: it is the old design |
| `aparelho` | phone only: the body of the 3D kit's phone, face-on (metal edge, side buttons, a light reflection on the glass), in 430×900 proportion around the screen. `raio` is ignored (the device's own rules) | **an app video where the device has to show** (sales, Reels, person on camera). It pairs with the `pouso` opening: the 3D device settles and the recorded screen takes its place without the swap showing | computer recording (error) |
| `navegador` | the address bar with the domain (only the domain: the path may carry a token) | web portal, SaaS, "go to app.produto.com" | native app |
| `proprio` | `visual.js` draws it; `margem` (a number or `[top, right, bottom, left]`) says how much the layout reserves around it | polaroid, taped paper, the brand's own frame | when `fio` or `janela` are enough |

### legenda: the step text

Fields:

- `tipo`, `lado` and `tinta`;
- `rotulo` (`ponto` | `mono` | `numero` | `nenhum`) and `troca` (`virar` | `subir` | `corte`);
- on the card: `fundo`, `borda` (a color or `"nenhuma"`) and `raio`. On the strip: `fundo`;
- optional: `sinal` (the label's color; the default is `tinta`), `caixa` (default `normal`), `peso` (default 700), the card's `sombra` (default `nenhuma`) and `fonte` (`titulo` or `texto`, default `titulo`: the sentence uses the title font; a handwritten or display typeface calls for `texto`, otherwise it gets too small to read);
- optional `largura`: the side caption column (`direita`/`esquerda`), a fraction of the frame (0.2 to 0.5) or px. Without it, 440 px in 16:9 and the same fraction (23%) in the wider ones;
- optional `recuo` (px, 0 to 200, default 0): the side column pulled away from the edge of the safe area. The refinement's OCR measures the lettering with
  some slack, and a stroke or light text on dark stuck to the edge fails; 24 px fixes it;
- optional `arranjo` (`pilha` | `linha`, default `pilha`), only with the caption at the top or bottom of a landscape frame: `linha` puts the
  section, the step pill and the sentence side by side, each in its own fixed column, in a low strip (96 px of text; the `faixa` bleeds
  to the edge of the frame). It is the lower-third ticker: the screen keeps the height that is left. A long sentence shrinks until it fits on one line.

**`lado`** is `direita`, `esquerda`, `baixo` or `cima`, or one value per format:
`{ "9x16": "cima", "padrao": "direita" }`. The side decides the whole layout:

- the caption takes that side, with the text always inside the safe area;
- the screen takes the largest rectangle left, minus the frame;
- the camera centers the action in what is left.

The four sides work in the four formats. How to choose each one:

- `direita`/`esquerda` in 16:9 is the natural choice;
- in 9:16, a side column squeezes the screen (the column is about 380 px);
- `cima` in 9:16 is the natural choice (the Reels safe area starts at y 250);
- `baixo` in 9:16 goes up to y 1450 and leaves empty what is below, under the platform's interface.

| type | what it looks like | when to use | when not to use |
|---|---|---|---|
| `cartao` | a card with background, border and radius, floating next to the screen | the clearest way to read; a brand of surfaces and cards | raw or editorial aesthetic |
| `faixa` | a strip of flat color that bleeds from one edge of the frame to the other, with the text inside | night, sports, TV, any color-block brand | a delicate brand; a background the same color as the strip |
| `solta` | the text right on the background, no box. The caption side gets a scrim with the same background, and the zoomed screen fades out at the edge of the free area instead of passing under the text | editorial, sober, lots of white space | a very busy background (`luz`, strong `faixas`): the text loses contrast |
| `nenhuma` | the engine **does not draw a caption**. Only `lado` is declared: it is where the edit's text will go, and the layout reserves that strip inside the safe area. The device uses the frame; on the reserved side and, in 9:16, at the opposite end (outside the safe area), the frame darkens to the series color | a video edited later with the person on camera: **a single text for the whole video**, in the same place, the same over the person and over the app | a standalone tutorial, with no edit afterwards (it would have no caption) |

| rotulo | what it looks like | when to use |
|---|---|---|
| `ponto` | "● Step 2 of 5" | the readable default |
| `mono` | "STEP 02 OF 05" in spaced typewriter lettering | technical, night, flyer |
| `numero` | "02 /05" in title type, above the sentence | kids, editorial: when the order is the message |
| `pilula` | "Step 2 of 5" in a flat pill (36 px): the badge's colors when it is `pilula` with `fundo`; otherwise, `sinal` over itself at 12% | a brand that has a label pill (a light color with its dark shade as the text, as in the example series) |
| `nenhum` | only the sentence | a one-step video, or when the number gets in the way |

| troca | what it looks like | sound | when to use |
|---|---|---|---|
| `virar` | the card (or the text block) flips on the X axis and the new text is born on the back | `virada` (card variant) | card, kids, friendly |
| `subir` | the old text leaves upward, the new one comes in from below | short, low `whoosh` | sober, editorial |
| `corte` | a dry swap at the instant of the step | none (the cut is the accent) | night, hard cut, pace |

**With voice**, the caption keeps the type, side, label and change the series chose. What changes is the text: each
step's caption is its line, and the spoken word is highlighted, one at a time, in the brand accent (or as a marker pen
when the accent does not read over the caption's background). Only the color changes, and the collision and
safe-area check applies to the line's text (`references/voice-tutorial.md` §4).

### selo: the series label above the title, in the opening

Fields: `tipo` and `cor` (except in `nenhum` and `proprio`). The text is the `rotulo` from `series.json`. Optional in `pilula`:
`fundo` (the flat pill in that color, with the text in `cor`; without it, the pill is `cor` at 12%).

| type | what it looks like | when to use |
|---|---|---|
| `pilula` | the text in a pill with a light background of the same color | friendly, consumer product |
| `mono` | the text in uppercase, typewriter lettering, typed letter by letter | technical, night |
| `linha` | a short rule that extends, with the text next to it, no box | editorial, sober, left-aligned title |
| `nenhum` | nothing | when the title is enough (kids, a very strong brand) |
| `proprio` | `visual.js` draws it | tape, stamp, the brand's tag |

### titulo: the lettering of the opening and the closing

Fields: `caixa` (`alta` | `normal`), `peso`, `espaco` (in em, e.g. -0.02), `tinta` and `entrada`. Optional:
`alinhar` (`centro` | `esquerda`, default `centro`) and `escala` (default 1).

The title shrinks on its own until it fits in the safe area. The line height is never smaller than the text box
in the series font: a font with tall ascenders, like Baloo or Caveat, gets more space.

| entrada | what it looks like | when to use |
|---|---|---|
| `palavras` | each word rises from inside a mask | the calm default |
| `letras` | each letter rises in a cascade | kids, playful |
| `mascara` | the whole line is revealed from left to right | editorial, sober |
| `corte` | appears whole, all at once | night, hard cut |

### abertura: how the title gives way to the screen

Field: `saida` (plus `cor` for `cortina`).

| saida | what it looks like | sound | when to use |
|---|---|---|---|
| `mergulho` | the title grows until it passes through the screen, and the screen is born from inside it | whoosh | cinematic; it is the old design |
| `corte` | a hard cut at the end of the opening | none | night, pace, a direct brand |
| `deslizar` | the title leaves to the left and the screen comes in from the right, over the same background | whoosh from the right | sober, logical sequence |
| `cortina` | a `cor` panel sweeps across the frame and reveals the screen | long whoosh | kids, energy, a flat-color brand |
| `virar` | the opening's 3D panel (the result screen, next to the title) turns until it is edge-on, the title leaves, and the recorded screen is born on the back, in the steps panel | whoosh | **a computer recording in cinema mode** (the panel in section 15); `compor` rejects the rest |
| `pouso` | **no title, badge or panel.** The whole 3D phone comes in with the app screen (the recording's 1st frame), from below and from the side, and settles face-on where the recorded screen will be; the camera then moves in. `"abertura"` in `series.json` is the time of the entrance (1.3 s is a good value) | long whoosh | **a video where a person on camera opens**: the device arrives over them (`video.pessoa`, below). It requires `cinema: "moldura"`, a recorded phone and the `aparelho` frame (`compor` rejects the rest) |

Optional: `painel` (the color of the cinema mode panel that opens the video with the logo; default: the closing's `fundo`).

Optional: `indice` (`true` | `false`, default `false`): **the video's map**. With 2 or more `g.secao` in the script, after the
title the sections take its place as numbered pills (`01 Search`, `02 Summary`…), in the series pill (the step
label's: the badge's colors when it is `pilula` with `fundo`), one every 0.15 s, in a fan in depth (each
one turns edge-on, hinged on its left edge, comes from behind and settles slightly turned, a little deeper than the previous one),
each with a very soft pop. They hold for reading time (0.8 s + 0.3 s per section, after the last one settles) and leave with the
opening; the panel (or the preview) stays alive beside them. The opening grows to fit (`planoDoIndice` in compor: with 2
sections and `"abertura": 2.8`, it goes to 5.2 s). With 0 or 1 section, nothing changes. The pills are marked text: the safe area and
the text-outside-the-image rule apply to them. It does not exist with the `pouso` exit.

Optional: `previa` (`resultado` | `nenhuma`, default `resultado`). With `resultado`, the opening shows the screen where the
tutorial ends up: the recording's frame 0.6 s after `g.sucesso()`, or the last frame if there is no success. In
16:9 the title goes to the left half and the screen sits on the right; in 9:16 the title moves up and the screen sits below it,
inside the safe area. On the phone, the preview is not the whole device shrunk (the app's lettering would be 6 px and the
refinement fails the shrunk screen): it is a crop of the final screen at the camera's minimum reading zoom, centered on the target of
`g.sucesso()`, with the edge cut into a soft fade. It only exists in 16:9 and 9:16. That is why every script ends with a `g.sucesso()` on the screen that
proves the task is done (the finished proposal, the requested withdrawal), not on a screen you just pass through.

With the `deslizar` exit, the title drifts forward slowly (up to 4%: less, if some text would leave the safe area) while it is read, instead of
standing still.

**In the computer's 3D panel (cinema mode)** every exit works, not only `virar`, and in all of them the panel moves (the screen
never slides inside a still window):

- `deslizar`: the title and the preview leave together to the left and the steps panel comes in from the right, behind them (without the
  column crop until it settles: the caption only comes in at A);
- `mergulho`: the camera passes through the result preview (the zoom is on its center) and the steps panel arrives from up close, bigger,
  and settles; the preview stays whole until the panel covers it, with no empty frame;
- `cortina` and `corte`: the steps panel appears at A, under the curtain or at the cut.

### Recorded phone: camera and safe area

With the touch device (`phone`, `phone-largo`) in 16:9 or in 9:16, the engine does this on its own:

- **wide then detail:** each **new screen comes in whole** (the whole device, never a strip cut in the middle), stays
  ~0.75 s and the camera **moves in on the current field**, at reading zoom (the app's 12 px lettering at ~30 px in 16:9,
  ~28 px in 9:16). If the next tap takes a while, it moves in earlier, on that tap's target. A new step on the same screen and scrolling
  stay in detail (scrolling is reading). On success, it opens up again to the whole result and moves in on it. A screen that comes in
  cut in the middle is a defect: the whole screen first, then the zoom;
- **the refinement accepts a short wide shot:** the small whole screen for up to 2.6 s in a row is a warning, including the app's text
  that passes under the social network's interface at that moment (`PLANO_GERAL_MAX` in `scripts/refine/video.mjs`).
  More than that is still an error: the screen shrunk for a long time is what you want to avoid;
- **9:16:** in detail, the app screen sits in the middle of the platform's safe area (`VIDEO.plataforma`), the camera only
  moves up and down, and goes down until it brings the app's bottom bar inside the safe area; below the safe area, the
  screen fades out (that is where the social network puts caption and music). In the wide shot there is no fade: the device
  uses the whole frame;
- **16:9:** in detail, the screen cut at the top and bottom fades out (never a half line stuck to the
  edge); in the wide shot, none;
- **live camera:** while the caption is being read and the hand waits, the camera breathes slowly. The frame is never still.
  With voice, the same holds while the voice speaks and the hand waits.

Do not copy the engine to tweak this: fix it here and copy again with `scripts/tutorial/copy.mjs`.

### Cinema mode: the frame in 3D and motion, the steps face-on

`"cinema": "moldura"` (the default in the series design) or `"nenhum"`, in `series.json` or in `video.mjs` (the video's wins).
With `moldura`, compor loads the 3D kit (`assets/3d/`) and `scripts/tutorial/cinema.js`:

| Where | What happens | Sound |
|---|---|---|
| opening | the video opens on a **panel in the closing's color with the brand logo**, which leaves on a quick diagonal and reveals the title (the hook: it opens and closes in the same color) | long whoosh |
| opening and steps (computer recording) | the **3D panel**: the screen on a panel with the series frame, which comes from afar, tilts, breathes, flips and recedes; the camera moves in inside it (section 15) | whoosh |
| opening (phone recording) | the success screen on a **whole 3D phone** that comes in from afar, turned sideways and from below, and settles at three-quarters (~22° → ~16°) next to the title (16:9) or below it (9:16), slightly out of focus (the focus is the title); a shine in the brand color passes over the glass and a light sweeps the metal edge | — |
| steps | behind the device, **the screen itself, blurred**, covers the frame, with a scrim in the series tone: the space around it stops being leftover plain background | — |
| step change | a diagonal shine in the brand color crosses the screen in 0.65 s | the caption-change sound |
| screen change | the screen turns slightly in perspective (up to 6°, one side at a time) | whoosh |
| closing | the **brand logo in 3D** (the pieces of `MARCA.logo`) comes in from outside piece by piece and settles; then a light passes over the bevel and the logo sways slowly | a riser that ends in an impact on the last piece |

| `pouso` opening | no title: the **whole 3D phone** comes in with the app screen and settles face-on, and the recorded screen takes its place (`aparelho` frame) | long whoosh |
| proof (`g.prova`) | the screen turns slightly in perspective (one side at a time), the shine crosses and the big marker comes in | success (the last one with one extra note) |
| scoreboard (`g.placar`) | the device recedes, tilts and goes out of focus; the number counts | a riser of ticks and an impact |

The steps do not change: the screen face-on, the camera on the field, caption, tap. That is where the viewer reads and imitates.

#### The person on camera: behind the device (`video.pessoa`)

In a video where a person on camera opens and closes (takes that arrive ready-made), the app's middle part **uses the whole
cinema**, and the person → screen transition is **a gesture, not a dissolve**. An edit that cuts out the device's entrance or the
3D logo, or dissolves the person into a screen without a body, loses the cinema, the motion, the 3D and the phone the middle part had.

```js
// video.mjs — paths relative to the video's folder
pessoa: {
  entrada: { arquivo: '../takes/abertura.mp4', de: 4.6 },   // where the edit leaves the opening take
  saida:   { arquivo: '../takes/fecho.mp4', em: 0 },         // the frame where the edit enters the next take
  fecho:   { arquivo: '../takes/fecho.mp4', de: 5.8 },       // where the edit leaves it for the closing with the logo
  volta: 0.6,                                                // how long the device takes to leave the scene
},
```

- **entrada** (with the `pouso` opening): the end of the take runs **behind the arriving 3D device**, and blurs quickly.
  In a narrated video, the person's speech can carry on over it ("Look at this" while the phone comes in).
- **saida:** the recording gets `volta` s at the end, frozen on the last frame: the device drops out of the frame spinning, the
  scoreboard rises, and the 1st frame of the next take comes from blur into focus.
- **fecho:** the end of that take runs under the closing's entrance (`iris`, `cortina`, `deslizar`), and the logo assembles
  on top.
- The person's frames come in **with no filter at all** at the cut points: the edit cuts **hard** from the take to the middle part
  and back, on matching frames (`"transicao": "corte"`).
- `compor` writes a **`<id>-<device>.cinema.json`** next to the video: the stretches that carry the 3D (the device's
  entrance, the closing logo) and the cut points (`pessoa.sai`, `pessoa.fecho`). The edit that joins the takes to the
  middle part follows this file: it does not cut into one of those stretches, does not dissolve where there is a cut, and cuts only at the points.
- The look of that middle part: `aparelho` frame, `nenhuma` caption (there is a single caption, the edit's), `pouso` opening,
  closing with `ordem: "logo"`. A script with a `g.prova` on each answer and a `g.placar` at the end.

**When to use it (it is your decision, not the default's):**
- **Use `moldura`** in every tutorial someone will watch as a brand piece: Reels, TikTok, website, the app's player, the
  team's WhatsApp. It is the common case, which is why it is the default. A tutorial that passes the refinement but is the same screen from
  start to end, with a flat opening and closing, will not do: it has no 3D, motion or transition.
- **Use `nenhum`** when the owner asks for sober, when the video goes to a help center that only wants the step (and
  file size matters), or when the machine has no GPU (`playwright.cjs --gpu` exits with code 1; on CPU the 3D
  is ~13× slower).
- Computer recording: instead of the 3D phone, the **3D panel** (section 15); the step change and the 3D logo apply to both.
- **A phone recorded in cinema mode gets the device body** (`aparelho` or `janela` frame). With `nenhuma`,
  `compor` warns; with the person on camera (`video.pessoa`), it rejects.
- **After the draft, the direction critique decides whether more is missing** (`references/refine.md`, "Direction"). A
  `fraco` (weak) score is not delivered silently: either you change what it points out, or you show it to the owner saying why it stayed that way.

The 3D canvas is transparent (the series background shows behind it) and does not enter the collision check: an invisible marker
in place of the app's text (opening) and of the logo (closing) is what the check measures. It needs the GPU in the render: every Chromium
of the video comes from `scripts/playwright.cjs`, which on the Mac opens with `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`.
`node $SKILL/scripts/playwright.cjs --gpu` prints the `UNMASKED_RENDERER_WEBGL` and exits with code 1 if it is SwiftShader;
`render.cjs` prints the renderer at the start of each render and, on the Mac, stops with the warning `3D ON CPU` if it falls back to
SwiftShader. Before the draft and the final, the renderer has to be the GPU (on the Mac, something like
`ANGLE (Apple, ANGLE Metal Renderer: Apple M5)`). Only `VIDEOSTUDIO_NO_GPU=1` lets the render go on on the CPU.

### fechamento: the brand at the end

Fields: `entrada`, `fundo`, `tinta` and `logo` (`cores`: the logo in its own colors; `negativo`: the whole logo
in `tinta`; `png`: the brand's PNG logo, section 16). Optional: `ordem` (`frase`, the default: the big sentence and the
logo below; `logo`, only with the cinema mode 3D logo: the logo bigger and on top, and the sentence below, smaller, after it
assembles: it is the "the logo and just the address" closing; `so-logo`: **only the logo**, centered, no sentence at all (not even `fimLinhas`),
no shine or 3D: it rises and settles in 0.6 s and stays still until the end. It is the closing of the example series; with
`"fechamento": 3.0` in `series.json`, it stays still for ~1.9 s).

| entrada | what it looks like | sound | when to use |
|---|---|---|---|
| `iris` | a circle of `fundo` grows from the center and covers the screen | impact | friendly; it is the old design |
| `cortina` | the final card is revealed by an edge that runs from left to right | impact when it closes | sober, editorial |
| `corte` | a hard cut to the final card | impact on the cut | night, pace |
| `deslizar` | the final card comes in from the right, over the screen | whoosh | kids, light, without the weight of an impact |
| `dissolver` | the final card arrives by opacity while the screen recedes | low whoosh | a card in the same color as the series background (the screen goes away and the background stays, with no shape passing over it) |

### realce: where the finger goes

Fields: `tipo`, `cor`, `espessura` (default 3) and `raio` (default 12).

| type | what it looks like | when to use | when not to use |
|---|---|---|---|
| `contorno` | a rounded stroke rectangle, with a light scrim inside | the default; it is the old design | — |
| `cantos` | only the four corners, like a camera viewfinder | technical, night, photo | a very small target (the corners merge) |
| `sublinhado` | a stroke that runs under the target | editorial, sober, links and fields | a tall target (a whole card) |
| `preenchido` | highlighter: a color background behind the target, which multiplies (the app's text stays readable) | kids, studying | a dark-interface app (multiply darkens it further) |
| `proprio` | `visual.js` draws it | a pen circle, a drawn arrow | — |

### indicador: the finger and the cursor

Fields: `tinta` (the finger's translucent center, and the cursor's body) and `contorno` (the finger's ring and the
cursor's border). The tap ripple comes out in `contorno` on the phone and in the `realce` color on the computer. The choice
badge ("✓ 3º ano A") uses the `realce` color, with the ink that reads over it.

### secao (optional): the chapter card

The card for each `g.secao` in cinema mode (the first one, attached to the opening, has none). Without `visual.secao`, it is the usual one:
diagonal, with the name in the title lettering, in the `abertura.painel` color. Fields: `entrada` and, optional, `cor` (default
`abertura.painel`, or the closing's background), `tinta` (default: the `MARCA.pares` pair for `cor`; checked as large text, so
AA18 holds) and `letreiro` (default `titulo`).

| entrada | what it looks like | the panel behind it | sound |
|---|---|---|---|
| `diagonal` | the blade in the color comes in from the left, covers the frame and leaves to the right | turns edge-on and comes back | whoosh on the way in and on the way out |
| `empurrar` | the card rises from below and leaves at the top (it holds full a little longer) | is pushed up and comes back from below | whoosh on the way in and on the way out |
| `whip` | whip pan: the card comes in from the right and leaves to the left, blurred mid-motion | leaves to the left and comes back from the right, blurred | a short whoosh on both |
| `mascara` | a circle is born in the middle of the panel, covers the frame and closes back to the same point | recedes while the circle covers it and comes back to the front | whoosh as the circle opens and as it closes |

| letreiro | what it looks like | when to use |
|---|---|---|
| `titulo` | the section name, large, comes in like the title | the default |
| `numero` | the section number (`02`) giant, and the name below it | chapters that count: the number reads from afar |
| `digitado` | the name typed letter by letter, with a blinking cursor; one keystroke per letter in the soundtrack | dark stage, technical |

The timings of each entrance are in `visual.mjs` (`temposDaSecao`); the panel and the sound use the same ones. In all of them, the card covers
the frame for ~0.6 s and the panel comes back up to 1 s after the section.

### painel (optional): how the 3D panel moves during the steps

Only in the computer panel in cinema mode. Field: `movimento` (default `respira`).

| movimento | what it looks like | camera (variety axis) |
|---|---|---|
| `respira` | tilted toward the text, breathing in slow sines; almost face-on at reading zoom | `dolly-3d` |
| `plano` | face-on, still: only the camera moves inside it | `guided-zoom` |
| `travelling` | moves sideways slowly (up to 140 px; 30 px with the side column), one direction per section, turning slightly in the direction of the movement | `travelling` |
| `orbita` | turns slowly around its own center, in Y and in X (one turn every 9 s), except at reading zoom | `orbita` |

With the text on the right, the panel's outer edge (the left one, where the app usually has its name and menu) stays 36 px inside the safe
area: tilted toward the text, it comes forward and grows in perspective.

### The `proprio` hook (visual.js)

When no type says what the product is, the series brings a `visual.js` in its folder. These accept `proprio`:

- `fundo`, `moldura`, `selo` and `realce`.

These do not, and why:

- `legenda`, `titulo`, `abertura` and `fechamento`;
- they carry text that the check measures and timings that the sync sheet follows;
- free drawing there would break both without anyone seeing.

```js
// <series>/visual.js — runs in the browser, after engine.js. Only the engine's helpers.
VISUAL_PROPRIO.fundo = (ctx) => {
  const s = svgQuadro(ctx.camada)
  // … draws …
  return (t) => { /* only from t */ }
}
```

**What every hook receives (`ctx`):**

- the frame: `W`, `H`, `FMT`, `L`, `CX`, `CY`;
- the times: `A`, `D`, `F` and `fim`;
- `toque` and the colors: `cores` (the resolved palette) and `visual` (everything, already in hex);
- the space: `area` (the safe area), `tela` (x, y, w, h, r), `legenda`, `livre` and `fontes` (titulo, texto, mono).

**What each one receives on top of that, and what it returns:**

| element | receives | returns | draws on |
|---|---|---|---|
| `fundo` | `camada` (full screen, already with `fundo.cor`) and `fase` (`abertura`, `tela` or `veu`, since it is called once per scene) | `(t) => {}` | the layer, behind everything |
| `moldura` | `mundo` (moves with the camera) and `cromo` (the declared margin, in px) | `(t) => {}` | the world, under the recorded screen |
| `selo` | `camada` (the opening's), `texto`, `titulo` (rectangle of the lines) and `alinhar` | `(t) => {}` | the opening's layer |
| `realce` | `svg` (in the world), `k` (frame px per app px), `aTela(x, y)` and `cor` | `(t, alvo) => {}`; `alvo` is `{ x, y, w, h, a }` in world px, or `null`; `a` is the intensity, from 0 to 1 | the svg |

**What the hook cannot do, and what enforces it:**

- **Depend on network, clock or unseeded randomness:**
  - the render runs without network;
  - each motion-blur subframe has to come out the same.
  - `compose.mjs` reads `visual.js` and **rejects** `fetch`, `http://`, `import()`, `Math.random`, `Date.now`, `setTimeout`, `requestAnimationFrame` and CSS animation. Use `rng(semente)` and the time `t`.
- **Cover the caption:**
  - background, frame and highlight are in scenes below the caption's scene, so they cannot;
  - the badge lives in the opening, which has no caption.
- **Leave the safe area with text:** the hook's text has to be marked (`marcar(el, 'texto')`, or `bloco`, which already marks it). Then the safe-area and collision check applies to it as to everything else.
- **Draw outside the place it received:** this is a rule, not a lock. The hook receives its own container; touching another element of the page is a bug in the hook.

## 14. Formats: any of them, by orientation

The tutorial composes in **16:9 (1920×1080), 19:9 (2280×1080), 21:9 (2520×1080), 9:16, 4:5 and 1:1**. Nothing in the engine asks
"is it 16:9?": the orientation decides (width × height). The landscape ones (16:9, 19:9, 21:9) split the frame into a text column on the side
and the screen in the rest; the portrait ones put the text on top. Landscape safe area: 5% on each side.

- **Which format comes out**, in this order: compor's `--format`, `video.formato`, `serie.formato`, the recorded device's
  (`computer` → 16:9). `video.formato` and `serie.formato` accept one per version: `{ "computer": "19x9", "padrao": "16x9" }`.
- **Another format from the same recording**: `compose.mjs <folder> --format 16x9`. The file gets the format in its name
  (`<id>-<device>-16x9-draft.mp4`, `…-16x9-sheet.png`); the default format's file has no suffix. `refine.mjs <folder>` takes the
  newest MP4 in the folder; for another one, `--video <file>` (each format with its own channel: 9:16 with `--channel reels`).
- **The column**: `visual.legenda.largura` (a fraction of the frame or px). Without it, the column keeps the 16:9 fraction (23%).
- **Old design** (a series without `"versao"`) also composes in the wide landscape formats: the screen on the left as far as the height allows, the
  caption with the rest of the width, inside the safe area.

## 15. 3D panel for computer recordings (cinema mode) and sections

A computer recording with `"cinema": "moldura"` turns on the **3D panel** (CSS 3D, a function of time only). The screen lives on a panel
with the series frame (in the browser frame: the bar with the address), still in the frame and **inside the safe area**; **the camera
moves in and out inside it**, and the panel never crosses to the text side.

| Where | What happens | Sound |
|---|---|---|
| opening | the panel in the `abertura.painel` color with the logo (SVG, or the PNG from section 16) leaves diagonally; the 3D panel with the result screen comes from afar spinning and settles tilted next to the title, facing it, and keeps slowly coming closer; a shine in the highlight color passes over the glass | whoosh |
| index (`abertura.indice`) | the title leaves and the sections come into the column as numbered pills, in a 3D fan (section 13, opening) | one pop per pill |
| `virar` exit | the opening panel turns until it is edge-on and the recorded screen is born on the back, in the steps panel | whoosh |
| steps | the panel breathes (tilt and depth in slow sines), tilted ~5° in the wide shot and almost face-on at reading zoom. Other movements: `visual.painel` (section 13) | — |
| camera | wide then detail: each new screen whole for ~0.75 s, then the **reading zoom** (the app's 16 px lettering at ~34 px); between actions far from each other, it moves in and out 7% every 2.2 s; it never stops | — |
| tap | a highlight on the target and a **glow** in the highlight color that grows and fades around the tapped element | click |
| step change | the shine band crosses only the screen's glass | the caption sound |
| screen change (URL) | the panel turns slightly and recedes | whoosh |
| new section (`g.secao`) | the **chapter card** (the `abertura.painel` color, the section name in title lettering) comes in diagonally from the left, covers the frame and leaves to the right, while the panel flips back behind it. Other entrances and letterings: `visual.secao` (section 13) | whoosh on the way in and on the way out |
| closing | the panel recedes and disappears; the closing comes in (with `dissolver`, by opacity) | the entrance's sound |

- **A sharp zoom needs a sharp capture.** The reading zoom goes beyond 2× the screen; with DSF 2 (2880×1800) it goes soft and the refinement
  flags the small lettering. The series records the computer with DSF 3 (`"aparelhos": { "computer": { "dsf": 3 } }`, 4320×2700).
- **Section:** `g.secao('Name')` before the `g.passo` that opens the block. The name stays at the top of the column (with a rule in the
  highlight color) until the next section. The first section, attached to the opening, has no card (the opening already is one). Use sections: in a
  light app over a light background, the zoom inside the panel changes the composition very little, and the card is the strong moment the refinement's direction check
  demands every 8–10 s (a ~20 s video with one section in the middle passes with DIRECTION strong).
- **Portrait (9:16):** the panel sits in the strip below the text, at the width of the safe area; the opening title moves up and the opening
  panel shrinks below it. It works; for Reels, prefer recording the phone.

## 16. Logo as PNG (`MARCA.png`)

A brand whose logo only exists as an image (never redraw or vectorize someone's logo) declares `MARCA.png` in `brand.js`,
with PNG paths (`logo`, `logoPreto`, `logoClaro`, …). Compor finds each file **in the series folder** (the path in
`brand.js`, or `<series>/media/<name>`), copies it into the engine project and picks the one that reads over each
background: light background → `logo` (or `logoPreto`); dark or strong-color background → `logoClaro`. `MARCA.logo` as
SVG, when it exists, wins. Only the placeholders of the example series (`*-placeholder*.png`) are also found in
`assets/example/`, where the skill keeps them, so the example composes with no image copied; a real brand's logo is
looked for in its series folder and nowhere else.

Where the brand's own logo-per-background rule disagrees with the light/dark rule, `brand.js` says so in
`MARCA.pngPorFundo`: background hex → the `MARCA.png` key that goes on it. The example brand has
`{ "#979797": "logo", "#A8A8A8": "logo" }`: on those two mid greys the dark placeholder reads better than the light one.
`null` = no standalone logo in that color (`{ "#C0C0C0": null }`): the opening panel or the closing in that color is a
`--check` error, which tells you to change the color.

- **Opening (cinema mode):** the panel in the `abertura.painel` color shows the PNG centered, still for 0.35 s, and leaves diagonally.
- **Closing:** `"logo": "png"` with `"ordem": "so-logo"`: only the logo, centered, up to 680 px wide (never bigger than the PNG),
  it rises, settles, and stays still. The logo comes in whole: no piece by piece, no shine, no shadow.
- A PNG the look asks for that does not exist is a `--check` error, with where to put the file (the series folder).

## 17. Text outside the image

`"texto": "fora-da-imagem"` in `series.json` (or in `video.mjs`) is the rule "text on screen never overlaps the image":

- **In the drawing:** the recorded screen is cropped at the edge of the free area (in the panel, at its window); with zoom it fades out there and
  never passes under the title, the badge, the caption, the section label, a marker or a scoreboard.
- **In the check:** the recorded screen, the panel's frame, the opening preview and the magnifier are marked as image
  (`marcarImagem`). In each checked frame, a marked text (text or caption, opacity ≥ 0.5) whose rectangle crosses the
  **visible** rectangle of the image (what it occupies, clipped by its ancestors' crop) is an error:
  `TEXT OVER IMAGE t=… s: caption "…" crosses the recorded screen (…)`. Registered transition windows are left out.
- **Where it runs:** in compor's event sheet, in the draft's `--auto` sheet and in a sweep of the whole timeline
  at 5 frames per second (`frames.cjs --check --qps 5`), which compor does on its own when the rule is on. If it fails, compor
  stops (code 1) with the list; fix the layout or the text, never the check.
- `g.prova`, `g.placar` and the magnifier belong to the sales video and draw over the screen: in a tutorial with the rule on, the
  check fails them.

## 18. The example computer tutorial series

`assets/example/computer-tutorial-series/` is a ready-made series for the tutorial of a web tool on a 3D panel. It has
no brand: it shows the format in neutral greys, with placeholder texts and a placeholder logo, and it is where a new
series starts. What is in it:

- `series.json` (version 2) and `reading.md` (the why behind each choice);
- `brand.js`, a copy of `assets/example/brand.js`: the skeleton of a brand, with a comment on what goes in each field;
- `identity.json` (the soundtrack);
- `video.example.mjs`, the model of a `video.mjs`, with a `TROQUE` on everything to replace;
- `video.example-guide.mjs`, the series recorded end to end on the neutral sample page that ships with the skill
  (`assets/example/page.html`): 2 sections, 4 steps;
- `variants/`, the four visual variants (below).

The example's font is the Inter that `scripts/example-fonts.mjs` puts in the series; its logo is the placeholder that
compor finds in `assets/example/` (section 16).

What the series looks like:

- 19:9 by default (16:9 and 9:16 with `--format`), `texto: fora-da-imagem`, cinema, DSF 3 on the computer.
- Plain light background; browser frame (a flat bar in a light surface color, the address in the dark neutral, radius
  28, long shadow): it is a web tool, and the bar says so without extra drawing.
- Loose caption on the left, 30% of the width (portrait: on top), dark, `subir` change; step label and badge in the
  same pill (the third color, with its dark shade as the text); bold title, dark, left-aligned.
- Outline highlight and glow in the main color (shape only); dark cursor with a light border.
- Opening: panel in the main color with the light logo, 3D panel with the result screen, **section index**
  (`"indice": true`: with 2 or more `g.secao`, the pills 01, 02…), `virar` exit. Section: card in the main color with
  the name in the light neutral (a pair for large text only, title lettering).
- `dissolver` closing, only the logo over the light background, ~1.9 s still. By default the video closes with the
  brand's logo, alone; a sentence or a slogan (`ordem`, section 13) only when the brand has one and the person wants it.
- Sober soundtrack, 112–118 BPM, role `protagonista`, restrained (low density), −14 LUFS: a video without voice. At −14
  the WAV's peak ceiling goes down to −2.5 dBTP (the MP4's AAC was going over the −0.5 of `finalize.mjs`).
  With voice, the same identity becomes the bed: −18 LUFS, ducked under each line, the whole mastered at −14 LUFS
  with a −1 dBTP ceiling (section 9; `references/voice-mix.md` §1).
- With voice: the closing shows only the logo, with no sentence, so the voice script leaves out the closing line (a
  closing line has to say `fimLinhas`, which this closing does not show). The opening line says the title.
- Contrast is checked against `MARCA.pares` (the text pairs the brand lists): caption, label and badge only in an AAA
  or AA pair; AA18 only on large text (title, section card).

### Starting from it with the person's brand

The greys, the placeholder texts and the placeholder logo stand for the person's brand and content: all of them are
swapped. After copying the series to `_serie`, with a variant on top (below):

1. **`_serie/brand.js`:** fill it in from the reading of the person's product (their site, their app, their brand
   guide): `nome`, the colors by role (`fundo`, `tinta`, `marca`, `acento`, `a`/`b`/`c`, and the shades that
   `series.json` calls by name), the text pairs in `pares`, `fonte`, `raio`. A color name used in the `visual` of
   `series.json` has to exist in `MARCA.cores` (or be a hex): keep the example's role names or change them in both
   files.
2. **The logo:** the brand's PNG files go in `_serie/media/`, and `MARCA.png` points to them (`logo` for light
   backgrounds, `logoClaro` for dark ones; the symbol, if the look uses the `simbolo` background). With the logo in
   SVG, fill `MARCA.logo` instead (`scripts/logo.mjs`). A color that takes another logo, or none, goes in
   `MARCA.pngPorFundo` (section 16).
3. **The font:** `node $SKILL/scripts/fonts.mjs _serie "<Family>"`, and the family in `fontes`, `fonteTitulo` and
   `fonteTexto` of `series.json`. `example-fonts.mjs` is only the examples' Inter.
4. **`_serie/series.json`:** the step label and counter in the video's language (`rotulo`, `passo`), and whatever in the
   look the brand asks to change.
5. **`_serie/reading.md`:** the example's note gives way to the reading of the product: the choice for each element
   and its why.
6. **`_serie/identity.json`:** the name of the soundtrack and, if the brand asks, its style (`references/soundtrack.md`).

`node 01-<task>/video.mjs --check` then says what is still missing: a color name that does not exist, a text pair
outside `MARCA.pares`, a font that is not in `fonts/`, a logo PNG that is not in the series folder.

### Visual variants of the series

A recipe that always starts from the same series makes every tool tutorial come out the same (the same layout, the same
transitions). That is why the series has four visual variants, in
`assets/example/computer-tutorial-series/variants/<name>/`. Each one truly changes the axes of the variety matrix
(`references/catalog/variety.md`); what changes in none of them: 19:9, text never over the screen (the check fails it),
the 3D panel, the pairs of `MARCA.pares`, a closing with only the logo in the version that reads on the background.

| variant | what you see | layout · transition · topic · camera · palette · background · pace | soundtrack |
|---|---|---|---|
| `left-column` (the base series) | plain light background; the step in the left column; the panel flips in the opening and at each section; card in the main color | left-column · flip · index-pill · dolly-3d · light-neutral · plain · medium | electronic pop 115 |
| `right-column` | shapes in light shades of the second color; the step on the right; the panel face-on, still (a thick line around the screen); the opening slides; the card in the second color with the giant number rises and pushes the panel; closing in the lightest shade of the second color | right-column · push · big-number · guided-zoom · secondary-color · shapes · calm | acoustic pop 104 |
| `bottom-strip` | a thin grid; the big screen on top and the step in a strip in the dark shade of the third color below, on a single line; the opening dives into the preview; the panel moves sideways; the section passes in a whip with the card in the third color; closing in its lightest shade | bottom-strip · whip · chapter-card · tracking · accent-color · grid · fast | soft house 122 |
| `dark-stage` | a dark stage with the giant brand symbol, tone on tone, behind the light screen; light text; a curtain in the main color in the opening; the panel orbits; the section opens in a light circle with the name typed out; dark closing with the light logo | left-column · mask · typed-text · orbit · dark-neutral · giant-symbol · medium | broken-beat electronic 96 |

In the example's `brand.js` the main color is `marca`, the second color is `acento` and the third is `apoio`, each with
its shades; the `palette` axis says which of them dominates the frame (`main-color`, `secondary-color`, `accent-color`)
or that a neutral does.

Each folder has a `direction.json` (the ten axes, for `scripts/variety.mjs`) and, in the three new ones, the whole `series.json`, the
`identity.json` (the soundtrack) and the `reading.md` (the why behind each change). The base one only has the `direction.json`.

**How to choose.** By the variety rule, not by the taste of the moment: the new direction differs from each of the brand's last 3 videos
in 3 axes or more and never repeats the style + layout + transition trio of the last one. Check the four against the history:

```sh
for v in left-column right-column bottom-strip dark-stage; do
  node $SKILL/scripts/variety.mjs check --brand <brand> --direction $SKILL/assets/example/computer-tutorial-series/variants/$v/direction.json >/dev/null && echo "passa: $v"
done
```

Among the ones that pass, the content chooses: a dark-interface tool goes with `dark-stage`; a spreadsheet or a wide panel of
numbers reads better in `bottom-strip` (the screen gets the whole width of the middle); a long step by step, to be read calmly, in
`right-column`. With no content reason, the first one that passes, in list order. The person's request beats the rule ("dark",
"same as the previous one"): then you use the one requested and say so in the prompt.

**How to use it.** The variant goes on top of the base series, whole files (nothing gets merged):

```sh
cp -R $SKILL/assets/example/computer-tutorial-series _serie
cp $SKILL/assets/example/computer-tutorial-series/variants/<name>/* _serie/
```

Then the person's brand goes in ("Starting from it with the person's brand", above).

**To see the format as it ships**, in greys and with the placeholders, run the example itself: the series in `_serie`
with the variant on top, `node $SKILL/scripts/example-fonts.mjs _serie`, `cp _serie/video.example-guide.mjs
01-guide/video.mjs` and the same path as always (section 19, step 5). `compose.mjs 01-guide --no-render` gives the
event sheet and the check in seconds, with no video.

After the video is approved, record its direction (`variety.mjs record --brand <brand> --direction _serie/direction.json
--video <mp4> --title "…"`): that history is what makes the next one come out different.

## 19. Recipe: tutorial of a web tool on the computer

1. **The tool's local preview**, with the parameters in the URL (demo mode, sample data, language):
   `video.url = 'http://localhost:5173/?demo=1'` (or `file:///…/pagina.html?…`). Test login in `entrar`, with the password
   from an environment variable; start screen in `inicio`. Customer data, never: only a demo account.
2. **The folder** (once per project):
   ```sh
   mkdir -p <project>/videos && cd <project>/videos
   cp -R $SKILL/assets/example/computer-tutorial-series _serie
   cp $SKILL/assets/example/computer-tutorial-series/variants/<variant>/* _serie/    # the one that passed variety.mjs (section 18)
   mkdir 01-<task> && cp _serie/video.example.mjs 01-<task>/video.mjs
   ```
   Then the person's brand goes into `_serie` (section 18, "Starting from it with the person's brand"): `brand.js`, the
   logo in `_serie/media/`, the font (`fonts.mjs`), the reading. The example's greys, its Inter and its placeholder logo
   only show the format: they do not go into a real video.
3. **The `video.mjs`:** the model finds the skill in `~/.claude/skills/primo-videos` (somewhere else:
   `VIDEOSTUDIO_SKILL=<skill folder>`). Replace each `TROQUE` (id, informative title, url, address) and write the script: `g.secao` per block
   (one per view of the tool; with 2 or more, the opening shows their index, "the map", with nothing to do), `g.passo`
   with the short imperative sentence, `g.toque`/`g.digita`/`g.escolhe`, and end with `g.sucesso(<what proves the task
   is done>)`. A short (up to 28 letters) and informative section name: it is what shows in the index, in the label and on the card. Light theme: `tema: 'light'` (the app gets `prefers-color-scheme: light`); if the app stores the theme
   somewhere else, set it in `entrar` or `preparar`.
4. **Privacy:** e-mails, passwords and links with a token already come out blurred; add to `borrar` (or
   `privacidade.seletores`) every selector with a name, an amount, a CPF/CNPJ (tax ID) or customer data, and to `esconder` whatever never appears.
   Look at the tap sheet: blurred has to be blurred.
5. **The commands:**
   ```sh
   node 01-<task>/video.mjs --check                   # until ✓ (taps, series, fonts, logo, contrast)
   node 01-<task>/video.mjs                           # records; LOOK at output/computer/taps-sheet.png
   node $SKILL/scripts/playwright.cjs --gpu           # report the WebGL line (on the Mac, Metal)
   node $SKILL/scripts/tutorial/compose.mjs 01-<task> --mode draft          # 19:9; LOOK at the event sheet
   node $SKILL/scripts/refine.mjs 01-<task> --channel site                    # until PASSED; DIRECTION not "weak"
   node $SKILL/scripts/tutorial/compose.mjs 01-<task> --mode draft --format 16x9     # other formats, if they ask
   node $SKILL/scripts/refine.mjs 01-<task> --channel site --video 01-<task>/<id>-computer-16x9-draft.mp4
   node $SKILL/scripts/tutorial/compose.mjs 01-<task> --mode final             # the final, after the preview is approved
   ```
   To get the look right in seconds: `compose.mjs 01-<task> --no-render` (event sheet and check, no video).
6. **Before showing:** the text-outside-the-image check with no error (the line `check 19x9: …, no text over the image`),
   the refinement at PASSED, the sheet looked at, and the closing with only the logo. An exception in the drawing (`PAGE ERROR`) fails the composition.
7. **After approval:** `node $SKILL/scripts/variety.mjs record --brand <brand> --direction _serie/direction.json --video
   <mp4> --title "…"` (section 18, variants).

### With voice (only when the person asks for it)

The steps above make the tutorial without voice, with no API and nothing paid, and that stays the default. When the
person asks for a voiceover, the same recipe gains the steps below, in this order (1 to 5 before the recording of step
5 above, 6 to 8 with it and after it). The voice is paid (ElevenLabs): the key is `ELEVENLABS_API_KEY` or
`~/.claude/secrets/elevenlabs.env`, and without it `voice.mjs` prints the command for the person to save it in their own
terminal. Never paste a key into the chat (`references/voice-choice.md` §12). For the person: up to about 900 credits
per minute of narration, against a cap per video (1,500 voice credits by default).

1. **Progress with the voice stage**, if you track it: `node $SKILL/scripts/progress.mjs start 01-<task> --voice`.
2. **The voice script**, one per version: `01-<task>/voice/computer/script.json`, one line `{ "passo": n }` per
   `g.passo`, in order; the opening line says `video.titulo` and the closing line says `fimLinhas` (with the example
   series' logo-only closing, no closing line: section 18). How to write each line: `references/voice-script.md`
   §2–§6. Then, with no network: `node $SKILL/scripts/voice.mjs review 01-<task>/voice/computer/script.json`.
3. **`voz` in the `video.mjs`** (section 3), and the script written for the voice: one sentence per step, the button's
   name as it is on screen, `{ junto: true }` + `g.na` in a step with more than one tap (section 4).
   `node 01-<task>/video.mjs --check` already checks the lines against the script, before any credit.
4. **Approval, then the voice:** the approval table (`references/voice-script.md` §5); after the yes, three candidates
   reading the real line (`voice.mjs samples`, paid; `references/voice-choice.md` §1–§5). The chosen one goes into the
   `voz` of the `script.json`.
5. **Generate** (paid):
   ```sh
   node $SKILL/scripts/voice.mjs generate 01-<task>/voice/computer/script.json --out 01-<task>/voice/computer
   ```
   Exit code 3: an AI tic in a new line, nothing spent (fix the line; `--accept-text` only when the person wants it
   that way on purpose). Exit code 5: over the video's cap, nothing spent: ask the person, and only with their yes run
   `node $SKILL/scripts/costs.mjs cap 01-<task> --voice-credits <n>`.
6. **Record and compose** as in step 5 above. The recording warns about each stretch of more than ~2.5 s without
   voice: fix it before composing (section 4).
7. **Before showing**, on top of step 6:
   - `voice.mjs validate <narration.json>` (no network);
   - `voice.mjs listen <narration.json> --words "…"` (the risk words) and `voice.mjs check <narration.json>` (forced
     alignment: each word within ±80 ms of where the caption lights up), both paid;
   - on each format's MP4, `voice.mjs listen --mix` (`references/voice-mix.md` §6);
   - on the event sheet, the highlighted word is the one being said;
   - `refine.mjs` on the folder also fixes the narration's word times by the real pauses and trims leftover silence
     (the original stays in `narration.before-refine.json`): when it reports a fix, compose again. With more than one
     version with voice, pass `--narration voice/<device>/narration.json`.
8. **After each paid call:** `node $SKILL/scripts/costs.mjs board 01-<task>`, and what it prints goes as the `costs`
   patch on the review board, when there is one (`recipes/board.md`).
