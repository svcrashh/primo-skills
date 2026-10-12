# Product and brand

The video has to look like it was made by someone who knows the brand from the inside, and who knows the people who use the product. Find out everything on your own before asking.

This file says where to look and what to extract. What you extract becomes the `reading.md` (`references/reading.md`), written before any decision: the product, the audience, the product's look, the audience's sound, the decisions with the why, the swap test and what could not be found out. Color, font and logo are the start. Someone who only collected those only has somewhere to put four colors, and the rest of the video comes out of the engine's default.

**Start with the script:** `node $SKILL/scripts/reading.mjs <repository> --out <folder>` collects the facts (colors with the place where each one is used, fonts, radii, border or shadow, surfaces, brand files, documents about audience and product, the vocabulary of the screens) and does not read secrets. The paths below are for going beyond what it found.

## Where to look (in order)

1. **The current conversation:** the user may have pasted colors, links, files or rules.
2. **The current project and its sibling folders:** another folder with `brand`, `-brand-kit`, `site` or `ui` in its name usually has the brand.
   ```sh
   # logos, kits and manuals (ignore node_modules/dist/android/ios)
   find . .. -maxdepth 4 \( -path '*/node_modules' -o -path '*/dist' -o -path '*/android' -o -path '*/ios' \) -prune -o \
     \( -iname '*logo*' -o -iname '*brand*' -o -iname '*marca*' -o -iname '*simbolo*' -o -iname '*symbol*' -o -iname '*presskit*' \) -print
   ```
   - Windows (PowerShell): `Get-ChildItem -Recurse -Depth 4 -Include *logo*,*brand*,*marca* | ? FullName -notmatch 'node_modules|dist'`.
   - Look for: `public/brand*`, `docs/brand`, `assets/logo*`, `favicon.svg`, color tokens (`tokens.css/json`, `tailwind.config`, `index.css` with `--cor`), fonts (`@fontsource*` in package.json, `@font-face`, Google Fonts in `index.html`) and a brand manual (PDF, a `/manual-marca` page, a voice-and-tone `.md`).
3. **The product's website:** take a full-page screenshot to see colors, typography and tone in use. Do this only with GET requests, without triggering forms or login.
   ```js
   await page.route('**/*', r => r.request().method() !== 'GET' ? r.abort() : r.continue())
   // pages that reveal on scroll: scroll in steps of ~400 px with a pause before the fullPage screenshot
   ```
4. **Project instructions:** CLAUDE.md, README and docs may carry rules about language, sensitive data and what the product refuses to do. That applies to the video's text.
5. **Who uses it:** vision, persona and research documents, plans and roadmap; the roles the system has (who logs in, what each one can do); the language, the register and the vocabulary of the screens; the landing page (who it speaks to). The audience is rarely in a file called "audience": it is spread across these sources.

## What to extract

- **SVG logo:** prefer the official vector (horizontal, vertical, symbol, negative version) over a PNG. Run `node $SKILL/scripts/logo.mjs logo.svg --js LOGO`:
  - `--split` splits compound paths (pieces, letters). Letter holes become loose parts; regroup them by `getBBox` before animating letter by letter.
  - Look at the result: how many parts, which colors, and whether the parts tell a story (pieces, layers, strokes) that can become the signature move.
