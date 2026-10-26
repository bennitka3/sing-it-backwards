# Sing It Backwards: notes for Claude

A static party game site (plain HTML/JS, no build, no server) served by GitHub Pages from `main`, folder `/`.
Owner: ben (GitHub `bennitka3`), not an engineer: explain in plain language, verify before saying it works.
It must work on locked-down work computers: nothing to install, no third-party services; recordings and song packs
travel as files through the players' own chat. Why: `docs/DECISIONS.md`.

- Pages: `index.html` (lobby), `room1.*` (singer), `room2.*` (wall), `host.*` (song pack maker). Shared code:
  `audio.js` (reverse, synth, mic to WAV, the scrambled answer chunk, browser storage), `deck.js`, `songs.js`.
- Use relative paths only (the site lives at `/sing-it-backwards/`).
- Never commit copyrighted audio: pop clips come only from the host's own song pack.
- Test: `npm install --no-save playwright` then `npm test` (two full rounds in Chromium with a fake mic).
  `npm start` serves it at http://localhost:3000.
