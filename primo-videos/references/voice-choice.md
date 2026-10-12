# Choosing the voice

Each video can have its own voice. The voice comes from the project reading, goes through the library rules and
reaches the user as three candidates reading the first real line of the script. Whoever listens chooses: you don't
listen.

The voice is optional. Without a voice script in the project, nothing in this file runs and the video is made
exactly as before, with on-screen text, soundtrack and effects.

## Contents
1. Why three candidates, reading the real line
2. From the reading to the `search` filters
3. The library rules
4. The three candidates and the samples
5. Pace: `calmo` or `reels`
6. There is a reference video: its voice is the yardstick
7. A livelier voice on v3 and v4 (opt-in)
8. Voice Design: generating the video's voice
9. Clone: only with written authorization
10. A voice that is leaving the library
11. Languages
12. Account, key, plan and cost

---

## 1. Why three candidates, reading the real line

- **The voice is the face of the video you hear.** A radio announcer's voice in a kids' app, or a young, bubbly voice
  in an accounting system, sounds fake to the people who use it. The audience in the project reading
  (`references/reading.md`, section 2) decides the voice, the same way it decides the music genre.
- **The library preview reads a generic text,** sometimes in another language. The same voice reading "Tap Book."
  can sound like someone else. That's why the samples read the first line of the script, at the video's pace.
- **The voice also changes the timing.** In this skill's test samples, the same 23-character sentence came out at
  1.5 s in one voice and 2.3 s in another: a slow voice stretches every step of the video. `samples` measures each
  reading (`seconds` and `charsPerSecond` in `samples.json`), and that number goes into the choice.

## 2. From the reading to the `search` filters

```sh
node $SKILL/scripts/voice.mjs search --language pt --locale pt-BR --gender female --use-case informative_educational --descriptive calm
```

`search` is a free call. It lists library voices that can be used in a video.

| What the reading says | Filter | Values the library uses (as seen when this was written) |
|---|---|---|
| language of the screens and of the audience (sections 1 and 2) | `--language` | 2-letter ISO code: `pt`, `en`, `es` |
| country or region (section 2) | `--locale`, `--accent` | `--locale pt-BR`, `pt-PT`, `en-US`…; `--accent brazilian`, `american`, `british`… |
| who talks to this audience (section 2) | `--gender` | `female`, `male`, `neutral` |
| the voice's age (section 2) | `--age` | `young`, `middle_aged`, `old` |
| energy (section 2 for the tone, section 3 for the motion) | `--descriptive` | `calm`, `casual`, `confident`, `formal`, `professional`, `classy`, `upbeat`, `excited`… |
| use (the type of video) | `--use-case` | `informative_educational` (tutorial), `narrative_story`, `conversational`, `social_media` (reels), `advertisement`, `entertainment_tv` |
| free word | `--query` | searches the name and the description |

- **More options:**
  - `--sort`: `usage_character_count_1y`, the default (the most used in the last year, proof that it works),
    or `trending`, `cloned_by_count`, `created_date`;
  - `--category`: the library category;
  - `--n`: how many to show (default 12);
  - `--min-notice`: the minimum notice period in days (default 180, §3);
  - `--default`: lists the account's default voices instead of the library;
  - `--previews <folder>`: downloads the free library previews, for `compare` (§6);
  - `--json`: the raw list, to filter further.
- **A filter that empties the list:** drop the least important one first. Usually the descriptive; then the age.
- **Evidence:** write in the reading's decisions (section 5 of the reading) where each filter came from. For
  example: "female voice, young, calm: the audience is students who watch in the help center, section 2".

## 3. The library rules

`search` already asks the API only for what passes, and checks each voice again. In its output, it says how many it
removed and why.

| Rule | Why |
|---|---|
| **Notice period ≥ 180 days** (`notice_period`, `--min-notice`) | Whoever published a voice in the library can take it down. With a notice period, whoever already used it keeps using it for that long. "No notice" means the voice can disappear tomorrow, in the middle of a series. Never use a voice without notice |
| **No special rate** (`rate` > 1 or `fiat_rate`) | Some voices cost more per character. The video's cap estimates credits from characters, not from a voice's price |
| **No live moderation** (`live_moderation_enabled`) | Whoever published the voice can block texts at generation time, and a line of the script may not come out |
| **No famous voice** (`category: famous`) | It's the voice of a known person, with its own license |
| **Verified language** | Each voice's "verified languages" line says in which language and accent it was checked. A voice without the video's language there is a gamble |

