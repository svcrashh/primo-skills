# Voiceover script

The voiceover script is what the voice will say, line by line. I write it, the user approves it in a table, and only
then are credits spent. It lives in `<video folder>/voice/<version>/script.json`, next to the `narration.json` that
`voice.mjs generate` writes.

Without a script, there is no voice: the video is made as always, told by on-screen text, soundtrack and effects.

## Contents
1. Why the script comes before the voice
2. Where it comes from
3. How to write each line (and no AI tics: `review`)
4. Risk words and pronunciation
5. The approval table
6. `script.json`
7. A sentence changed: what gets regenerated
8. Four examples (invented, from different products)

---

## 1. Why the script comes before the voice

- **The voice sets the timing.** The recorder holds each step for as long as its line takes. A 4 s sentence on a 1 s
  step stretches the video by 3 s. With a voice, the script decides the video's duration, not the recording.
- **The caption is the speech.** What the voice says appears in writing, sentence by sentence, with the spoken word
  highlighted. There is no "short" caption and "full" speech: it's the same text.
- **Every character costs, and every take is unique.** The same sentence never comes out the same twice (measured: with
  the same `seed`, the timings repeat and the sound changes). The generated take becomes the video's take. Redoing it
  asks for another take, not "the same one again". That's why the text is approved first.

## 2. Where it comes from

