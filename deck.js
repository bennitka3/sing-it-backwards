// The deck: which songs are on the wall and which can be dealt. Without a song pack from the host,
// it's the built-in list (only the songs with a built-in tune can be dealt).
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
