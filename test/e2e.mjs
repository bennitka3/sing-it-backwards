// Plays whole rounds in Chromium with a fake microphone (Chromium's test tone), passing files between
// the rooms the way players do through their team chat.
//   node test/e2e.mjs [screenshot-dir]
// Needs Playwright (npm install --no-save playwright).
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
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
const contexts = {};
async function open(p, name, viewport = { width: 1200, height: 900 }, setup) {
  // Each room is its own "computer": its own browser storage.
  if (!contexts[name]) {
    contexts[name] = await browser.newContext({ permissions: ['microphone'], viewport, acceptDownloads: true });
    if (setup) await setup(contexts[name]);
  }
  const page = await contexts[name].newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  await page.goto(base + p);
  return page;
}
const shot = (page, n) => shots && page.screenshot({ path: path.join(shots, n + '.png'), fullPage: true });
async function download(page, click) {
  const [d] = await Promise.all([page.waitForEvent('download'), page.click(click)]);
  const file = path.join(tmp, d.suggestedFilename());
  await d.saveAs(file);
  return file;
}
const step = (s) => console.log('✓', s);
const expect = (ok, msg) => { if (!ok) throw new Error(msg); };

// A 3-second 440 Hz WAV standing in for "an MP3 the host owns".
function toneWav(seconds = 3, rate = 44100) {
  const n = seconds * rate, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), 44 + i * 2);
  return b;
}

async function singAndSave(room1, name) {
  await room1.fill('#player', name);
  await room1.click('#draw');
  await room1.waitForSelector('#play-back:not([disabled])', { timeout: 10000 });
  await room1.click('#play-back');
  await room1.waitForTimeout(300);
  await room1.click('#rec');
  await room1.waitForTimeout(2000);
  await room1.click('#rec');
  await room1.waitForSelector('#take:not([hidden])');
  const file = await download(room1, '#save');
  await room1.waitForSelector('#handoff:not([hidden])');
  return file;
}