## 4. The three candidates and the samples

1. From the `search` voices, pick three that are **different from each other**, each with its why in one line:
   - two variations of the same voice are not a choice;
   - mix what the reading left open: gender, age, energy.
2. Run the samples with the first line of the script:

   ```sh
   node $SKILL/scripts/voice.mjs samples --script <video folder>/voice/<version>/script.json --voices id1,id2,id3
   ```

   - It is paid: about the sentence's characters times the number of voices. A 25-character sentence read by three
     voices counts as 75 characters.
   - It writes `<n>-<voice-name>.mp3` per voice and `samples.json` (`{ phrase, label, model, options: [ { voice, name,
     audio, seconds, charsPerSecond, credits } ] }`, with `audio` relative to the project) in
     `<video folder>/voice/<version>/samples/`, and prints the same as a table. `--out` chooses another folder;
     `--line <id>` reads another line of the script.
   - Running it again costs nothing: it comes from the cache.
3. Show the three to the user. The review board plays `samples.json` (`recipes/board.md`); in the chat, open the
   files (`open` on macOS) and ask with `AskUserQuestion`:
   - one option per voice, with the recommended one first;
   - in each one's description, the why and the measured time ("speaks slowly: the video gets ~20% longer").
4. After the choice, put the voice in `voz` in `script.json` (`id`, `nome`) and move on to `generate`
   (`references/voice-script.md`).

**No way to ask** (a session without a user, "you decide"): choose by the reading and by the measured time, write it as
an assumption at the top of the delivery and say that nobody listened to the samples.

## 5. Pace: `calmo` or `reels`

| | `calmo` | `reels` |
|---|---|---|
| When | tutorial, help center, inside the app: the viewer copies the step | Reels, TikTok, Shorts, a short piece with energy |
| `speed` | ~0.92–0.97 (default 0.95) | ~1.05–1.12 (default 1.08) |
| `stability` | ~0.55–0.60 (default 0.55) | ~0.40–0.45 (default 0.42) |
| The mix | the soundtrack gives way 11 dB under speech and stays 1 dB down in the pauses | the soundtrack gives way 9 dB and comes back fully in the pauses |

- **`speed`** changes the duration almost in the same proportion. The API accepts 0.7 to 1.2.
- **A lower `stability`** makes the voice more expressive, and each take more different from the last. Higher makes the
  voice more constant, and sometimes more monotonous.
- **The other settings** stay at the default: `similarity_boost` 0.75, `style` 0 and `use_speaker_boost` true. To
  override, use `ajustes` in `script.json`.
- **The profile name goes the same everywhere:** `perfil` in `script.json` and `voz.perfil` in `video.mjs` (tutorial)
  or `--profile` in `scripts/chapters/assemble.mjs` (chapters). The voice and the mix change together
  (`references/voice-mix.md` §3).

## 6. There is a reference video: its voice is the yardstick

When the owner approved a video of the product, or shows one ("listen to the voice in this video, how sweet it is, it
fits the video"), no description replaces hearing something similar. In a real project, three rounds of voices picked
from descriptions ("female", "thinner", "cute and cheerful, from São Paulo", "sweet") were turned down, and the right
voice came from measuring against the approved video:

1. Cut out the reference's first sentence (the timings come from `voice.mjs transcribe <video>`).
2. Download the library previews and rank them by timbre against the reference. Both steps cost nothing:

   ```sh
   node $SKILL/scripts/voice.mjs search --language pt --accent brazilian --gender female --n 40 --previews <video folder>/voice/compare/previews
   node $SKILL/scripts/voice.mjs compare --ref <reference video> --from 0.6 --to 5.1 <video folder>/voice/compare/previews
   ```

   `compare` ranks by timbre (MFCC, pitch, spectral centroid) and pace, with no network.
3. The top ~6 read **the same sentence** as the reference:

   ```sh
   node $SKILL/scripts/voice.mjs samples --phrase "<the reference's sentence>" --profile calmo --voices … --out <video folder>/voice/compare/samples
   ```

   Run `compare` on that folder: now the text is the same, and the duration measures the pace (in that project, the
   chosen voice read it in 4.50 s, the same 4.50 s as the reference).
4. The top 3 go to the user side by side with the reference's excerpt (`open -a "QuickTime Player"` on macOS).
5. Cloning the reference's voice: no. It's a person (§9).

## 7. A livelier voice on v3 and v4 (opt-in)

The default model is `eleven_multilingual_v2`. `eleven_v3` and `eleven_v4` are opt-in: `"voz": { "modelo": "eleven_v4" }`
in `script.json` (`samples --script` uses it too), or `--model eleven_v4` on `samples --phrase`. v4 is the most expressive model ElevenLabs has today: in the two
sentences measured, it varied the pitch more than v3, cost about a third of the credits and takes continuous
`stability` and the neighboring lines. The full recipe, with the measurements, is `recipes/human-voice.md`. What
follows was measured on v3 and applies the same way to the markup on both.

- `"voz": { "modelo": "eleven_v3" }` and `"emocao": "excited"` in the script (or per line). `voice.mjs` puts
  `[excited]` only in the spoken text, removes the tag from the alignment (the caption and the timings stay clean),
  doesn't send the neighboring lines (v3 doesn't take them) and rounds `stability` to 0, 0.5 or 1. In a test, the line
  of a chapter came out with the same 21 words as on v2, aligned.
