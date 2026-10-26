# Sing It Backwards: notes for Claude

A static party game site (plain HTML/JS, no build, no server) served by GitHub Pages from `main`, folder `/`.
Owner: ben (GitHub `bennitka3`), not an engineer: explain in plain language, verify before saying it works.
It must work on locked-down work computers: nothing to install, no logins for players. Recordings go live to Room 2
through a free Firebase database (`live.js`, `firebase-config.js`, `firestore.rules`, setup in `docs/LIVE-SETUP.md`);
when that's off or blocked, they go as files through the players' chat. Why: `docs/DECISIONS.md`.

- Pages: `index.html` (lobby, makes game codes), `room1.*` (singer), `room2.*` (wall). Shared code: `audio.js`
  (reverse, synth, mic to WAV, the scrambled answer chunk, browser storage), `deck.js`, `songs.js`, `live.js`.
- Use relative paths only (the site lives at `/sing-it-backwards/`).
- Songs are public-domain tunes only (ben dropped pop songs, 2026-10-26). Never commit copyrighted audio.
- Test: `npm install --no-save playwright` then `npm test` (whole rounds in Chromium with a fake mic and a stand-in for Firebase).
  `npm start` serves it at http://localhost:3000.
