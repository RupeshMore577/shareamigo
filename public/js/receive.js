// ═══════════════════════════════════════════════════════
//  js/receive.js
//  Handles the Receive screen.
// ═══════════════════════════════════════════════════════

// ── FETCH CONTENT ──────────────────────────────────────

function receiveContent() {
  const input = document.getElementById('receive-code');
  if (!input) return;

  const code = input.value.trim();

  if (code.length !== 8) {
    showStatus('receive-status', 'error', 'Code must be exactly 8 characters');
    return;
  }

  // Hide previous result
  const box = document.getElementById('received-box');
  if (box) box.style.display = 'none';

  // Hide expiry elements from previous fetch
  hideExpiryTimer();
  hideExpiryExpired();

  // Hide copy and download from previous fetch
  const copyBtn = document.getElementById('copy-btn');
  const dlLink  = document.getElementById('received-download');
  if (copyBtn) copyBtn.style.display = 'none';
  if (dlLink)  dlLink.style.display  = 'none';

  showStatus('receive-status', 'info', 'Looking up code...');

  // Send plain string code to server
  socket.emit('get-content', code);
}

// ── COPY RECEIVED TEXT ─────────────────────────────────

function copyReceived() {
  const textEl = document.getElementById('received-text');
  if (!textEl) return;

  // Get text — could be textContent or innerText
  const text = textEl.textContent || textEl.innerText || '';
  if (!text.trim()) return;

  navigator.clipboard.writeText(text)
    .then(() => {
      const btn = document.getElementById('copy-btn');
      if (!btn) return;
      const original = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = original; }, 2000);
    })
    .catch(() => {
      // Fallback for browsers that block clipboard write
      try {
        const range = document.createRange();
        range.selectNodeContents(textEl);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
      } catch (e) {
        alert('Could not copy automatically. Please select and copy manually.');
      }
    });
}