- **Colors:** the official palette with name and hex, which is the light background and which is the dark one, and which is the emphasis color. Note the manual's proportion, if there is one.
- **Fonts:** the title and body families. Bring them with `fonts.mjs`: it looks in node_modules and, if it does not find them, in Google Fonts. A paid font that is not in the project: ask the user whether they have the file; otherwise, propose the closest free alternative and say so.
- **Elements:** official shapes (they go in `MARCA.formas`, paths in a 400×400 viewBox), patterns, icons, illustrations.
- **Brand voice (tone):** anchor phrases, slogan, words the brand uses and the ones it forbids.
- **Product:** screens, interface tokens (button color, radius, the app's font) and the features' vocabulary, to rebuild the UI in HTML.
- **Visual language, beyond the paint.** For each item, the evidence (`file:line`, screenshot):
  - surface: light or dark, and where each one appears (landing page, dashboard, app);
  - the **role** of each color: where it goes (page background, button, active item, alert), where it never goes and how it changes from one surface to another. Look at where each color is used, not only where it is defined;
  - typography: family, weight, case (upper or normal), letter spacing, the title size against the body size;
  - shape: radius, border or shadow, flat or with a gradient;
  - density, texture and grid, photography (is there any? of what? how is it treated?), motion (what the interface already does).
- **Audience:** who they are, what they do, where they will watch, what they would find fake, and what they listen to. Where the repository does not say, write down a guess or ask; never derive the audience from the product's name or color.

Build the `brand.js` with `cores`, `logo`, `simbolo` and `formas`. The color names stay as the brand calls them.

## When there is no brand

A new project, a brand still raw, a user who "just wants a video": do not invent an identity on your own. The reading still applies: the audience and the audience's sound exist even without a brand, and that is where the directions come from. In the briefing, offer 2 or 3 ready visual directions, each one with a palette, a Google Fonts font pairing and a shape style (organic, geometric, editorial). Use the product's name as a text wordmark. Make it clear that it is a provisional identity, just for the video.

## Respecting the brand

- The final logo is exact: proportion, colors, clear space and the right version for the background. Animating the parts arriving into place is allowed; the final frame cannot have distortion.
- Colors outside the palette only in neutral supporting tones.
- The manual's rules ("do not apply a shadow to the logo", "text always in color X") apply in the video.
- **The logo is the product's component, copied.** Read the repository's logo component (`BrandLogo`, `Logo`,
  `Header`…): the SVG it uses and how it writes the name (font, weight, `font-style`, case, color per letter,
  spacing). Reproduce it exactly, with the repo's SVG and the same class. Do not generate a PNG with a similar font: "you
  changed the logo's font" is the first thing the product owner notices.
- **The video's title in the class of the website's title.** If the CSS says `font-style: italic` on a font that has no italic
  file (the browser slants it by itself), write `italic` in the video's `font`: the render's Chromium slants it the same way. A
  `skewX` gives a different slant. Weight, `letter-spacing` and uppercase also come from the class.
- **The slogan is the product's,** word for word (the `<meta name="description">`, the hero, the `<title>`). Swapping a
  word of the slogan for a synonym is inventing.

## The brand's options

What the skill decided once about a brand and has to remember in the next video: `node $SKILL/scripts/brand.mjs show
"<brand>"` reads them and `set` saves them, in `~/Documents/VideoStudio/Brands/<brand>/brand.json`.

| Option | Default | When to change it |
|---|---|---|
| `openingLogo` | on | `--opening-logo off` when the person asks for the video to start on the content (a piece that plays inside another video, a channel that cuts the first second, a series whose episodes open on the title) |
| `closingLogo` | on | `--closing-logo off` only on request: a cut that goes inside another video, a loop |
| `slogan` | none | `--slogan "…"` when the reading found the brand's slogan (the site's hero, the `<title>`, the `<meta name="description">`) **and** the person wants it in the video. Word for word. `--slogan none` takes it out |
| `cta` | none | `--cta "…"` when the person wants a call to action at the end ("Download the app", the site's address). The words are theirs, or the product's own button |
| `language` | the product's | `--language pt-BR` when this brand's videos always go out in one language that is not the one of its screens |

The reading says what the brand has; the person says what goes in the video. A slogan that exists and that nobody asked
for stays out: asking "the site says '…': does it close the video?" costs one line and avoids both mistakes.

## Product screens: capture, reuse or recreate

In update, demo, launch and announcement the default answer is 3 (recreate), in the chapters format
(`references/chapters.md`): the real screen goes in only as proof, full screen. A whole screen shrunk inside the frame
becomes unreadable and is rejected, and **so is a still screenshot inside a panel** (catalog, rule 15): beautiful real screenshots,
placed as proof on each item, give a video that is "random, weird, all the same thing".
**Recreating with the real media** is the way: `scripts/extract-media.mjs` downloads from the public page (with the analytics
blocked) the images, the background video and the API's JSON, and the redraw uses the real artwork and data. Outside that,
decide on your own, in this order:

1. **Reuse:** screenshots, screen recordings or mockups that already exist (in the conversation, in the repo, in `docs/`, `presskit`, an app store). The most recent ones win.
2. **Capture from the running system:** when you can start the project locally or open the public website.
   - Find out how to run it from the README, from `package.json` (`dev`/`start` scripts) and from CLAUDE.md, and respect the project's ports and warnings.
   - Use Playwright to bring the screen to the right state (click, fill in with fictitious data) and capture at high resolution (`deviceScaleFactor: 2`). For motion, record the screen (`recordVideo`) or capture a sequence of frames.
   - In production, GET only: block the rest with `page.route`. Never submit a real form, purchase or message.
   - Login: use demo mode or a test account documented in the project. If there is none, ask the user. The password never goes in the chat: they log in and tell you.
   - Real people's data (names, e-mails, photos, documents) does not go in the video. Swap it for fictitious data in the interface or recreate the screen.
3. **Recreate in HTML (mock):** when the real screen is hard to reach, is confidential or would be unreadable in the format. Rebuild it with the product's tokens (colors, radius, font, spacing), use the features' real vocabulary and plausible fictitious data. It usually looks better than the screenshot: it animates in parts, stays sharp at any scale and adapts to 9:16.
4. **No screen:** a physical product, a service, an event, a personal brand. Use typography, shapes, icons, photos the user sends (`imagem()` + `kenBurns`) and visual metaphors of what the product does.

Media files go in `<project>/media/`. A recording becomes a sequence of frames for the engine (`clipe()`); see `engine.md`.
