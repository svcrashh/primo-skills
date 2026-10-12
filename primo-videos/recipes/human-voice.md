# Recipe: the voice that sounds like a person

The request that started this recipe, after two redos: **"less robotic, more human, more emotion, more pauses and
intonation."** It applies to the voiceover of any video that takes narration. Checked against the ElevenLabs
documentation and API; what is measured says it was measured, and what only the ear can judge says so.

## Contents
1. Which model
2. Writing the text for the voice
3. Emotion and pause markup (v3 and v4)
4. Settings
5. What makes it robotic (and how to avoid it)
6. Word timings (the caption and the assembly depend on them)
7. The proof (real sentences, one voice, measured)
8. The owner judges
9. Commands

---

## 1. Which model

The default is `eleven_multilingual_v2`. `eleven_v3` and `eleven_v4` are opt-in, per video: `"voz": { "modelo":
"eleven_v4" }` in `script.json`, or `--model eleven_v4` on `samples --phrase`.

| Case | Model | Why (measured, table in §7) |
|---|---|---|
| Screen tutorial, chapter video, the usual `calmo`/`reels` profile | `eleven_multilingual_v2` (the default) | its word timings already come out right (≤ 68 ms off the forced alignment) and every cached take is on it |
| A short line that has to sound like a person talking, with more emotion | `eleven_v4` (opt-in) | the widest pitch variation (10.7–13.1 st in the two sentences, against 6–7.4 for the v2 reading), pauses that follow the punctuation, ~0.11 credits per character against 0.4 |
| Long voiceover (30 s+) | `eleven_v4` (opt-in) | over 476 characters: 7.6 st of pitch against 4.9, 8 pauses against 15 (some of 1.2 s), no stumble in the transcription (v2 stuttered in the middle of a word), 52 credits against 190 |
| Want the default back | remove `modelo` from `voz` (or `"modelo": "eleven_multilingual_v2"`), or drop `--model` from `samples --phrase` | — |

**`eleven_v3` is not recommended for anyone:** with the same voice and the same sentence it gave pitch variation similar
to the v2 reading (5.1–8.4 st against 6.0–7.4), ignored the pause of the "…" in sentence A (0.36 s) and, with
`stability` 0, already ate a word. v4 exists in the API as `eleven_v4` (`GET /v1/models` describes it as the most
emotive model, 90+ languages, 10,000 characters per request; v3 takes 5,000).

**Why the default stays on v2.** What can be measured favors v4. The default didn't change because (1) every project
that already has v2 takes would redo everything (the model is part of the cache key, `references/voice-script.md` §7)
and (2) nobody has approved v4 by ear in a tutorial yet. When the person asks for a voice that sounds more human, offer
v4 in a sample round (§8) and let them decide.

## 2. Writing the text for the voice

The voice reads what's written the way it was punctuated. Write the way people talk, not the way people write:

