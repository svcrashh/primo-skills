# Soundtrack

## Contents
1. Music research on the spot: first, what this audience listens to
2. Role of the music: background or lead (role is not genre)
   2.1 The honest limit of synthesis, by genre
3. Style catalog (and how to synthesize each one)
4. Composer subagent prompt
5. `sheet.json`, the contract with the image
6. The user's reference or finished track
7. Did the image change? Retime the soundtrack
8. Sound effects
9. Series soundtrack

---

## 1. Music research on the spot

The music of each video is decided for that product, that audience and that platform. There is no default style.

1. **First: what this audience listens to.** Before thinking about role, mood or BPM, answer with evidence (the
   project's `reading.md`, section "The audience's sound"; the site, the social media, the artists and the events the product mentions):
   - which genres this audience listens to, and which ones it despises;
   - the conventions of those genres: tempo, groove, kick timbre, bass pattern, what is a cliché;
   - what would embarrass the brand in front of them.

   The genre comes from here, not from the type of video. A neighborhood bakery, a physiotherapy clinic, a racing
   game, a trucking company and an accounting firm have audiences that listen to different things, and the
   soundtrack of each one is different, even if all five videos are tutorials.

   **When music is part of the audience's world** (a nightclub, a music school, an instrument
   store, a studio, a festival), the soundtrack is part of the credibility. It has to be in the genre this
   audience lives, with the conventions it recognizes. Swapping the genre for a "neutral" bed so as not to take a risk is the
   opposite mistake to what it seems: people who live off a kind of music notice its absence before they notice the quality. In that case,
   read §2.1 right away: the first option to offer is usually the user's own music.
2. **Classify the rest:**
   - product category;
   - audience (age, B2B or B2C, country and culture);
   - where the video runs (feed with the sound off? event with a big screen? site?);
   - target emotion in 3 words;
   - how much text the video has. This decides the **role** (§2), not the genre.
3. **Research, if WebSearch/WebFetch is available.** For example: "‹audience's genre› ‹year› tracks", "‹category› launch video soundtrack", "‹competitor› launch video music", "‹platform› ‹audience› audio trends ‹year›". Also look at the brand's own videos and social media: does it already have a jingle, a sonic signature, a playlist, partner artists? Research is for understanding *genre, tempo, groove and mood*. It is never for copying a song.
4. **Without web access**, use what you know about the audience and the category, and tell the user so.
5. **Formulate 3 directions**, different on purpose, all within what the audience recognizes:
   - **safe:** the genre the audience expects, with its conventions, done well;
   - **bold:** a neighbor of the genre (house → garage; techno → electro), to stand out without sounding strange to them;
   - **brand:** comes from the specific personality of this product.

   Each direction carries genre, role (background or lead), BPM, key or mode, groove and kick (§3), 3 timbres and the mood in words ("pulsing and clean, like a dashboard coming to life"). If synthesis cannot handle the genre for this audience (§2.1), say so in the option itself.
6. **Ask in the briefing** (`AskUserQuestion`) with these 3 directions as options. When the audience is a music audience, the 1st option is "use a track of yours or from one of the product's artists (with permission)". The answer can come as free text, a reference ("something like song X", "some electronic in the background") or a finished track. See §6 for these cases.

Vary from one video to the next: different key, BPM and timbres. A soundtrack repeated across different products is a sign that the research did not happen.

## 2. Role of the music: background or lead

**Role and genre are two decisions.** The genre comes from the audience (§1). The role comes from the reading: how much text is on screen and where the video runs. The role says how loud, how full and how much room the music leaves. It does **not** forbid a genre. A background house track still has a kick on every beat and the hi-hat on the offbeat: it only loses layers and volume.

| | Background | Lead |
|---|---|---|
| When | lots of text on screen, B2B, tutorial, sober tone | showreel, launch, short ad, sting |
| Level | −18 LUFS | −14 LUFS |
| Density | only what defines the genre: the kick, the backbeat, the offbeat and the bass stay; the sixteenth-note timekeeping, the ghost snares and most of the melody go | everything the genre asks for, with build, drop, breaks, silence before the impact |
| Room for reading | mids (1.2–4 kHz) left open in the harmony and the melody; transients that do not compete with the sound effects | everything can shine |
| Sync | soft accents on the cuts (a pluck, a shaker, a swell) | every important event with a dedicated, strong sound |
| Dynamics | almost constant, slow waves | big contrast between sections |

What the role changes within each genre, in the series (`arrange_series.py`, identity v2):

