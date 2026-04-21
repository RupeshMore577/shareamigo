// ═══════════════════════════════════════════════════════
//  js/sync.js
//  Cross-device clipboard sync using Firestore.
//  Only active for logged-in users.
//
//  Flow:
//  Device A: user clicks Sync Clipboard
//    → checkClipboard() reads text
//    → pushClipboardToSync() saves to Firestore
//  Device B (same account):
//    → onSnapshot fires instantly
//    → showSyncedClipboard() shows popup
// ═══════════════════════════════════════════════════════

let syncUnsubscribe = null;  // Holds Firestore listener
let lastSyncedText  = '';    // Prevents showing same text twice

// ── START LISTENING FOR SYNCED CLIPBOARD ───────────────

function startClipboardSync(uid) {
  // Clean up any existing listener
  stopClipboardSync();

  console.log('📡 Starting clipboard sync for:', uid);

  // Watch this user's document in real time
  syncUnsubscribe = db.collection('users').doc(uid)
    .onSnapshot((doc) => {
      if (!doc.exists) return;

      const data = doc.data();
      const text = data.clipboard || '';

      // Only react if text is new and non-empty
      if (text && text !== lastSyncedText) {
        lastSyncedText = text;
        showSyncedClipboard(text);
      }

    }, (err) => {
      // Firestore listener error — don't crash
      console.warn('Clipboard sync listener error:', err);
    });
}

// ── STOP LISTENING ─────────────────────────────────────

function stopClipboardSync() {
  if (syncUnsubscribe) {
    syncUnsubscribe();
    syncUnsubscribe = null;
    console.log('📡 Clipboard sync stopped');
  }
}

// ── PUSH CLIPBOARD TO FIRESTORE ────────────────────────
// Called when logged-in user clicks Sync Clipboard
// Saves text → all other devices get it via onSnapshot

async function pushClipboardToSync(text) {
  if (!currentUser) return;

  try {
    // Use set with merge so doc is created if it doesn't exist
    await db.collection('users').doc(currentUser.uid).set({
      clipboard:  text,
      syncedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      syncedFrom: navigator.userAgent.slice(0, 200)  // limit length
    }, { merge: true });

    console.log('📋 Clipboard pushed to sync ✅');

  } catch (e) {
    console.error('Sync push failed:', e);
    // Non-critical — don't alert the user
  }
}

// ── SHOW SYNCED CLIPBOARD POPUP ────────────────────────
// Fires on all OTHER devices when a new clipboard arrives

function showSyncedClipboard(text) {
  clipboardContent = text;

  const previewEl = document.getElementById('clipboard-preview-text');
  const titleEl   = document.getElementById('clipboard-popup-title');
  const popupEl   = document.getElementById('clipboard-popup');

  if (previewEl) previewEl.textContent = text;

  // Custom title for synced content
  if (titleEl) titleEl.textContent = '📲 Synced from your other device';

  if (popupEl) popupEl.classList.add('show');

  // Push notification if tab is backgrounded
  sendNotification('Clipboard Synced', text.slice(0, 60) + (text.length > 60 ? '...' : ''));
}