// Live sending between Room 1 and Room 2 goes through a free Google Firebase database.
// Paste the config from the Firebase console here (docs/LIVE-SETUP.md). These values are not secret:
// Firebase web configs are meant to be public; firestore.rules is what limits what anyone can do.
// Leave it null and the game falls back to passing recordings as files.
export const FIREBASE_CONFIG = null;
