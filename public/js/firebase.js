// ═══════════════════════════════════════════════════════
//  js/firebase.js
//  Initialize Firebase.
//  Exposes auth and db globally for all other JS files.
// ═══════════════════════════════════════════════════════

// ── YOUR CONFIG ───────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBV5Km2vsFxD3rAYsQBXxI_XT-7JQ--AiM",
  authDomain:        "shareamigo-3fe59.firebaseapp.com",
  projectId:         "shareamigo-3fe59",
  storageBucket:     "shareamigo-3fe59.firebasestorage.app",
  messagingSenderId: "890515174763",
  appId:             "1:890515174763:web:bfcb6dfdd31c374a22c82e"
};

// ── INITIALIZE ────────────────────────────────────────
firebase.initializeApp(firebaseConfig);

// Global references — used by auth.js, sync.js, history.js
const auth = firebase.auth();
const db   = firebase.firestore();

// ── PERSIST LOGIN ACROSS SESSIONS ────────────────────
// User stays logged in even after closing the browser
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// ── FIRESTORE OFFLINE PERSISTENCE ────────────────────
// App works briefly even if internet drops
db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open — only one tab can use persistence
      console.warn('⚠️  Firestore persistence: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // Browser does not support persistence
      console.warn('⚠️  Firestore persistence not supported here');
    }
  });

// ── FIRESTORE CACHE SETTINGS ──────────────────────────
// Unlimited cache size — handles large history smoothly
db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// ── CURRENT USER ──────────────────────────────────────
// Set by auth.js onAuthStateChanged
// Used by sync.js, history.js, room.js
let currentUser = null;

console.log('🔥  Firebase initialized');