| Family | Background | Lead |
|---|---|---|
| Dance floor (house, techno) | kick on every beat and above the bass, low clap on 2 and 4, open hi-hat on the offbeat, eighth-note timekeeping, the genre's bass, the bed ducks for the kick, one melody phrase every 8 bars | sixteenth-note timekeeping, clap and offbeat louder, melody every 4 bars |
| Broken (garage, break) | the kick and snare pattern stays (it is the genre), the ghost snares go, eighth-note timekeeping | ghost snares and sixteenths come in |
| Light (acoustic, lo-fi, calm pop) | discreet kick (sometimes only on 1), harmony up front | percussion and melody rise |

Both roles follow the same contract: markers at the exact sample, digital silence where the sheet asks for it and mastering at the sheet's loudness. Even in the background, a video without sync looks sloppy.

**With voice** (opt-in, `references/voice-script.md`), the music is always background: the voice leads. The bed is
mixed at −18 LUFS, `mix_voz.py` ducks it under each line and masters the whole at −14 LUFS
(`references/voice-mix.md`). The genre still comes from §1. Without voice, nothing here changes.

### 2.1 The honest limit of synthesis

The skill's synthesis (numpy, no samples) has a ceiling. It gets the grid, tempo, groove, harmony and mix right. It does not reach the timbre of a track produced with samples, analog synthesizers and hours of mixing. For an audience that does not listen to that genre closely, this almost never matters. For an audience that lives it, it does.

| Genre | What synthesis does well | What it does not do | Does the audience notice? |
|---|---|---|---|---|
| House / deep house | 4×4 on the beat, round kick, open hi-hat on the offbeat, clap, offbeat bass, organ and e-piano stabs in m7/m9, sidechain | disco and vocal samples, the human swing of an MPC, real piano in dense chords, analog saturation | house DJ and producer: yes |
| Techno | hard, saturated kick, short rumble, hi-hats, repeated-note bass, dub chord with delay | modular synth textures, filters that evolve over minutes, the rumble of a real kick reverb, the scale of a track (a 64-bar build does not fit in a 30 s tutorial) | techno DJ: yes |
| UK garage / 2-step | the 2-step kick pattern, sixteenth-note swing, ghost snares | chopped and repitched vocals (half of the genre), reese bass | yes | `"genero": "garage"` → `garage` · `garage` · swing 0.14–0.22 |
| Break / drum & bass | the break pattern and the ghost snare | the sound of a sampled break (Amen, Think): the synthetic `break` is an approximation | yes |
| Acoustic / MPB / acoustic pop | fingerpicked acoustic guitar (Karplus-Strong), simple piano, shaker, rimshot | vocals, close-up acoustic guitar with finger dynamics, exposed solo piano | musician: sometimes |
| Lo-fi / hip hop | e-piano, vinyl, tape, swing | chopped jazz samples, boom bap with sampled drums | producer: yes |
| Orchestral / cinematic | string bed, impact, riser | exposed, believable orchestra | composer: yes |
| Brazil (samba, forró, funk) | the stylized rhythmic cell | the swing of a live roda, a real accordion, the tamborzão with the MC's voice | Brazilian audience of the genre: yes |

**When the audience will notice the difference, the first option to offer is the user's own music, or music from one of the product's artists, with permission** (the "I have the music" path, §6). People who live off music usually have tracks: the nightclub has its residents, the school has its students and teachers, the festival has its line-up. Synthesis in the right genre comes as the second option, with the limit stated in one line ("it is a synthesized ‹genre›, at the right tempo and groove, but it does not have the timbre of a produced track"). For everything else, synthesis is the normal path. Never propose, for this audience, a soundtrack outside its genre just because the synthesis of that genre is limited.

## 3. Style catalog

The timbre functions are in `assets/audio/synth.py` (full list in `API.md`). "Build it in the arrangement" means assembling the sound from the primitives (`saw`, `tone`, `noise`, filters, envelopes) inside `arranjo.py` when there is no ready-made function.

The last column says what a series identity declares (`"versao": 2`, §9) to sound like the genre: the `groove` and the `bumbo` (and, where it matters, the bass, the swing and how much the bed ducks). "Own arrangement" means the series does not have that groove ready: for that style, compose each piece with the prompt from §4, or prefer the user's music (§2.1). The BPMs are genre convention: put their range in `bpm`.

**Electronic**

