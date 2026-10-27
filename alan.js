// The host: Alan Cumming's cutout head (a CC BY 2.0 photo, credited on every page) on a drawn outfit, popping up
// in the corner with a line at key moments. Purely decoration: if anything here fails, the game carries on.

const LINES = {
  lobby: ['Welcome to my castle.', 'Come in, come in. The round table awaits.', 'Ah, Faithfuls. Or are you?',
    'Tonight, we sing… backwards.', 'Gather round, my darlings.'],
  drawn: ['Your secret song awaits. Tell no one.', 'Guard this tune with your life.',
    'Only you know the song. Keep it that way.', 'Listen closely. Then sing it back… backwards.',
    'Not a word to the other room.'],
  sent: ['Sealed and sent to the round table.', 'Your song is on its way. No turning back now.',
    "Delivered. Let's see if they're worthy.", "It's in their hands now.", 'The deed is done.'],
  arrived: ['Listen closely, Faithfuls.', 'A message has arrived from the other room.',
    'Play it. Then trust your ears.', 'What on earth did they sing?', "Gather round. Something's arrived."],
  right: ['Faithful! You found it.', 'Bravo, my darlings!', 'Magnificent. The castle is proud.', 'You cracked it!',
    'A triumph at the round table!'],
  wrong: ['Not quite, Faithfuls. On to the next one.', 'So close. Shake it off.',
    'Ooh, not that one. Better luck next round.', 'The song lives to fool another day.',
    'Never mind. Keep your wits about you.'],
};

const SH = 'M4 104 C6 50 40 22 100 18 C160 22 194 50 196 104 Z'; // shoulders
const SHIRT = '<path d="M80 18 L100 60 L120 18 Z" fill="#f4efe6"/>';
const OUTFITS = {
  lobby: { front: `<path d="${SH}" fill="url(#alan-tartan)"/>${SHIRT}<path d="M100 60 L92 30 L108 30 Z" fill="#1a1a1a"/>
    <path d="M80 18 L100 70 L64 104 L52 104 L70 22 Z" fill="#5a1414" opacity=".9"/><path d="M120 18 L100 70 L136 104 L148 104 L130 22 Z" fill="#5a1414" opacity=".9"/>
    <circle cx="150" cy="58" r="14" fill="#d9d9d9" stroke="#8a8a8a" stroke-width="3"/><circle cx="150" cy="58" r="5" fill="#9b2020"/>` },
  drawn: { back: `<path d="M18 300 L28 120 C30 40 70 4 100 4 C130 4 170 40 172 120 L182 300 Z" fill="#141010"/>
    <path d="M40 300 L46 130 C50 60 78 26 100 26 C122 26 150 60 154 130 L160 300 Z" fill="#2b1818"/>`,
    front: `<path d="M0 104 C4 40 50 10 100 8 C150 10 196 40 200 104 Z" fill="#141010"/><path d="M100 30 L86 104 M100 30 L114 104" stroke="#6b5a44" stroke-width="3"/>
    <circle cx="100" cy="30" r="9" fill="#d0a64e"/>` },
  sent: { front: `<path d="${SH}" fill="#4a1238"/>${SHIRT}<path d="M92 26 Q100 44 108 26 Q100 36 92 26" fill="#d0a64e"/>
    <path d="M80 18 L100 64 L72 104 L60 104 L72 22 Z" fill="#2c0b22"/><path d="M120 18 L100 64 L128 104 L140 104 L128 22 Z" fill="#2c0b22"/>
    <rect x="132" y="50" width="44" height="30" rx="3" fill="#f3e9d2" transform="rotate(-12 154 65)"/><circle cx="154" cy="65" r="6" fill="#9b2020"/>` },
  arrived: { front: `<path d="${SH}" fill="#2a3a52"/>${SHIRT}
    <path d="M30 70 C40 30 70 16 100 18 C130 16 160 30 170 70 C150 50 128 40 100 44 C72 40 50 50 30 70 Z" fill="#e8e0d0"/>
    <circle cx="68" cy="66" r="16" fill="#c0c0c0" stroke="#7d7d7d" stroke-width="3"/><path d="M60 66 L76 66 M68 58 L68 74" stroke="#2a3a52" stroke-width="3"/>` },
  right: { front: `<path d="${SH}" fill="url(#alan-sequin)"/>${SHIRT}<path d="M88 22 L100 34 L112 22 L112 40 L100 34 L88 40 Z" fill="#111"/>
    <path d="M80 18 L100 66 L66 104 L56 104 L70 22 Z" fill="#111"/><path d="M120 18 L100 66 L134 104 L144 104 L130 22 Z" fill="#111"/>` },
  wrong: { front: `<path d="${SH}" fill="#5b4a3a"/>${SHIRT}
    <path d="M70 22 C80 40 120 40 130 22 L136 34 C120 54 80 54 64 34 Z" fill="url(#alan-tartan)"/>
    <path d="M118 44 L132 104 L112 104 L106 48 Z" fill="url(#alan-tartan)"/>` },
};

const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <pattern id="alan-tartan" width="28" height="28" patternUnits="userSpaceOnUse">
    <rect width="28" height="28" fill="#8e1c1c"/><rect y="9" width="28" height="9" fill="#1f3b2a" opacity=".85"/>
    <rect x="9" width="9" height="28" fill="#1f3b2a" opacity=".6"/><rect y="22" width="28" height="2" fill="#d0a64e" opacity=".8"/>
    <rect x="22" width="2" height="28" fill="#d0a64e" opacity=".55"/></pattern>
  <pattern id="alan-sequin" width="8" height="8" patternUnits="userSpaceOnUse">
    <rect width="8" height="8" fill="#b88a2c"/><circle cx="4" cy="4" r="2.6" fill="#f1d27a"/></pattern>
</defs></svg>`;

const last = {};
function pick(moment) {
  const lines = LINES[moment];
  let i = Math.floor(Math.random() * lines.length);
  if (lines.length > 1 && i === last[moment]) i = (i + 1) % lines.length; // never the same line twice running
  last[moment] = i;
  return lines[i];
}

let box, hideTimer;
export function showAlan(moment) {
  try {
    if (!LINES[moment]) return;
    if (!box) {
      document.body.insertAdjacentHTML('beforeend', DEFS);
      box = document.createElement('div');
      box.className = 'alan';
      box.setAttribute('role', 'status');
      document.body.append(box);
    }
    const o = OUTFITS[moment];
    box.innerHTML = `<p class="alan-bubble"></p><div class="alan-figure">
      ${o.back ? `<svg class="alan-back" viewBox="0 0 200 300" aria-hidden="true">${o.back}</svg>` : ''}
      <img src="img/alan-head.png" alt="" onerror="this.closest('.alan').hidden = true">
      <svg class="alan-front" viewBox="0 0 200 104" aria-hidden="true">${o.front}</svg></div>`;
    box.querySelector('.alan-bubble').textContent = pick(moment);
    box.dataset.moment = moment;
    box.hidden = false;
    box.classList.remove('in');
    void box.offsetWidth; // restart the slide-in
    box.classList.add('in');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 6000);
  } catch {}
}

function hide() {
  if (box) { box.classList.remove('in'); box.hidden = true; }
}
