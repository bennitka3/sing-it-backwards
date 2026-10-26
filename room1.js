import { $, play, stop, reverse, songAudio, Recorder, fmtTime, micAvailable, encodeWav, scramble, saveFile, toBase64, bufferToWav, kvGet, kvSet } from './audio.js';
import { defaultDeck, deckFromPack, isPack, playable, wallOf } from './deck.js';

let deck = defaultDeck();
let usingPack = false;
let draw = null;        // { song, number }
let backwards = null;   // AudioBuffer of the song, reversed
let take = null;        // { buffer, samples, sampleRate, seconds }
let recorder = null;
let timerId = null;

const nameInput = $('#player');
try { nameInput.value = localStorage.getItem('player') || ''; } catch {}
nameInput.addEventListener('input', () => { try { localStorage.setItem('player', nameInput.value); } catch {} });

function say(text, isError) {
  const m = $('#msg');
  m.textContent = text;
  m.classList.toggle('error', !!isError);
  m.hidden = !text;
}

// Round bookkeeping lives in this browser: which songs were dealt, and the running song number.
const getRound = () => { try { return JSON.parse(localStorage.getItem('round')) || { used: [], count: 0 }; } catch { return { used: [], count: 0 }; } };
const setRound = (r) => { try { localStorage.setItem('round', JSON.stringify(r)); } catch {} };

function showDeck() {
  const ready = deck.filter(playable).length;
  $('#deck-status').textContent = usingPack
    ? `Using the host's song pack: ${ready} song${ready === 1 ? '' : 's'} ready to draw, ${deck.length} cards on the wall.`
    : `Using the ${ready} built-in nursery songs. Load the host's pack for the pop songs.`;
  $('#clear-pack').hidden = !usingPack;
}

async function init() {
  const pack = await kvGet('pack');
  if (isPack(pack)) { deck = deckFromPack(pack); usingPack = true; }
  showDeck();
}

$('#load-pack').onclick = () => $('#pack-file').click();
$('#pack-file').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const pack = JSON.parse(await f.text());
    if (!isPack(pack)) throw new Error();
    await kvSet('pack', pack);
    deck = deckFromPack(pack);
    usingPack = true;
    showDeck();
    say('Song pack loaded.');
  } catch {
    say("That file isn't a song pack. Ask the host for the file their Host page saved (song-pack.json).", true);
  }
};
$('#clear-pack').onclick = async () => { await kvSet('pack', undefined); deck = defaultDeck(); usingPack = false; showDeck(); say(''); };
$('#new-round').onclick = () => { setRound({ used: [], count: 0 }); say('New round: every song is back in the draw and numbering restarts at 1.'); };

async function drawSong() {
  say('');
  stop();
  const pool = deck.filter(playable);
  if (!pool.length) return say('No songs are ready to draw. Load the song pack again, or go back to the built-in songs.', true);
  const round = getRound();
  const skipped = draw?.song.id;
  const notSkipped = pool.filter((s) => s.id !== skipped);
  const fresh = notSkipped.filter((s) => !round.used.includes(s.id));
  const from = fresh.length ? fresh : notSkipped.length ? notSkipped : pool;
  const song = from[Math.floor(Math.random() * from.length)];
  round.used.push(song.id);
  round.count += 1;
  setRound(round);
  draw = { song, number: round.count };

  $('#secret').textContent = `Secret song #${draw.number}`;
  $('#draw-empty').hidden = true;
  $('#drawn').hidden = false;
  $('#handoff').hidden = true;
  $('#play-back').disabled = true;
  $('#play-back').textContent = 'Loading…';
  try {
    backwards = reverse(await songAudio(song));
  } catch {
    return say("This song's clip couldn't be played. Draw a different song.", true);
  }
  $('#play-back').disabled = false;
  $('#play-back').textContent = '▶ Play it backwards';
  $('#rec').disabled = false;
  take = null;
  $('#take').hidden = true;
}
$('#draw').onclick = drawSong;
$('#redraw').onclick = drawSong;

$('#play-back').onclick = () => {
  if (!backwards) return;
  const b = $('#play-back');
  if (b.dataset.playing) { stop(); return; }
  b.dataset.playing = '1';
  b.textContent = '■ Stop';
  play(backwards, () => { delete b.dataset.playing; b.textContent = '▶ Play it backwards'; });
};

$('#rec').onclick = async () => {
  const b = $('#rec');
  if (recorder) {
    clearInterval(timerId);
    take = recorder.stop();
    recorder = null;
    b.classList.remove('on');
    b.textContent = '● Record again';
    $('#level').style.width = '0';
    $('#take').hidden = take.seconds < 0.5;
    if (take.seconds < 0.5) say('That was too short. Try again.', true);
    return;
  }
  say('');
  stop();
  try {
    recorder = new Recorder();
    await recorder.start((lvl) => { $('#level').style.width = `${Math.round(lvl * 100)}%`; });
  } catch (e) {
    recorder = null;
    const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    say(denied ? 'The microphone is blocked. Allow it for this site (the icon in the address bar), then try again. On a work computer, IT may have switched it off for websites.' : e.message, true);
    return;
  }
  const t0 = performance.now();
  $('#timer').textContent = '0:00';
  timerId = setInterval(() => {
    const s = (performance.now() - t0) / 1000;
    $('#timer').textContent = fmtTime(s);
    if (s > 60) b.click(); // a minute is plenty
  }, 250);
  b.classList.add('on');
  b.textContent = '■ Stop';
  $('#take').hidden = true;
};

$('#play-take').onclick = () => { if (take) play(take.buffer); };

$('#save').onclick = async () => {
  if (!take || !draw) return;
  const player = nameInput.value.trim() || 'Someone';
  const { song, number } = draw;
  // Room 2 needs the wall, the answer and (for a clip) the real song to play after the guess.
  const answer = {
    v: 1, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    player, number, createdAt: new Date().toISOString(),
    songId: song.id, wall: wallOf(deck),
    clip: song.clip ? (typeof song.clip === 'string' ? song.clip : await toBase64(bufferToWav(await songAudio(song)))) : undefined,
  };
  const blob = encodeWav(take.samples, take.sampleRate, { bwsg: scramble(answer) });
  const safe = player.replace(/[^\w-]+/g, '').slice(0, 20) || 'singer';
  const name = `room1-song-${number}-${safe}.wav`;
  saveFile(blob, name);
  $('#saved-name').textContent = name;
  $('#handoff').hidden = false;
  say('');
  draw = null; backwards = null; take = null;
  $('#drawn').hidden = true;
  $('#draw-empty').hidden = false;
  $('#take').hidden = true;
  $('#rec').disabled = true;
  $('#rec').textContent = '● Start singing';
  $('#timer').textContent = '0:00';
};

if (!micAvailable()) say('The microphone only works when this page is opened from its https:// link.', true);
init();
