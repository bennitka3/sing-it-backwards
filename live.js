// Live sending: Room 1 adds its recording to the game in Firebase; every open Room 2 hears it at once.
// A recording is the same WAV a saved file would be (answer scrambled inside), as base64.
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
let ready;

function transport() {
  if (window.__liveTransport) return Promise.resolve(window.__liveTransport); // the browser test's stand-in
  if (!FIREBASE_CONFIG) return Promise.resolve(null);
  return (ready ||= (async () => {
    const [{ initializeApp }, f] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-firestore.js')]);
    const db = f.getFirestore(initializeApp(FIREBASE_CONFIG));
    const col = (game) => f.collection(db, 'games', game, 'recordings');
    return {
      send: (game, doc) => f.addDoc(col(game), { ...doc, createdAt: f.serverTimestamp() }),
      watch: (game, onAdd, onError) => f.onSnapshot(col(game), (snap) => {
        for (const c of snap.docChanges()) if (c.type === 'added') onAdd(c.doc.data());
      }, onError),
    };
  })().catch(() => null));
}

export const liveEnabled = () => !!(window.__liveTransport || FIREBASE_CONFIG);

export async function sendLive(game, doc) {
  const t = await transport();
  if (!t) throw new Error('Live sending is not set up.');
  // Don't hang forever on a network that blocks it.
  await Promise.race([t.send(game, doc), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 15000))]);
}

export async function watchLive(game, onAdd, onError) {
  const t = await transport();
  if (!t) { onError(new Error('not set up')); return () => {}; }
  return t.watch(game, onAdd, onError);
}

// Game codes: the part after # in the room links, e.g. room2.html#K7QF.
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newGameCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export function gameCode() {
  const c = decodeURIComponent(location.hash.slice(1)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return c || null;
}
