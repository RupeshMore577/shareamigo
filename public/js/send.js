// ═══════════════════════════════════════════════════════
//  js/send.js
//  Handles the Send screen.
//  Sends expiresIn (duration in ms) — server calculates
//  the absolute expiresAt timestamp.
// ═══════════════════════════════════════════════════════

// ── REQUEST SEND CODE ──────────────────────────────────

function requestSendCode() {
  const display = document.getElementById('send-code-display');
  if (display) display.textContent = '...';

  generatedSendCode = '';

  hideQR('send-qr-wrapper');
  clearQRBox('send-qr-box');

  socket.emit('request-send-code');
}

// ── SEND CONTENT ───────────────────────────────────────

function sendContent() {
  const textEl = document.getElementById('send-text');
  const text   = textEl ? textEl.value.trim() : '';

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

  if (selectedFile) {
    sendFileContent();
  } else {
    sendTextContent(text);
  }
}

// ── SEND TEXT ──────────────────────────────────────────

function sendTextContent(text) {
  // Store preview for history
  window.lastSentPreview = text.slice(0, 80);

  socket.emit('share-content', {
    code:      generatedSendCode,
    type:      'text',
    data:      text,          // plain text string
    name:      '',            // no filename for text
    size:      '',            // no size for text
    expiresIn: selectedExpiryMs > 0 ? selectedExpiryMs : null
  });
}

// ── SEND FILE ──────────────────────────────────────────

function sendFileContent() {
  const pw     = document.getElementById('send-progress-wrap');
  const pb     = document.getElementById('send-progress-bar');
  const reader = new FileReader();

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

    // Store preview for history
    window.lastSentPreview = selectedFile.name;

    socket.emit('share-content', {
      code:      generatedSendCode,
      type:      'file',
      data:      e.target.result,           // base64 data URL
      name:      selectedFile.name,         // filename
      size:      formatBytes(selectedFile.size),
      expiresIn: selectedExpiryMs > 0 ? selectedExpiryMs : null
    });
  };

  reader.onerror = () => {
    showStatus('send-status', 'error', 'Failed to read file — try again');
    if (pw) pw.classList.remove('show');
  };

  reader.readAsDataURL(selectedFile);
}