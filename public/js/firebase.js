// ═══════════════════════════════════════════════════════
//  js/firebase.js
//  Initialize Firebase.
//  Exposes auth and db globally for all other JS files.
// ═══════════════════════════════════════════════════════

// ── YOUR CONFIG ────────────────────────────────────────
// Get this from Firebase Console
// → Project Settings → Your Apps → SDK setup and configuration

  const firebaseConfig = {
    apiKey:            "AIzaSyBV5Km2vsFxD3rAYsQBXxI_XT-7JQ--AiM",
    authDomain:        "shareamigo-3fe59.firebaseapp.com",
    projectId:         "shareamigo-3fe59",
    storageBucket:     "shareamigo-3fe59.firebasestorage.app",
    messagingSenderId: "890515174763",
    appId:             "1:890515174763:web:bfcb6dfdd31c374a22c82e"
  };

// Initialize
firebase.initializeApp(firebaseConfig);

// Global references — used by auth.js, sync.js, history.js
const auth = firebase.auth();
const db   = firebase.firestore();

// Persist login across browser sessions
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Current logged-in user — set by auth.js onAuthStateChanged
let currentUser = null;

console.log('🔥 Firebase initialized');