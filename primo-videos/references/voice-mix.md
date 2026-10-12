# Mixing with voice

How the soundtrack and the voiceover become a single audio track, and how to prove it came out right without anyone
listening.

Without a `voz` block in the sync sheet, none of this runs: the soundtrack is mixed as always
(`references/soundtrack.md`) and `mix_voz.py` is not even imported.

## Contents
1. What the mix does, and why
2. The sheet with voice
3. The two profiles
4. Effects under the speech
5. Running it
6. Checking: `verify.py`, `finalize.mjs` and `listen --mix`
7. When something fails
8. What only the ear can judge

---

## 1. What the mix does, and why

When the sheet has the `voz` block, `arrange_series.py` composes the bed as always and then calls `mix_voz.py`.
`soundtrack.wav` stops being just the music: it becomes the final mix (music, effects and voice), mastered. That's how
a professional edit works. **The voice leads, and the music makes room for it before it starts.**

| Step | Value | Why |
|---|---|---|
| Input gain | each line at −23 LUFS | the lines come out of the generator at different levels (up to 7 dB from one to the next); without this, the same compressor would squeeze one and not even touch the other |
| High-pass | 80 Hz | below that the voice has only rumble and breath, which steal loudness and carry no words |
| Compressor | −26 dBFS, 3:1, attack 5 ms, release 90 ms | brings the strong syllable closer to the weak one: the last word of the sentence doesn't vanish under the music |
| Speech level | each line at −15 LUFS | all equal, 3 dB above the bed |
| Bed level | −18 LUFS (music and effects, without the voice) | it's the level of a background soundtrack; with a voice, the music is always background |
| The music goes down | starting 0.15 s before the 1st sound | the listener perceives the music making room, and the first syllable is born clean |
| It stays down | while the voice speaks; holds 0.08 s after the last word | the tail of the word isn't swallowed by the music coming back |
| It comes back | in 0.45 s | fast enough for the music to fill the pause, slow enough not to jump |
| Short pause | under 0.6 s doesn't go up | going up and down again in half a second is pumping |
| Cut | an extra −3 dB at 1.5–4 kHz while the voice speaks | it's the band where speech is understood; the music stays whole in the rest of the spectrum |
| Master | −14 LUFS integrated; true peak ≤ the sheet's ceiling (−1 dBTP), 4× true-peak limiter aiming 0.3 dB below | the delivery's AAC raises the peak by a few tenths |
| **Guarantee** | in each line, voice ≥ 12 dB above the soundtrack, full band and on a phone speaker (300 Hz–8 kHz) | on a phone the bed "rises" relative to the voice. If it doesn't make it, the music under that line goes down until it does, and the log says by how much. The calculation is done after the master: the limiter holds the voice's peaks and eats a few tenths of the ratio |

## 2. The sheet with voice

`compose.mjs` (tutorial) and `scripts/chapters/assemble.mjs` (chapters) write it into `audio/sheet.json`, and the mix
reads it:

```json
"loudness_lufs": -14, "teto_dbtp": -1.0,
"voz": { "arquivo": "voz.wav", "trechos": [[3.214, 4.702], …], "perfil": "calmo", "falas": […] }
```

- **`voz.wav`**: the whole voiceover on the video's timeline, 48 kHz mono, with silence outside the lines, next to the
  sheet. The level is the generator's, with no gain: the 1st sound of each line is measured on it (10 ms from the
  instant, above −45 dBFS, the same yardstick as the narration's `inicio_voz`).
- **`trechos`**: one per line, from the 1st sound to the end of the last word. It's what the music's envelope follows.
- **`perfil`**: `calmo` or `reels` (§3).
- **`falas`**: each line's id, time and text.
- `mix_voz.py` has to sit next to `arrange_series.py`. If it's missing, the arrangement says so and stops.

## 3. The two profiles

The profile changes together with the voice's speed: it's the video's pace (`references/voice-choice.md` §5).

| | `calmo` (tutorial, explainer) | `reels` (fast cut, feed) |
|---|---|---|
| The music gives way under speech | 11 dB | 9 dB |
| The music in the pauses, over the bed | −1 dB | 0 dB |

In `reels` the music stays more present, because the video is short and the energy is part of the message. In `calmo`
the music steps back further, because the viewer is learning.

## 4. Effects under the speech

An effect plays "under the speech" when it sounds between the music going down (0.15 s before the 1st sound) and the
end of the hold.

- **They stay at their level:** `toque`, `clique`, `digitacao` (and the small UI sounds `pop`, `tique`, `blip`). They
  are the gesture the screen shows; if they vanished, the image would lose its cause.
