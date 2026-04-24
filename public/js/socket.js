// ═══════════════════════════════════════════════════════
//  js/socket.js
//  All server events — routes to correct handlers.
//
//  Fixed in this version:
//  - share-confirmed handles object { code, expiresAt }
//  - content-received correctly handles BOTH text and file
//  - Text: shows in #received-text, shows copy button
//  - File: shows filename/size, shows download link
//  - share-expired matches server event name
//  - Uses showPushNotification (from notifications.js)
//  - Uses addHistoryEntry (from history.js)
// ═══════════════════════════════════════════════════════

const socket = io();

// Tracks last sent content preview for history
window.lastSentPreview = '';

// ── CONNECTION ─────────────────────────────────────────

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Socket disconnected');
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err.message);
});

// ── SEND CODE GENERATED ────────────────────────────────
// Server sends plain string

socket.on('send-code-generated', (code) => {
  generatedSendCode = code;

  const display = document.getElementById('send-code-display');
  if (display) display.textContent = code;

  // Show QR — encodes full URL so phone scan works
  showReceiveQR('send-qr-wrapper', 'send-qr-box', code);
});

// ── ROOM CODE GENERATED ────────────────────────────────

socket.on('room-code-generated', (code) => {
  generatedRoomCode = code;

  const display = document.getElementById('create-code-display');
  if (display) display.textContent = code;

  const btn = document.getElementById('create-room-btn');
  if (btn) btn.disabled = false;

  showJoinQR('room-qr-wrapper-create', 'room-qr-box-create', code);
});

// ── SHARE CONFIRMED ────────────────────────────────────
// Server sends object: { code, expiresAt }

socket.on('share-confirmed', (payload) => {
  // Handle both object and plain string for safety
  const code      = (typeof payload === 'object') ? payload.code      : payload;
  const expiresAt = (typeof payload === 'object') ? payload.expiresAt : null;

  // Finish progress bar
  const pb = document.getElementById('send-progress-bar');
  const pw = document.getElementById('send-progress-wrap');
  if (pb) pb.style.width = '100%';
  setTimeout(() => {
    if (pw) pw.classList.remove('show');
    if (pb) pb.style.width = '0%';
  }, 800);

  showStatus('send-status', 'success',
    'Shared! Code: ' + code + ' — give it to the receiver');

  // Save to history for logged-in users
  if (typeof addHistoryEntry === 'function' && currentUser) {
    const preview  = window.lastSentPreview || '';
    const fileType = selectedFile ? 'file' : 'text';
    addHistoryEntry('sent', preview, code, fileType);
  }

  // Reset selected file after successful send
  selectedFile = null;
  const fileCard = document.getElementById('send-file-card');
  if (fileCard) fileCard.classList.remove('show');

  // Push notification if tab is hidden
  if (typeof showPushNotification === 'function') {
    showPushNotification('Content shared!', 'Code ' + code + ' is ready', 'success');
  }
});

// ── CONTENT RECEIVED ───────────────────────────────────
// Server sends: { type, data, name, size, expiresAt }

