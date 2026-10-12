# After Hours — Club Edition

A Discord Activity party game with 800 curated questions, a 1–100 board mode, procedural club ambience, synthesized game sound effects, and a neon lounge interface.

## What changed in this build

- Preserves the previously working Discord Activity startup guard.
- Pins Tailwind CSS to **3.4.17** to avoid the Tailwind 4/PostCSS breakage encountered during setup.
- Adds a club-style animated background and glass UI.
- Adds Settings for music, SFX, volume, and reduced motion.
- Adds original browser-generated deep-house ambience using Web Audio. No external music files or licenses are required.
- Adds synthesized dice, tile-step, landing, card-reveal, click, and win sounds.
- Animates board pieces one tile at a time after a dice roll.
- Adds destination-tile feedback and a winner overlay.
- Keeps the 800-question JSON database intact.

## Install

```powershell
npm install
```

Do **not** run `npm audit fix --force`; it can upgrade Tailwind to v4 and break this project.

Copy `.env.example` to `.env` and set:

```dotenv
VITE_DISCORD_CLIENT_ID=YOUR_DISCORD_APPLICATION_ID
```

Only add `DISCORD_TOKEN` locally if you need to run the one-time Activity registration script.

## Run locally

```powershell
npm run dev
```

## Build

```powershell
npm run build
npm run preview
```

The production output is `dist/`.

## Discord Activity registration

The existing launcher is intentionally age-restricted. Run only if the Entry Point is missing or needs repair:

```powershell
npm run register:activity
```

Because the launcher is NSFW, Discord must launch it from an age-restricted channel.

## Cloudflare Pages

Recommended settings:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_DISCORD_CLIENT_ID`

Then update the Discord Activity URL Mapping target from your temporary tunnel hostname to your permanent `*.pages.dev` hostname.

## Audio

This build does not depend on MP3 files. `src/lib/audioManager.ts` creates the background groove and SFX with the browser Web Audio API. That makes development self-contained and avoids third-party music licensing or broken asset URLs.