- **They go down 6 dB:** everything else. `whoosh`, `virada` and `riser` (transitions), and also `sucesso`, `impacto`,
  `baque`, `erro`, `rabisco`, `giz`, `brilho` and the musical accent of markers without an effect. They are long or
  pitched, and they compete with the voice's band.
- The caption flip always lands 0.15 s before the step's line. For it to be heard without opening a hole under the
  first syllable, the room the bed makes for it is short: it comes back in 150 ms, before the 1st sound. An effect that
  lands when the music is already giving way to the voice opens no room at all: the voice already opened it.

## 5. Running it

**Tutorial:** through `compose.mjs`, with `video.voz`, nothing changes: it copies the audio files and runs the
arrangement (`references/voice-tutorial.md`).

**Chapters:** `assemble.mjs` puts each line at the start of its scene + 1.4 s, writes `audio/voz.wav`, the `voz` block
of `audio/sheet.json` and an `.srt` next to each delivered MP4. With `--soundtrack` it also composes and checks the
soundtrack, and with `--deliver` it finalizes each format:

```sh
node $SKILL/scripts/chapters/assemble.mjs <project> --narration voice/v1/narration.json [--profile reels|calmo] [--speech-at 1.4] [--soundtrack --deliver <folder>]
```

The opening logo (`opening-logo.json`) goes in after `finalize.mjs`, and the `.srt` is shifted by its duration.

**By hand:**

```
python arrange_series.py identity.json sheet.json
```

Next to the sheet, out come:

- `soundtrack.wav`: the final mix;
- `stems/voz.wav`, `stems/musica.wav`, `stems/efeitos.wav`: the three add up to `soundtrack.wav`;
- `stems/ref/`: the yardsticks (the music after the effects and before the voice, the raw music, the effects before
  they go down), with the same master;
- `soundtrack.voz.json`: the profile, how much the music gave way in each line (and how much more for the guarantee),
  and each line's voice/soundtrack ratio after the master.

In an arrangement of your own (no series), the path is the same one `arrange_series.py` takes in its `if voz` block:
separate the music from the effects, and call `mix_voz.salvar`.

## 6. Checking: `verify.py`, `finalize.mjs` and `listen --mix`

**`python verify.py sheet.json`** measures, on the stems, each row of the table in §1. Exit code 0 means everything is
ok. The per-line table shows:

| column | what it is |
|---|---|
| 1st snd | the 1st sound of the sheet's voice; it has to land within ±10 ms of the start of the segment |
| position | how far the mix's voice is shifted from the sheet's voice (correlation at 300–3400 Hz; limit ±1 ms) |
| LUFS | the line's level; all of them within 1 LU of each other |
| voc/trk, phone | how far the voice sits above the soundtrack, full band and through the phone filter (minimum 12) |
| pumping | how much the mix moves the music inside the line (400 ms LUFS, against the raw music; limit 3) |
| raw music | the music's own variation in the line, just for comparison |

After the table: the music in the pauses, how much it gives way in each line and at which instants (still up 0.18 s
before, halfway down, down at the 1st sound, down until 0.08 s after, halfway back, back 0.53 s after), the short pauses
that don't go up, the cut (measured at 2–3 kHz) and each effect under the speech. With a voice, the effect markers are
measured on the soundtrack without the voice: the voice is another layer, and its position is measured per line.

**`finalize.mjs`**, with a sheet that has `voz`, checks on the MP4's audio, already in AAC:

- the true peak against the sheet's ceiling;
- in each line, the 1st sound in the MP4 within ±1 frame of the start of the segment (the sheet's voice is the
  template; the delay comes from cross-correlation);
- in each line, how far the voice sits above what plays under it, in the gaps between words: at least 15 dB (the
  guarantee's 12 dB plus the ~3 dB between the strong syllable and the average). A good mix sits above 19; a soundtrack
  that didn't give way sits near 9.

**`voice.mjs listen --mix`**, on the final MP4 of each format, proves what no level proves: that each word is still
understood over the soundtrack and the effects. A whoosh right on top of the product's name passes the 12 dB guarantee
(it's the line's average) and takes the word with it.

```sh
node $SKILL/scripts/voice.mjs listen --mix <delivery>/<video>-9x16.mp4 --script <video folder>/voice/<version>/narration.json --words "Brand,Acronym"
```

- It extracts the audio from the MP4 (ffmpeg, mono 16 kHz), transcribes it with the same speech-to-text as `listen`
  (`scribe_v2`, no keyterms: biasing it toward the right word would hide the wrong one) and compares it with the
  script's text. It accepts `narration.json` or `script.json` (with the `pronuncia` map, a word counts as written or
  as it was said).