socket.on('content-received', (payload) => {
  const { type, data, name, size, expiresAt } = payload;

  // Hide status pill
  hideStatus('receive-status');

  // Show the received box
  const box = document.getElementById('received-box');
  if (box) box.style.display = 'block';

  const textEl  = document.getElementById('received-text');
  const copyBtn = document.getElementById('copy-btn');
  const dlLink  = document.getElementById('received-download');

  if (type === 'text') {
    // ── TEXT RECEIVED ──────────────────────────────
    // Show the text content
    if (textEl) {
      textEl.style.display = 'block';
      textEl.textContent   = data;   // textContent prevents XSS
    }

    // Show copy button
    if (copyBtn) copyBtn.style.display = 'inline-block';

    // Hide download link
    if (dlLink) dlLink.style.display = 'none';

    // Save to history
    if (typeof addHistoryEntry === 'function' && currentUser) {
      addHistoryEntry('received', data.slice(0, 80), '', 'text');
    }

    console.log('📥 Text received, length:', data.length);

  } else if (type === 'file') {
    // ── FILE RECEIVED ──────────────────────────────
    // Show file info
    if (textEl) {
      textEl.style.display = 'block';
      textEl.innerHTML     =
        '<span style="font-weight:700;color:var(--accent)">' +
          getExt(name) +
        '</span>' +
        '&nbsp;&nbsp;' + name +
        '<br><span style="font-size:13px;color:var(--muted)">' + size + '</span>';
    }

    // Hide copy button — can't copy a file
    if (copyBtn) copyBtn.style.display = 'none';

    // Show download link
    if (dlLink) {
      dlLink.href          = data;     // base64 data URL
      dlLink.download      = name;     // filename for download
      dlLink.style.display = 'block';
    }

    // Save to history
    if (typeof addHistoryEntry === 'function' && currentUser) {
      addHistoryEntry('received', name, '', 'file');
    }

    console.log('📥 File received:', name, size);

  } else {
    // Unknown type — show raw data as text
    if (textEl) {
      textEl.style.display = 'block';
      textEl.textContent   = data;
    }
    if (copyBtn) copyBtn.style.display = 'inline-block';
    if (dlLink)  dlLink.style.display  = 'none';
    console.warn('📥 Unknown content type received:', type);
  }

  // Show expiry countdown if content expires
  if (expiresAt) {
    showExpiryTimer(expiresAt);
  } else {
    hideExpiryTimer();
    hideExpiryExpired();
  }

  // Push notification
  if (typeof showPushNotification === 'function') {
    showPushNotification(
      'Content received!',
      type === 'text'
        ? data.slice(0, 50)
        : 'File: ' + name,
      'success'
    );
  }
});

// ── CONTENT NOT FOUND ──────────────────────────────────

socket.on('content-not-found', (payload) => {
  const reason = payload && payload.reason ? payload.reason : 'not-found';

  let message = 'Nothing found — check the code';
  if (reason === 'expired') {
    message = 'This content has expired and been deleted';
  }

  showStatus('receive-status', 'error', message);
  hideExpiryTimer();
  hideExpiryExpired();

  const box = document.getElementById('received-box');
  if (box) box.style.display = 'none';

  console.log('❌ Content not found, reason:', reason);
});

// ── SHARE EXPIRED (sender gets this) ──────────────────

socket.on('share-expired', ({ code }) => {
  showStatus('send-status', 'error',
    'Your content on code ' + code + ' has expired and been deleted');

  if (typeof showPushNotification === 'function') {
    showPushNotification('Share expired', 'Code ' + code + ' was deleted', 'warning');
  }
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

  addMsg('create', 'Room created. Share the code or QR with your group.', 'sys');
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

  // Show QR so member can also share room with others
  showJoinQR('room-qr-wrapper-join', 'room-qr-box-join', code);
});

// ── ROOM NOT FOUND ─────────────────────────────────────

socket.on('room-not-found', () => {
  showStatus('join-status', 'error', 'Room not found — check the code');
});

// ── ROOM HISTORY ───────────────────────────────────────

socket.on('room-history', (history) => {
  if (!history || !history.length) return;

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

    if (typeof showPushNotification === 'function') {
      showPushNotification('New message', payload.message.slice(0, 60), 'info');
    }
  } else {
    addFileMsg(currentRoomType, payload, 'them');

    if (typeof showPushNotification === 'function') {
      showPushNotification('File shared in room', payload.name, 'info');
    }
  }
});

// ── ROOM MEMBER EVENTS ─────────────────────────────────

socket.on('user-joined-room', () => {
  addMsg(currentRoomType, 'Someone joined the room 👋', 'sys');
  if (typeof showPushNotification === 'function') {
    showPushNotification('Room', 'Someone joined', 'info');
  }
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

  if (typeof showPushNotification === 'function') {
    showPushNotification('Room closed', 'The creator has left', 'warning');
  }
});

// ── SERVER ERROR ───────────────────────────────────────

socket.on('server-error', ({ message }) => {
  console.error('Server error:', message);
  if (typeof showToast === 'function') {
    showToast('Server error', message, 'error');
  }
});