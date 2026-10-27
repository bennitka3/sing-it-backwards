import { $, esc, play, stop, reverse, parseWav, unscramble, songAudio, kvGet, kvSet, fromBase64 } from './audio.js';
import { SONGS } from './songs.js';
import { deck, wallOf } from './deck.js';
import { liveEnabled, watchLive, watchResults, sendResult, gameCode, playLimit } from './live.js';
import { celebrate } from './celebrate.js';
import { showAlan } from './alan.js';

// recordings: [{ id, player, number, songId, wall, guess, wav: ArrayBuffer }], kept in this browser.
let recordings = [];
let selected = null;
let pending = null;
const audioCache = new Map();

function say(text, isError) {
  const m = $('#msg');
  m.textContent = text;
  m.classList.toggle('error', !!isError);
  m.hidden = !text;
}

// Each Room 2 gets its own shuffled wall that stays put.
let seed;
try { seed = localStorage.getItem('wall-seed'); } catch {}
if (!seed) { seed = String(Math.random()).slice(2, 10); try { localStorage.setItem('wall-seed', seed); } catch {} }
const key = (id) => [...(seed + id)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

// The wall: every card any recording listed (all recordings from one pack list the same cards).
function wall() {
  const cards = new Map();
  for (const r of recordings) for (const c of r.wall) cards.set(c.id, c);
  if (!cards.size) for (const c of wallOf(deck())) cards.set(c.id, c);
  return [...cards.values()].sort((a, b) => key(a.id) - key(b.id));
}
const titleOf = (id) => wall().find((c) => c.id === id)?.title || 'an unknown song';
const current = () => recordings.find((r) => r.id === selected);
// Each game keeps its own list in this browser; recordings opened as files without a game go under 'files'.
const storeKey = () => 'room2:' + (gameCode() || 'files');
const persist = () => kvSet(storeKey(), recordings);
// How many times this page may play each recording (the host sets it in the lobby).
const PLAYS = playLimit(2);

// Add one recording (a Room 1 WAV). Returns true if it was new.
function addRecording(wav, label, quiet) {
  const parsed = parseWav(wav);
  const answer = parsed && parsed.chunks.bwsg && unscramble(parsed.chunks.bwsg);
  if (!parsed || !parsed.buffer || !answer || !answer.songId) {
    if (!quiet) say(`${label} isn't a Room 1 recording. Ask Room 1 to send it from their page.`, true);
    return false;
  }
  if (recordings.some((r) => r.id === answer.id)) return false;
  recordings.push({ ...answer, wall: answer.wall || wallOf(deck()), guess: null, wav });
  if (!current() || current().guess) selected = answer.id;
  return true;
}

async function addFiles(files) {
  let added = false;
  for (const f of files) added = addRecording(await f.arrayBuffer(), f.name) || added;
  if (added) { pending = null; say(''); await persist(); showAlan('arrived'); }
  render();
}

// Live: every recording Room 1 sends to this game arrives here by itself (and the earlier ones on load).
let stopWatching = () => {};
let stopResults = () => {};
async function connect() {
  stopWatching();
  stopResults();
  const game = gameCode();
  $('#join').hidden = !!game || !liveEnabled();
  if (!liveEnabled()) { $('#live-status').textContent = "Live sending isn't set up yet. Room 1 sends recordings as files through your chat."; return; }
  if (!game) { $('#live-status').textContent = 'Enter the game code from the host to get Room 1\'s recordings.'; return; }
  $('#live-status').textContent = `Game ${game} · connecting…`;
  stopWatching = await watchLive(game, async (doc) => {
    $('#live-status').textContent = `Game ${game} · live: recordings appear by themselves`;
    if (addRecording(fromBase64(doc.payload), 'A recording', true)) { chime(); await persist(); render(); showAlan('arrived'); }
  }, () => {
    $('#live-status').textContent = `Game ${game} · couldn't connect. This network may block it; Room 1 can send files through your chat instead.`;
  });
  // Another Room 2 page's guess counts for this team too.
  stopResults = await watchResults(game, async (res, fresh) => {
    const r = recordings.find((x) => x.id === res.recordingId);
    if (!r || r.guess) return;
    r.guess = res.guess;
    if (r.id === selected) pending = null;
    await persist();
    render();
    if (fresh && res.correct) { celebrate(); showAlan('right'); }
    else if (fresh) showAlan('wrong');
  });
  setTimeout(() => {
    if (/connecting/.test($('#live-status').textContent)) $('#live-status').textContent = `Game ${game} · live: waiting for Room 1`;
  }, 4000);
}
$('#join').addEventListener('submit', (e) => { e.preventDefault(); location.hash = $('#code-input').value.trim(); });
async function loadGame() {
  stop();
  const saved = await kvGet(storeKey());
  recordings = Array.isArray(saved) ? saved : [];
  audioCache.clear();
  pending = null;
  selected = recordings.find((r) => !r.guess)?.id || recordings[recordings.length - 1]?.id || null;
  render();
  connect();
}
window.addEventListener('hashchange', loadGame);

function chime() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.6);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.6);
  } catch {}
}

$('#open').onclick = () => $('#files').click();
$('#files').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
const drop = $('#drop');
document.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) drop.classList.remove('over'); });
document.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); });

