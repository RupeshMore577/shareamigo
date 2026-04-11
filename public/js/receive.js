// ── RECEIVE SCREEN ────────────────────────────────────
// Handles fetching content using a send code

function receiveContent() {
  const code = document.getElementById('receive-code').value.trim();

  // Validate — must be 8 characters
  if (code.length !== 8) {
    showStatus('receive-status', 'error', 'Code must be 8 characters');
    return;
  }

  showStatus('receive-status', 'info', 'Looking up code...');

  // Ask server for content stored under this code
  socket.emit('get-content', code);
}

// ── COPY RECEIVED TEXT ────────────────────────────────
function copyReceived() {
  const text = document.getElementById('received-text').textContent;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    const original = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => btn.textContent = original, 2000);
  }).catch(() => {
    alert('Could not copy. Please copy manually.');
  });
}