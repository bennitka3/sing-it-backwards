import { $, esc, play, stop, reverse, songAudio, loadAudio, cut, bufferToWav, toBase64, Recorder, fmtTime, saveFile, kvGet, kvSet, fromBase64 } from './audio.js';
import { SONGS, CLIP_SECONDS } from './songs.js';
import { PACK_APP, isPack } from './deck.js';

// Per song: { inPlay, source: ArrayBuffer (the recording or file), name, start }. Kept in this browser.
// Every clip is CLIP_SECONDS long, from `start`.
let edits = {};
let custom = [];
let recording = null; // { songId, recorder, timer }

function say(text, isError) {
  const m = $('#msg');
  m.textContent = text;
  m.classList.toggle('error', !!isError);
  m.hidden = !text;
}

const allSongs = () => [...SONGS, ...custom];
const ed = (id) => (edits[id] ||= {});
const inPlay = (s) => ed(s.id).inPlay !== false;
const hasAudio = (s) => !!(s.melody || ed(s.id).source);
const save = () => kvSet('host', { edits, custom });

async function forward(s) {
  const e = ed(s.id);
  if (e.source) return cut(await loadAudio(e.source), e.start || 0, CLIP_SECONDS);
  return songAudio(s);
}

function render() {
  const ready = allSongs().filter((s) => inPlay(s) && hasAudio(s)).length;
  $('#ready-count').textContent = `${ready} song${ready === 1 ? '' : 's'} ready to draw · ${allSongs().length} cards on the wall`;
  $('#songs').innerHTML = allSongs().map((s) => {
    const e = ed(s.id);
    const src = e.source ? `<span class="status ok">Your clip: ${esc(e.name || 'recording')}</span>`
      : s.melody ? '<span class="status ok">Built-in tune</span>'
      : '<span class="status need">Needs a clip before it can be drawn (still shows on the wall)</span>';
    const isRec = recording && recording.songId === s.id;
    const id = esc(s.id);
    return `<div class="song-row" data-id="${id}">
      <div style="display:grid;gap:6px;min-width:0">
        <h3>${esc(s.title)}</h3>
        <span class="small muted">${s.artist ? esc(s.artist) + ' · ' : ''}${s.kind === 'nursery' ? 'Nursery' : 'Pop'}</span>
        ${src}
        <label class="row" style="color:var(--ink)" for="inplay-${id}"><input type="checkbox" id="inplay-${id}" data-act="inplay" ${inPlay(s) ? 'checked' : ''}> In the draw</label>
      </div>
      <div style="display:grid;gap:10px;min-width:0">
        <div class="row">
          <button class="sm" data-act="fwd" ${hasAudio(s) ? '' : 'disabled'}>▶ Forward</button>
          <button class="sm" data-act="back" ${hasAudio(s) ? '' : 'disabled'}>◀ Backwards</button>
          <button class="sm ${isRec ? 'danger' : ''}" data-act="rec" ${recording && !isRec ? 'disabled' : ''}>${isRec ? '■ Stop <span data-timer>0:00</span>' : '● Record clip'}</button>
          <button class="sm" data-act="upload">Load audio file</button>
          <input type="file" accept="audio/*" data-act="file" id="file-${id}">
          ${e.source ? '<button class="sm danger" data-act="unclip">Remove clip</button>' : ''}
          ${s.custom ? '<button class="sm danger" data-act="delete">Delete card</button>' : ''}
        </div>
        ${e.source ? `<div class="row">
          <label for="start-${id}">Chorus starts at (sec)<input type="number" min="0" step="0.5" id="start-${id}" data-act="start" value="${e.start || 0}"></label>
          <span class="small muted">The sample is the ${CLIP_SECONDS} seconds from there.</span>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

$('#songs').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  const song = allSongs().find((s) => s.id === btn.closest('.song-row').dataset.id);
  const act = btn.dataset.act;
  say('');
  try {
    if (act === 'fwd') play(await forward(song));
    if (act === 'back') play(reverse(await forward(song)));
    if (act === 'upload') btn.closest('.song-row').querySelector('input[type=file]').click();
    if (act === 'unclip') { delete edits[song.id].source; await save(); render(); }
    if (act === 'delete') { custom = custom.filter((s) => s.id !== song.id); delete edits[song.id]; await save(); render(); }
    if (act === 'rec') {
      if (recording) {
        clearInterval(recording.timer);
        const take = recording.recorder.stop();
        recording = null;
        if (take.seconds < 1) { render(); return say('That was too short to keep.', true); }
        Object.assign(ed(song.id), { source: await take.blob.arrayBuffer(), name: 'your recording', start: 0 });
        await save();
        render();
        say(`Saved your clip for ${song.title}. Press Forward to check it.`);
      } else {
        stop();
        const recorder = new Recorder();
        await recorder.start();
        const t0 = performance.now();
        recording = { songId: song.id, recorder, timer: setInterval(() => {
          const sec = (performance.now() - t0) / 1000;
          const el = document.querySelector('[data-timer]');
          if (el) el.textContent = fmtTime(sec);
          if (sec >= CLIP_SECONDS) document.querySelector(`.song-row[data-id="${song.id}"] [data-act="rec"]`)?.click();
        }, 100) };
        render();
        say(`Recording ${song.title}. Sing from the start of the chorus. It stops by itself after ${CLIP_SECONDS} seconds.`);
      }
    }
  } catch (err) {
    if (recording && act === 'rec') { clearInterval(recording.timer); recording = null; render(); }
    say(err && err.name === 'NotAllowedError' ? 'The microphone is blocked. Allow it for this site, then try again.' : (err.message || "That didn't work."), true);
  }
});

$('#songs').addEventListener('change', async (ev) => {
  const el = ev.target;
  const row = el.closest('.song-row');
  if (!row) return;
  const song = allSongs().find((s) => s.id === row.dataset.id);
  const e = ed(song.id);
  if (el.dataset.act === 'inplay') e.inPlay = el.checked;
  if (el.dataset.act === 'start') e.start = Math.max(0, Number(el.value) || 0);
  if (el.dataset.act === 'file' && el.files[0]) {
    const f = el.files[0];
    const source = await f.arrayBuffer();
    try { await loadAudio(source); } catch { return say(`This browser can't play ${f.name}. Try an MP3 or WAV.`, true); }
    Object.assign(e, { source, name: f.name, start: 0 });
    render();
    say(`Loaded ${f.name}. Set "Chorus starts at" to where the chorus begins, then press Forward to check.`);
  }
  await save();
  if (el.dataset.act === 'inplay') render();
});

$('#add').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const title = $('#add-title').value.trim();
  if (!title) return say('Give the song a title.', true);
  custom.push({ id: 'custom-' + Date.now().toString(36), title, artist: $('#add-artist').value.trim(), kind: 'pop', custom: true });
  $('#add-title').value = '';
  $('#add-artist').value = '';
  await save();
  render();
});