| Style | BPM | Mood / use | Timbres and recipe | In series v2: groove · kick |
|---|---|---|---|---|
| Background electronic (bed) | 95–110 | B2B, SaaS, tutorial, lots of text | long `pad_note`, eighth-note bass with a dark `bass_note`, light `hat` and `shaker`, rare `pluck` on the cuts; no drop, subtle sidechain | `reto` or `house` · `eletronico` · `cede_db` 2–3 |
| Ambient | 60–90 | premium, wellness, architecture | `pad_coral`, `bell`, sparse `piano`, sub, `fita` and `vinil` as texture; silence is an instrument | no kick (percussion only `shaker`) · `cede_db` 0 |
| Deep house | 118–124 | fashion, lifestyle, elegant fintech | round 4/4 kick on every beat, open hi-hat on the offbeat, clap on 2 and 4, round offbeat bass, m7/m9 chords on `orgao` or `epiano`, `shaker`, the bed ducks for the kick | `"genero": "house"` → `house` · `house` · bass `contratempo` |
| Tech / minimal house | 124–128 | tech, events, "smart" product | dry kick, short repeated bass, `tick`/`pop`/`aro` as percussion, little harmony | `house` · `garage` (dry) · bass `rolante` |
| Electronic pop / future bass | 120–128 or 140–150 (half-time) | consumer apps, cheerful launch | `supersaw_note`, `pluck`, `pling`, vocal chops with short `pad_coral`, drop | `house` · `house` · `cede_db` 6–8 (the pumping is part of the genre) |
| Synthwave | 100–118 | games, nostalgia, tech | `supersaw_note`, sixteenth-note arpeggio, octave bass, snare with lots of reverb | `reto` · `eletronico` |
| Lo-fi / chillwave | 75–90 with swing | creative, study, café | `epiano`, `vinil`, `fita`, soft `baixo808`, soft kick and snare | `meio_tempo` or `leve` · `acustico` · swing 0.1–0.2 |
| Liquid drum & bass | 170–174 | sports, speed, fluid tech | fast breaks (kick, snare, `hat`), wide pad, sub; it can drop to half-time in the calm parts | `"genero": "break"` → `break` · `break` (bpm 170–174) |
| UK garage / 2-step | 130–134 | young, urban, fashion | sixteenth-note swing, kick off the downbeat, chopped bass and `pad_coral` |
| Glitch / IDM | 90–140 | AI, dev tools, data | tight grid with micro-events (`tick`, `pop`, bursts of filtered `noise`), cold pads | own arrangement (no ready-made groove) |
| Dark techno | 125–135 | gaming, night, aggressive fintech, nightclub | heavy kick on every beat, rumble (low tail after the hit), open hi-hat on the offbeat and closed in sixteenths, short repeated-note bass (`baixo_serra`), a dub chord with delay | `"genero": "techno"` → `techno` · `techno` · bass `rolante` |
| Trap / phonk | 130–145 (half-time) | gaming, streetwear, sports | `baixo808` with glide, hats in triplets and rolls, `palma_seca`; phonk: cowbell (build it in the arrangement: 2 detuned square waves, 540 and 800 Hz, with a short decay) | own arrangement (triplets and rolls are not in the series) |
| Chiptune / 8-bit | 120–160 | indie games, humor, nostalgia | square wave (build it in the arrangement: `saw(f) - saw(f, fase+0,5)`), fast arpeggios, short noise as percussion | own arrangement |

**Organic and instrumental**

| Style | BPM | Mood / use | Timbres and recipe | In series v2: groove · kick |
|---|---|---|---|---|
| Warm acoustic | 90–110 | family, health, NGO, handmade | fingerpicked `corda` (acoustic guitar), `piano`, claps, `shaker`, `bell` | `"genero": "acustico"` → `leve` · `acustico` |
| Emotional piano | 60–90 | tribute, cause, health | `piano` + `cordas_orq` coming in slowly, a pause before the ending | no kick |
| Cinematic / epic | 80–100 (or half-time) | big launch, luxury, sports | `cordas_orq` in ostinato, `metais`, `impacto_cinema`, low taiko-like `tom`, `riser` | own arrangement |
| Jazz / lounge | 90–130 with swing | food, hotel, casual luxury | `epiano` or `piano` with 9th/13th chords, walking bass (dark `bass_note`), swung `prato_ride`, `shaker` as brushes | `leve` · `acustico` · timekeeping on `prato_ride` |
| Rock / indie | 110–150 | drinks, sports, energy | guitar (build it in the arrangement: `corda` + strong `tanh` saturation + low-pass), kick, snare, `crash`, eighth-note bass | `reto` · `acustico` · backbeat on `snare` |
| Funk / disco / nu-disco | 110–122 | fashion, retail, party | octave bass, muted guitar (very short `corda`), `metais`, claps, open hi-hat on the offbeat | `house` · `house` · bass `contratempo_oitava` |

