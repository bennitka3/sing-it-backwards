// Audio helpers shared by every page: decode, cut, reverse, play, synthesize the built-in tunes,
// and record the microphone straight to WAV (WAV plays back in every browser, Safari included).

let ctx;
export function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export async function decode(arrayBuffer) {
  const c = audioCtx();
  return new Promise((resolve, reject) => {
    const p = c.decodeAudioData(arrayBuffer, resolve, reject);
    if (p && p.then) p.then(resolve, reject);
  });
}

function copyBuffer(buf, from, to, reversed) {
  const out = audioCtx().createBuffer(buf.numberOfChannels, Math.max(1, to - from), buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch).subarray(from, to);
    const dst = out.getChannelData(ch);
    if (reversed) for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
    else dst.set(src);
    // 20 ms fades so cut edges don't click.
    const f = Math.min(Math.floor(buf.sampleRate * 0.02), dst.length >> 1);
    for (let i = 0; i < f; i++) { const g = i / f; dst[i] *= g; dst[dst.length - 1 - i] *= g; }
  }
  return out;
}

export function reverse(buf) { return copyBuffer(buf, 0, buf.length, true); }

// start and duration in seconds; duration 0 means "to the end".
export function cut(buf, start = 0, duration = 0) {
  const sr = buf.sampleRate;
  const from = Math.min(buf.length - 1, Math.max(0, Math.round(start * sr)));
  const to = duration > 0 ? Math.min(buf.length, from + Math.round(duration * sr)) : buf.length;
  return copyBuffer(buf, from, to, false);
}

// --- playback: one sound at a time across the page ---
let current = null;
export function play(buf, onEnd) {
  stop();
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.onended = () => { if (current === src) current = null; onEnd && onEnd(); };
  src.start();
  current = src;
  return src;
}
export function stop() {
  if (!current) return;
  const s = current;
  current = null;
  try { s.stop(); } catch {}
}

// --- built-in tunes: a soft "ooh" voice sung from the melody in songs.js ---
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(note) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(note);
  if (!m) throw new Error('Bad note ' + note);
  const midi = 12 * (Number(m[3]) + 1) + STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

export async function renderMelody(melody, tempo) {
  const notes = melody.trim().split(/\s+/).map((t) => { const [n, d] = t.split(':'); return { f: freq(n), d: parseFloat(d || '1') }; });
  const spb = 60 / tempo;
  const total = notes.reduce((a, n) => a + n.d * spb, 0) + 0.25;
  const sr = 44100;
  const oc = new OfflineAudioContext(1, Math.ceil(total * sr), sr);
  const master = oc.createGain();
  master.gain.value = 0.22;
  const tone = oc.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 1600;
  tone.Q.value = 0.7;
  tone.connect(master).connect(oc.destination);
  const lfo = oc.createOscillator();
  lfo.frequency.value = 5.2;
  const depth = oc.createGain();
  depth.gain.value = 18; // cents of vibrato
  lfo.connect(depth);
  lfo.start(0);

  let t = 0.15;
  for (const n of notes) {
    const dur = n.d * spb;
    const env = oc.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.05);
    env.gain.linearRampToValueAtTime(0.75, t + Math.min(0.2, dur * 0.5));
    env.gain.setValueAtTime(0.75, t + Math.max(0.06, dur - 0.09));
    env.gain.linearRampToValueAtTime(0, t + Math.max(0.08, dur - 0.02));
    env.connect(tone);
    for (const [type, detune, level] of [['sawtooth', -6, 0.5], ['triangle', 6, 0.9]]) {
      const o = oc.createOscillator();
      o.type = type;
      o.frequency.value = n.f;
      o.detune.value = detune;
      depth.connect(o.detune);
      const g = oc.createGain();
      g.gain.value = level;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(t + dur);
    }
    t += dur;
  }
  return oc.startRendering();
}

// The forward audio for a song: its clip (WAV bytes) or its built-in tune.
export async function songAudio(song) {
  if (song.clip) return loadAudio(typeof song.clip === 'string' ? fromBase64(song.clip) : song.clip);
  return renderMelody(song.melody, song.tempo);
}

// --- microphone -> WAV ---
export function micAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export class Recorder {
  async start(onLevel) {
    if (!micAvailable()) throw new Error('This browser can only use the microphone on a secure (https) link or on localhost.');
    const c = audioCtx();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
    });
    this.source = c.createMediaStreamSource(this.stream);
    this.proc = c.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(d));
      if (onLevel) {
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] * d[i];
        onLevel(Math.min(1, Math.sqrt(sum / (d.length / 4)) * 4));
      }
    };
    this.silent = c.createGain();
    this.silent.gain.value = 0;
    this.source.connect(this.proc);
    this.proc.connect(this.silent).connect(c.destination);
    this.sampleRate = c.sampleRate;
  }

  stop() {
    this.proc.onaudioprocess = null;
    try { this.source.disconnect(); this.proc.disconnect(); this.silent.disconnect(); } catch {}
    this.stream.getTracks().forEach((t) => t.stop());
    const len = this.chunks.reduce((a, c) => a + c.length, 0);
    const data = new Float32Array(len);
    let off = 0;
    for (const c of this.chunks) { data.set(c, off); off += c.length; }
    const buffer = audioCtx().createBuffer(1, Math.max(1, len), this.sampleRate);
    buffer.getChannelData(0).set(data);
    return { buffer, blob: encodeWav(data, this.sampleRate), samples: data, sampleRate: this.sampleRate, seconds: len / this.sampleRate };
  }
}

