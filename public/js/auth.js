// ═══════════════════════════════════════════════════════
//  js/auth.js
//  Works on BOTH login.html and index.html
//  login.html  → handles login/signup/google/guest
//  index.html  → restores session, updates status bar
// ═══════════════════════════════════════════════════════

// ── WHICH PAGE ARE WE ON? ──────────────────────────────
const IS_LOGIN_PAGE = window.location.pathname.includes('login');
const IS_INDEX_PAGE = !IS_LOGIN_PAGE;

// ── AUTH STATE ─────────────────────────────────────────
// Runs on both pages automatically when Firebase loads

auth.onAuthStateChanged((user) => {
  if (IS_LOGIN_PAGE) {
    // On login page
    if (user) {
      // Already logged in — go straight to app
      window.location.href = 'index.html';
    }
    // If no user — stay on login page (do nothing)

  } else {
    // On index.html
    const isGuest = sessionStorage.getItem('shareamigo-guest');

    if (user) {
      // Logged in user
      currentUser = user;
      updateUserStatusBar(user);
      startClipboardSync(user.uid);
      showHistoryBtn();
      showLogoutBtn();
      maybeShowNotifBanner();

    } else if (isGuest) {
      // Guest mode
      currentUser = null;
      updateUserStatusBar(null);

    } else {
      // Not logged in and not guest — send to login
      window.location.href = 'login.html';
    }
  }
});

// ── LOGIN ──────────────────────────────────────────────
async function login() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!email || !password) {
    showAuthError('Please enter email and password');
    return;
  }

  showAuthLoading('Signing in...');

  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged fires → redirects to index.html
  } catch (e) {
    hideAuthLoading();
    showAuthError(friendlyError(e.code));
  }
}

// ── SIGNUP ─────────────────────────────────────────────
async function signUp() {
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();

  if (!name || !email || !password) {
    showAuthError('Please fill in all fields');
    return;
  }

  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters');
    return;
  }

  showAuthLoading('Creating account...');

  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);

    // Save display name
    await result.user.updateProfile({ displayName: name });

    // Create Firestore user document
    await db.collection('users').doc(result.user.uid).set({
      name:      name,
      email:     email,
      uid:       result.user.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      clipboard: ''
    });

    // onAuthStateChanged fires → redirects to index.html
  } catch (e) {
    hideAuthLoading();
    showAuthError(friendlyError(e.code));
  }
}

// ── GOOGLE SIGN IN ─────────────────────────────────────
async function loginWithGoogle() {
  showAuthLoading('Opening Google...');

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result   = await auth.signInWithPopup(provider);

    // Create Firestore doc if first time
    const userDoc = await db.collection('users')
      .doc(result.user.uid).get();

    if (!userDoc.exists) {
      await db.collection('users').doc(result.user.uid).set({
        name:      result.user.displayName || '',
        email:     result.user.email || '',
        uid:       result.user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        clipboard: ''
      });
    }

    // onAuthStateChanged fires → redirects to index.html
  } catch (e) {
    hideAuthLoading();
    showAuthError(friendlyError(e.code));
  }
}

// ── GUEST ──────────────────────────────────────────────
function continueAsGuest() {
  sessionStorage.setItem('shareamigo-guest', 'true');
  window.location.href = 'index.html';
}

// ── LOGOUT ─────────────────────────────────────────────
function logout() {
  stopClipboardSync();
  auth.signOut().then(() => {
    sessionStorage.removeItem('shareamigo-guest');
    currentUser = null;
    window.location.href = 'login.html';
  }).catch(err => {
    console.error('Logout failed:', err);
  });
}

// ── UPDATE STATUS BAR ──────────────────────────────────
function updateUserStatusBar(user) {
  const bar      = document.getElementById('user-status-bar');
  const nameEl   = document.getElementById('user-status-name');
  const avatarEl = document.getElementById('user-status-avatar');
  const dotEl    = document.getElementById('sync-dot');

  if (!bar) return;

  bar.style.display = 'flex';

  if (user) {
    const name = user.displayName
      || (user.email ? user.email.split('@')[0] : 'User');

    if (nameEl)   nameEl.textContent   = name;
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
    if (dotEl) {
      dotEl.style.background = 'var(--success)';
      dotEl.title = 'Clipboard sync active';
    }
  } else {
    if (nameEl)   nameEl.textContent   = 'Guest';
    if (avatarEl) avatarEl.textContent = 'G';
    if (dotEl) {
      dotEl.style.background = 'var(--muted)';
      dotEl.title = 'Sign in for clipboard sync';
    }
  }
}

function showHistoryBtn() {
  const btn = document.getElementById('history-toggle-btn');
  if (btn) btn.style.display = 'inline-block';
}

function showLogoutBtn() {
  const btn = document.getElementById('logout-btn');
  if (btn) btn.style.display = 'inline-block';
}

// ── TOGGLE HISTORY PANEL ───────────────────────────────
function toggleHistory() {
  const panel    = document.getElementById('history-panel');
  const backdrop = document.getElementById('history-backdrop');
  if (!panel) return;

  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  } else {
    panel.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    loadHistory();
  }
}

// ── NOTIFICATION BANNER ────────────────────────────────
function maybeShowNotifBanner() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  if (localStorage.getItem('shareamigo-notif-dismissed')) return;

  const banner = document.getElementById('notif-banner');
  if (banner) banner.style.display = 'flex';
}

function hideNotifBanner() {
  const banner = document.getElementById('notif-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('shareamigo-notif-dismissed', '1');
}

async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  const result = await Notification.requestPermission();
  hideNotifBanner();
  if (result === 'granted') {
    new Notification('Shareamigo ✅', {
      body: 'Notifications enabled!'
    });
  }
}

// ── SHOW / HIDE FORMS (login page only) ───────────────
function showSignup() {
  document.getElementById('login-form').style.display  = 'none';
  document.getElementById('signup-form').style.display = 'block';
  clearAuthMessages();
}

function showLogin() {
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('login-form').style.display  = 'block';
  clearAuthMessages();
}

// ── AUTH UI HELPERS ────────────────────────────────────
function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent   = msg;
  el.style.display = 'block';
}

function showAuthLoading(msg) {
  const errEl = document.getElementById('auth-error');
  const lodEl = document.getElementById('auth-loading');
  if (errEl) errEl.style.display = 'none';
  if (lodEl) { lodEl.textContent = msg; lodEl.style.display = 'block'; }
}

function hideAuthLoading() {
  const el = document.getElementById('auth-loading');
  if (el) el.style.display = 'none';
}

function clearAuthMessages() {
  const errEl = document.getElementById('auth-error');
  const lodEl = document.getElementById('auth-loading');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  if (lodEl) { lodEl.style.display = 'none'; lodEl.textContent = ''; }
}

// ── FRIENDLY ERROR MESSAGES ────────────────────────────
function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':   'This email is already registered. Try signing in.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment.',
    'auth/popup-closed-by-user':   'Google sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/invalid-credential':     'Email or password is incorrect.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}