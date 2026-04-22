// ═══════════════════════════════════════════════════════
//  js/send.js
//  Fixed: sends expiresIn (duration in ms) to server
//  Server adds to Date.now() to get expiresAt timestamp
// ═══════════════════════════════════════════════════════

function requestSendCode() {
  const display = document.getElementById('send-code-display');
  if (display) display.textContent = '...';

  generatedSendCode = '';
  hideQR('send-qr-wrapper');
  clearQRBox('send-qr-box');

  socket.emit('request-send-code');
}

function sendContent() {
  const textEl = document.getElementById('send-text');
  const text   = textEl ? textEl.value.trim() : '';

  if (!generatedSendCode) {
    showStatus('send-status', 'error', 'Wait for your code to generate');
    return;
  }

  if (!text && !selectedFile) {
    showStatus('send-status', 'error', 'Add text or a file first');
    return;
  }

  showStatus('send-status', 'info', 'Sending...');

  if (selectedFile) {
    sendFile();
  } else {
    sendText(text);
  }
}

function sendText(text) {
  lastSentPreview = text.slice(0, 80);

  socket.emit('share-content', {
    code:      generatedSendCode,
    type:      'text',
    data:      text,
    name:      '',
    size:      '',
    expiresIn: selectedExpiryMs > 0 ? selectedExpiryMs : null
  });
}

function sendFile() {
  const pw     = document.getElementById('send-progress-wrap');
  const pb     = document.getElementById('send-progress-bar');
  const reader = new FileReader();

  if (pw) pw.classList.add('show');
  if (pb) pb.style.width = '35%';

  reader.onprogress = (e) => {
    if (e.lengthComputable && pb) {
      pb.style.width = (Math.round((e.loaded / e.total) * 60) + 20) + '%';
    }
  };

  reader.onload = (e) => {
    if (pb) pb.style.width = '80%';
    lastSentPreview = selectedFile.name;

    socket.emit('share-content', {
      code:      generatedSendCode,
      type:      'file',
      data:      e.target.result,
      name:      selectedFile.name,
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