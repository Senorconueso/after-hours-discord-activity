# After Hours — Music Loop Fix

This patch fixes the background club track stopping whenever a menu option is selected.

## Cause
The shared `audioManager.unlock()` routine ran on every UI interaction. Its preload step called `HTMLAudioElement.load()` every time, which resets and pauses a playing media element.

## Fix
- Audio assets are preloaded only once per app session.
- The existing `loop = true` behavior remains intact.
- If Discord/browser focus suspension pauses a previously-started track, the next interaction resumes it from its current position.
- Music still stops normally when the user turns Music off.

## Install
Copy `src/lib/audioManager.ts` over the same file in your working After Hours project, then restart Vite.