- **One idea per sentence, 8 to 18 words.** The whole sentence has to close on its own ("Today I'll show you a theme…
  for Acme Notes Plus."), because the reader bets on the ending to decide the tone.
- **No AI tics.** It's what most gives away machine text, and the voice reads the tic with the same conviction as the
  rest:
  - no dash: comma or period;
  - no "it's not X, it's Y" (nor "it's not just X, it's Y", "not only X but also Y"); "not X, but Y" only if it's a real
    caveat;
  - no reveal with a colon ("it's live: three fixes"): the fact in a single sentence, with the verb;
  - no slogan instead of the fact ("Three requests, three live."): who did what;
  - no filler (simply, basically, actually, literally, really) and no "let's go", "let's do this", "stay tuned";
  - no three short sentences in a row;
  - a spoken list only if each item appears on screen when it's said;
  - ~150 words per minute, counting the pauses.

  `voice.mjs review script.json` checks it with no network, and `generate` stops before spending when a new line has an
  error. The table, what is an error and what is a warning, which rules are checked in which language, and how the
  owner overrides on purpose: `references/voice-script.md` §3.
- **Contractions and loose speech:** "it's", "you'll", "we're"; in Portuguese "pra", "tá", "pro", "a gente". "The chat
  goes straight to your team" sounds better than "the conversation is forwarded to the attendant". But only what the
  speaker would really say.
- **A question first, when it fits:** "Is your team drowning in messages?" makes the tone rise on its own, and the
  answer that follows comes down. It's the cheapest intonation there is.
- **Breathing room with punctuation**, not with spaces:
  - `.` and `?` close the sentence and give ~0.4–0.5 s on v4;
  - `,` gives a breath of 0.1 to 0.4 s, depending on the word: **don't put a comma everywhere**, the same pause in
    every place is what sounds like a machine;
  - `…` (a single character) gives ~0.45 s on v4 and leaves the tone hanging: use it **once** per sentence, where the
    listener has to wait ("a theme… for Acme Notes Plus");
  - `[pause]` (v3 and v4) adds ~0.4 s to the "…" (from 0.46 to 0.84 s): only for the dramatic pause;
  - **avoid** `;`, `..`, `……`, `—` and `,,`: they give long, unpredictable pauses, and the transcription sometimes
    hears extra words;
  - `!` only where there's real excitement, never on the sentence that has to close going down.
- **The brand word** goes in the `pronuncia` map written the way it's said ("Vyrta" → "Veerta"); the caption keeps the
  right spelling. Check it with `voice.mjs listen`.

## 3. Emotion and pause markup (v3 and v4)

In square brackets, **separated by spaces**, before the stretch it changes. The voice interprets it and **doesn't say
it** (checked by transcription on v4); `voice.mjs` removes it from the caption and from the words in `narration.json`.

```
[curious] Is your team drowning in messages?… [warm] This is how Vyrta sorts them. Look.
[warm] Hi there. Today I'll show you a theme… for Acme Notes Plus.
```

- Accepted (tested): `[warm]`, `[curious]`, `[playful]`, `[friendly]`, `[calm]`, `[excited]`, `[pause]`. From the
  documentation: `[laughs]`, `[whispers]`, `[sighs]`, `[sarcastic]`, `[crying]`, `[sings]`, `[strong <accent> accent]`.
  Markup that describes the **quality of the voice** ("warm", "curious") works better than markup that describes a
  sound.
- **At most one per sentence, where the emotion changes.** Marking every word flattens everything, and v4 already varies
  the tone without it (on sentence A, with `[warm]` it gave 10.7 st and without it 11.8).
- One tag for a whole line: the `"emocao": "warm"` field in the script (or on the line); `voice.mjs` puts `[warm]` at
  the start.
- **On v2 the bracket is read aloud.** Never mark a line that goes to v2.
- A bracket glued to the word (`[warm]Hi`) or one that never closes is text, not markup.

## 4. Settings

- **v4:** `stability` 0.5 and `speed` 1.0 (the profile's default works). Moving `stability` from 0 to 1 changed little
  (pitch between 10.7 and 11.8 st; the "…" pause stayed between 0.2 and 0.3 s). `style` and `use_speaker_boost` are
  ignored by the model. It accepted `speed` 0.92 and 1.1, and 0.92 didn't give a better pause: no need.
- **v3:** `stability` only 0, 0.5 or 1 (`voice.mjs` rounds it). Use **0.5**; 0 is the most expressive and the one that
  loses words.
- **v2:** what already worked: `speed` ~1.0, `stability` ~0.3 and `style` ~0.45 make it looser (pitch 11.8 st against
  7.4 for the `reels` profile), but the energy drops (14.5 dB against 19 on v4).
- **A fixed seed doesn't help:** the documentation says repetition with the same seed "is not guaranteed". What
  guarantees the approved take is the cache.

## 5. What makes it robotic (and how to avoid it)

1. A comma in every sentence: the same pause everywhere. One per idea.
2. A long sentence that doesn't fit in one breath: the voice speeds up in the middle and closes without meaning to.
   Cut it in two.
3. Everything in the same emotion, or everything marked up.
4. `speed` above 1.1 and `stability` close to 1: a flat, rushed voice.
5. A sentence that doesn't close ("Today I'll show you…" and the title comes in afterward): the tone stays in the air.
6. A long pause at every stop (the "before" reading of sentence A: 0.5 to 0.9 s at each one; the listener feels the
   speaker has stopped).
7. Reading acronyms and numbers as written: spell them out or use the `pronuncia` map.
8. Choosing an ad voice ("corporate") for a conversational role: the voice matters more than the setting.
9. Judging by the first reading: read 2–3 and send them to the owner (§8).

## 6. Word timings (the caption and the assembly depend on them)

- **v2:** the `with-timestamps` timings already come out right (≤ 68 ms off against the forced alignment, measured on
  4 lines).
- **v3 and v4: `with-timestamps` returns the timings, but early** (the word shows up to 260 ms before the voice says it,
  and the error grows along the sentence). Against the forced alignment: v3 worst 260 ms, v4 worst 240 ms; 0 of 4 lines
  within ±80 ms on v3 and 2 of 4 on v4.
- **The way that doesn't spend character credits:** `voice.mjs generate` aligns the finished WAV to the text (the
  ElevenLabs forced alignment, the same one `check` uses) and keeps the result in the take. It costs **about 1 credit
  per line** (33 calls, 33 credits, measured), once: the second round comes from the cache. If the alignment doesn't
  match the text, `generate` warns and keeps the voice's own timings.
- `check` on a v3/v4 take compares the forced alignment with the forced alignment: it always passes. What really checks
  it is `listen`.

## 7. The proof (real sentences, one voice, measured)

Measured without an ear by `voice.mjs measure --align` (pitch and energy: the p10–p90 range; CV = variation of the
interval between syllables; pauses ≥ 0.2 s inside the speech; "pause" = the gap between the end of one word and the
start of the next by the forced alignment). The **before** reading is the one the owner heard and turned down. The same
library voice in every row of each table.

**Sentence A:** a short greeting that names the brand, then "today I'll show you a theme… for <brand> Plus", in
Portuguese (~6 s). The owner asked for an audible pause before the last words, between 0.25 and 0.6 s.

| Reading | Model and settings | Duration | Pitch | Energy | Syllables/s | CV | Pauses ≥ 0.2 s | Pause before the last words | Credits |
|---|---|---|---|---|---|---|---|---|---|
| **before** | v2, reels (speed 1.08, stab 0.42) | 6.59 s | 7.4 st | 14.8 dB | 4.0 | 0.45 | 0.47 · 0.86 · 0.67 | **0.80 s** (outside) | 29 |
| new 1 | v2 loose (speed 1.0, stab 0.3, style 0.45) | 6.83 s | 11.8 st | 14.5 dB | 4.4 | 0.65 | 0.60 · 0.38 · 0.64 | 0.78 s (outside) | 29 |
| new 2 | v3, stab 0.5, `[warm]` | 6.00 s | 8.4 st | 20.5 dB | 3.4 | 0.69 | 0.38 · 0.21 | 0.36 s | 32 |
| new 3 | **v4**, stab 0.5, `[warm]` | 5.68 s | **10.7 st** | 19.0 dB | 4.7 | 0.49 | 0.23 · 0.42 · 0.23 | **0.46 s** | **9** |
| extra | v3, stab 0, `[warm]` | 5.79 s | 7.8 st | 20.4 dB | 3.5 | 0.56 | 0.40 · 0.30 | 0.48 s | 32 |
| extra | v4, `[warm]` + `[pause]` | 6.34 s | 13.1 st | 18.5 dB | 4.3 | 0.46 | 0.22 · 0.46 · 0.57 | 0.84 s (outside) | 10 |

The pauses of new 3 land after the greeting's first word, after the brand name and after the "…", where the sentence
asks for them.

**Sentence B:** a question about the viewer's problem, a short introduction of the product and a two-word call to look,
in Portuguese (~5 s). The "before" reading had no `take.json`, so it has no word timings.

| Reading | Model and settings | Duration | Pitch | Energy | Syllables/s | CV | Pauses ≥ 0.2 s | Pause after the question | Credits |
|---|---|---|---|---|---|---|---|---|---|
| **before** | v2, reels | 4.73 s | 6.0 st | 21.9 dB | 6.0 | 0.47 | 0.52 · 0.35 | — | 29 |
| new 1 | v2 loose (speed 1.0, stab 0.3, style 0.45) | 4.30 s | 9.9 st | 21.6 dB | 5.2 | 0.53 | 0.40 | 0.48 s | 30 |
| new 2 | v3, stab 0.5, `[curious]`/`[warm]` | 5.85 s | 6.0 st | 22.6 dB | 5.6 | 0.35 | 0.85 · 0.62 | 0.96 s | 36 |
| new 3 | **v4**, stab 0.5, `[curious]`/`[warm]` | 5.23 s | **12.2 st** | 22.7 dB | 6.2 | 0.42 | 0.44 · 0.34 | 0.52 s | **10** |
| extra | v3, stab 0 | 5.98 s | 5.1 st | 26.2 dB | 4.9 | 0.40 | 0.58 · 0.23 · 0.62 | 0.80 s | 36 |
| extra | v4, with `[pause]` | 5.92 s | 9.7 st | 21.2 dB | 5.2 | 0.56 | 1.03 · 0.36 | 1.08 s | 11 |

**Long voiceover** (the same voice, 476 characters, 1 line): v2 `calmo` 33.6 s · pitch 4.9 st · energy 17.9 dB ·
15 pauses (up to 1.23 s) · 190 credits · the transcription heard a stumble in the middle of a word; v4 30.3 s · 7.6 st ·
19.8 dB · 8 pauses (0.21–0.65 s) · 52 credits · no stumble. Four short lines in a row: the timbre stayed similar on all
three models (median f0 within 17 Hz on v2, 14 on v3, 12 on v4; level within 2.0, 1.4 and 2.3 dB).

**What the table says:** v4 is the one that moves the pitch the most in both sentences (10.7 and 12.2 st), pauses
0.45 s where the punctuation says to (the range the owner asked for) and costs a third. v3 didn't beat the "before"
reading on pitch (sentence B: 6.0 and 5.1 st) and left the "…" pause short in sentence A. The loose v2 also varies the
pitch, but with low energy and long pauses. **What the table doesn't say:** whether it sounds good, whether the emotion
convinces, whether the voice sounds like the same person. That's the owner's ear (§8). The CV is a hint of rhythm: in
short sentences it swings between 0.35 and 0.69 with no clear order; don't draw conclusions from it.

The whole test spent about 870 ElevenLabs credits (new readings, a grid of variations on sentence A, the long voiceover,
alignments and transcriptions).

## 8. The owner judges

Send **2–4 readings of the same sentence** in one round, with the "before" one in the middle. Show them on the review
board (it plays `samples.json`), or open the audio files (`open -a "QuickTime Player" <readings>` on macOS, `start "" "<reading>"` on Windows) and ask
with `AskUserQuestion` ("Which reading sounds most like a person?"), with one line per option saying what changes.
Recommend one (the v4), first and marked "(Recommended)", and say it may still need a pause adjustment (`[pause]` to
lengthen, remove the "…" to shorten).

## 9. Commands

```sh
# the round: the same sentence, one voice, on v4 and on the default v2 (each folder gets its own samples.json)
node $SKILL/scripts/voice.mjs samples --phrase "<the sentence>" --voices <voice> --model eleven_v4 --out <video>/voice/tests/v4
node $SKILL/scripts/voice.mjs samples --phrase "<the sentence>" --voices <voice> --out <video>/voice/tests/v2
# what can be seen without listening (--align uses ~1 credit per reading)
node $SKILL/scripts/voice.mjs measure --align <video>/voice/tests/v4 <video>/voice/tests/v2
# production: the chosen model goes in script.json ("voz": { "modelo": "eleven_v4" })
node $SKILL/scripts/voice.mjs review <video>/voice/<version>/script.json           # no AI tics, no network
node $SKILL/scripts/voice.mjs generate <video>/voice/<version>/script.json --out <video>/voice/<version>
node $SKILL/scripts/voice.mjs listen <video>/voice/<version>/narration.json --words "Brand"
# the final MP4, with the soundtrack: did the mix eat a word? (references/voice-mix.md §6)
node $SKILL/scripts/voice.mjs listen --mix <delivery>/<video>.mp4 --script <video>/voice/<version>/narration.json --words "Brand"
# what this video has spent, against its cap
node $SKILL/scripts/costs.mjs show <video>
```
