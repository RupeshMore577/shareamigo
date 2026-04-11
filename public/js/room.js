// ── ROOM SCREEN ───────────────────────────────────────
// Handles create room, join room, messaging and file sharing

// ── REQUEST NEW ROOM CODE ─────────────────────────────
function requestRoomCode() {
  document.getElementById('create-code-display').textContent = '...';
  document.getElementById('create-room-btn').disabled = true;
  generatedRoomCode = '';
  socket.emit('request-room-code');
}

// ── CREATE ROOM ───────────────────────────────────────
function createRoom() {
  if (!generatedRoomCode) {
    showStatus('create-status', 'error', 'Wait for code to generate');
    return;
  }
  showStatus('create-status', 'info', 'Creating room...');
  socket.emit('create-room', generatedRoomCode);
}

// ── JOIN ROOM ─────────────────────────────────────────
function joinRoom() {
  const code = document.getElementById('join-code').value.trim();

  if (code.length !== 8) {
    showStatus('join-status', 'error', 'Code must be 8 characters');
    return;
  }

  showStatus('join-status', 'info', 'Joining room...');
  socket.emit('join-room', code);
}

// ── SEND ROOM TEXT MESSAGE ────────────────────────────
function sendRoomMsg(type) {
  const inputId = type === 'create' ? 'create-msg-input' : 'join-msg-input';
  const input   = document.getElementById(inputId);
  const message = input.value.trim();

  if (!message)      return;
  if (!currentRoom)  return;

  // Show message on our own screen immediately
  addMsg(type, message, 'me');

  // Send to server — server forwards to everyone else in room
  socket.emit('room-message', { roomCode: currentRoom, message });

  // Clear input
  input.value = '';
}

// ── SEND ROOM FILE ────────────────────────────────────
function sendRoomFile(input, type) {
  const file = input.files[0];
  if (!file || !currentRoom) return;

  const reader = new FileReader();

  reader.onload = e => {
    const payload = {
      roomCode: currentRoom,
      data:     e.target.result,       // base64
      name:     file.name,
      size:     formatBytes(file.size),
      fileType: getExt(file.name)
    };

    // Show on our screen immediately
    addFileMsg(type, payload, 'me');

    // Send to server — server forwards to others
    socket.emit('room-file', payload);
  };

  reader.onerror = () => alert('Failed to read file. Try again.');
  reader.readAsDataURL(file);

  // Reset input so same file can be sent again if needed
  input.value = '';
}

// ── ADD TEXT BUBBLE TO CHAT ───────────────────────────
function addMsg(type, text, side) {
  const boxId = type === 'create' ? 'msgs-create' : 'msgs-join';
  const box   = document.getElementById(boxId);

  const div         = document.createElement('div');
  div.className     = `msg ${side}`;
  div.textContent   = text;

  box.appendChild(div);

  // Always scroll to latest message
  box.scrollTop = box.scrollHeight;
}

// ── ADD FILE BUBBLE TO CHAT ───────────────────────────
function addFileMsg(type, payload, side) {
  const boxId = type === 'create' ? 'msgs-create' : 'msgs-join';
  const box   = document.getElementById(boxId);

  const ext = payload.fileType || getExt(payload.name);

  const div       = document.createElement('div');
  div.className   = `msg ${side} msg-file`;
  div.innerHTML   = `
    <span class="ftype">${ext}</span>
    <div class="file-info">
      <div class="fname">${payload.name}</div>
      <div class="fsize">${payload.size}</div>
    </div>
    <a href="${payload.data}" download="${payload.name}" title="Download">⬇</a>
  `;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}