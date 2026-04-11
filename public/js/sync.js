// ── CROSS-DEVICE CLIPBOARD SYNC ───────────────────────
// When logged in user copies text on any device:
// → It saves to Firestore under their UID
// → All other devices with same account get it instantly
// → Popup appears asking if they want to send it

let syncUnsubscribe = null;  // holds the Firestore listener
let lastSyncedText  = '';    // prevents showing same text twice

// ── START SYNCING FOR THIS USER ───────────────────────
function startClipboardSync(uid) {
  // Stop any existing listener first
  stopClipboardSync();

  console.log('Starting clipboard sync for:', uid);

  // Listen to this user's Firestore document in real time
  // Firestore fires this instantly whenever clipboard field changes
  syncUnsubscribe = db.collection('users').doc(uid)
    .onSnapshot((doc) => {
      if (!doc.exists) return;

      const data = doc.data();
      const text = data.clipboard || '';

      // Only show popup if text is new and non-empty
      if (text && text !== lastSyncedText) {
        lastSyncedText = text;
        showSyncedClipboard(text);
      }
    });
}

// ── STOP SYNCING ──────────────────────────────────────
function stopClipboardSync() {
  if (syncUnsubscribe) {
    syncUnsubscribe();  // detaches the Firestore listener
    syncUnsubscribe = null;
    console.log('Clipboard sync stopped');
  }
}

// ── SAVE CLIPBOARD TO FIRESTORE ───────────────────────
// Called when logged-in user clicks "Sync Clipboard"
// This saves to Firestore → all other devices get it instantly
async function pushClipboardToSync(text) {
  if (!currentUser) return;  // guests don't use sync

  try {
    await db.collection('users').doc(currentUser.uid).update({
      clipboard:   text,
      syncedAt:    firebase.firestore.FieldValue.serverTimestamp(),
      syncedFrom:  navigator.userAgent  // which device sent it
    });
    console.log('Clipboard pushed to sync ✅');
  } catch(e) {
    console.error('Sync push failed:', e);
  }
}

// ── SHOW SYNCED CLIPBOARD POPUP ───────────────────────
// This fires on receiving devices when a new clipboard arrives
function showSyncedClipboard(text) {
  clipboardContent = text;
  document.getElementById('clipboard-preview-text').textContent = text;

  // Update popup title to show it came from another device
  const title = document.getElementById('clipboard-popup-title');
  if (title) title.textContent = '📲 Synced from your other device';

  document.getElementById('clipboard-popup').classList.add('show');
}

// ── OVERRIDE checkClipboard FOR LOGGED-IN USERS ───────
// When logged in: read clipboard AND push it to Firestore
// When guest: just read clipboard locally (existing behavior)
async function checkClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) {
      alert('Your clipboard is empty or has no text.');
      return;
    }

    const trimmed = text.trim();
    clipboardContent = trimmed;

    if (currentUser) {
      // Logged in → push to Firestore so other devices get it
      await pushClipboardToSync(trimmed);
      showStatus('send-status', 'success', 'Clipboard synced to all your devices!');
    } else {
      // Guest → just show the local popup
      document.getElementById('clipboard-preview-text').textContent = trimmed;
      document.getElementById('clipboard-popup').classList.add('show');
    }

  } catch(e) {
    alert('Please allow clipboard access when your browser asks.');
  }
}