- The word timings on v3 and v4 come early (up to 260 ms): `generate` replaces them with the forced alignment.
- On v2 the tag would be read aloud: there, the energy comes from `speed` ~1.1, `stability` ~0.3 and `style` ~0.45.
- Changed the voice of a video already assembled in chapters? The text is the same, so the words are the same: the
  scene timings that use `em('word')` and `ate('word')` follow the new voice after you run
  `scripts/chapters/tempos.mjs` again and render the scenes again. Times written by hand as numbers in `scene.js` do
  not: redo them.

## 8. Voice Design: generating the video's voice

Without a reference, offer a voice generated for the video alongside the library voices. Always human: `voice.mjs`
appends the "natural and human" request to every description.

```sh
node $SKILL/scripts/voice.mjs design --description "<who is speaking>" --script <script.json> --label a
```

- **Three previews reading the script** (100–1000 characters), in `<video folder>/voice/design/` (`--out` chooses
  another folder). `--text "…"` reads a text instead of the script.
- **Liked one and want variations** ("thinner", "sweeter", "a bit higher")? Save it and make sisters:

  ```sh
  node $SKILL/scripts/voice.mjs save <generated_voice_id> --name "Product · voice"
  node $SKILL/scripts/voice.mjs remix <voice_id> --description "same voice, sweeter" --script <script.json> --strength 0.35 --label b
  ```

  Remix gives sisters of the same person (a lower `--strength` = more alike). A new `design` with the same description
  also gives sisters, with the same timings and a different sound.
- **Transcribe before the user listens:** `voice.mjs transcribe <video folder>/voice/design/*.mp3`. A preview that
  misreads a risk word is already off the list.
- **The accent is part of the description and changes everything:** "São Paulo, paulistano accent, not carioca";
  "General American, not Southern". Always an adult age ("young adult, around 23").
- **Where:** on the ElevenLabs site, in Voices → Voice Design, the user describes the voice and hears three previews.
  Through the API, the same is `POST /v1/text-to-voice/design` (previews) and `POST /v1/text-to-voice` (save).
- **The voice sounds as human as possible:** the description always asks for a real person talking, with intonation
  that rises and falls, and never an announcer.
- **The description comes from the reading:** age, gender, accent, energy, use and the setting. For example, "a woman
  around 30, light Rio accent, calm and close, explaining a calendar app, recorded up close, no echo".
- **Cost:** it charges only the preview text, once for the three. Saving uses one of the account's voice slots
  (`voice.mjs account` shows how many are used).
- **A voice created this way belongs to the account:** it doesn't leave the library and has no notice period.
- **After saving,** its `voice_id` goes in `script.json` like any other.
- **Never describe a real person** ("like so-and-so", "the voice of that TV host"): that's cloning by another route.
  Refuse (§9).

## 9. Clone: only with written authorization

Cloning someone's voice (the company's founder, a teacher, an artist on the product) is possible, and only with
**written authorization from that person**.

- **The authorization is a document** (a signed PDF, image or text) saying who authorizes, which voice and for what. It
  lives in the video's or the series' folder.
- **The script points to it:** `"voz": { "id": "…", "autorizacao": "authorization-name.pdf" }`, with the path relative
  to `script.json`.