function render() {
  const guessed = recordings.filter((r) => r.guess);
  $('#score').textContent = `${guessed.filter((r) => r.guess === r.songId).length} of ${guessed.length} right`;

  $('#inbox').innerHTML = recordings.slice().reverse().map((r) => {
    const pill = !r.guess ? '<span class="pill new">to guess</span>'
      : r.guess === r.songId ? '<span class="pill right">right</span>' : '<span class="pill wrong">wrong</span>';
    return `<button data-id="${esc(r.id)}" class="${r.id === selected ? 'sel' : ''}"><span>#${esc(r.number)} · ${esc(r.player)}</span>${pill}</button>`;
  }).join('');
  $('#inbox').querySelectorAll('button').forEach((b) => b.onclick = () => { stop(); selected = b.dataset.id; pending = null; render(); });
  $('#clear').hidden = !recordings.length;

  const r = current();
  $('#stage-controls').hidden = !r;
  $('#stage-help').hidden = !!r;
  $('#stage-label').textContent = r ? `Recording #${r.number}` : 'No recording yet';
  $('#stage-title').textContent = r ? `${r.player} sang this backwards.` : 'The wall is waiting.';
  $('#confirm').hidden = !(r && !r.guess && pending);
  if (pending) $('#confirm-title').textContent = titleOf(pending);
  $('#result').hidden = !(r && r.guess);
  if (r && r.guess) {
    const right = r.guess === r.songId;
    $('#verdict').textContent = right ? 'Correct!' : 'Not quite.';
    $('#verdict').className = 'verdict ' + (right ? 'right' : 'wrong');
    $('#truth').textContent = right ? `It was ${titleOf(r.songId)}.` : `You picked ${titleOf(r.guess)}. It was ${titleOf(r.songId)}.`;
    $('#play-real').hidden = !SONGS.find((s) => s.id === r.songId);
  }

  $('#wall').innerHTML = wall().map((s, i) => {
    let cls = 'card';
    if (r && r.guess) cls += s.id === r.songId ? ' right' : s.id === r.guess ? ' wrong' : ' dim';
    else if (s.id === pending) cls += ' picked';
    const tilt = ((i * 37) % 7 - 3) * 0.6;
    return `<button class="${cls}" data-id="${esc(s.id)}" style="--tilt:${tilt}deg" ${!r || r.guess ? 'disabled' : ''}>
      <span class="t">${esc(s.title)}</span>
      <span>${s.artist ? `<span class="a">${esc(s.artist)}</span><br>` : ''}<span class="k">${s.kind === 'nursery' ? 'Nursery' : 'Pop'}</span></span>
    </button>`;
  }).join('');
  $('#wall').querySelectorAll('.card').forEach((c) => c.onclick = () => { pending = c.dataset.id; render(); $('#lock').focus(); });
  showPlays();
}

function sung(r) {
  if (!audioCache.has(r.id)) audioCache.set(r.id, parseWav(r.wav).buffer);
  return audioCache.get(r.id);
}

// counted: plays of the team's recording use up this page's allowance for that recording.
function toggle(btn, label, getBuffer, counted) {
  btn.onclick = async () => {
    if (btn.dataset.playing) { stop(); return; }
    const r = current();
    if (!r) return;
    if (counted && (r.plays || 0) >= PLAYS) return;
    try {
      btn.disabled = true;
      const buf = await getBuffer(r);
      if (counted) { r.plays = (r.plays || 0) + 1; persist(); showPlays(); }
      btn.dataset.playing = '1';
      btn.textContent = '■ Stop';
      play(buf, () => { delete btn.dataset.playing; btn.textContent = label; showPlays(); });
    } catch {
      say("That audio couldn't be played.", true);
    } finally {
      btn.disabled = false;
      showPlays();
    }
  };
}
// Plays left for the selected recording; both ways of hearing it share the allowance.
function showPlays() {
  const r = current();
  const left = r ? Math.max(0, PLAYS - (r.plays || 0)) : PLAYS;
  const out = left === 0 && !(r && r.guess) ? 'No plays left' : null;
  for (const b of [$('#play-flip'), $('#play-raw')]) {
    if (b.dataset.playing) continue;
    b.disabled = !r || (left === 0 && !r.guess);
  }
  if (!$('#play-flip').dataset.playing) $('#play-flip').textContent = out || '▶ Play it flipped';
  $('#plays-left').textContent = r ? (r.guess ? '' : `${left} of ${PLAYS} plays left`) : '';
}
toggle($('#play-flip'), '▶ Play it flipped', async (r) => reverse(sung(r)), true);
toggle($('#play-raw'), 'Hear it as sung', async (r) => sung(r), true);
toggle($('#play-real'), '▶ Hear the real song', (r) => songAudio(SONGS.find((s) => s.id === r.songId)));

$('#cancel').onclick = () => { pending = null; render(); };
$('#lock').onclick = async () => {
  const r = current();
  if (!r || !pending || r.guess) return;
  r.guess = pending;
  pending = null;
  await persist();
  render();
  if (r.guess === r.songId) { celebrate(); showAlan('right'); } else showAlan('wrong');
  // Tell Room 1 (and any other Room 2 page) how it went. If the database refuses, the game still works here.
  const game = gameCode();
  if (game && liveEnabled()) sendResult(game, r.id, { number: Number(r.number) || 0, guess: r.guess, correct: r.guess === r.songId }).catch(() => {});
};

$('#clear').onclick = () => { $('#clear-confirm').hidden = false; };
$('#clear-no').onclick = () => { $('#clear-confirm').hidden = true; };
$('#clear-yes').onclick = async () => {
  recordings = []; selected = null; pending = null; audioCache.clear();
  $('#clear-confirm').hidden = true;
  await persist();
  render();
};

(async () => {
  await loadGame();
})();
