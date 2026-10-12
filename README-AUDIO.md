# After Hours — Club Edition

A Discord Activity party game with 800 curated questions, a 1–100 board mode, a neon lounge interface, background club music, and responsive game sound effects.

## What changed in this build

- Preserves the previously working Discord Activity startup guard.
- Pins Tailwind CSS to **3.4.17** to avoid the Tailwind 4/PostCSS breakage encountered during setup.
- Adds a club-style animated background and glass UI.
- Adds Settings for music, SFX, volume, and reduced motion.
- Uses the supplied club loop as the default background soundtrack.
- Uses supplied sound effects for dice rolls, tile steps, landings, card reveals, menu clicks, and wins.
- Keeps lightweight synthesized audio as an automatic fallback if a media asset cannot play.
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

Production audio lives in `public/audio/`:

- `club-loop.mp3` — looping background music
- `button-click.mp3` — primary UI click
- `card-reveal.mp3` — question reveal
- `dice-roll.mp3` — dice animation
- `piece-step.mp3` — each board tile advanced
- `piece-land.mp3` — destination tile landing
- `win.mp3` — tile 100 victory

The uploaded WAV effects were transcoded to 48 kHz MP3 for much smaller deployment size while keeping the supplied sounds intact for gameplay. The club loop and click were already MP3 sources.

`src/lib/audioManager.ts` handles playback, per-effect leveling, music/SFX volume, polyphony for repeated board steps, and synthesized fallbacks if a file cannot be loaded.

Keep the source/license details for any third-party audio in `AUDIO_CREDITS.md` before distributing the Activity publicly.
