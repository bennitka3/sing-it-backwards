# Sing It Backwards

A two-room party game based on the backwards-song challenge on The Traitors. It's a plain website: it runs in any
browser, installs nothing and has no server, so it works on locked-down work computers.

- **Room 1 (the singer)** draws a secret song, hears it **played backwards**, records themselves copying those
  backwards sounds, and saves the recording.
- They drop the file in the team chat (Teams, Slack, email). The answer is hidden inside it.
- **Room 2 (the wall)** opens the file, plays it **flipped**, which turns the gibberish back into something like the
  real song, and pins one of the song cards on the wall. The page says if they got it right.
- **Host** records the pop songs once and puts them on the site, so players download nothing.

Songs: 6 nursery songs with a built-in tune (Twinkle Twinkle, Mary Had a Little Lamb, Row Row Row Your Boat, London
Bridge, Old MacDonald, Happy Birthday) and 6 iconic pop songs (Don't Stop Believin', Y.M.C.A., Sweet Caroline, Bohemian
Rhapsody, Livin' on a Prayer, Dancing Queen). Every song is a card on the wall; the host can add more cards.

## Putting it online (once)

The site is the files in this folder. GitHub Pages hosts it for free:

1. The files go in a **public** GitHub repo (Pages on a private repo needs a paid plan).
2. In that repo: Settings → Pages → "Deploy from a branch" → `main`, folder `/ (root)` → Save.
3. After a minute the site is at `https://bennitka3.github.io/<repo-name>/`.

Browsers only allow the microphone on `https://` links, which GitHub Pages gives you.

Nothing is uploaded by players: the recordings stay on the players' computers and in your chat. The public part
is the game and the host's song pack.

## Before the game: the pop songs

Every sample is the first 7 seconds of the chorus. Nursery songs have a built-in tune. Pop songs have no audio
until the host adds some, because the site is public and can't hold copies of the real records. On the Host page:

1. For each pop song, press **Record clip** and sing from the start of the chorus. It stops by itself after 7
   seconds. (Or load an audio file of your own singing and set "Chorus starts at".)
2. Untick "In the draw" for any song you don't want dealt; it stays on the wall as a decoy.
3. Press **Save song pack**, then upload `pack.json` on the repo's upload page
   (github.com/bennitka3/sing-it-backwards/upload/main) and press "Commit changes".

About a minute later every Room 1 has those songs. Without a `pack.json`, Room 1 draws the nursery songs.

## Tips

- Room 1 should wear headphones, so the backwards song doesn't leak into the recording.
- The built-in nursery tunes are a hummed melody with no words. A clip of a real voice singing the words is harder and
  funnier; record your own over any built-in tune on the Host page.
- If the microphone is blocked on a work computer, check the address-bar icon. If IT has switched it off for
  websites, that person can be in Room 2 instead.

## For developers

No dependencies, no build. `npm start` serves the folder at http://localhost:3000. `npm test` plays two whole rounds
in Chromium with a fake microphone, passing the files between rooms (needs Playwright). Song list: `songs.js`.
