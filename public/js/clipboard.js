// ── CLIPBOARD SYNC ────────────────────────────────────
// Reads clipboard on load + when user clicks Sync button
// Shows popup → user picks Simple Send or Send to Room

async function checkClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) {
      alert('Your clipboard is empty or has no text.');
      return;
    }
    showClipboardPopup(text.trim());
  } catch(e) {
    alert('Please allow clipboard access when your browser asks.');
  }
}

function showClipboardPopup(text) {
  clipboardContent = text;
  document.getElementById('clipboard-preview-text').textContent = text;
  document.getElementById('clipboard-popup').classList.add('show');
}

function closePopup() {
  document.getElementById('clipboard-popup').classList.remove('show');
}

// User chose Simple Send → go to send screen with text pre-filled
function clipboardToSend() {
  closePopup();
  showScreen('send-screen');
  // Wait for screen to render then fill textarea
  setTimeout(() => {
    document.getElementById('send-text').value = clipboardContent;
  }, 50);
}

// User chose Send to Room → go to create screen, prefill message
function clipboardToRoom() {
  closePopup();
  showScreen('create-screen');
  setTimeout(() => {
    document.getElementById('create-msg-input').value = clipboardContent;
  }, 50);
}

// ── AUTO CHECK ON PAGE LOAD ───────────────────────────
window.addEventListener('load', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text && text.trim().length > 0) {
      showClipboardPopup(text.trim());
    }
  } catch(e) {
    // Silently ignore — user hasn't granted permission yet
    // They can always use the manual Sync Clipboard button
  }
});