# Turning on live sending (once, about 10 minutes)

Live sending lets Room 1's recording appear on every open Room 2 page by itself. It uses a free Google Firebase
database. Only the host does this setup, with any Google account. Players never log in to anything.

It's free (Firebase's "Spark" plan, no card). If it ever asks for billing details, stop: you've picked a paid option.

1. Go to https://console.firebase.google.com and sign in with your Google account.
2. **Create a project.** Name it `sing-it-backwards`. Turn Google Analytics **off** (not needed). Press Create.
3. In the left menu, open **Build → Firestore Database** and press **Create database**.
   - Location: any (the one closest to your players).
   - Mode: **production mode**. Press Create.
4. Open the **Rules** tab. Delete what's there, paste everything from `firestore.rules` in this repo, and press
   **Publish**.
5. Press the gear icon (top left) → **Project settings**. Under "Your apps", press the **web** icon (`</>`).
   Give it a nickname (`game`), leave "Firebase Hosting" unticked, and press **Register app**.
6. It shows a block that starts `const firebaseConfig = {`. Copy that block and paste it to Claude in the chat.
   It's safe to share: those values are meant to be public, and step 4's rules are what protect the database.

Claude then puts it in `firebase-config.js`. A minute later the site sends live. (Done 2026-10-26: project `sing-it-backwards-c0027`.)

## When firestore.rules changes

Paste the new `firestore.rules` into the same Rules tab and publish again (step 4). Latest change: 2026-10-26, so Room 1
hears Room 2's guess (the confetti in both rooms).

## Good to know

- Each recording is about 80 KB. The free plan holds about 1 GB, so thousands of games before anything fills up.
- Anyone with a game code can hear that game's recordings, and nobody can list other games. Codes are random, so
  start a new game for each group.
- If a work network blocks Firebase, Room 1 gets a "Save it as a file instead" button and the chat hand-off still
  works.
