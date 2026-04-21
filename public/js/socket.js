// ═══════════════════════════════════════════════════════
//  js/socket.js
//  Creates socket connection.
//  Listens to ALL server events and routes them.
// ═══════════════════════════════════════════════════════

const socket = io();

let lastSentPreview = '';

// ── CONNECTION ─────────────────────────────────────────

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Socket disconnected');
  showStatus('send-status', 'error', 'Connection lost — please refresh');
});

socket.on('connect_error', (err) => {
  console.error('Socket error:', err.message);
});

// ── SEND CODE GENERATED ────────────────────────────────

socket.on('send-code-generated', (code) => {
  generatedSendCode = code;

  const display = document.getElementById('send-code-display');
  if (display) display.textContent = code;

  // QR encodes a URL → receiver scans → receive screen opens
  // with this code already filled in
  showReceiveQR('send-qr-wrapper', 'send-qr-box', code);
});

// ── ROOM CODE GENERATED ────────────────────────────────

socket.on('room-code-generated', (code) => {
  generatedRoomCode = code;

  const display = document.getElementById('create-code-display');
  if (display) display.textContent = code;

  const btn = document.getElementById('create-room-btn');
  if (btn) btn.disabled = false;

  // QR encodes a URL → member scans → join screen opens
  // with this code already filled in
  showJoinQR('room-qr-wrapper-create', 'room-qr-box-create', code);
});

// ── SHARE CONFIRMED ────────────────────────────────────

socket.on('share-confirmed', (code) => {
  const pb = document.getElementById('send-progress-bar');
  const pw = document.getElementById('send-progress-wrap');

  if (pb) pb.style.width = '100%';

  setTimeout(() => {
    if (pw) pw.classList.remove('show');
    if (pb) pb.style.width = '0%';
  }, 800);

  showStatus('send-status', 'success',
    'Shared! Give code  ' + code + '  or let them scan the QR');

  addToHistory('sent', code, lastSentPreview);
  sendNotification('Content shared!', 'Code ' + code + ' is ready');
});

// ── CONTENT RECEIVED ───────────────────────────────────

socket.on('content-received', ({ type, data, name, size, expiresAt }) => {
  hideStatus('receive-status');

  const box = document.getElementById('received-box');
  if (box) box.style.display = 'block';

  const textEl  = document.getElementById('received-text');
  const copyBtn = document.getElementById('copy-btn');
  const dlLink  = document.getElementById('received-download');

  if (type === 'text') {
    if (textEl)  textEl.textContent    = data;
    if (copyBtn) copyBtn.style.display = 'inline-block';
    if (dlLink)  dlLink.style.display  = 'none';

    addToHistory('received', '', data.slice(0, 80));

  } else {
    if (textEl) {
      textEl.innerHTML =
        '<span style="font-weight:700">' + getExt(name) + '</span>' +
        '&nbsp;' + name +
        '<br><span style="font-size:13px;color:var(--muted)">' + size + '</span>';
    }

    if (copyBtn) copyBtn.style.display = 'none';

    if (dlLink) {
      dlLink.href          = data;
      dlLink.download      = name;
      dlLink.style.display = 'block';
    }

    addToHistory('received', '', name);
  }

  if (expiresAt) {
    showExpiryTimer(expiresAt);
  } else {
    hideExpiryTimer();
    hideExpiryExpired();
  }

  sendNotification(
    'Content received!',
    type === 'text' ? 'Text ready to copy' : 'File: ' + name
  );
});

// ── CONTENT NOT FOUND ──────────────────────────────────

socket.on('content-not-found', () => {
  showStatus('receive-status', 'error',
    'Nothing found — check the code or content may have expired');

  hideExpiryTimer();
  hideExpiryExpired();

  const box = document.getElementById('received-box');
  if (box) box.style.display = 'none';
});

// ── CONTENT EXPIRED ────────────────────────────────────

socket.on('content-expired', (code) => {
  showStatus('send-status', 'error',
    'Content on code ' + code + ' has expired and been deleted');
  sendNotification('Share expired', 'Code ' + code + ' was deleted');
});

// ── ROOM CREATED ───────────────────────────────────────

socket.on('room-created', (code) => {
  currentRoom     = code;
  currentRoomType = 'create';

  hideStatus('create-status');

  const tag  = document.getElementById('created-room-tag');
  const area = document.getElementById('room-area-create');
  if (tag)  tag.textContent    = code;
  if (area) area.style.display = 'block';

  addMsg('create', 'Room created. Share code ' + code +
    ' or let members scan the QR.', 'sys');
});

// ── ROOM JOINED ────────────────────────────────────────

socket.on('room-joined', (code) => {
  currentRoom     = code;
  currentRoomType = 'join';

  hideStatus('join-status');

  const tag  = document.getElementById('joined-room-tag');
  const area = document.getElementById('room-area-join');
  if (tag)  tag.textContent    = code;
  if (area) area.style.display = 'block';

  addMsg('join', 'You joined room ' + code, 'sys');

  // Also show QR on join screen — so this member can share it
  // with others who haven't joined yet
  showJoinQR('room-qr-wrapper-join', 'room-qr-box-join', code);
});

// ── ROOM NOT FOUND ─────────────────────────────────────

socket.on('room-not-found', () => {
  showStatus('join-status', 'error', 'Room not found — check the code');
});

// ── ROOM HISTORY ───────────────────────────────────────

socket.on('room-history', (history) => {
  if (!history || history.length === 0) return;

  history.forEach(payload => {
    if (payload.type === 'text') {
      addMsg(currentRoomType, payload.message, 'them');
    } else {
      addFileMsg(currentRoomType, payload, 'them');
    }
  });
});

// ── LIVE ROOM MESSAGE ──────────────────────────────────

socket.on('room-message-received', (payload) => {
  if (payload.type === 'text') {
    addMsg(currentRoomType, payload.message, 'them');
    sendNotification('New message', payload.message.slice(0, 60));
  } else {
    addFileMsg(currentRoomType, payload, 'them');
    sendNotification('File shared in room', payload.name);
  }
});

// ── ROOM MEMBER EVENTS ─────────────────────────────────

socket.on('user-joined-room', () => {
  addMsg(currentRoomType, 'Someone joined the room 👋', 'sys');
  sendNotification('Room', 'Someone joined the room');
});

socket.on('user-left-room', () => {
  addMsg(currentRoomType, 'Someone left the room', 'sys');
});

// ── MEMBER COUNT ───────────────────────────────────────

socket.on('room-count', (count) => {
  const label = count === 1 ? '1 member' : count + ' members';

  if (currentRoomType === 'create') {
    const el = document.getElementById('create-member-count');
    if (el) el.textContent = label;
  }

  if (currentRoomType === 'join') {
    const el = document.getElementById('join-member-count');
    if (el) el.textContent = label;
  }
});

// ── ROOM CLOSED ────────────────────────────────────────

socket.on('room-closed', () => {
  addMsg(currentRoomType, '⚠️ The room was closed by the creator.', 'sys');

  const createInput = document.getElementById('create-msg-input');
  const joinInput   = document.getElementById('join-msg-input');
  if (createInput) createInput.disabled = true;
  if (joinInput)   joinInput.disabled   = true;

  sendNotification('Room closed', 'The room creator has left');
});

// ── SERVER ERROR ───────────────────────────────────────

socket.on('error-msg', (msg) => {
  console.error('Server error:', msg);
  showStatus('send-status', 'error', msg);
});