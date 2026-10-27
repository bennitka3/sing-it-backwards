// Plays whole rounds in Chromium with a fake microphone (Chromium's test tone).
// Live sending runs through a stand-in relay inside this test (the real site uses Firebase), so the test
// checks the game, not Google's servers. It also checks the file fallback used when live sending is off.
//   node test/e2e.mjs [screenshot-dir]
// Needs Playwright (npm install --no-save playwright).
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const shots = process.argv[2];
const tmp = await mkdtemp(path.join(tmpdir(), 'bws-e2e-'));

const server = await serve(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const relay = new Map(); // 'game/kind' -> [docs]
const contexts = {};

async function open(url, name, { live = true, blocked = false, viewport = { width: 1200, height: 900 } } = {}) {
  // Each player is their own "computer": their own browser storage.
  if (!contexts[name]) {
    const ctx = await browser.newContext({ permissions: ['microphone'], viewport, acceptDownloads: true });
    if (live) {
      // Stand-in for Firebase: entries live in `relay` in this test process, shared by every "computer".
      const list = (game, kind) => { const k = game + '/' + kind; return relay.get(k) || relay.set(k, []).get(k); };
      await ctx.exposeFunction('__relayAdd', (game, kind, doc) => { list(game, kind).push(doc); });
      await ctx.exposeFunction('__relayPut', (game, kind, id, doc) => {
        const l = list(game, kind);
        if (l.some((d) => d.__id === id)) throw new Error('already exists');
        l.push({ ...doc, __id: id });
      });
      await ctx.exposeFunction('__relayList', (game, kind, from) => list(game, kind).slice(from));
      await ctx.addInitScript(() => {
        window.__liveTransport = {
          add: (game, kind, doc) => window.__relayAdd(game, kind, doc),
          put: (game, kind, id, doc) => window.__relayPut(game, kind, id, doc),
          watch: (game, kind, onAdd) => {
            let seen = 0, first = true;
            const tick = async () => {
              const docs = await window.__relayList(game, kind, seen);
              seen += docs.length;
              docs.forEach((d) => onAdd(d, !first));
              first = false;
            };
            tick();
            const t = setInterval(tick, 300);
            return () => clearInterval(t);
          },
        };
      });
    }
    // A work network that blocks Firebase.
    if (blocked) await ctx.route(/gstatic\.com|googleapis\.com/, (r) => r.abort());
    contexts[name] = ctx;
  }
  const page = await contexts[name].newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !blocked && !/fonts\.g|Failed to load resource/.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  await page.goto(url.startsWith('http') ? url : base + url);
  return page;
}
const shot = (page, n) => shots && page.screenshot({ path: path.join(shots, n + '.png'), fullPage: true });
const step = (s) => console.log('✓', s);
// Alan pops up with a line for this moment, and his picture actually loaded.
async function alan(page, moment) {
  await page.waitForSelector(`.alan[data-moment="${moment}"]:not([hidden])`, { timeout: 4000 });
  await page.waitForFunction(() => { const i = document.querySelector('.alan img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 4000 });
  return (await page.textContent('.alan-bubble')).trim();
}
const expect = (ok, msg) => { if (!ok) throw new Error(msg); };
const answerOf = (page, i) => page.evaluate((i) => new Promise((res) => {
  const q = indexedDB.open('sing-it-backwards');
  q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('room2:' + location.hash.slice(1)); g.onsuccess = () => res(g.result[i].songId); };
}), i);

async function sing(room1, name, seconds = 2) {
  await room1.fill('#player', name);
  await room1.click('#draw');
  await room1.waitForSelector('#play-back:not([disabled])', { timeout: 10000 });
  await room1.click('#play-back');
  await room1.waitForTimeout(300);
  await room1.click('#rec');
  await room1.waitForTimeout(seconds * 1000);
  await room1.click('#rec');
  await room1.waitForSelector('#take:not([hidden])');
}

try {
  const lobby = await open('/', 'host');
  await lobby.click('#new-game');
  const link1 = await lobby.textContent('#link1');
  const link2 = await lobby.textContent('#link2');
  const code = await lobby.textContent('#code');
  expect(/room1\.html\?plays=3#[A-Z0-9]{4}$/.test(link1) && link2.endsWith('room2.html?plays=2#' + code), 'lobby links: ' + link1 + ' ' + link2);
  await lobby.fill('#plays1', '4');
  expect((await lobby.textContent('#link1')).includes('?plays=4#'), 'changing the play count updates the link');
  await lobby.fill('#plays1', '3');
  step('lobby links carry the play limits (3 for Room 1, 2 for Room 2 by default; changing them updates the links)');
  const said = { lobby: await alan(lobby, 'lobby') };
  await shot(lobby, 'lobby');
  step(`lobby made game ${code} with Room 1 and Room 2 links`);

  const room2 = await open(link2, 'room2');
  await room2.waitForFunction(() => /live/.test(document.querySelector('#live-status').textContent));
  const room1 = await open(link1, 'room1');
  expect((await room1.textContent('#game-code')) === code, 'room1 shows the game code');
  expect((await room1.textContent('#plays-help')).startsWith('You can play it 3 times'), 'room1 says how many plays');

  await sing(room1, 'Alan');
  said.drawn = await alan(room1, 'drawn');
  expect((await room1.textContent('#play-back')).includes('2 left'), 'after one play, 2 of 3 left: ' + await room1.textContent('#play-back'));
  await room1.click('#send');
  await room1.waitForSelector('#handoff:not([hidden])');
  said.sent = await alan(room1, 'sent');
  await shot(room1, 'room1-sent');
  expect(/^Sent!/.test(await room1.textContent('#handoff-text')), 'room1 says Sent!');
  const doc = relay.get(code + '/recordings')[0];
  const perSecond = doc.payload.length / 2.3;
  expect(perSecond * 20 < 1_000_000, `a 20 s recording must fit one database entry (${Math.round(perSecond * 20)} bytes)`);
  step(`Room 1 sang and pressed Send: no file saved (${Math.round(doc.payload.length / 1024)} KB sent)`);

  await room2.waitForSelector('#inbox button', { timeout: 3000 });
  said.arrived = await alan(room2, 'arrived');
  step('Room 2 got it by itself, with the page already open');
  expect((await room2.textContent('#plays-left')) === '2 of 2 plays left', 'room2 starts with 2 plays');
  await room2.click('#play-flip');
  await room2.waitForSelector('#play-flip[data-playing]', { timeout: 5000 });
  await room2.click('#play-raw');
  await room2.waitForSelector('#play-raw[data-playing]', { timeout: 5000 });
  await room2.click('#play-raw');
  await room2.waitForFunction(() => document.querySelector('#plays-left').textContent === '0 of 2 plays left'
    && document.querySelector('#play-flip').disabled && document.querySelector('#play-raw').disabled, null, { timeout: 3000 });
  expect((await room2.textContent('#play-flip')) === 'No plays left', 'room2 says no plays left');
  await room2.reload();
  await room2.waitForSelector('#inbox button');
  expect(await room2.isDisabled('#play-flip'), 'reloading Room 2 must not reset its plays');
  step('Room 2 gets 2 plays of the recording (flipped or as sung), and a reload does not reset them');
  const cards = await room2.$$eval('.card', (els) => els.length);
  expect(cards === 10, 'wall should have 10 cards, got ' + cards);
  const answer = await answerOf(room2, 0);
  await room2.click(`.card[data-id="${answer}"]`);
  await room2.click('#lock');
  await room2.waitForSelector('#result:not([hidden])');
  expect((await room2.textContent('#verdict')) === 'Correct!', 'expected Correct!');
  await room2.waitForSelector('.celebrate-tint', { timeout: 1000 });
  await room2.waitForSelector('canvas.celebrate-confetti', { timeout: 1000 });
  await room2.waitForTimeout(400);
  await shot(room2, 'room2-celebrate');
  await room1.waitForSelector('.celebrate-tint', { timeout: 3000 });
  expect(/Room 2 got secret song #1 right!/.test(await room1.textContent('#msg')), 'room1 told it was right');
  said.right = [await alan(room2, 'right'), await alan(room1, 'right')];
  await shot(room1, 'room1-celebrate');
  await room2.waitForFunction(() => !document.querySelector('.celebrate-tint, .celebrate-confetti'), null, { timeout: 4000 });
  step('right guess: confetti and gold tint in Room 2 and in Room 1, gone after about 3 s');
  await room2.click('#play-real');
  await room2.waitForSelector('#play-real[data-playing]', { timeout: 5000 });
  await shot(room2, 'room2-result');
  step(`Room 2 played it flipped, picked ${answer}: Correct!, and heard the real tune`);

  await sing(room1, 'Bea');
  await room1.click('#send');
  await room2.waitForSelector('#inbox button >> nth=1', { timeout: 3000 });
  const answer2 = await answerOf(room2, 1);
  const wrong = answer2 === 'twinkle' ? 'jingle-bells' : 'twinkle';
  await room2.click(`.card[data-id="${wrong}"]`);
  await room2.click('#lock');
  await room2.waitForSelector('#result:not([hidden])');
  expect((await room2.textContent('#verdict')) === 'Not quite.', 'expected a wrong guess');
  expect((await room2.textContent('#score')) === '1 of 2 right', 'score');
  await room1.waitForFunction(() => /got it wrong/.test(document.querySelector('#msg').textContent), null, { timeout: 3000 });
  await room1.waitForTimeout(400);
  expect(!(await room1.$('.celebrate-tint')) && !(await room2.$('.celebrate-tint')), 'no celebration for a wrong guess');
  said.wrong = [await alan(room2, 'wrong'), await alan(room1, 'wrong')];
  await shot(room1, 'room1-wrong');
  for (const [k, v] of Object.entries(said)) console.log(`    Alan (${k}): ${[].concat(v).join(' / ')}`);
  step('Alan showed up at every moment, in both rooms for right and wrong guesses');
  step('second recording arrived live; wrong guess: no confetti, Room 1 told it was wrong; score 1 of 2');

  // Same computer, switching to another game: only that game's recordings show, and back again.
  await room2.evaluate(() => { location.hash = '#QQQQ'; });
  await room2.waitForFunction(() => !document.querySelector('#inbox button') && /QQQQ/.test(document.querySelector('#live-status').textContent));
  await room2.evaluate((c) => { location.hash = '#' + c; }, code);
  await room2.waitForSelector('#inbox button >> nth=1', { timeout: 3000 });
  step('one computer switching between two games only sees each game\'s own recordings');
  // Room 1 plays: 3 per song, then the button stops.
  await room1.click('#draw');
  await room1.waitForSelector('#play-back:not([disabled])', { timeout: 10000 });
  for (let i = 0; i < 3; i++) {
    await room1.click('#play-back');
    await room1.waitForSelector('#play-back[data-playing]');
    await room1.click('#play-back');
    await room1.waitForSelector('#play-back:not([data-playing])');
  }
  expect(await room1.isDisabled('#play-back') && (await room1.textContent('#play-back')) === 'No plays left', 'room1 out of plays');
  step('Room 1 gets 3 plays of each song backwards, then the button stops');
  // Alan slides back down, then he's gone.
  await room1.waitForSelector('.alan.out', { timeout: 8000 });
  await room1.waitForSelector('.alan', { state: 'hidden', timeout: 2000 });
  step('Alan slides back off the bottom of the screen when he leaves');
  // The host's lobby (open since the start) keeps a live scoreboard of the game.
  await lobby.waitForFunction((c) => {
    const row = document.querySelector(`#games tr[data-code="${c}"]`);
    return row && [...row.cells].slice(2, 5).map((td) => td.textContent.trim()).join('|') === '2|2|1 of 2';
  }, code, { timeout: 5000 });
  await shot(lobby, 'lobby-scores');
  await lobby.reload();
  await lobby.waitForFunction((c) => document.querySelector(`#games tr[data-code="${c}"]`)?.cells[4].textContent.trim() === '1 of 2', code, { timeout: 5000 });
  const other = await open('/', 'other-host');
  await other.fill('#watch-code', code.toLowerCase());
  await other.click('#watch button[type=submit]');
  await other.waitForFunction((c) => document.querySelector(`#games tr[data-code="${c}"]`)?.cells[2].textContent.trim() === '2', code, { timeout: 5000 });
  step('lobby scoreboard: 2 sent, 2 guessed, 1 right, live and after a reload; another host can follow it by code');
  expect(!(await room1.$('#new-round')), 'Room 1 has no new-round button');
  const late = await open(link2, 'late-guesser');
  await late.waitForSelector('#inbox button >> nth=1', { timeout: 3000 });
  await late.waitForFunction(() => document.querySelector('#score').textContent === '1 of 2 right', null, { timeout: 3000 });
  expect(!(await late.$('.celebrate-tint')), 'old results must not set off confetti on a page opened later');
  step("a Room 2 player who opens the page late gets both recordings and the team's guesses, without old confetti");
  const otherGame = await open(link2.replace(/#.*/, '#ZZZZ'), 'other-game');
  await otherGame.waitForTimeout(1200);
  expect(!(await otherGame.$('#inbox button')), 'another game must not see these recordings');
  step('a different game code sees none of them');

  const tuneLens = await room1.evaluate(async () => {
    const a = await import('./audio.js');
    const { SONGS } = await import('./songs.js');
    const out = [];
    for (const s of SONGS) out.push((await a.renderMelody(s.melody, s.tempo)).duration);
    return out;
  });
  expect(tuneLens.length === 10 && tuneLens.every((d) => d > 6.9 && d < 7.8), 'tunes should be about 7 s: ' + tuneLens.join(', '));
  step('all 10 tunes are about 7 s (' + tuneLens.map((d) => d.toFixed(1)).join(', ') + ')');

  // Fallback when the network blocks Firebase: Room 1 offers a file, Room 2 opens it.
  const offline1 = await open('/room1.html#OFFL', 'offline-room1', { live: false, blocked: true });
  await sing(offline1, 'Cal');
  await offline1.click('#send');
  await offline1.waitForSelector('#fallback:not([hidden])', { timeout: 20000 });
  const [dl] = await Promise.all([offline1.waitForEvent('download'), offline1.click('#save')]);
  const file = path.join(tmp, dl.suggestedFilename());
  await dl.saveAs(file);
  const offline2 = await open('/room2.html#OFFL', 'offline-room2', { live: false, blocked: true });
  await offline2.waitForFunction(() => /couldn't connect/.test(document.querySelector('#live-status').textContent), null, { timeout: 15000 });
  await offline2.setInputFiles('#files', file);
  await offline2.waitForSelector('#inbox button');
  await writeFile(path.join(tmp, 'not-ours.txt'), 'hello');
  await offline2.setInputFiles('#files', path.join(tmp, 'not-ours.txt'));
  await offline2.waitForSelector('#msg.error:not([hidden])');
  step('on a network that blocks Firebase: both rooms say so, Room 1 saves a file, Room 2 opens it (and rejects other files)');

  for (const p of ['/', link1, link2]) {
    const page = await open(p, 'phone', { viewport: { width: 390, height: 844 } });
    await page.waitForTimeout(300);
    expect(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), p + ' scrolls sideways on a phone');
    if (p === link1) await shot(page, 'room1-phone');
  }
  step('every page fits a phone screen');

  expect(!errors.length, 'Console errors:\n' + errors.join('\n'));
  console.log('\nE2E PASSED');
} catch (e) {
  console.error('\nE2E FAILED:', e.message, errors.length ? '\n' + errors.join('\n') : '');
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
