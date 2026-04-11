// ── SOCKET CONNECTION ─────────────────────────────────
// This file creates the socket and handles ALL incoming
// events from the server. Other files emit TO the server.
// socket.js just LISTENS and routes responses correctly.

const socket = io();

// ── CONNECTION STATUS ─────────────────────────────────
socket.on('connect', () => {
  console.log('Connected to Shreamigo server:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// ── SEND CODE GENERATED ───────────────────────────────
// Server gives us a unique send code
socket.on('send-code-generated', (code) => {
  generatedSendCode = code;
  document.getElementById('send-code-display').textContent = code;
});

// ── ROOM CODE GENERATED ───────────────────────────────
// Server gives us a unique room code
socket.on('room-code-generated', (code) => {
  generatedRoomCode = code;
  document.getElementById('create-code-display').textContent = code;
  // Enable the Create Room button now that we have a code
  document.getElementById('create-room-btn').disabled = false;
});

// ── SHARE CONFIRMED ───────────────────────────────────
// Server confirms our content was stored successfully
socket.on('share-confirmed', (code) => {
  // Complete the progress bar
  const pb = document.getElementById('send-progress-bar');
  const pw = document.getElementById('send-progress-wrap');
  pb.style.width = '100%';
  setTimeout(() => {
    pw.classList.remove('show');
    pb.style.width = '0%';
  }, 800);
  showStatus('send-status', 'success', `Shared! Give code  ${code}  to the receiver`);
});

// ── CONTENT RECEIVED ──────────────────────────────────
// Server returns the content for a given receive code
socket.on('content-received', ({ type, data, name, size }) => {
  hideStatus('receive-status');
  const box = document.getElementById('received-box');
  box.style.display = 'block';

  if (type === 'text') {
    document.getElementById('received-text').textContent = data;
    document.getElementById('copy-btn').style.display   = 'inline-block';
    document.getElementById('received-download').style.display = 'none';
  } else {
    // File received — show name, size and download button
    document.getElementById('received-text').innerHTML =
      `<span style="font-weight:700">${getExt(name)}</span>
       &nbsp;${name}
       <br>
       <span style="font-size:13px;color:var(--muted)">${size}</span>`;
    document.getElementById('copy-btn').style.display = 'none';
    const dl = document.getElementById('received-download');
    dl.href     = data;
    dl.download = name;
    dl.style.display = 'block';
  }
});

// ── CONTENT NOT FOUND ─────────────────────────────────
socket.on('content-not-found', () => {
  showStatus('receive-status', 'error', 'Nothing found for this code');
});

// ── ROOM CREATED ──────────────────────────────────────
socket.on('room-created', (code) => {
  currentRoom     = code;
  currentRoomType = 'create';
  hideStatus('create-status');
  document.getElementById('created-room-tag').textContent      = code;
  document.getElementById('room-area-create').style.display    = 'block';
  addMsg('create', 'Room created. Share code ' + code + ' with your group.', 'sys');
});

// ── ROOM JOINED ───────────────────────────────────────
socket.on('room-joined', (code) => {
  currentRoom     = code;
  currentRoomType = 'join';
  hideStatus('join-status');
  document.getElementById('joined-room-tag').textContent    = code;
  document.getElementById('room-area-join').style.display   = 'block';
  addMsg('join', 'You joined room ' + code, 'sys');
});

// ── ROOM NOT FOUND ────────────────────────────────────
socket.on('room-not-found', () => {
  showStatus('join-status', 'error', 'Room not found — check the code');
});

// ── ROOM HISTORY ──────────────────────────────────────
// Fired when a new user joins — sends all past messages
socket.on('room-history', (history) => {
  if (!history || history.length === 0) return;

  history.forEach(payload => {
    if (payload.type === 'text') {
      // 'them' because history is other people's messages
      addMsg(currentRoomType, payload.message, 'them');
    } else {
      addFileMsg(currentRoomType, payload, 'them');
    }
  });
});

// ── ROOM MESSAGE RECEIVED ─────────────────────────────
// Live message from another user in the room
socket.on('room-message-received', (payload) => {
  if (payload.type === 'text') {
    addMsg(currentRoomType, payload.message, 'them');
  } else {
    addFileMsg(currentRoomType, payload, 'them');
  }
});

// ── ROOM MEMBER EVENTS ────────────────────────────────
socket.on('user-joined-room', () => {
  addMsg(currentRoomType, 'Someone joined the room 👋', 'sys');
});

socket.on('user-left-room', () => {
  addMsg(currentRoomType, 'Someone left the room', 'sys');
});

// ── ROOM MEMBER COUNT ─────────────────────────────────
socket.on('room-count', (count) => {
  const label = count === 1 ? '1 member' : `${count} members`;
  if (currentRoomType === 'create') {
    document.getElementById('create-member-count').textContent = label;
  }
  if (currentRoomType === 'join') {
    document.getElementById('join-member-count').textContent = label;
  }
});

// ── ROOM CLOSED (creator left) ────────────────────────
socket.on('room-closed', () => {
  addMsg(currentRoomType, 'The room was closed by the creator.', 'sys');
  // Disable input so no more messages can be sent
  const msgInputId = currentRoomType === 'create'
    ? 'create-msg-input'
    : 'join-msg-input';
  document.getElementById(msgInputId).disabled = true;
});

// ── SERVER ERROR ──────────────────────────────────────
socket.on('error-msg', (msg) => {
  console.error('Server error:', msg);
  alert('Error: ' + msg);
});