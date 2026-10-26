// The deck: which songs are on the wall and which can be dealt. It comes from the site's pack.json
// (made on the Host page and uploaded to the repo); without one, it's the built-in list.
import { SONGS } from './songs.js';

export const PACK_APP = 'sing-it-backwards';
export const defaultDeck = () => SONGS.map((s) => ({ ...s, inPlay: true }));
export const playable = (s) => s.inPlay && !!(s.clip || s.melody);
export const wallOf = (deck) => deck.map(({ id, title, artist, kind }) => ({ id, title, artist: artist || '', kind }));
export const isPack = (o) => !!(o && o.app === PACK_APP && Array.isArray(o.songs));

// A pack stores clips as base64 WAV; built-in tunes are looked up by id so packs stay small.
export function deckFromPack(pack) {
  return pack.songs.map((s) => {
    const builtin = SONGS.find((b) => b.id === s.id);
    return { ...(builtin || {}), ...s };
  });
}

export async function loadSiteDeck() {
  try {
    const res = await fetch('pack.json', { cache: 'no-cache' });
    if (res.ok) {
      const pack = await res.json();
      if (isPack(pack)) return { deck: deckFromPack(pack), fromPack: true };
    }
  } catch {}
  return { deck: defaultDeck(), fromPack: false };
}
