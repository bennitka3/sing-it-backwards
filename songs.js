// The song list (pure data, no imports). All public domain, each with a built-in tune
// (melody only, synthesized in the browser): the famous first line, about 7 seconds.
//
// melody: "NOTE:beats ..." where NOTE is like C4, F#4, Bb3. tempo is beats per minute.

export const SONGS = [
  {
    id: 'twinkle', title: 'Twinkle, Twinkle, Little Star', kind: 'nursery', tempo: 137,
    melody: 'C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2',
  },
  {
    id: 'mary-lamb', title: 'Mary Had a Little Lamb', kind: 'nursery', tempo: 137,
    melody: 'E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:2 D4:1 D4:1 D4:2 E4:1 G4:1 G4:2',
  },
  {
    id: 'row-boat', title: 'Row, Row, Row Your Boat', kind: 'nursery', tempo: 103,
    melody: 'C4:1.5 C4:1.5 C4:1 D4:0.5 E4:1.5 E4:1 D4:0.5 E4:1 F4:0.5 G4:3',
  },
  {
    id: 'london-bridge', title: 'London Bridge Is Falling Down', kind: 'nursery', tempo: 137,
    melody: 'G4:1.5 A4:0.5 G4:1 F4:1 E4:1 F4:1 G4:2 D4:1 E4:1 F4:2 E4:1 F4:1 G4:2',
  },
  {
    id: 'old-macdonald', title: 'Old MacDonald Had a Farm', kind: 'nursery', tempo: 137,
    melody: 'G4:1 G4:1 G4:1 D4:1 E4:1 E4:1 D4:2 B4:1 B4:1 A4:1 A4:1 G4:4',
  },
  {
    id: 'happy-birthday', title: 'Happy Birthday to You', kind: 'nursery', tempo: 103,
    melody: 'C4:0.75 C4:0.25 D4:1 C4:1 F4:1 E4:2 C4:0.75 C4:0.25 D4:1 C4:1 G4:1 F4:2',
  },
  {
    id: 'frere-jacques', title: 'Frère Jacques (Are You Sleeping?)', kind: 'nursery', tempo: 137,
    melody: 'C4:1 D4:1 E4:1 C4:1 C4:1 D4:1 E4:1 C4:1 E4:1 F4:1 G4:2 E4:1 F4:1 G4:2',
  },
  {
    id: 'jingle-bells', title: 'Jingle Bells', kind: 'nursery', tempo: 137,
    melody: 'E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:0.5 E4:4',
  },
  {
    id: 'itsy-bitsy', title: 'The Itsy Bitsy Spider', kind: 'nursery', tempo: 107,
    melody: 'G3:0.5 C4:1 C4:0.5 C4:1 D4:0.5 E4:1.5 E4:1 E4:0.5 D4:1 C4:0.5 D4:1 E4:0.5 C4:3',
  },
  {
    id: 'hot-cross-buns', title: 'Hot Cross Buns', kind: 'nursery', tempo: 137,
    melody: 'E4:1 D4:1 C4:2 E4:1 D4:1 C4:2 C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5 E4:1 D4:1 C4:2',
  },
];
