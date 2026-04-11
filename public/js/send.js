// ── SEND SCREEN ───────────────────────────────────────
// Handles requesting a send code + sending text or files

// Request a fresh unique send code from server
function requestSendCode() {
  document.getElementById('send-code-display').textContent = '...';
  generatedSendCode = '';
  socket.emit('request-send-code');
}

// ── SEND CONTENT ──────────────────────────────────────
function sendContent() {
  const text = document.getElementById('send-text').value.trim();

  // Must have a valid code before sending
  if (!generatedSendCode) {
    showStatus('send-status', 'error', 'Wait for your code to generate');
    return;
  }

  // Must have something to send
  if (!text && !selectedFile) {
    showStatus('send-status', 'error', 'Add text or a file first');
    return;
  }

  showStatus('send-status', 'info', 'Sending...');

  if (selectedFile) {
    // ── FILE SEND ──────────────────────────────────
    const reader  = new FileReader();
    const pw      = document.getElementById('send-progress-wrap');
    const pb      = document.getElementById('send-progress-bar');

    // Show progress bar at 35% while reading
    pw.classList.add('show');
    pb.style.width = '35%';

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        // Update bar based on actual read progress
        const pct = Math.round((e.loaded / e.total) * 60) + 20;
        pb.style.width = pct + '%';
      }
    };

    reader.onload = (e) => {
      // File fully read — bump to 80% while uploading
      pb.style.width = '80%';
      socket.emit('share-content', {
        code: generatedSendCode,
        type: 'file',
        data: e.target.result,        // base64 encoded file
        name: selectedFile.name,
        size: formatBytes(selectedFile.size)
      });
    };

    reader.onerror = () => {
      showStatus('send-status', 'error', 'Failed to read file');
      pw.classList.remove('show');
    };

    // Read file as base64 data URL
    reader.readAsDataURL(selectedFile);

  } else {
    // ── TEXT SEND ──────────────────────────────────
    socket.emit('share-content', {
      code: generatedSendCode,
      type: 'text',
      data: text,
      name: '',
      size: ''
    });
  }
}