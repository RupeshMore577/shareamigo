// ── FIREBASE INIT ─────────────────────────────────────
// We use the CDN version (no npm needed for frontend)
// This file just initializes Firebase and exports the services
// All other JS files use: auth, db from this file

// Wait for Firebase SDKs to load (they come from index/login HTML)
// then expose auth and db globally

let auth, db;

function initFirebase() {
  const firebaseConfig = {
    apiKey:            "AIzaSyBV5Km2vsFxD3rAYsQBXxI_XT-7JQ--AiM",
    authDomain:        "shareamigo-3fe59.firebaseapp.com",
    projectId:         "shareamigo-3fe59",
    storageBucket:     "shareamigo-3fe59.firebasestorage.app",
    messagingSenderId: "890515174763",
    appId:             "1:890515174763:web:bfcb6dfdd31c374a22c82e"
  };

  // Initialize the Firebase app
  const app = firebase.initializeApp(firebaseConfig);

  // Firebase Authentication — handles login/signup/google/logout
  auth = firebase.auth();

  // Firestore — our real-time database for clipboard sync
  db = firebase.firestore();

  console.log('Firebase initialized ✅');
}