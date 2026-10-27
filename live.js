// Live sending: Room 1 adds its recording to the game in Firebase; every open Room 2 hears it at once.
// A recording is the same WAV a saved file would be (answer scrambled inside), as base64.
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
let ready;

// A transport has: add(game, kind, doc) for a new entry, put(game, kind, id, doc) for an entry with a fixed id
// (first write wins), and watch(game, kind, onAdd(doc, fresh), onError). `kind` is 'recordings' or 'results'.
// `fresh` is false for entries that already existed when the page started watching.
function transport() {
  if (window.__liveTransport) return Promise.resolve(window.__liveTransport); // the browser test's stand-in
  if (!FIREBASE_CONFIG) return Promise.resolve(null);
  return (ready ||= (async () => {
    const [{ initializeApp }, f] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-firestore.js')]);
    const db = f.getFirestore(initializeApp(FIREBASE_CONFIG));
    const col = (game, kind) => f.collection(db, 'games', game, kind);
    return {
      add: (game, kind, doc) => f.addDoc(col(game, kind), { ...doc, createdAt: f.serverTimestamp() }),
      put: (game, kind, id, doc) => f.setDoc(f.doc(col(game, kind), id), { ...doc, createdAt: f.serverTimestamp() }),
      watch: (game, kind, onAdd, onError) => {
        let first = true;
        return f.onSnapshot(col(game, kind), (snap) => {
          for (const c of snap.docChanges()) if (c.type === 'added') onAdd(c.doc.data(), !first);
          first = false;
        }, onError);
      },
    };
  })().catch(() => null));
}

export const liveEnabled = () => !!(window.__liveTransport || FIREBASE_CONFIG);

// Don't hang forever on a network that blocks it.
const within = (p, ms = 15000) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

async function need() {
  const t = await transport();
  if (!t) throw new Error('Live sending is not set up.');
  return t;
}

export async function sendLive(game, doc) {
  await within((await need()).add(game, 'recordings', doc));
}

// Room 2's guess for one recording, so Room 1 and every other Room 2 page see it.
export async function sendResult(game, recordingId, result) {
  await within((await need()).put(game, 'results', recordingId, { recordingId, ...result }));
}

async function watch(game, kind, onAdd, onError) {
  const t = await transport();
  if (!t) { onError(new Error('not set up')); return () => {}; }
  return t.watch(game, kind, onAdd, onError);
}
export const watchLive = (game, onAdd, onError) => watch(game, 'recordings', onAdd, onError);
export const watchResults = (game, onAdd, onError = () => {}) => watch(game, 'results', onAdd, onError);

// Plays allowed, from the room link (room1.html?plays=3#K7QF). The lobby sets it; default when missing.
export function playLimit(fallback) {
  const n = parseInt(new URLSearchParams(location.search).get('plays'), 10);
  return n >= 1 && n <= 20 ? n : fallback;
}

// Game codes: the part after # in the room links, e.g. room2.html#K7QF.
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newGameCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export function gameCode() {
  const c = decodeURIComponent(location.hash.slice(1)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return c || null;
}
