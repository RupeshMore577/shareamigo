// ═══════════════════════════════════════════════════════
//  js/clipboard.js
//  Local clipboard reading + popup handling
//  For guests: reads local clipboard only
//  For logged-in users: sync.js overrides checkClipboard
//  to also push to Firestore
// ═══════════════════════════════════════════════════════

// ── READ CLIPBOARD ─────────────────────────────────────
// Called by the "Sync Clipboard" button on landing page
// For guests → shows local popup
// For logged-in users → sync.js extends this behavior

async function checkClipboard() {
  try {
    const text = await navigator.clipboard.readText();

    if (!text || !text.trim()) {
      // Nothing useful in clipboard
      alert('Your clipboard is empty or contains no readable text.');
      return;
    }

    const trimmed = text.trim();
    clipboardContent = trimmed;

    if (currentUser) {
      // Logged in — push to Firestore (sync.js handles this)
      await pushClipboardToSync(trimmed);
      // Don't show local popup — other devices will get the Firestore popup
      showStatus('send-status', 'success', 'Clipboard synced to all your devices!');
    } else {
      // Guest — just show local popup
      showClipboardPopup(trimmed);
    }

  } catch (e) {
    // Most common reason: permission denied
    if (e.name === 'NotAllowedError') {
      alert('Clipboard access was denied. Please allow it in your browser settings.');
    } else {
      alert('Could not read clipboard. Please copy your text first, then try again.');
    }
    console.warn('Clipboard read failed:', e);
  }
}

// ── SHOW CLIPBOARD POPUP ───────────────────────────────

function showClipboardPopup(text) {
  clipboardContent = text;

  const previewEl = document.getElementById('clipboard-preview-text');
  const titleEl   = document.getElementById('clipboard-popup-title');
  const popupEl   = document.getElementById('clipboard-popup');

  if (previewEl) previewEl.textContent = text;

  // Default title (sync.js may override this for synced content)
  if (titleEl) titleEl.textContent = '📋 Clipboard Detected!';

  if (popupEl) popupEl.classList.add('show');
}

// ── CLIPBOARD TO SEND ──────────────────────────────────
// Popup button: "Simple Send"
// Fills the send screen textarea with clipboard text

function clipboardToSend() {
  closePopup();
  showScreen('send-screen');

  // Wait a frame for screen transition
  requestAnimationFrame(() => {
    const textarea = document.getElementById('send-text');
    if (textarea) {
      textarea.value = clipboardContent;
      textarea.focus();
    }
  });
}

// ── CLIPBOARD TO ROOM ──────────────────────────────────
// Popup button: "Send to Room"
// Fills the active room's message input

function clipboardToRoom() {
  closePopup();

  if (!currentRoom) {
    // No active room — go to join screen
    showScreen('join-screen');
    return;
  }

  const inputId = currentRoomType === 'create'
    ? 'create-msg-input'
    : 'join-msg-input';

  const input = document.getElementById(inputId);
  if (input) {
    input.value = clipboardContent;
    input.focus();
  }
}