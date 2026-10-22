# Deendayal Verma: Portfolio

Static site: plain HTML, CSS and JS with no build step. GSAP, ScrollTrigger, SplitText, Lenis and all fonts are bundled in `assets/`, so nothing loads from a CDN.

## Run it locally

Use any static server from this folder:

```bash
npx serve .            # or: python -m http.server 5173
```

Then open the printed URL. Opening `index.html` by double-click mostly works, but some browsers block fonts and video on `file://`, so use a server.

## Deploy

- **Vercel / Netlify:** drag this folder in (or connect the repo). No build command, and the output directory is the folder root.
- **GitHub Pages:** push the folder and enable Pages on the branch.

## Pages

| File | What it is |
|---|---|
| `index.html` | Home: intro video → name morph → portrait, about, git-graph journey, 3 case cards, more builds, client work, stack, proof, contact |
| `work/sarra.html` | SARRA case study (map, architecture, VAPT audit, migration) |
| `work/yatrimap.html` | YatriMap case study (live impact numbers, TouristGo flow, raft pool, payments, reel) |
| `work/hackbytecodex.html` | HackByteCodex case study (hierarchy, geofenced QR, judging, tiers, API platform, emails) |

## Where to edit things

- **Text and links:** directly in the HTML files.
- **Journey timeline:** the `<li class="commit">` items in `index.html`. Year and label per row are in `initJourney()` in `assets/js/home.js` (`YEARS`, `LABELS`, `BR` for branch lanes).
- **"Where I've used it" skill map:** `GROUPS` and `P` in `initStack()` in `assets/js/home.js`.
- **Terminal demo commands:** `CMDS` in `initCli()` in `assets/js/home.js`.
- **Résumé PDF:** replace `assets/docs/Deendayal_Verma_Resume.pdf` (keep the name, or update the links).
- **Colours and fonts:** CSS variables at the top of `assets/css/base.css`.

## Scene engines

`assets/js/lib/` holds deterministic `draw(t)` scenes. Each scene starts when it scrolls into view and pauses off-screen.

- `sarra.js`, `yatri.js`, `toon.js`, `uk-map-data.js`: from your SARRA and YatriMap kits.
- `hbc.js`: HackByteCodex scenes, modelled on the real backend logic (roles, `POST /qr/attendance` with a 30 s JWT and a 500 m haversine check, `score.locked`, `API_TIER_LIMITS`).
- `assets/js/kit.js`: vanilla ports of the kit's SpotlightReveal, ScrollWalker and CursorBuddy.

## Behaviour notes

- The full intro video plays once per browser session, and later visits get a short intro. A fresh load or reload always starts on the hero. Only the in-site "All work" link jumps straight to `#work`.
- The site uses the normal system cursor. The background grain is static, so it costs nothing while scrolling.
- Phones and portrait screens get the vertical push-reveal video. Landscape screens get the wide one, letterboxed so the name is never cropped.
- `prefers-reduced-motion` turns off the intro video, smooth scroll and scene animation, and shows each scene's final state.
- The YatriMap rating and impact board read `https://api.yatrimap.com/public/impact` live and fall back to the 22 Oct 2026 snapshot.