// Mix any buffer down to one channel.
export function mono(buf) {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const out = new Float32Array(buf.length);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < out.length; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}

export function bufferToWav(buf, extra) { return encodeWav(mono(buf), buf.sampleRate, extra); }

// 16-bit mono WAV. extra: {fourcc: Uint8Array} chunks written after the audio (how a recording carries its answer).
export function encodeWav(samples, sampleRate, extra = {}) {
  // Halve the rate when it's high: smaller files, still plenty for a voice.
  let rate = sampleRate;
  if (sampleRate >= 44100) {
    const half = new Float32Array(samples.length >> 1);
    for (let i = 0; i < half.length; i++) half[i] = (samples[2 * i] + samples[2 * i + 1]) / 2;
    samples = half;
    rate = sampleRate / 2;
  }
  const chunks = Object.entries(extra);
  const extraSize = chunks.reduce((a, [, d]) => a + 8 + d.length + (d.length & 1), 0);
  const dataSize = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataSize + extraSize);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + dataSize + extraSize, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, dataSize, true);
  for (let i = 0, o = 44; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let o = 44 + dataSize;
  for (const [id, d] of chunks) {
    str(o, id); v.setUint32(o + 4, d.length, true);
    new Uint8Array(buf, o + 8, d.length).set(d);
    o += 8 + d.length + (d.length & 1);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

// Read a 16-bit PCM WAV (ours) into an AudioBuffer plus its extra chunks. Returns null if it isn't one.
export function parseWav(arrayBuffer) {
  const v = new DataView(arrayBuffer);
  const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (arrayBuffer.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let fmt = null, data = null;
  const chunks = {};
  for (let o = 12; o + 8 <= arrayBuffer.byteLength;) {
    const id = tag(o), size = v.getUint32(o + 4, true);
    const body = o + 8;
    if (id === 'fmt ') fmt = { format: v.getUint16(body, true), channels: v.getUint16(body + 2, true), rate: v.getUint32(body + 4, true), bits: v.getUint16(body + 14, true) };
    else if (id === 'data') data = { offset: body, size: Math.min(size, arrayBuffer.byteLength - body) };
    else chunks[id] = new Uint8Array(arrayBuffer.slice(body, Math.min(body + size, arrayBuffer.byteLength)));
    o = body + size + (size & 1);
  }
  if (!fmt || !data || fmt.format !== 1 || fmt.bits !== 16) return { buffer: null, chunks };
  const frames = Math.floor(data.size / (2 * fmt.channels));
  const buffer = audioCtx().createBuffer(fmt.channels, Math.max(1, frames), fmt.rate);
  for (let ch = 0; ch < fmt.channels; ch++) {
    const out = buffer.getChannelData(ch);
    for (let i = 0; i < frames; i++) out[i] = v.getInt16(data.offset + (i * fmt.channels + ch) * 2, true) / 0x8000;
  }
  return { buffer, chunks };
}

// Any audio file (ours or an MP3) -> AudioBuffer.
export async function loadAudio(arrayBuffer) {
  const w = parseWav(arrayBuffer);
  if (w && w.buffer) return w.buffer;
  return decode(arrayBuffer.slice(0));
}

// The answer travels inside the recording, scrambled so it can't be read by opening the file.
const KEY = new TextEncoder().encode('sing-it-backwards');
export function scramble(obj) {
  const b = new TextEncoder().encode(JSON.stringify(obj));
  return b.map((x, i) => x ^ KEY[i % KEY.length]);
}
export function unscramble(bytes) {
  try { return JSON.parse(new TextDecoder().decode(bytes.map((x, i) => x ^ KEY[i % KEY.length]))); } catch { return null; }
}

export async function toBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

// Save a file to the viewer's Downloads.
export function saveFile(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

// --- a tiny key/value store in the browser (IndexedDB), so a reload keeps what you loaded ---
let dbp;
function idb() {
  return (dbp ||= new Promise((resolve, reject) => {
    const r = indexedDB.open('sing-it-backwards', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function kvGet(key) {
  try {
    const db = await idb();
    return await new Promise((resolve, reject) => {
      const q = db.transaction('kv').objectStore('kv').get(key);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
  } catch { return undefined; }
}
export async function kvSet(key, value) {
  try {
    const db = await idb();
    await new Promise((resolve, reject) => {
      const t = db.transaction('kv', 'readwrite');
      if (value === undefined) t.objectStore('kv').delete(key); else t.objectStore('kv').put(value, key);
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  } catch {}
}

// --- small page helpers ---
export const $ = (sel, root = document) => root.querySelector(sel);
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
