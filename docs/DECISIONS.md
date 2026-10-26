# Decisions

## 2026-10-26: songs built into the site; 7-second chorus samples

ben: "Can we do this without any end users having to download song files? Can they be pre-loaded? And let's have the
samples only be 7 seconds of the beginning of the chorus of the songs."

- **The song pack lives on the site** as `pack.json` (the host saves it on the Host page and uploads it to the repo).
  Room 1 loads it automatically; players download nothing. Room 1 recordings still travel through the chat, since
  there's no server.
- **Every sample is 7 seconds** from the start of the chorus. Host recordings stop by themselves at 7 s; nursery tunes
  were sped up to fit their famous first line into 7 s (nursery songs have no chorus).
- **Pop samples are the host's own singing, never the real records.** The site is public, and putting commercial
  recordings on it would be copyright infringement. Claude also doesn't write out pop melodies as built-in tunes:
  from memory the notes would likely be wrong, and a wrong tune makes the round unwinnable.


## 2026-10-26: no server; GitHub Pages; files through the team chat

ben: "this needs to work on locked down work machines, so a brew install is off the table… any app install is
probably off the table. they can see public github pages though if that works."

- **Static site on GitHub Pages,** no server and nothing to install. Replaces the Node server + tunnel.
- **Recordings travel as a file through the chat the players already use.** It's the one channel a locked-down
  machine is sure to allow. The answer, the wall and (for pop songs) the real clip ride inside the WAV, scrambled so
  opening the file doesn't give it away.
- **Rejected: a free public relay (e.g. ntfy.sh)** for automatic sending. It's a third party holding voice recordings,
  work firewalls often block such sites, and it couldn't be tested from Claude's sandbox.
- ~~**Pop clips go to Room 1 as a song-pack file from the host.**~~ Superseded the same day: the pack now lives on the site (above).
- **Needs a public repo** for free Pages; Claude can't create repos (403), so ben creates it.


## 2026-10-26: first build

What ben asked (thinking out loud, paraphrased): a web app that plays 3 to 5 childhood/nursery songs backwards; players
sing into it and it flips the recording so others can tell which song it is. Then: "should we also do pop songs… a
mix… really iconic songs that everybody knows, like Don't Stop Believin' or YMCA." Two users, two pages: Room 1 hears
the sample backwards and records themselves; the recording goes to Room 2, which plays it forward and finds the song
"on the wall" by clicking a card, like the Traitors episode. "It's got to be done virtually."

Decided while building (Claude's calls; change any of them):

- **Mix of songs:** 6 nursery + 6 iconic pop, all 12 on the wall. The round uses whichever are "in the draw".
- **Room 2 picks a card** (not typing the title, not singing): matches the Traitors wall and is quick on a phone.
- **One guess per recording,** then the answer is revealed and Room 2 can hear the real song.
- **The singer never sees the title** (it says "Secret song #3"), and can redraw if they get one they hate.
- **Pop songs need a clip from the host** (record yourself or upload a file you own). Shipping commercial recordings
  would be copyright infringement; nursery songs and Happy Birthday are public domain, so they get a built-in tune.
- **Built-in tunes are melody only** (a synthesized "ooh" voice). Browsers can't record their own text-to-speech, so
  words need a human recording.
- ~~**Runs as a small Node app on ben's Mac, shared with a free Cloudflare tunnel.**~~ Superseded the same day (above). A claude.ai artifact would have given a
  link with no setup, but artifacts can't use the microphone, and the microphone is the game.
- **Lives in `research-testing/apps/backwards-songs/` for now,** because this session couldn't create a new GitHub repo
  (403). Move it to its own repo when ben creates one.

Open questions for ben: how many songs per round (3 to 5 was the first idea; the app doesn't cap it), scoring between
teams, and whether Room 2 should also have to sing.