**Brazil and the world**

| Style | BPM | Mood / use | Timbres and recipe | In series v2: groove · kick |
|---|---|---|---|---|
| Bossa nova | 120–140 (felt in 2) | Brazilian premium, café, tourism | `corda` with 7th/9th chords in a bossa strum, `shaker`, `aro`, bass on beats 1 and 3 | `contratempo` · `acustico` |
| Samba / pagode (stylized) | 90–100 (or double-time) | popular brand, party, food | `tamborim`, surdo (low `tom` on beat 2), pandeiro (`shaker` + `aro`), cavaquinho (high, bright `corda`) | own arrangement |
| Forró / baião | 110–130 | Brazil's Northeast, São João, regional | zabumba (low `tom` + `aro`), triangle (build it: short high `bell`, muted on the beat), accordion (`orgao` with vibrato) | own arrangement |
| Brazilian funk (stylized) | 125–130 or 150 | young Brazilian audience | tamborzão pattern with kick and `palma_seca`, `baixo808`; only if the brand fits that universe | own arrangement (tamborzão is not in the series) |
| MPB / acoustic pop | 80–110 | warm Brazilian brands | `corda`, `piano`, light percussion, singable melody on `pluck` or `bell` | `"genero": "acustico"` |
| Amapiano | 110–115 | fashion, music, young | log drum (build it: sine with a 1-octave pitch drop in 80 ms + resonant low-pass), constant `shaker`, jazzy `piano` | own arrangement (log drum) |
| Afrobeats | 100–110 | lifestyle, young, global | `conga`, `shaker`, `aro`, syncopated bass, `corda` in a short riff | own arrangement |
| Reggaeton / dembow | 90–100 | Latin America, party | dembow pattern (kick on every beat, `aro` or `palma_seca` in 3+3+2), `baixo808`, pad | own arrangement (dembow is not in the series) |
| Lo-fi hip hop / boom bap | 85–95 with swing | creative, street, podcast | heavy kick and snare with swing, `epiano` or `piano` in a loop, `vinil` | `sincopado` or `meio_tempo` · `break` · swing 0.1–0.2 |

Mixing is allowed and often gives identity ("bossa with a background electronic pulse", "cinematic that turns into house at the drop"). Write the mix down in the music direction.

## 4. Composer subagent prompt

Launch it in the background (Agent, `run_in_background: true`) when the music and the script are defined. Fill in what is between ‹›:

- **Series** (several videos of the same product): do not use this prompt for each piece. Decide the identity once and generate each piece with `arrange_series.py` (§9).
- **Sound effects** (tap, click, typing, flip, whoosh, success, riser, impact) come from `sounds.py` (§8). The composer does not recreate them.