try {
  await shot(await open('/', 'lobby'), 'lobby');
  step('lobby loads');

  // Host: one pop song with a loaded file, one with a recorded clip; only those two in the draw.
  const host = await open('/host.html', 'host');
  await host.waitForSelector('.song-row');
  const mp3 = path.join(tmp, 'ymca-i-own.wav');
  await writeFile(mp3, toneWav());
  await host.setInputFiles('.song-row[data-id="ymca"] input[type=file]', mp3);
  await host.waitForSelector('.song-row[data-id="ymca"] .status.ok');
  await host.fill('#start-ymca', '0.5'); // the "chorus" starts half a second in
  await host.dispatchEvent('#start-ymca', 'change');
  await host.click('.song-row[data-id="ymca"] [data-act="back"]');
  await host.click('.song-row[data-id="sweet-caroline"] [data-act="rec"]');
  await host.waitForSelector('.song-row[data-id="sweet-caroline"] .status.ok', { timeout: 10000 }); // stops by itself at 7 s
  const clipLen = await host.evaluate(async () => {
    const a = await import('./audio.js');
    const st = await new Promise((res) => { const q = indexedDB.open('sing-it-backwards'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('host'); g.onsuccess = () => res(g.result); }; });
    return (await a.loadAudio(st.edits['sweet-caroline'].source)).duration;
  });
  expect(clipLen > 6.5 && clipLen < 7.6, 'host recording should stop at 7 s, was ' + clipLen);
  for (const id of ['twinkle', 'mary-lamb', 'row-boat', 'london-bridge', 'old-macdonald', 'happy-birthday']) {
    await host.uncheck(`#inplay-${id}`);
  }
  await host.fill('#add-title', 'Baby Shark');
  await host.click('#add button[type=submit]');
  await host.waitForSelector('text=Baby Shark');
  const ready = await host.textContent('#ready-count');
  expect(/^2 songs ready/.test(ready), 'host ready count: ' + ready);
  await shot(host, 'host');
  const pack = await download(host, '#export');
  step(`Host made a song pack (${ready})`);
  await host.reload();
  await host.waitForSelector('.song-row[data-id="ymca"] .status.ok');
  step('Host page remembers its clips after a reload');

  // Publish: the site now serves that pack.json (stand-in for ben uploading it to the repo).
  const packBody = await readFile(pack);
  const packJson = JSON.parse(packBody);
  expect(path.basename(pack) === 'pack.json', 'host should save pack.json');
  const pop = packJson.songs.find((x) => x.id === 'ymca');
  expect(pop.clip && !packJson.songs.find((x) => x.id === 'twinkle').clip, 'pack holds only the clips the host made');

  // Round 1: Room 1 opens the site and gets the pack's songs with no download.
  const room1 = await open('/room1.html', 'room1', undefined, async (ctx) => {
    await ctx.route('**/pack.json', (route) => route.fulfill({ body: packBody, contentType: 'application/json' }));
  });
  await room1.waitForFunction(() => /2 songs in the draw, 13 cards/.test(document.querySelector('#deck-status').textContent));
  const rec1 = await singAndSave(room1, 'Alan');
  await shot(room1, 'room1-saved');
  step('Room 1 got the site\'s songs with no download, drew a pop song, sang and saved ' + path.basename(rec1));

  const room2 = await open('/room2.html', 'room2');
  await room2.setInputFiles('#files', rec1);
  await room2.waitForSelector('#inbox button');
  await room2.click('#play-flip');
  await room2.waitForSelector('#play-flip[data-playing]', { timeout: 5000 });
  const cards = await room2.$$eval('.card', (els) => els.length);
  expect(cards === 13, 'wall should have 13 cards incl. Baby Shark, got ' + cards);
  // Peek at the answer the way the page does, to pick the right card in the test.
  const answer = await room2.evaluate(async () => {
    const v = await new Promise((res) => { const q = indexedDB.open('sing-it-backwards'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('room2'); g.onsuccess = () => res(g.result); }; });
    return v[0].songId;
  });
  expect(['ymca', 'sweet-caroline'].includes(answer), 'pack draw should be a pop song, got ' + answer);
  await room2.click(`.card[data-id="${answer}"]`);
  await room2.click('#lock');
  await room2.waitForSelector('#result:not([hidden])');
  expect((await room2.textContent('#verdict')) === 'Correct!', 'expected Correct!');
  await room2.click('#play-real');
  await room2.waitForSelector('#play-real[data-playing]', { timeout: 5000 });
  await shot(room2, 'room2-result');
  step(`Room 2 opened it, played it flipped, picked ${answer}: Correct!, and heard the real clip`);

  // Round 2: a site with no pack.json yet uses the built-in songs; a wrong guess.
  const room1b = await open('/room1.html', 'room1b');
  await room1b.waitForFunction(() => /^6 songs in the draw, 12 cards/.test(document.querySelector('#deck-status').textContent));
  const tuneLens = await room1b.evaluate(async () => {
    const a = await import('./audio.js');
    const { SONGS } = await import('./songs.js');
    const out = [];
    for (const s of SONGS.filter((x) => x.melody)) out.push((await a.renderMelody(s.melody, s.tempo)).duration);
    return out;
  });
  expect(tuneLens.every((d) => d > 6.9 && d < 7.8), 'built-in tunes should be about 7 s: ' + tuneLens.join(', '));
  step('built-in tunes are ' + tuneLens.map((d) => d.toFixed(1)).join(', ') + ' s long');
  const rec2 = await singAndSave(room1b, 'Bea');
  await room2.setInputFiles('#files', rec2);
  await room2.waitForSelector('#inbox button >> nth=1');
  await room2.click('.card[data-id="bohemian-rhapsody"]');
  await room2.click('#lock');
  await room2.waitForSelector('#result:not([hidden])');
  expect((await room2.textContent('#verdict')) === 'Not quite.', 'expected a wrong guess');
  await room2.click('#play-real');
  await room2.waitForSelector('#play-real[data-playing]', { timeout: 5000 });
  expect((await room2.textContent('#score')) === '1 of 2 right', 'score');
  step('Round 2 with built-in songs: wrong guess revealed, built-in tune played, score 1 of 2');

  await room2.reload();
  await room2.waitForSelector('#inbox button >> nth=1');
  step('Room 2 keeps its recordings and score after a reload');

  await room2.setInputFiles('#files', mp3);
  await room2.waitForSelector('#msg.error:not([hidden])');
  step('Room 2 rejects a file that is not a Room 1 recording');

  for (const p of ['/', '/room1.html', '/room2.html', '/host.html']) {
    const page = await open(p, 'phone', { width: 390, height: 844 });
    await page.waitForTimeout(300);
    expect(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), p + ' scrolls sideways on a phone');
    if (p === '/room2.html') await shot(page, 'room2-phone');
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
