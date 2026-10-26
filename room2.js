import { $, esc, play, stop, reverse, parseWav, unscramble, songAudio, kvGet, kvSet } from './audio.js';
import { SONGS } from './songs.js';
import { defaultDeck, wallOf } from './deck.js';

// recordings: [{ id, player, number, songId, wall, clip, guess, wav: ArrayBuffer }], kept in this browser.
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
  if (!cards.size) for (const c of wallOf(defaultDeck())) cards.set(c.id, c);
  return [...cards.values()].sort((a, b) => key(a.id) - key(b.id));
}
const titleOf = (id) => wall().find((c) => c.id === id)?.title || 'an unknown song';
const current = () => recordings.find((r) => r.id === selected);
const persist = () => kvSet('room2', recordings);

async function addFiles(files) {
  let added = 0;
  for (const f of files) {
    const wav = await f.arrayBuffer();
    const parsed = parseWav(wav);
    const answer = parsed && parsed.chunks.bwsg && unscramble(parsed.chunks.bwsg);
    if (!parsed || !parsed.buffer || !answer || !answer.songId) {
      say(`${f.name} isn't a Room 1 recording. Ask Room 1 to send the file their page saved (it starts with "room1-song").`, true);
      continue;
    }
    if (recordings.some((r) => r.id === answer.id)) { selected = answer.id; continue; }
    recordings.push({ ...answer, wall: answer.wall || wallOf(defaultDeck()), guess: null, wav });
    selected = answer.id;
    added++;
  }
  if (added) { pending = null; say(''); await persist(); }
  render();
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
    $('#play-real').hidden = !(r.clip || SONGS.find((s) => s.id === r.songId)?.melody);
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
}

function sung(r) {
  if (!audioCache.has(r.id)) audioCache.set(r.id, parseWav(r.wav).buffer);
  return audioCache.get(r.id);
}

function toggle(btn, label, getBuffer) {
  btn.onclick = async () => {
    if (btn.dataset.playing) { stop(); return; }
    const r = current();
    if (!r) return;
    try {
      btn.disabled = true;
      const buf = await getBuffer(r);
      btn.dataset.playing = '1';
      btn.textContent = '■ Stop';
      play(buf, () => { delete btn.dataset.playing; btn.textContent = label; });
    } catch {
      say("That audio couldn't be played.", true);
    } finally {
      btn.disabled = false;
    }
  };
}
toggle($('#play-flip'), '▶ Play it flipped', async (r) => reverse(sung(r)));
toggle($('#play-raw'), 'Hear it as sung', async (r) => sung(r));
toggle($('#play-real'), '▶ Hear the real song', (r) => songAudio(r.clip ? { clip: r.clip } : SONGS.find((s) => s.id === r.songId)));

$('#cancel').onclick = () => { pending = null; render(); };
$('#lock').onclick = async () => {
  const r = current();
  if (!r || !pending || r.guess) return;
  r.guess = pending;
  pending = null;
  await persist();
  render();
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
  const saved = await kvGet('room2');
  if (Array.isArray(saved)) recordings = saved;
  selected = recordings.find((r) => !r.guess)?.id || recordings[recordings.length - 1]?.id || null;
  render();
})();
