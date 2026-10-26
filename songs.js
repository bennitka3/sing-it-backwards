// The song list. Shared by the server and the browser (pure data, no imports).
// Nursery songs and Happy Birthday are public domain, so they ship with a built-in tune
// (melody only, synthesized in the browser). Pop songs have no audio until the host
// records or uploads a clip on the Host page.
//
// melody: "NOTE:beats ..." where NOTE is like C4, F#4, Bb3. tempo is beats per minute.

export const SONGS = [
  {
    id: 'twinkle', title: 'Twinkle, Twinkle, Little Star', kind: 'nursery', tempo: 112,
    melody: 'C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2',
  },
  {
    id: 'mary-lamb', title: 'Mary Had a Little Lamb', kind: 'nursery', tempo: 120,
    melody: 'E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:2 D4:1 D4:1 D4:2 E4:1 G4:1 G4:2',
  },
  {
    id: 'row-boat', title: 'Row, Row, Row Your Boat', kind: 'nursery', tempo: 112,
    melody: 'C4:1.5 C4:1.5 C4:1 D4:0.5 E4:1.5 E4:1 D4:0.5 E4:1 F4:0.5 G4:3 ' +
      'C5:0.5 C5:0.5 C5:0.5 G4:0.5 G4:0.5 G4:0.5 E4:0.5 E4:0.5 E4:0.5 C4:0.5 C4:0.5 C4:0.5 ' +
      'G4:1 F4:0.5 E4:1 D4:0.5 C4:3',
  },
  {
    id: 'london-bridge', title: 'London Bridge Is Falling Down', kind: 'nursery', tempo: 120,
    melody: 'G4:1.5 A4:0.5 G4:1 F4:1 E4:1 F4:1 G4:2 D4:1 E4:1 F4:2 E4:1 F4:1 G4:2',
  },
  {
    id: 'old-macdonald', title: 'Old MacDonald Had a Farm', kind: 'nursery', tempo: 132,
    melody: 'G4:1 G4:1 G4:1 D4:1 E4:1 E4:1 D4:2 B4:1 B4:1 A4:1 A4:1 G4:4',
  },
  {
    id: 'happy-birthday', title: 'Happy Birthday to You', kind: 'nursery', tempo: 100,
    melody: 'C4:0.75 C4:0.25 D4:1 C4:1 F4:1 E4:2 C4:0.75 C4:0.25 D4:1 C4:1 G4:1 F4:2',
  },
  { id: 'dont-stop-believin', title: "Don't Stop Believin'", artist: 'Journey', kind: 'pop' },
  { id: 'ymca', title: 'Y.M.C.A.', artist: 'Village People', kind: 'pop' },
  { id: 'sweet-caroline', title: 'Sweet Caroline', artist: 'Neil Diamond', kind: 'pop' },
  { id: 'bohemian-rhapsody', title: 'Bohemian Rhapsody', artist: 'Queen', kind: 'pop' },
  { id: 'livin-on-a-prayer', title: "Livin' on a Prayer", artist: 'Bon Jovi', kind: 'pop' },
  { id: 'dancing-queen', title: 'Dancing Queen', artist: 'ABBA', kind: 'pop' },
];