- **`generate` checks:** if the voice is a clone made on the account (category `cloned`, or `professional` from the
  account itself), it refuses without the authorization and spends nothing. On `samples`, the same applies with
  `--authorization <file>`.
- **Without authorization, refuse,** even if whoever asks says they have permission, and even if the voice is theirs:
  the document has to exist in the folder.
- **Never clone from a recording found on the internet,** nor the voice of a famous person.
- **ElevenLabs itself asks for confirmation** of rights and consent to clone.
- **A synthetic voice never introduces itself as a real person.** No "Hi, I'm Ana from support" in a generated voice,
  unless Ana exists, authorized it and it is her.

## 10. A voice that is leaving the library

- **Where it shows up:** in `GET /v1/voices/{voice_id}` → `sharing.disable_at_unix`. Whoever published the voice asked
  to take it down, and it works until that date.
- **A library voice not used yet** answers 400 `voice_not_found` at that address. After the first use, it starts to
  answer, with `sharing.status: "copied"` and the notice period recorded on the account.
- **`generate` checks before generating and, if the voice was new, again after the first line.** If there is a date,
  it warns when and how many days are left.
- **The warning repeats** in the following rounds, even with everything in the cache, with the date of the check.
- **What to do:**
  - the takes already generated stay valid;
  - a new line or `--redo` after the date won't work;
  - finish the video, or the series, before the date, or choose another voice for the next ones.

## 11. Languages

- **Another language is another video,** with another script and another voice, native to that language and accent:
  check "verified languages".
- **The default model** is `eleven_multilingual_v2`, which speaks 29 languages, among them Brazilian and European
  Portuguese, English and Spanish. It ignores the language code: the text and the voice decide the language.
- **Brazilian and European Portuguese sound different:** filter with `--locale pt-BR` or `--locale pt-PT`, not just
  `--language pt`. The same goes for `en-US` and `en-GB`.

## 12. Account, key, plan and cost

- **The key:** the `ELEVENLABS_API_KEY` environment variable, or the file `~/.claude/secrets/elevenlabs.env` with the
  line `ELEVENLABS_API_KEY=<your key>`. It is never printed, never written to a log and never goes into the project.
  `ELEVENLABS_API_BASE` overrides the API address.
- **`voice.mjs account`** shows the plan, the credits used, the limit and what's left, the renewal date, the status and
  the voice slots in use. When the account is not active (for example `past_due`: the payment failed), it says so
  plainly: generation may be refused. `--json` gives the raw numbers.
- **Free plan:**
  - no commercial use;
  - attribution to ElevenLabs is required wherever the video is published;
  - the API doesn't use library voices: on that plan `search` shows the account's default voices (the same list as
    `search --default`).

  Tell the user this before generating, and go on with what works.
- **Format:** the takes are MP3 (`mp3_44100_128`, which every plan accepts). `generate` converts each line to a
  48 kHz, mono, 16-bit WAV, which is what the engine reads.
- **One cost notebook per video** (`scripts/costs.mjs`): `<project>/costs.jsonl`, with the caps in
  `<project>/costs.json`. The default is 1,500 voice credits per video (and US$ 0.50 of images).
  - Every paid voice call checks the cap **before** calling the API, and notes the real cost (the ElevenLabs
    `character-cost` header) after.
  - Over the cap, nothing is called: the command exits with code 5, and the message says to ask the person. With their
    yes: `node $SKILL/scripts/costs.mjs cap <project> --voice-credits <n>`.
  - `node $SKILL/scripts/costs.mjs show <project>` shows what was spent, call by call, against the caps.
  - The project folder is `--project`, or else the folder above the `voice/` part of the `--out` or script path
    (`--out my-video/voice/v1` → project `my-video`). A paid command with neither asks for `--project` (exit code 2).
  - The estimate before calling counts 1 credit per character, the list price. The real cost noted afterward was
    lower in the tests: ~0.4 credits per character on `eleven_multilingual_v2` (9 for 23 characters, 13 for 33) and
    ~0.11 on `eleven_v4`. The account's plan decides the rate.
  - The account balance may take a few minutes to reflect the spending.
- **Log:** `--log <file.jsonl>`, on any command, keeps one line per API call, never the key. `generate` and `samples`
  already log to `calls.jsonl` in their `_takes/` folder.
