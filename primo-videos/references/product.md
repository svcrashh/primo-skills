# Each type of product: how to start it, how to record it, which template, what to ask

The skill recognizes the type from the repository **before recording** and says which one it found, in one line:

```sh
node $SKILL/scripts/product/type.mjs <project-folder>        # [--json]
# Reconheci: tipo 3 — programa de computador com janela · Electron. Achei: electron no package.json (Electron).
```

Tell the owner this line, with the start command the script returned. If the owner corrects it, what they said wins. The script reads only
manifests (`package.json`, `Cargo.toml`, `pyproject`, `go.mod`, `Package.swift`, `index.html`), at the root and one or two levels
below; documentation, examples and test folders do not decide. In a monorepo, the screen beats the API. If it returns "Did not recognize"
or "Not one of the five types" (a native phone app, with no web version), ask the owner once what to record.

| # | Type (`id`) | Image | Template | Recorder |
|---|---|---|---|---|
| 1 | website or web app on the computer (`web-computer`) | real screen, browser | `real-screen-camera` | `scripts/tutorial/record.mjs` |
| 2 | web app on the phone (`web-phone`) | real screen, 390×844 | tutorial mode with a phone mockup frame | `scripts/tutorial/record.mjs` |
| 3 | program with a window (`window`) | only the window, macOS or Windows | `real-screen-camera` with `"moldura": "nenhuma"` | `scripts/product/record-window.mjs` |
| 4 | command line (`terminal`) | what was typed and what it answered | `typing-terminal` | `scripts/product/record-terminal.mjs` |
| 5 | no screen (`no-screen`) | **none** | none | `scripts/product/propose.mjs` |

## 1 · Website or web app on the computer (already existed)
- **Start:** the reconnaissance's `subir` (`npm run dev`, `streamlit run app.py`…), after the installation it points to. With no
  server, `npx --yes serve`. Start it yourself, in the background, and close **only** the process you opened (by PID).
- **Record:** `video.mjs` with `versoes: ['computer']` (`references/tutorial.md` §3–§7). One task per video.
- **Template:** `templates/real-screen-camera/` (or the style that the style choice recommends). A 10 s draft: one step.
- **Ask:** how to log in without a password in the chat (demo mode/test account); what can never appear; which task.

## 2 · Web app on the phone (already existed)
- **Start:** same as 1. Capacitor/Ionic/Expo: the web server (`npm run dev`), not the simulator.
- **Record:** `versoes: ['phone']` (390×844, DSF 3, touch). It is the tutorial mode path: `compose.mjs` with a phone mockup frame,
  9:16, caption card, finger. The `real-screen-camera` template recomposes the 9:16 from a computer recording; for a
  product made for the phone, record in a phone viewport and compose through the tutorial mode.
- **Ask:** how to log in; is there a computer version too (both come from the same script); which task.
- A series with a `series.json` without `"versao"` uses the engine's old drawing (a `compose.mjs` warning): for a real product, define
  the identity (`references/tutorial.md` §9 and §13).

## 3 · Computer program with a window (Electron, Tauri, native)
Records **the window and only it** on macOS or Windows, at its native resolution (2× on Retina; the display scale on Windows), with no shadow,
without the desktop around it. On any other system (Linux) it does not record: the recorder says so and stops. Then, for a web app, record
through the browser (types 1 and 2); otherwise ask the owner to record the screen and hand over the video file.

- **Start:** the reconnaissance's `subir` (`npm start`, `cargo tauri dev`, `swift run`, `python3 main.py`). No need to start it by hand:
  the recorder opens it with `--launch` and, at the end, closes **only** the process group it opened (on Windows, the process tree).
- **Permission (once, macOS):** Screen Recording for whatever runs the skill. Check it with `node scripts/product/record-window.mjs --permission`.
  If it is missing, the recorder **stops** and says, in a message: *Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela*
  (System Settings → Privacy & Security → Screen Recording), tick the app that runs the skill (Terminal, VS Code…), quit and reopen that app. It does not keep retrying. A click in the script
  also needs **Accessibility** (same settings screen) and stops the same way.
