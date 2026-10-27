// The lobby: start a game (code + two links carrying the play limits) and follow the scores of your games.
import { newGameCode, liveEnabled, watchLive, watchResults } from './live.js';
import { showAlan } from './alan.js';
import { esc } from './audio.js';

const $ = (id) => document.getElementById(id);
setTimeout(() => showAlan('lobby'), 600);

const base = location.href.replace(/[#?].*$/, '').replace(/index\.html$/, '');
const plays = (id, d) => { const n = parseInt($(id).value, 10); return n >= 1 && n <= 20 ? n : d; };
const links = (code, p1 = plays('plays1', 3), p2 = plays('plays2', 2)) =>
  [`${base}room1.html?plays=${p1}#${code}`, `${base}room2.html?plays=${p2}#${code}`];

let code = null;
function showLinks() {
  if (!code) return;
  // The play limits ride in each room's link, so changing them here updates the links to share.
  const [l1, l2] = links(code);
  $('code').textContent = code;
  $('link1').textContent = l1;
  $('link2').textContent = l2;
  $('door1').href = l1;
  $('door2').href = l2;
  $('links').hidden = false;
  const g = games.find((x) => x.code === code);
  if (g && (g.p1 !== plays('plays1', 3) || g.p2 !== plays('plays2', 2))) { g.p1 = plays('plays1', 3); g.p2 = plays('plays2', 2); saveGames(); renderGames(); }
}
$('new-game').onclick = () => {
  code = newGameCode();
  games.unshift({ code, startedAt: Date.now(), p1: plays('plays1', 3), p2: plays('plays2', 2), mine: true });
  saveGames();
  follow(games[0]);
  showLinks();
  renderGames();
};
for (const id of ['plays1', 'plays2']) $(id).addEventListener('input', showLinks);

async function copy(btn, text, selectEl) {
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; }
  catch { if (selectEl) getSelection().selectAllChildren(selectEl); btn.textContent = selectEl ? 'Press Ctrl+C' : 'Copy failed'; }
  setTimeout(() => (btn.textContent = btn.dataset.label || 'Copy'), 2000);
}
document.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => copy(b, $(b.dataset.copy).textContent, $(b.dataset.copy)));

// --- Your games: remembered in this browser; scores come live from each game's recordings and results ---
let games = [];
try { games = JSON.parse(localStorage.getItem('my-games')) || []; } catch {}
const saveGames = () => { try { localStorage.setItem('my-games', JSON.stringify(games.slice(0, 30))); } catch {} };
const live = new Map(); // code -> { sent, guessed, right, stop }

function follow(g) {
  if (live.has(g.code) || !liveEnabled()) return;
  const t = { sent: 0, guessed: 0, right: 0, stops: [] };
  live.set(g.code, t);
  watchLive(g.code, () => { t.sent++; renderGames(); }, () => {}).then((s) => t.stops.push(s));
  watchResults(g.code, (res) => { t.guessed++; if (res.correct) t.right++; renderGames(); }).then((s) => t.stops.push(s));
}

function when(ms) {
  const d = new Date(ms);
  const today = new Date().toDateString() === d.toDateString();
  return (today ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ') + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function renderGames() {
  if (!games.length) { $('games').innerHTML = '<tr><td colspan="6" class="muted">No games yet. Start one above.</td></tr>'; return; }
  $('games').innerHTML = games.map((g) => {
    const t = live.get(g.code) || { sent: 0, guessed: 0, right: 0 };
    return `<tr data-code="${esc(g.code)}">
      <td><strong>${esc(g.code)}</strong>${g.mine ? '' : ' <span class="pill">followed</span>'}</td><td>${g.startedAt ? when(g.startedAt) : '—'}</td>
      <td>${t.sent}</td><td>${t.guessed}</td><td><strong>${t.right}</strong>${t.guessed ? ` of ${t.guessed}` : ''}</td>
      <td class="row" style="gap:6px;flex-wrap:nowrap">
        <button class="sm" data-act="l1" data-label="Room 1 link">Room 1 link</button>
        <button class="sm" data-act="l2" data-label="Room 2 link">Room 2 link</button>
        <button class="sm danger" data-act="remove" aria-label="Remove ${esc(g.code)} from this list">✕</button></td></tr>`;
  }).join('');
}
$('games').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const g = games.find((x) => x.code === b.closest('tr').dataset.code);
  if (!g) return;
  const [l1, l2] = links(g.code, g.p1 || 3, g.p2 || 2);
  if (b.dataset.act === 'l1') copy(b, l1);
  if (b.dataset.act === 'l2') copy(b, l2);
  if (b.dataset.act === 'remove') {
    live.get(g.code)?.stops.forEach((s) => s());
    live.delete(g.code);
    games = games.filter((x) => x !== g);
    saveGames();
    renderGames();
  }
});
$('watch').addEventListener('submit', (e) => {
  e.preventDefault();
  const c = $('watch-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!c) return;
  $('watch-code').value = '';
  if (!games.some((g) => g.code === c)) { games.unshift({ code: c, mine: false }); saveGames(); }
  follow(games.find((g) => g.code === c));
  renderGames();
});

games.forEach(follow);
renderGames();