```
You will compose and synthesize FROM SCRATCH the original soundtrack of a ‹duration› s video for ‹product› (‹what it is, in one line›),
audience ‹audience›, platform ‹where it runs›.
What this audience listens to: ‹genre(s)› — conventions it recognizes: ‹tempo, groove, kick, bass›; what would sound
fake to it: ‹…›. The genre is not negotiable through the role: in the background, the arrangement loses layers and volume, not the genre.
Music direction chosen by the user: ‹role: background | lead› · ‹style/mix› · ‹BPM› · ‹key/mode› ·
timbres ‹3-5 timbres› · mood ‹words›. ‹If there is a reference from the user: "the user mentioned ‹reference› — capture
the style (tempo, timbres, groove), without copying melody, lyrics or hook">
This music belongs to this video only: do not reuse harmony, melody, structure or timbres from examples
(api_example.py only shows the API, not a style).

Folder: ‹project›/audio (it already has synth.py, sounds.py, verify.py and sheet.json). Do not touch any git repository.
The marker sound effects (tap, click, typing, flip, whoosh, success, riser, impact) come from sounds.py:
sons.colocar(itens) after leveling the bed. Do not recreate these sounds; compose the music around them.
Read ‹$SKILL›/assets/audio/API.md and the style's row in ‹$SKILL›/references/soundtrack.md §3 before writing.
Python: create the venv in ‹project›/audio/.venv and install numpy + scipy
(‹macOS/Linux: python3 -m venv .venv && .venv/bin/pip install numpy scipy | Windows: py -3 -m venv .venv; .venv\Scripts\pip install numpy scipy›).

Write audio/arranjo.py (import synth; synth.configurar('sheet.json'); from synth import *), with your own harmony, melody,
drum patterns, automation, loudness targets per bus and mixdown. Build in the arrangement the instruments the
style asks for and the library does not have. Everything in sheet.json is a contract: exact duration, digital silences, fade,
and a dedicated sound starting at the exact sample of each marker (place(..., event=True)). If the soundtrack is "background",
the marker sounds are discreet accents, and the arrangement leaves room for reading.

Structure (sheet sections): ‹sections with energy and description›
Markers: ‹table: time · on-screen event · requested sound›

Quality: no aliasing (use the library's oscillators), attacks and releases without clicks (ramp ≥ 1 ms starting at
zero), low end < 120 Hz in mono, reverb and delay through the sends, sidechain only when the style asks for it.

Verify for real before reporting:
1. .venv/bin/python arranjo.py → generates the wav named in "saida".
2. .venv/bin/python verify.py sheet.json ‹output›: it has to exit with code 0.
3. Spectrogram (ffmpeg -i ‹output› -lavfi showspectrumpic=s=1920x1080 espectro.png): LOOK for aliasing,
   clicks or a section without the expected energy.
4. Run it twice and confirm the same hash (determinism).
Short report in the user's language: path of the wav, measured LUFS and true peak, markers with deviation, instrumentation per
section and honest limitations (you do not listen — do not say it "sounds great"; say what was measured and what only an ear can judge,
and what synthesis cannot reach in this genre, references/soundtrack.md §2.1).
```

While the subagent works, you do the scenes. When it finishes, run `verify.py` yourself and look at the spectrogram before the draft.

## 5. `sheet.json`, the contract with the image

It lives in `<project>/audio/sheet.json`, created by `new-project.mjs`. Fill it in together with the script:

```json
{
  "titulo": "Video name", "duracao": 30.0, "bpm": 100, "compasso": 4, "taxa": 48000,
  "saida": "soundtrack.wav", "loudness_lufs": -14.0, "teto_dbtp": -1.5, "semente": 4242,
  "silencios": [[14.2, 14.4]],
  "fade": [28.0, 30.0],
  "secoes": [{ "nome": "gancho", "de": 0, "ate": 2.4, "energia": "baixa", "descricao": "logo draws itself in a stroke" }],
  "marcos": [
    { "t": 0.6, "evento": "first stroke of the logo", "som": "low pluck", "opcional": false },
    { "t": 14.4, "evento": "whole screen changes color", "som": "kick + crash + sub", "opcional": false }
  ]
}
```

- The times fall on the grid: multiples of 60/BPM, or fractions of that.
- `silencios` becomes exact digital silence, and `finalize.mjs` checks that it survived AAC.
- In a background soundtrack, leave `silencios` empty or very short, and mark as `opcional` the accents that sit underneath.
- A marker with `"efeito": "toque"` (and `nivel`, `dur`, optional parameters) gets a sound from `sounds.py` at the exact sample (§8). Full schema in `API.md`.
- With voice, `compose.mjs` (tutorial) and `scripts/chapters/assemble.mjs` (chapters) add a `voz` block to this sheet
  (`references/voice-mix.md` §2). Without that block, the mix is the one on this page.

## 6. The user's reference or finished track

- **"I want something like song X":** describe what characterizes X (tempo, genre, timbres, groove, mood) and compose something **original** with those qualities. Do not reproduce melody, lyrics, hook or sample. Tell the user so in one line.
- **"I have the music":** the rights are the user's. Do not download music from the internet.
  - Find out the BPM and the first downbeat: ask or measure it (spectral flux in numpy and autocorrelation between 60 and 180 BPM).
  - Build the scenes on its grid. `sheet.json` now *describes* the music's timings.
  - Cut it to the duration with a fade: `ffmpeg -t ‹dur› -af afade=t=out:st=‹dur-2›:d=2`.
  - `finalize.mjs` still mixes and verifies.

## 7. Did the image change? Retime the soundtrack

- Changed a timing in `scenes.js`? Update `sheet.json` right away.
- Subagent running: send the new markers with SendMessage ("SHEET CHANGE: … before X, now Y") and ask it to redo the verification.
- Subagent already finished: adjust the timings in `arranjo.py`, run it and verify.

## 8. Sound effects

