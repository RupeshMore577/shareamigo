// ── AUTH SYSTEM ───────────────────────────────────────
// Handles: Login, Signup, Google Sign-in, Guest, Logout
// Works with Firebase Authentication

// ── CURRENT USER STATE ────────────────────────────────
// This is available globally across all JS files
let currentUser = null;   // Firebase user object if logged in
let isGuest     = false;  // true if user chose "Continue as Guest"

// ── LISTEN FOR AUTH STATE CHANGES ────────────────────
// This fires automatically when:
// - User logs in
// - User logs out
// - Page refreshes (session restored automatically)
function startAuthListener() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      // User is logged in
      currentUser = user;
      isGuest     = false;
      console.log('Logged in as:', user.email || user.displayName);
      onUserLoggedIn(user);
    } else {
      // No user — show login page if not guest
      currentUser = null;
      if (!isGuest) {
        showLoginPage();
      }
    }
  });
}

// ── CALLED WHEN USER IS CONFIRMED LOGGED IN ───────────
function onUserLoggedIn(user) {
  // Hide login page, show main app
  hidePage('login-page');
  showPage('main-app');

  // Update status bar with user info
  updateUserStatus(user);

  // Start clipboard sync for this user
  startClipboardSync(user.uid);
}

// ── SIGNUP WITH EMAIL + PASSWORD ──────────────────────
async function signUp() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  const name     = document.getElementById('auth-name').value.trim();

  if (!email || !password || !name) {
    showAuthError('Please fill in all fields');
    return;
  }

  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters');
    return;
  }

  try {
    showAuthLoading('Creating account...');

    // Create user in Firebase Auth
    const result = await auth.createUserWithEmailAndPassword(email, password);

    // Save display name
    await result.user.updateProfile({ displayName: name });

    // Create user document in Firestore
    await db.collection('users').doc(result.user.uid).set({
      name:      name,
      email:     email,
      uid:       result.user.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      clipboard: ''   // will store latest clipboard text
    });

    hideAuthLoading();
    // onAuthStateChanged fires automatically → onUserLoggedIn called

  } catch(e) {
    hideAuthLoading();
    showAuthError(friendlyError(e.code));
  }
}

// ── LOGIN WITH EMAIL + PASSWORD ───────────────────────
async function login() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value.trim();

  if (!email || !password) {
    showAuthError('Please enter email and password');
    return;
  }

  try {
    showAuthLoading('Signing in...');
    await auth.signInWithEmailAndPassword(email, password);
    hideAuthLoading();
    // onAuthStateChanged fires → onUserLoggedIn called

  } catch(e) {
    hideAuthLoading();
    showAuthError(friendlyError(e.code));
  }
}

// ── GOOGLE SIGN IN ────────────────────────────────────
async function loginWithGoogle() {
  try {
    showAuthLoading('Opening Google...');
    const provider = new firebase.auth.GoogleAuthProvider();
    const result   = await auth.signInWithPopup(provider);

    // If first time Google login → create Firestore doc
    const userDoc = await db.collection('users').doc(result.user.uid).get();
    if (!userDoc.exists) {
      await db.collection('users').doc(result.user.uid).set({
        name:      result.user.displayName,
        email:     result.user.email,
        uid:       result.user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        clipboard: ''
      });
    }

    hideAuthLoading();
    // onAuthStateChanged fires → onUserLoggedIn called

  } catch(e) {
    hideAuthLoading();
    showAuthError(friendlyError(e.code));
  }
}

// ── CONTINUE AS GUEST ─────────────────────────────────
function continueAsGuest() {
  isGuest     = true;
  currentUser = null;

  // Skip login, go straight to app
  hidePage('login-page');
  showPage('main-app');

  // Update status bar to show Guest
  updateUserStatus(null);

  console.log('Continuing as guest');
}

// ── LOGOUT ────────────────────────────────────────────
async function logout() {
  try {
    // Stop listening to clipboard sync
    stopClipboardSync();

    await auth.signOut();
    isGuest     = false;
    currentUser = null;

    // Show login page again
    hidePage('main-app');
    showPage('login-page');

    // Reset status bar
    updateUserStatus(null);

  } catch(e) {
    console.error('Logout error:', e);
  }
}

// ── USER STATUS BAR ───────────────────────────────────
function updateUserStatus(user) {
  const bar    = document.getElementById('user-status-bar');
  const name   = document.getElementById('user-status-name');
  const avatar = document.getElementById('user-status-avatar');

  if (!bar) return;

  if (user) {
    // Show logged in user info
    const displayName = user.displayName || user.email || 'User';
    name.textContent   = displayName;
    avatar.textContent = displayName[0].toUpperCase();
    bar.style.display  = 'flex';
  } else if (isGuest) {
    name.textContent   = 'Guest';
    avatar.textContent = 'G';
    bar.style.display  = 'flex';
  } else {
    bar.style.display = 'none';
  }
}

// ── UI HELPERS ────────────────────────────────────────
function showPage(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function hidePage(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent    = msg;
  el.style.display  = 'block';
}

function showAuthLoading(msg) {
  const el = document.getElementById('auth-loading');
  if (!el) return;
  el.textContent   = msg;
  el.style.display = 'block';
  document.getElementById('auth-error').style.display = 'none';
}

function hideAuthLoading() {
  const el = document.getElementById('auth-loading');
  if (el) el.style.display = 'none';
}

// ── TOGGLE LOGIN / SIGNUP FORM ────────────────────────
function showSignup() {
  document.getElementById('login-form').style.display  = 'none';
  document.getElementById('signup-form').style.display = 'block';
  document.getElementById('auth-error').style.display  = 'none';
}

function showLogin() {
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('login-form').style.display  = 'block';
  document.getElementById('auth-error').style.display  = 'none';
}

// ── FRIENDLY ERROR MESSAGES ───────────────────────────
function friendlyError(code) {
  const errors = {
    'auth/email-already-in-use':    'This email is already registered. Try logging in.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/weak-password':           'Password is too weak. Use at least 6 characters.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password. Try again.',
    'auth/too-many-requests':       'Too many attempts. Please wait a moment.',
    'auth/popup-closed-by-user':    'Google sign-in was cancelled.',
    'auth/network-request-failed':  'Network error. Check your connection.',
  };
  return errors[code] || 'Something went wrong. Please try again.';
}

// ── START AUTH ON PAGE LOAD ───────────────────────────
window.addEventListener('load', () => {
  initFirebase();
  startAuthListener();
});