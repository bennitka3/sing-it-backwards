import { $, play, stop, reverse, songAudio, Recorder, fmtTime, micAvailable, encodeWav, scramble, saveFile, toBase64 } from './audio.js';
import { deck as fullDeck, wallOf } from './deck.js';
import { liveEnabled, sendLive, gameCode } from './live.js';

const deck = fullDeck();
let game = gameCode();
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

function showGame() {
  $('#game-code').textContent = game || 'none';
  $('#join').hidden = !!game || !liveEnabled();
  if (!liveEnabled()) $('#game-status').textContent = "Live sending isn't set up yet, so recordings are saved as files for your chat.";
}

$('#join').addEventListener('submit', (e) => {
  e.preventDefault();
  location.hash = $('#code-input').value.trim();
  game = gameCode();
  showGame();
});
window.addEventListener('hashchange', () => { game = gameCode(); showGame(); });

$('#new-round').onclick = () => { setRound({ used: [], count: 0 }); say('New round: every song is back in the draw and numbering restarts at 1.'); };

async function drawSong() {
  say('');
  stop();
  const pool = deck;
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
    return say("This song couldn't be played. Draw a different song.", true);
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
    if (s > 20) b.click(); // the sample is 7 s; 20 s keeps a recording small enough to send
  }, 250);
  b.classList.add('on');
  b.textContent = '■ Stop';
  $('#take').hidden = true;
};

$('#play-take').onclick = () => { if (take) play(take.buffer); };

// The recording, with the answer and the wall scrambled inside it (Room 2 checks guesses with it).
function packRecording() {
  const player = nameInput.value.trim() || 'Someone';
  const { song, number } = draw;
  const answer = {
    v: 1, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    player, number, createdAt: new Date().toISOString(), songId: song.id, wall: wallOf(deck),
  };
  return { player, number, blob: encodeWav(take.samples, take.sampleRate, { bwsg: scramble(answer) }, 16000) };
}

function finish(text, rec) {
  $('#handoff-text').textContent = text;
  $('#handoff').hidden = false;
  $('#fallback').hidden = !rec;
  lastRecording = rec;
  draw = null; backwards = null; take = null;
  $('#drawn').hidden = true;
  $('#draw-empty').hidden = false;
  $('#take').hidden = true;
  $('#rec').disabled = true;
  $('#rec').textContent = '● Start singing';
  $('#timer').textContent = '0:00';
}

let lastRecording = null;
function saveAsFile(rec) {
  const safe = rec.player.replace(/[^\w-]+/g, '').slice(0, 20) || 'singer';
  const name = `room1-song-${rec.number}-${safe}.wav`;
  saveFile(rec.blob, name);
  return name;
}
$('#save').onclick = () => {
  if (!lastRecording) return;
  const name = saveAsFile(lastRecording);
  $('#handoff-text').textContent = `Saved to your Downloads as ${name}. Drop it in your team chat; Room 2 opens it on their page.`;
  $('#fallback').hidden = true;
};

$('#send').onclick = async () => {
  if (!take || !draw) return;
  say('');
  const rec = packRecording();
  if (!liveEnabled()) {
    const name = saveAsFile(rec);
    return finish(`Saved to your Downloads as ${name}. Drop it in your team chat; Room 2 opens it on their page.`);
  }
  if (!game) return say('Enter the game code first (Game, at the top), so Room 2 gets it.', true);
  const b = $('#send');
  b.disabled = true;
  b.textContent = 'Sending…';
  try {
    await sendLive(game, { player: rec.player, number: rec.number, payload: await toBase64(rec.blob) });
    finish(`Sent! Room 2 has secret song #${rec.number}. Draw another song whenever you're ready.`);
  } catch {
    finish("It couldn't be sent live, maybe this network blocks it. Save it as a file and drop it in your team chat instead.", rec);
  } finally {
    b.disabled = false;
    b.textContent = 'Send to Room 2';
  }
};

if (!micAvailable()) say('The microphone only works when this page is opened from its https:// link.', true);
showGame();