`assets/audio/sounds.py` generates the interface and transition sounds on the fly, on top of `synth.py`. It is deterministic by seed, and each repetition varies a little: ten taps never sound identical.

| sound | when | anchor | default level |
|---|---|---|---|---|
| `toque` | finger on the screen | starts at t | −6 dB |
| `clique` | mouse (press and release) | starts at t | −6 dB |
| `digitacao` | text being typed (`dur` or `teclas`; laptop, mechanical or touchscreen) | 1st key at t | −10 dB |
| `virada` | page or card flipping | starts at t | −4 dB |
| `whoosh` | transition, cut | peak at t | −3 dB |
| `sucesso` | saved, confirmed (tuned to the key) | starts at t | −2 dB |
| `riser` | rise up to a moment | ends at t | −4 dB |
| `impacto` | logo, closing | starts at t | 0 dB |

- **Level** is in dB relative to the music bed, not absolute. The defaults serve a tutorial's background soundtrack: present and underneath the music. In a lead soundtrack, raise them by 2 to 4 dB.
- **In the sheet:** put `"efeito": "<sound>"` in the marker. With `arrange_series.py`, that is enough. In your own arrangement, build the list and call `sons.colocar(itens)` after leveling the bed and before `retornos`.
- **A required marker only with a dry-attack sound.** Whoosh (peak) and riser (end) go with `"opcional": true`, or share the instant with an impact or a tap.
- **The bed makes room on its own.** If the effect will not stand out over what is playing at that instant, `colocar` makes the bed duck by 2 to 10 dB ahead of time (sidechain with lookahead) and logs it.
- **Verify:** `python sounds.py --verify --out <folder>` and look at `catalog-spectrum.png`.
- **With voice,** the effects that land under a line follow `references/voice-mix.md` §4: taps, clicks and typing keep
  their level; transitions, accents and impacts go down 6 dB.

## 9. Series soundtrack

A series is the case of 12 tutorials of the same app, or of a campaign with several pieces. The identity belongs to the series. The music belongs to each piece.

1. **Identity, once:** research and ask as in §1–2, starting with what the audience listens to. Then write `identity.json` at the root of the series. Full schema in `API.md`. A new series uses `"versao": 2`, because only that version can declare a genre:
   - `genero` (`acustico`, `break`, `garage`, `house`, `techno`) fills in what the genre asks for; or declare it field by field;
   - `groove`: the grooves the series accepts (the seed only chooses among them), and `bumbo`: the kick timbre;
   - `padrao_baixo` and `padrao_harmonia`: the accepted patterns (house's offbeat, techno's repeated note, the stab);
   - `cede_db`: how much the bed ducks for the kick (0 in acoustic, 3 in break, 4 in garage, 4–6 in house, 5–8 in techno);
   - `papel`: background or lead, which now changes level, density and room **within** the genre (§2);
   - `bpm`: the genre's range (a calm acoustic 80–96, house 120–126, drum & bass 170–174…). The adjusted tempo of each piece stays inside it.

   An identity without `"versao"` is still valid and composes sample by sample as before. But it chooses the groove by density and has only one kick, and so it cannot ask for a dance-floor genre.
2. **One seed per piece.** It can be the episode number. Neighboring seeds never repeat the key; `series.py --test identity.json` shows the guaranteed window. `series.py --show identity.json 1` shows what the seed chose (groove, kick, bass, harmony).
3. **Each piece:** `sheet.json` with sections (opening, screen, closing), markers with `efeito`, `"identidade": "../identity.json"` and `loudness_lufs` −18 for background. Run `python arrange_series.py identity.json sheet.json`.
   - The seed decides key, BPM, progression, harmonic rhythm, motif, groove, voicings and timbres, within the identity.
   - The sheet's BPM is ignored.
   - The video's events can fall off the grid: the effects go at the exact sample and the music follows its own grid. The four-on-the-floor does not lose time because of an event.
4. **Verify each piece:** `verify.py` (code 0) and spectrogram. In a dance-floor genre, check in the spectrogram that the kick marks every beat in the low end and that the hi-hat shows up on the offbeats. Tell the user that nobody listened: measuring that there is a kick on the beat does not prove that the kick is good.
5. **Prove that the pieces differ:** `python series.py --compare pecaA/sheet.json pecaB/sheet.json`. It has to pass: different key or BPM, different progression and motif, and chroma similarity < 0.85.

Never stretch the same soundtrack to another duration. The same seed on different sheets is that defect, and `--compare` fails it.
