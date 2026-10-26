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
const relay = new Map(); // game -> [docs]
const contexts = {};

async function open(url, name, { live = true, blocked = false, viewport = { width: 1200, height: 900 } } = {}) {
  // Each player is their own "computer": their own browser storage.
  if (!contexts[name]) {
    const ctx = await browser.newContext({ permissions: ['microphone'], viewport, acceptDownloads: true });
    if (live) {
      await ctx.exposeFunction('__relaySend', (game, doc) => { (relay.get(game) || relay.set(game, []).get(game)).push(doc); });
      await ctx.exposeFunction('__relayList', (game, from) => (relay.get(game) || []).slice(from));
      await ctx.addInitScript(() => {
        window.__liveTransport = {
          send: (game, doc) => window.__relaySend(game, doc),
          watch: (game, onAdd) => {
            let seen = 0;
            const t = setInterval(async () => {
              const docs = await window.__relayList(game, seen);
              seen += docs.length;
              docs.forEach(onAdd);
            }, 300);
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
const expect = (ok, msg) => { if (!ok) throw new Error(msg); };
const answerOf = (page, i) => page.evaluate((i) => new Promise((res) => {
  const q = indexedDB.open('sing-it-backwards');
  q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('room2'); g.onsuccess = () => res(g.result[i].songId); };
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
  expect(/room1\.html#[A-Z0-9]{4}$/.test(link1) && link2.endsWith('room2.html#' + code), 'lobby links: ' + link1);
  await shot(lobby, 'lobby');
  step(`lobby made game ${code} with Room 1 and Room 2 links`);

  const room2 = await open(link2, 'room2');
  await room2.waitForFunction(() => /live/.test(document.querySelector('#live-status').textContent));
  const room1 = await open(link1, 'room1');
  expect((await room1.textContent('#game-code')) === code, 'room1 shows the game code');

  await sing(room1, 'Alan');
  await room1.click('#send');
  await room1.waitForSelector('#handoff:not([hidden])');
  expect(/^Sent!/.test(await room1.textContent('#handoff-text')), 'room1 says Sent!');
  const doc = relay.get(code)[0];
  const perSecond = doc.payload.length / 2.3;
  expect(perSecond * 20 < 1_000_000, `a 20 s recording must fit one database entry (${Math.round(perSecond * 20)} bytes)`);
  step(`Room 1 sang and pressed Send: no file saved (${Math.round(doc.payload.length / 1024)} KB sent)`);

  await room2.waitForSelector('#inbox button', { timeout: 3000 });
  step('Room 2 got it by itself, with the page already open');
  await room2.click('#play-flip');
  await room2.waitForSelector('#play-flip[data-playing]', { timeout: 5000 });
  const cards = await room2.$$eval('.card', (els) => els.length);
  expect(cards === 10, 'wall should have 10 cards, got ' + cards);
  const answer = await answerOf(room2, 0);
  await room2.click(`.card[data-id="${answer}"]`);
  await room2.click('#lock');
  await room2.waitForSelector('#result:not([hidden])');
  expect((await room2.textContent('#verdict')) === 'Correct!', 'expected Correct!');
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
  step('second recording arrived live; wrong guess revealed; score 1 of 2');

  const late = await open(link2, 'late-guesser');
  await late.waitForSelector('#inbox button >> nth=1', { timeout: 3000 });
  step('a Room 2 player who opens the page late gets both recordings');
  const other = await open(link2.replace(/#.*/, '#ZZZZ'), 'other-game');
  await other.waitForTimeout(1200);
  expect(!(await other.$('#inbox button')), 'another game must not see these recordings');
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