- The comparison is the one `listen` uses: no case, accents or punctuation, a number in words against digits ("seven
  thousand one hundred twenty-nine" = "7,129"), a word glued to its neighbor, an address with one letter of difference.
  First in order; what's left counts out of order, because a video can play the pieces of a line in another order.
- **The threshold.** The video doesn't go to the owner if:
  - less than **90%** of the script's words show up in the transcription;
  - **one risk word** is missing (those in the `pronuncia` map and those in `--words`), as in `listen`;
  - or **3 words in a row** or more were lost, anywhere.

  Why: on the clean voice, the transcription returns every word (13 of 13 and 22 of 22 in two test lines with
  `listen`), and on a final MP4 mixed with a `reels` soundtrack, also 13 of 13. So what disappears in the mix is the
  mix's fault. The 10% margin is for what the transcription gets wrong on its own in a single word (a contraction
  written out, a word glued to the next): in a 13-word video, one lost word passes (92%) and two fail (85%). But the
  transcription misses single words, while a soundtrack or an effect on top eats a piece of a sentence: in a
  150-word video, 90% would let 15 lost words through, and the 3-in-a-row rule still catches the covered sentence. A
  risk word fails on its own because it's the one the owner will look for.
- It exits with code 1 when it fails, with each lost stretch **and its time** in the video (between the end of the last
  word heard before it and the start of the first one heard after, from the timings the transcription returns), and
  writes next to the MP4 `<video>.heard-mix.md` (the verdict, the stretches, the transcription) and
  `<video>.heard-mix.json` (the API's response).
- **The video uses only some of the lines, or a piece of one?** What is left out counts as lost: pass `--line id,id`
  with the lines the video says, or a script with only what it says. `--threshold 85` changes the percentage, with the reason written in
  the delivery.
- **Cost:** the transcription charges by duration, ~0.33 credits per second (a 15.1 s video cost 5 credits): a minute,
  about 20. It goes through the video's cost notebook like any paid voice call: checked against the cap before calling,
  noted after (`references/voice-choice.md` §12).

## 7. When something fails

| Failed | What it usually is | What to do |
|---|---|---|
| guarantee, and the log says "not even the music 40 dB down leaves the voice 12 dB above" | a `toque`, `clique` or `digitacao` too loud under the speech | lower that marker's `nivel` in the sheet and run it again |
| 1st sound outside the segment | `voz.wav` and the `trechos` disagree | it's `compose.mjs`'s (or `assemble.mjs`'s) job; compose again, don't edit the sheet by hand |
| voice position | the voice moved after the mix | `soundtrack.wav` was edited outside the arrangement; generate it again |
| the music doesn't give way on time | `soundtrack.wav` didn't come from this arrangement, or the sheet changed afterward | run the arrangement again with the current sheet |
| `finalize`: prominence < 15 dB | the soundtrack that went into the MP4 isn't the one that gives way | check that `--audio` is the `soundtrack.wav` from the arrangement with voice |
| `finalize`: 1st sound outside ±1 frame | video and audio from different versions | join the video and the `soundtrack.wav` from the same composition again |
| `listen --mix`: lost stretch | the voiceover alone also loses the word (`listen <narration.json>`) | it's the take, not the mix: fix the `pronuncia` map and `generate --redo <id>` |
| `listen --mix`: lost stretch, the voiceover alone passes | an effect on top of the word (`whoosh`, `impacto`, `riser`, `sucesso`, `virada`) | remove the marker or move it in the sheet (`verify.py` lists the effects under the speech) and redo the mix |
| `listen --mix`: many single words lost | the music on top of the voice | lower the soundtrack under the speech: `calmo` gives way 11 dB, `reels` 9; or the music lower in the identity. Redo the mix |

## 8. What only the ear can judge

The measurements above prove level, timing and room, and `listen --mix` proves the words are understood. They don't
prove taste. Nobody here listens. Tell the user, in so many words, what still needs an ear:

- whether the voice sounds natural over this bed, or too compressed;
- whether the music coming back in 0.45 s sounds like a breath or a jump, in this genre;
- whether `reels` is energetic enough, or `calmo` steps back too far, for this audience;
- sibilance and mouth clicks in the voice (the mix has no de-esser);
- whether an effect that stayed at its level, under the speech, distracts.
