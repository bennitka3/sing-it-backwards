// The deck: every song is a card on Room 2's wall and can be dealt to Room 1.
import { SONGS } from './songs.js';

export const deck = () => SONGS.slice();
export const wallOf = (songs) => songs.map(({ id, title, kind }) => ({ id, title, kind }));
