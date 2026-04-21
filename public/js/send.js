// ═══════════════════════════════════════════════════════
//  js/send.js
//  Handles the Send screen:
//  - Requesting send codes
//  - Text + file sending
//  - Progress bar
//  - Expiry timestamp
// ═══════════════════════════════════════════════════════

// ── REQUEST A SEND CODE ────────────────────────────────
// Called when send screen opens (from app.js showScreen)
// and by the refresh button in the HTML

function requestSendCode() {
  const display = document.getElementById('send-code-display');
  if (display) display.textContent = '...';

  // Reset so showScreen doesn't re-request before server responds
  generatedSendCode = '';

  // Clear QR
  hideQR('send-qr-wrapper');
  clearQRBox('send-qr-box');

  socket.emit('request-send-code');
}

// ── SEND CONTENT ───────────────────────────────────────

function sendContent() {
  const text = document.getElementById('send-text')
    ? document.getElementById('send-text').value.trim()
    : '';

  // Must have a code
  if (!generatedSendCode) {
    showStatus('send-status', 'error', 'Wait for your code to generate');
    return;
  }

  // Must have content
  if (!text && !selectedFile) {
    showStatus('send-status', 'error', 'Add text or a file first');
    return;
  }

  showStatus('send-status', 'info', 'Sending...');

  // Calculate absolute expiry timestamp
  // selectedExpiryMs = 0 means no expiry
  const expiresAt = selectedExpiryMs > 0
    ? Date.now() + selectedExpiryMs
    : null;

  if (selectedFile) {
    sendFile(expiresAt);
  } else {
    sendText(text, expiresAt);
  }
}

// ── SEND TEXT ──────────────────────────────────────────

function sendText(text, expiresAt) {
  // Save preview for history
  lastSentPreview = text.slice(0, 80);

  socket.emit('share-content', {
    code:      generatedSendCode,
    type:      'text',
    data:      text,
    name:      '',
    size:      '',
    expiresAt: expiresAt   // null or Unix timestamp in ms
  });
}

// ── SEND FILE ──────────────────────────────────────────

function sendFile(expiresAt) {
  const pw = document.getElementById('send-progress-wrap');
  const pb = document.getElementById('send-progress-bar');
  const reader = new FileReader();

  // Show progress bar
  if (pw) pw.classList.add('show');
  if (pb) pb.style.width = '35%';

  reader.onprogress = (e) => {
    if (e.lengthComputable && pb) {
      const pct = Math.round((e.loaded / e.total) * 60) + 20;
      pb.style.width = pct + '%';
    }
  };

  reader.onload = (e) => {
    if (pb) pb.style.width = '80%';

    // Save preview for history
    lastSentPreview = selectedFile.name;

    socket.emit('share-content', {
      code:      generatedSendCode,
      type:      'file',
      data:      e.target.result,         // base64 data URL
      name:      selectedFile.name,
      size:      formatBytes(selectedFile.size),
      expiresAt: expiresAt
    });
  };

  reader.onerror = () => {
    showStatus('send-status', 'error', 'Failed to read file — try again');
    if (pw) pw.classList.remove('show');
  };

  reader.readAsDataURL(selectedFile);
}