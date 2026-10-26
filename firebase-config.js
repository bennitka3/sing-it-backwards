// Live sending between Room 1 and Room 2 goes through a free Google Firebase database.
// Paste the config from the Firebase console here (docs/LIVE-SETUP.md). These values are not secret:
// Firebase web configs are meant to be public; firestore.rules is what limits what anyone can do.
// Set it to null and the game falls back to passing recordings as files.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBVgbAUGZhWd-pVhmoXd4twEgDpo53grVo',
  authDomain: 'sing-it-backwards-c0027.firebaseapp.com',
  projectId: 'sing-it-backwards-c0027',
  storageBucket: 'sing-it-backwards-c0027.firebasestorage.app',
  messagingSenderId: '716932440916',
  appId: '1:716932440916:web:a86e7178ff074868371ec1',
};