// First visit on this computer: start from the songs already on the site.
async function startFromSite() {
  try {
    const res = await fetch('pack.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const pack = await res.json();
    if (!isPack(pack)) return;
    for (const s of pack.songs) {
      if (s.custom) custom.push({ id: s.id, title: s.title, artist: s.artist, kind: s.kind, custom: true });
      const e = ed(s.id);
      e.inPlay = s.inPlay !== false;
      if (s.clip) Object.assign(e, { source: fromBase64(s.clip), name: 'on the site', start: 0 });
    }
  } catch {}
}

$('#export').onclick = async () => {
  const b = $('#export');
  b.disabled = true;
  b.textContent = 'Saving…';
  try {
    const songs = [];
    for (const s of allSongs()) {
      const e = ed(s.id);
      const entry = { id: s.id, title: s.title, artist: s.artist || '', kind: s.kind, inPlay: inPlay(s) };
      if (s.custom) entry.custom = true;
      if (e.source) entry.clip = await toBase64(bufferToWav(await forward(s)));
      songs.push(entry);
    }
    const pack = { app: PACK_APP, v: 1, createdAt: new Date().toISOString(), songs };
    saveFile(new Blob([JSON.stringify(pack)], { type: 'application/json' }), 'pack.json');
    const ready = songs.filter((s) => s.inPlay && (s.clip || SONGS.find((x) => x.id === s.id)?.melody)).length;
    say(`Saved pack.json with ${ready} songs in the draw. Upload it to the site (steps above) and everyone gets them.`);
  } catch (err) {
    say("The song pack couldn't be saved. " + (err.message || ''), true);
  } finally {
    b.disabled = false;
    b.textContent = 'Save song pack';
  }
};

(async () => {
  const saved = await kvGet('host');
  if (saved) { edits = saved.edits || {}; custom = saved.custom || []; }
  else await startFromSite();
  render();
})();
