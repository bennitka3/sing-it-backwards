# Sing It Backwards

A two-room party game based on the backwards-song challenge on The Traitors. It's a plain website: it runs in any
browser, installs nothing, and players never log in.

- The host presses **Start a new game** in the lobby and shares two links (they carry the game code).
- **Room 1 (the singer)** draws a secret song, hears it **played backwards**, records themselves copying those
  backwards sounds and presses **Send**.
- **Room 2 (the wall)** sees the recording pop up by itself, plays it **flipped** (the gibberish turns back into
  something like the song) and pins one of the cards on the wall. The page says if they got it right.

Songs: 10 public-domain nursery songs, each a built-in tune of its famous first line (about 7 seconds): Twinkle
Twinkle, Mary Had a Little Lamb, Row Row Row Your Boat, London Bridge, Old MacDonald, Happy Birthday, Frère Jacques,
Jingle Bells, The Itsy Bitsy Spider, Hot Cross Buns.

The host is Alan Cumming: a cutout of a CC BY 2.0 photo (Scottish Government, via Wikimedia Commons) on drawn
outfits, popping up with a line at key moments.

Live sending uses a free Firebase database the host sets up once: `docs/LIVE-SETUP.md`. Until then, or on a network
that blocks it, Room 1's recording is saved as a file to pass on through your chat.

## Putting it online (once)

The site is the files in this folder. GitHub Pages hosts it for free:

1. The files go in a **public** GitHub repo (Pages on a private repo needs a paid plan).
2. In that repo: Settings → Pages → "Deploy from a branch" → `main`, folder `/ (root)` → Save.
3. After a minute the site is at `https://bennitka3.github.io/<repo-name>/`.

Browsers only allow the microphone on `https://` links, which GitHub Pages gives you.

Recordings are kept only in the game's Firebase database, under the game code.

## Tips

- Room 1 should wear headphones, so the backwards song doesn't leak into the recording.
- The built-in tunes are a hummed melody with no words, so Room 1 copies a melody, not lyrics.
- If the microphone is blocked on a work computer, check the address-bar icon. If IT has switched it off for
  websites, that person can be in Room 2 instead.

## For developers

No dependencies, no build. `npm start` serves the folder at http://localhost:3000. `npm test` plays whole rounds in
Chromium with a fake microphone and a stand-in for Firebase (needs Playwright). Song list: `songs.js`.