- **From the project reading** (the project's `reading.md`, `references/reading.md`):
  - section 1, the words the audience uses. It's "close out the register", not "reconcile receivables";
  - section 2, the register: formal or close, and what the audience would find fake.
- **From the video's script.** In a tutorial, each `g.passo('…')` with a line becomes a line `{ "passo": n }`, in step
  order, starting at 1 (`references/voice-tutorial.md`). In a chapter video, each chapter becomes a line
  `{ "capitulo": n }`, in index order (`references/chapters.md`). A script doesn't mix the two.
- **In a tutorial, the opening** says exactly the video's title (`video.titulo`). The recorder compares ignoring case
  and punctuation, and refuses anything else.
- **The closing** says exactly the series' `fimLinhas`, joined, with the same comparison.
- Opening and closing are optional. A step can have no line when the image is enough, like a loading wait.

## 3. How to write each line

- **One sentence per step, said before the hand moves.** The recorder starts the action 0.3 s before the end of the
  sentence: first the voice says it, then the finger does it. The sentence talks about that step's action, and no
  other.
- **The button's name exactly as it is on screen,** with the same case: "Tap New booking." The viewer looks for that
  word on the screen.
- **Imperative and short:** "Choose the time." instead of "Now you're going to choose the time you prefer."
- **Timing:** in a test voiceover (calm voice, `speed` 0.95, 7 short tutorial lines, in Portuguese), the speech came out
  at **2.3 words/s, or 11.8 characters/s** counting the spaces. At the `reels` pace (`speed` ~1.08), estimate
  ~13.5 characters/s: it's a proportional estimate, not measured yet.
  - The voice changes that number: the same sentence varied from 9.9 to 16.3 characters/s across three voices. After
    the samples, redo the estimate with the chosen voice's number (its `charsPerSecond` in `samples.json`).
  - A step lasts at least 3 s (`leituraMin`), with or without voice.
  - A line above ~4 s (about 45 characters) stretches the step. Cut words or split the step.
- **Punctuation is a pause:**
  - comma, a short pause; period, a pause;
  - colon and dash, no: in speech they become a reveal and a dramatic break (the table below);
  - no parentheses, slashes, "etc.", emoji or abbreviations ("for example", never "e.g.").
- **The caption has to fit.** The sentence goes through the collision and safe-area check like any caption. A long
  sentence in 9:16 breaks into three lines and can cover the screen.
- **Don't invent:** no number, deadline or promise ("in seconds", "free") that the product doesn't guarantee.
- **Opening and closing with a voice are short.** The opening lasts `max(series opening, 0.3 + line + 0.4)` and the
  closing, `max(series closing, 0.25 + line + 1.5)`. A long spoken title pushes the screen back.

### No AI tics

The speech is a person explaining something to a friend, not an ad written by a machine. Each sentence states a fact,
with who did it and the verb. `review` checks the whole script with no network, before the approval table:

```sh
node $SKILL/scripts/voice.mjs review <video folder>/voice/<version>/script.json [--seconds <planned seconds of speech>]
```

| Rule | Level | Instead of | Write |
|---|---|---|---|
| no dash (`—`, `–` or ` - ` between sentences) | error | "The editor changed — and it saves by itself." | "The editor changed and now saves by itself." |
| no "it's not X, it's Y" (and "it's not just X, it's Y", "not only X but also Y", "not X but rather Y"; in Portuguese, "não é X, é Y") | error | "It's not just a list, it's your whole week." | "The list shows your whole week at once." |
| "not X, but Y" | warning | "It's not slow, but it needs internet." | if it's a real caveat, leave it; if it just flips it around, say the Y |
| no reveal with a colon | error | "The team asked, and it's live: three fixes in the editor." | "The team asked for three fixes in the editor, and all three are already live." |
| no slogan instead of the fact (short, parallel, no verb that says what happened) | error | "Three requests, three live." | the sentence above, with who did it and the verb |
| no filler: simply, basically, actually, literally, really | error | "The field simply clears the link when you paste it." | "The field clears the link when you paste it." |
| no "let's go", "let's do this", "stay tuned" | error | "Let's check it out." | "Open the editor and check the three changes there." |
| no three short sentences (up to 5 words) in a row | warning | "Fast. Easy. Done." | join two into a single sentence, with a verb |
| sentences of 8 to 18 words, one idea each | warning | "The map got bigger." | "The map got bigger, and every station now shows how many bikes it has." |
| spoken list (3 items or more) only if each item appears on screen when it's said | warning | "email, chat and calendar" with only the email field on screen | say only what is on screen |
| ~150 words per minute, counting the pauses | warning, with `--seconds` | 40 words for 12 s of speech | cut about 10 words, or plan 16 s |

- **Which rules the script checks by itself depends on the language.** The dash and the reveal with a colon (errors)
  and the speech rules (three short ones, 8 to 18 words, spoken list, time) are checked in any language. The
  expression rules ("it's not X, it's Y", "not X, but Y", slogan, filler, call-outs) are checked only in a Portuguese
  script (`idioma` starting with `pt`). In another language, the rest is on you: read each line against the table.
- **An error** is what has an obvious fix. `review` exits with code 1, and `generate` stops **before spending** (exit
  code 3, no API call) with the line, the sentence and what to change. Only the lines that are about to be generated go
  through the check: what is already in the cache was approved and heard.
- **The owner wants the sentence that way, on purpose?** Say which sentence and which rule it breaks; with their yes,
  `generate … --accept-text`. The output says how many errors stayed on purpose.
- **A warning** is a heuristic: it can be wrong. Look at each one and decide; it stops nothing. The script has no way to
  check the spoken list, because it doesn't see the screen: it points to the sentence, and whoever looks at the contact
  sheet checks it.
- **In a tutorial** (one line per step), the short imperative sentence is right: there, only the 18-word ceiling
  applies. The v3/v4 markup (`[warm]`) doesn't count as a word.
- **The 150 words per minute** are the pace of the finished narrated video, with the pauses between scenes: it's the
  estimate for the whole speech (words ÷ 2.5 = seconds). The voice alone speaks faster: a `reels` line (`speed` 1.06)
  said 13 words in 3.5 s, 221 per minute. That's why each line's `s` column keeps the character estimate above. After
  `generate`, `narration.json` has each line's real `duracao`.
- **The text rules also apply to the screen** (title, support, poster): `node $SKILL/scripts/writing.mjs review <file>`
  (`--lang pt` for Portuguese). The speech rules (three short ones, 8 to 18, list, time) apply only to the voice.

## 4. Risk words and pronunciation

A **risk word** is one the voice can misread:

- a product or brand name;
- an acronym;
- a word in another language inside the line (an English term in a Portuguese line, a Portuguese name in an English
  one);
- a number with a unit, a time, a date, a currency;
- an address, an email, a code.

Each one goes into the approval table with the proposed spelling. Before generating the whole video, the risk words
go into a single sentence for `voice.mjs samples --phrase` with the chosen voice. After generating,
`voice.mjs listen` transcribes each line, fails if a risk word wasn't heard and writes `heard.md` next to
`narration.json`. With the video finished,
`voice.mjs listen --mix <mp4> --script <narration.json>` does the same on the final audio, with the soundtrack
(`references/voice-mix.md` §6). Invented names, stage names with a number or a swapped letter, and words in another
language are the ones that fail most: they always go into the map.

**How it's solved without breaking the caption.** The caption shows the script's `texto`. The voice receives the same
text with the swaps from the `pronuncia` map, and `voice.mjs` returns the words in `narration.json` with the caption's
text.

- **Example:** the `texto` "Export the GIF from Vyrta." with `"pronuncia": { "GIF": "ghif", "Vyrta": "Veerta" }`.
- The voice receives "Export the ghif from Veerta.".
- The caption stays "Export the GIF from Vyrta.". The word "Vyrta." is highlighted from the start to the end of
  "Veerta.".

Map rules:

- **The key is the word as it is in `texto`,** without the punctuation around it, and with the same case: `"GIF"`
  doesn't swap "gif".
- **One word per key.** For an expression, put a key for each word that needs a swap.
- **The value is the spelling that makes the voice get it right:** a phonetic spelling in the language ("Veerta",
  "dashbord", "two thirty"). It can have several words.
- **The map applies to the whole script.** A line can have its own `pronuncia`, which wins over the general one in that
  line.
- **`narration.json` keeps what was said** in `dito`, only on the swapped words
  (`{ "texto": "Vyrta.", "ini": …, "fim": …, "dito": "Veerta." }`). `check` aligns the audio against the spoken text.
- **In doubt about a word?** Generate just that sentence with `voice.mjs samples --phrase`, with the chosen voice,
  before generating everything. The user listens, and it costs one sentence.

## 5. The approval table

Show it to the user before spending. One row per line:

| # | Where | What you see | What the voice says (= caption) | s | Risk words → how the voice reads them |
|---|---|---|---|---|---|
| 0 | opening | title over the series background | Book a bike. | 1.0 | — |
| 1 | step 1 | map with the stations | Open Vyrta and tap Book. | 2.0 | Vyrta → "Veerta" |
| 2 | step 2 | list of bikes | Pick a free bike. | 1.4 | — |
| 3 | closing | logo held still | Done. Enjoy the ride. | 1.8 | — |

- **s** is the estimate from §3: characters ÷ 11.8 on `calmo`, ÷ 13.5 on `reels`.
- Below the table, one line with the total characters (that's what is spent) and the proposed voice and pace.
- **On the review board,** `voice.mjs board <script.json>` gives it the script's state (`needs-fix`, `ready`,
  `generated` or `stale`), the words, the estimated seconds and credits, each line with its scene and audio, and the
  sample options (`--samples <folder>`, `--narration <narration.json>`). No network.
- **In the chat,** ask with `AskUserQuestion`: "Approve and generate", "Change sentences", "Change the
  pronunciation", or free text. **The table goes in the `preview` of the "Approve" option**, in monospaced text: what is
  written between one tool and the next may not reach the user ("I didn't see that script, show it to me").
- **Write the way people talk:** contractions ("you'll", "it's"; in Portuguese "pra", "a gente"), a real question
  ("Running a team chat?"), one stage of the screen per sentence, in the order it appears. It's the sentence that
  triggers the animation.

## 6. `script.json`

```json
{
  "idioma": "en-US",
  "perfil": "calmo",
  "voz": { "id": "<voice_id of the chosen voice>", "nome": "<its name>", "modelo": "eleven_multilingual_v2" },
  "ajustes": { "speed": 0.95 },
  "pronuncia": { "Vyrta": "Veerta" },
  "falas": [
    { "id": "abertura",   "onde": "abertura",      "texto": "Book a bike." },
    { "id": "p1",         "onde": { "passo": 1 },  "texto": "Open Vyrta and tap Book." },
    { "id": "p2",         "onde": { "passo": 2 },  "texto": "Pick a free bike." },
    { "id": "fechamento", "onde": "fechamento",    "texto": "Done. Enjoy the ride." }
  ]
}
```

| Field | What it is |
|---|---|
| `idioma` | the language of the speech, as in `video.mjs` |
| `perfil` | `calmo` or `reels`. It decides the voice's default settings and goes the same to `video.voz.perfil`, which decides the mix (`references/voice-choice.md` §5) |
| `voz` | the chosen voice (`references/voice-choice.md`). `modelo` default: `eleven_multilingual_v2`. `eleven_v3` and `eleven_v4` are opt-in and take bracket markup in the text (`recipes/human-voice.md`). `autorizacao`: the written authorization file, required for a cloned voice (`references/voice-choice.md` §9) |
| `ajustes` | optional: overrides the profile's settings (`speed`, `stability`, `similarity_boost`, `style`, `use_speaker_boost`) |
| `pronuncia` | optional: the map from §4 |
| `emocao` | optional, v3/v4 only: one tag for the whole script (`"warm"`); `voice.mjs` puts `[warm]` at the start of each line |
| `falas[]` | `id` (letters, numbers, `-` and `_`; it becomes the file name), `onde` (`"abertura"`, `{ "passo": n }`, `{ "capitulo": n }` or `"fechamento"`), `texto` and, if needed, its own `pronuncia` and `emocao`. On v3/v4 the `texto` can carry markup (`[warm] Hi.`): it goes to the voice, and stays out of the caption and of the words in `narration.json` |

At sample time the voice hasn't been chosen yet: `samples --script` accepts the script without `voz`. `generate`
doesn't.

```sh
node $SKILL/scripts/voice.mjs generate <video folder>/voice/<version>/script.json --out <video folder>/voice/<version>
```

It writes `narration.json` and `lines/<id>.wav` (48 kHz, mono, 16-bit) in the `--out` folder. In a chapter video,
then come `scripts/chapters/tempos.mjs` (the scenes' timing from the words) and `scripts/chapters/assemble.mjs
--narration voice/<version>/narration.json` (`references/chapters.md`).

## 7. A sentence changed: what gets regenerated

Each take's key is the SHA-256 of everything that changes the sound:

- the text sent (already with the pronunciation);
- the voice, the model, the settings and the format;
- the neighboring lines, which go as `previous_text` and `next_text` so the intonation joins up (`eleven_v3` doesn't
  take them);
- the pronunciation swaps used in that line.

So changing the sentence of step 2 regenerates step 2 **and lines 1 and 3**, because their neighbor changed. Before
calling, `generate` checks what the new lines will cost against the video's voice cap (`references/voice-choice.md`
§12): over the cap, nothing is called (exit code 5) and the message says to ask the person and raise it with
`node $SKILL/scripts/costs.mjs cap <project> --voice-credits <n>`.

The user listened and didn't like a take? `voice.mjs generate script.json --out … --redo p2` asks for another take of
that line only. The old one is kept in `voice/_takes/<key>/antigos/`.

The takes live in `<video folder>/voice/_takes/<sha256>/` (`take.mp3` + `take.json`), outside any output folder, and
they are the source of truth for the sound. A line that didn't change is not paid for again. Version the whole
`voice/` folder (the MP3s are small): deleting a take loses that reading forever.

## 8. Four examples

Invented. What counts is each one's format and tone, not the words. The tutorial ones and the chapter one pass
`review` with no error or warning.

**Ordering bread from a neighborhood bakery, phone, `calmo`.**

| # | Where | What the voice says | Risk |
|---|---|---|---|
| 0 | opening | Order tomorrow's bread. | — |
| 1 | step 1 | Tap Order. | — |
| 2 | step 2 | Choose how many of each loaf. | — |
| 3 | step 3 | Set the pickup time. | — |
| 4 | closing | Done. Your bread will be set aside. | — |

**A trial class at a gym, Reels, `reels`, casual, high energy.**

| # | Where | What the voice says | Risk |
|---|---|---|---|
| 0 | opening | Book your free class. | — |
| 1 | step 1 | Tap Trial class. | — |
| 2 | step 2 | Pick the workout and the time. | — |
| 3 | closing | Your class is booked. | — |

"Free" only goes in if the product says it is.

**A support ticket in an internal IT tool, computer, `calmo`, technical terms.**

| # | Where | What the voice says | Risk |
|---|---|---|---|
| 1 | step 1 | Click New ticket. | — |
| 2 | step 2 | Attach the log from the CLI. | CLI → "C L I" |
| 3 | step 3 | Send it to the SRE team. | SRE → "S R E" |

Here the pronunciation lives in the map, and the caption keeps the word the team uses.

**Patch notes of a bike-sharing app, chapters, `reels`.** On screen go the poster titles; the voice says the whole
sentence.

| # | Where | Title on screen | What the voice says | Risk |
|---|---|---|---|---|
| 0 | opening | What's new | Vyrta got two new features this month, and I'll show you each one now. | Vyrta → "Veerta" |
| 1 | chapter 1 | **Bigger** map | The map got bigger, and every station now shows how many bikes it has. | — |
| 2 | chapter 2 | Pay by **QR** | Now you can pay with a QR code, and the receipt lands in your email right away. | — |
| 3 | closing | the logo | Both features are already live for everyone who uses Vyrta. | Vyrta → "Veerta" |
