// ═══════════════════════════════════════════════════════
//  js/sync.js
//  Cross-device clipboard sync using Firestore
//  Only active for logged-in users
// ═══════════════════════════════════════════════════════

let syncUnsubscribe = null;
let lastSyncedText  = '';
let lastSyncedAt    = 0;   // timestamp — prevents re-showing old syncs

// ── START SYNC LISTENER ────────────────────────────────
function startClipboardSync(uid) {
  stopClipboardSync();
  console.log('📡 Starting clipboard sync for:', uid);

  syncUnsubscribe = db.collection('users').doc(uid)
    .onSnapshot((doc) => {
      if (!doc.exists) return;

      const data     = doc.data();
      const text     = data.clipboard  || '';
      const syncedAt = data.syncedAt?.toMillis() || 0;

      // Only show popup if:
      // 1. Text is non-empty
      // 2. Text is different from last shown
      // 3. It was synced recently (within last 30 seconds)
      //    → prevents old syncs showing on fresh login
      const isNew    = text !== lastSyncedText;
      const isRecent = Date.now() - syncedAt < 30000;

      if (text && isNew && isRecent) {
        lastSyncedText = text;
        lastSyncedAt   = syncedAt;
        showSyncedClipboard(text);
      }

    }, (err) => {
      console.warn('Clipboard sync error:', err.code);
    });
}

// ── STOP SYNC LISTENER ────────────────────────────────
function stopClipboardSync() {
  if (syncUnsubscribe) {
    syncUnsubscribe();
    syncUnsubscribe = null;
    console.log('📡 Clipboard sync stopped');
  }
  // Reset so fresh login works correctly
  lastSyncedText = '';
  lastSyncedAt   = 0;
}

// ── PUSH CLIPBOARD TO FIRESTORE ───────────────────────
async function pushClipboardToSync(text) {
  if (!currentUser) return;

  try {
    await db.collection('users').doc(currentUser.uid).set({
      clipboard:  text,
      syncedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      syncedFrom: navigator.userAgent.slice(0, 200)
    }, { merge: true });

    console.log('📋 Clipboard pushed ✅');

  } catch (e) {
    console.error('Sync push failed:', e);
    showToast('⚠️ Sync failed — check your connection', 'warning');
  }
}

// ── SHOW SYNCED POPUP ON OTHER DEVICES ────────────────
function showSyncedClipboard(text) {
  clipboardContent = text;

  const previewEl = document.getElementById('clipboard-preview-text');
  const titleEl   = document.getElementById('clipboard-popup-title');
  const popupEl   = document.getElementById('clipboard-popup');

  if (previewEl) previewEl.textContent = text;
  if (titleEl)   titleEl.textContent   = '📲 Synced from your other device';
  if (popupEl)   popupEl.classList.add('show');

  showToast('📲 Clipboard arrived from another device!', 'info');
}