// ═══════════════════════════════════════════════════════
//  js/room.js
//  Create room, join room, messaging, file sharing in rooms
// ═══════════════════════════════════════════════════════

// ── REQUEST ROOM CODE ──────────────────────────────────

function requestRoomCode() {
  const display = document.getElementById('create-code-display');
  if (display) display.textContent = '...';

  // Disable button until new code arrives
  const btn = document.getElementById('create-room-btn');
  if (btn) btn.disabled = true;

  // Clear old QR
  hideQR('room-qr-wrapper-create');
  clearQRBox('room-qr-box-create');

  generatedRoomCode = '';
  socket.emit('request-room-code');
}

// ── CREATE ROOM ────────────────────────────────────────

function createRoom() {
  if (!generatedRoomCode) {
    showStatus('create-status', 'error', 'Wait for code to generate');
    return;
  }
  showStatus('create-status', 'info', 'Creating room...');
  socket.emit('create-room', generatedRoomCode);
}

// ── JOIN ROOM ──────────────────────────────────────────

function joinRoom() {
  const input = document.getElementById('join-code');
  if (!input) return;

  const code = input.value.trim();

  if (code.length !== 8) {
    showStatus('join-status', 'error', 'Code must be exactly 8 characters');
    return;
  }

  showStatus('join-status', 'info', 'Joining room...');
  socket.emit('join-room', code);
}

// ── SEND ROOM TEXT MESSAGE ─────────────────────────────

function sendRoomMsg(type) {
  const inputId = type === 'create' ? 'create-msg-input' : 'join-msg-input';
  const input   = document.getElementById(inputId);
  if (!input) return;

  const message = input.value.trim();
  if (!message || !currentRoom) return;

  // Show on our own screen immediately (optimistic)
  addMsg(type, message, 'me');

  // Send to server
  socket.emit('room-message', { roomCode: currentRoom, message });

  // Clear input
  input.value = '';
}

// ── SEND ROOM FILE ─────────────────────────────────────

function sendRoomFile(inputEl, type) {
  const file = inputEl.files[0];
  if (!file || !currentRoom) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    const payload = {
      roomCode: currentRoom,
      data:     e.target.result,       // base64 data URL
      name:     file.name,
      size:     formatBytes(file.size),
      fileType: getExt(file.name)
    };

    // Show on our own screen immediately
    addFileMsg(type, payload, 'me');

    // Send to server — server broadcasts to others
    socket.emit('room-file', payload);
  };

  reader.onerror = () => {
    showStatus(
      type === 'create' ? 'create-status' : 'join-status',
      'error',
      'Failed to read file'
    );
  };

  reader.readAsDataURL(file);

  // Reset so same file can be re-sent
  inputEl.value = '';
}

// ── ADD TEXT MESSAGE BUBBLE ────────────────────────────

function addMsg(type, text, side) {
  const boxId = type === 'create' ? 'msgs-create' : 'msgs-join';
  const box   = document.getElementById(boxId);
  if (!box) return;

  const div = document.createElement('div');
  div.className = `msg ${side}`;

  // Escape HTML to prevent XSS in chat messages
  div.textContent = text;

  box.appendChild(div);

  // Always scroll to latest
  box.scrollTop = box.scrollHeight;
}

// ── ADD FILE MESSAGE BUBBLE ────────────────────────────

function addFileMsg(type, payload, side) {
  const boxId = type === 'create' ? 'msgs-create' : 'msgs-join';
  const box   = document.getElementById(boxId);
  if (!box) return;

  const ext = payload.fileType || getExt(payload.name);

  const div = document.createElement('div');
  div.className = `msg ${side} msg-file`;

  // Build download link safely
  // Do NOT use innerHTML with user-provided file content
  const badge = document.createElement('span');
  badge.className   = 'ftype';
  badge.textContent = ext;

  const info = document.createElement('div');
  info.className = 'file-info';

  const fname = document.createElement('div');
  fname.className   = 'fname';
  fname.textContent = payload.name;

  const fsize = document.createElement('div');
  fsize.className   = 'fsize';
  fsize.textContent = payload.size;

  info.appendChild(fname);
  info.appendChild(fsize);

  const dlLink = document.createElement('a');
  dlLink.href      = payload.data;   // safe — this is a data URL
  dlLink.download  = payload.name;
  dlLink.title     = 'Download';
  dlLink.textContent = '⬇';

  div.appendChild(badge);
  div.appendChild(info);
  div.appendChild(dlLink);

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}