- **Record:**
  ```sh
  node $SKILL/scripts/product/record-window.mjs --launch "<subir>" --folder <repo> --script script.json --out <folder>/recording
  ```
  `script.json`: `{ "dur": 5, "passos": [ { "t": 0.2, "frase": "…", "aponta": {x,y,w,h}, "clique": {x,y}, "sucesso": {x,y,w,h} } ] }`,
  coordinates in **points** from the top corner of the window (the title bar counts). To find the rectangles: record
  with no steps, open a frame from `recording/frames/` and divide the pixels by `dsf` from `recording/events.json` (2 on a Retina Mac;
  on Windows, the monitor's display scale: 1 at 100%, 1.5 at 150%). The tap time is measured on the frames
  (the instant the click changed the screen), not only by the clock.
- **Rules:** it records only the window of the program the recorder opened (or the `--pid` you give it); never by program name. The click
  moves the real mouse: it only fires if the program's window is the one on top at that point, otherwise it aborts without clicking. If the owner
  is using the computer, take the `clique` out of the script and use only `aponta`. A minimized window, or one in another Space (another virtual
  desktop on Windows), does not record.
- **On Windows:** there is no permission to turn on (`--permission` only checks that the helper runs). It needs `ffmpeg` on the PATH
  (`winget install ffmpeg`, then a new terminal) and Windows PowerShell 5.1, which comes with Windows (the helper is `scripts/product/window.ps1`).
  `ffmpeg -f gdigrab` records the **area of the screen where the window is**, exactly as it shows. So, before recording:
  - keep the window restored, not minimized (a minimized window is not found), and whole on the screen (a part past the edge is cut off,
    and the coordinates then count from the visible corner);
  - keep everything else off it: a notification, a dialog or another window over that area goes into the video, and a click that another
    window would receive aborts the recording. The recorder brings the window to the front once, at the start; it does not keep it there.

  `--launch` runs the command through `cmd.exe` (so `npm start`, `npx …` and `&&` work) and, at the end, closes the process tree it opened
  (`taskkill /T`), nothing else. A program that hands its window to an instance already open is not found: close that instance first, or use
  `--pid`. With display scaling (125%, 150%), the recorder measures in real pixels and checks the screen size ffmpeg sees; if the first frame
  still comes out shifted or cut, set Settings → System → Display → Scale to 100% for the recording. A program running as administrator
  ignores clicks from a terminal that is not: run the terminal the same way, or leave out the `clique`.
- **Resolution:** the capture comes out at the window's resolution (`--width 2560` reduces it). For camera zoom without softening, the program
  should open at ~1280×800 pt or more; a small window allows less zoom, it is not blurred on purpose.
- **Template:** `real-screen-camera` with `"gravacao": "<folder>/recording"` and **`"moldura": "nenhuma"`** (the window already brings its own
  bar; without this, a browser bar goes on top). No `endereco`.
- **Ask:** which screen and what to click; what demo data can appear in the window; whether the program can be opened now.

## 4 · Command-line program
The video shows what was typed and what the program **really** answered, in the typing-text style.

- **Start:** there is nothing to start. The reconnaissance's `subir` shows how to run it without installing (`node bin/x.js`, `cargo run --`).
- **Record:** `commands.json` with the list the **owner** approved (the skill only runs what is on it):
  `{ "titulo": "meu-cli", "prompt": "~/meu-cli $", "alias": { "meu-cli": "node bin/meu-cli.js" }, "comandos": [ { "cmd": "meu-cli lista", "legenda": "See the list." } ] }`
  ```sh
  node $SKILL/scripts/product/record-terminal.mjs --commands commands.json --out terminal.json --folder <repo>
  ```
  It runs each command (20 s at most) and stores the lines and the time of each one. An exit code ≠ 0 is shown as it came out; check
  whether the owner wants that on screen. `alias` makes the name that appears in the video run the project's program, without installing anything.
- **Template:** `templates/typing-terminal/` (`TEMPLATE.md`). `node templates/typing-terminal/render.mjs video.json --out <folder>`;
  16:9, 9:16 and 1:1 recomposed. Typing with a seeded human rhythm, cursor, a short caption below. No soundtrack in the draft.
- **Ask:** which commands, in order; does any of them change things or spend resources; does the output have real data or secrets (never show them).
- An interactive program (TUI, `inquirer`) does not fit: the recorder has no keyboard. For those, record the Terminal window through type 3.

## 5 · Product with no screen (library, API, bot, service)
**There is no screen to record, and the skill does not invent one.** Tell the owner that and propose:

```sh
node $SKILL/scripts/product/propose.mjs <project-folder>
```
- **API:** the real call and response (`curl` + JSON, in the `typing-terminal` template, against a local server with
  demo data), and the result on the screen of the product of whoever uses the API.
- **Library:** the code that uses it and what it returns when running; the effect on the product of whoever uses it.
- **Bot:** the real conversation on the screen of the app where it lives (test account), or the text of the real answers in `typing-text`.
- **Service:** the command that triggers it and the result it leaves.
- None of this works: an explainer video with no screen (typed text, counting number, rolling list).
- **Ask:** which proposal fits the channel; whether there is a test account/environment; in which product the result shows up.
- A number ("40 ms", "3 calls down to 1") only goes in if the owner measured it.

## Rules that apply to all five
- No brand inside: color, font and logo come from the project (briefing), never from the template.
- Never record, close or move a window that is not yours; never kill a process by name or port.
- Draft first; **look at the contact sheet** before showing it.
- Playwright is found by `scripts/playwright.cjs` (the one in `~/.videostudio/environment.json` first); if it is not found,
  `node $SKILL/scripts/environment.mjs --fix` (and `--yes` to download), or `PLAYWRIGHT_PATH=<…>/node_modules/playwright`.
