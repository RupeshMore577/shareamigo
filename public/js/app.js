// ═══════════════════════════════════════════════════════
//  js/app.js
//  Fixed: selectExpiry uses selectedExpiryMs (one variable)
//  expiry.js removed — all expiry logic lives here
// ═══════════════════════════════════════════════════════

let currentRoom       = '';
let currentRoomType   = '';
let selectedFile      = null;
let clipboardContent  = '';
let generatedSendCode = '';
let generatedRoomCode = '';
let selectedExpiryMs  = 0;    // 0 = never

// ── NAVIGATION ─────────────────────────────────────────

function showScreen(id) {
  const landing = document.getElementById('landing');
  if (landing) landing.style.display = 'none';

  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });

  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  if (id === 'send-screen'   && !generatedSendCode) requestSendCode();
  if (id === 'create-screen' && !generatedRoomCode) requestRoomCode();
}

function goHome() {
  const landing = document.getElementById('landing');
  if (landing) landing.style.display = 'flex';

  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });

  currentRoom       = '';
  currentRoomType   = '';
  generatedSendCode = '';
  generatedRoomCode = '';
  selectedFile      = null;
  selectedExpiryMs  = 0;

  // Reset expiry buttons — Never is default active
  document.querySelectorAll('.expiry-btn').forEach(b => {
    b.classList.remove('active');
  });
  const neverBtn = document.querySelector('.expiry-btn');
  if (neverBtn) neverBtn.classList.add('active');

  const createArea = document.getElementById('room-area-create');
  const joinArea   = document.getElementById('room-area-join');
  if (createArea) createArea.style.display = 'none';
  if (joinArea)   joinArea.style.display   = 'none';

  const sendDisplay   = document.getElementById('send-code-display');
  const createDisplay = document.getElementById('create-code-display');
  if (sendDisplay)   sendDisplay.textContent   = '—';
  if (createDisplay) createDisplay.textContent = '—';

  const createBtn = document.getElementById('create-room-btn');
  if (createBtn) createBtn.disabled = true;

  hideQR('send-qr-wrapper');
  hideQR('room-qr-wrapper-create');
  hideQR('room-qr-wrapper-join');
  clearQRBox('send-qr-box');
  clearQRBox('room-qr-box-create');
  clearQRBox('room-qr-box-join');

  const receivedBox = document.getElementById('received-box');
  if (receivedBox) receivedBox.style.display = 'none';

  hideExpiryTimer();
  hideExpiryExpired();

  const sendText = document.getElementById('send-text');
  if (sendText) sendText.value = '';

  const fileCard = document.getElementById('send-file-card');
  if (fileCard) fileCard.classList.remove('show');

  const pw = document.getElementById('send-progress-wrap');
  const pb = document.getElementById('send-progress-bar');
  if (pw) pw.classList.remove('show');
  if (pb) pb.style.width = '0%';

  const receiveCode = document.getElementById('receive-code');
  if (receiveCode) receiveCode.value = '';

  const joinCode = document.getElementById('join-code');
  if (joinCode) joinCode.value = '';

  ['send-status','receive-status','create-status','join-status']
    .forEach(id => hideStatus(id));
}

function closePopup() {
  const popup = document.getElementById('clipboard-popup');
  if (popup) popup.classList.remove('show');
}

// ── STATUS PILLS ───────────────────────────────────────

function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'status-pill ' + type + ' show';
  el.innerHTML = '<span class="dot"></span>' + msg;
}

function hideStatus(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className   = 'status-pill';
  el.textContent = '';
}

// ── FILE HELPERS ───────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024)          return bytes + ' B';
  if (bytes < 1048576)       return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function getExt(name) {
  if (!name) return 'FILE';
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
}

// ── EXPIRY ─────────────────────────────────────────────
// Single function — used by HTML buttons onclick

function selectExpiry(ms, btn) {
  selectedExpiryMs = ms;

  document.querySelectorAll('.expiry-btn').forEach(b => {
    b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
}

// ── EXPIRY TIMER (receive screen) ─────────────────────

let expiryCountdownInterval = null;

function showExpiryTimer(expiresAt) {
  const timerEl   = document.getElementById('expiry-timer');
  const expiredEl = document.getElementById('expiry-expired');

  if (!timerEl) return;

  if (expiryCountdownInterval) {
    clearInterval(expiryCountdownInterval);
    expiryCountdownInterval = null;
  }

  if (expiredEl) expiredEl.style.display = 'none';

  function tick() {
    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
      clearInterval(expiryCountdownInterval);
      expiryCountdownInterval = null;
      timerEl.style.display = 'none';
      if (expiredEl) expiredEl.style.display = 'block';
      return;
    }

    const totalSec = Math.ceil(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    let display = '';
    if (h > 0)      display = h + 'h ' + m + 'm ' + s + 's';
    else if (m > 0) display = m + 'm ' + s + 's';
    else            display = s + 's';

    timerEl.style.display = 'flex';
    timerEl.innerHTML =
      '<span class="dot"></span>Expires in: <strong>' + display + '</strong>';
    timerEl.style.color = totalSec <= 60 ? 'var(--danger)' : '';
  }

  tick();
  expiryCountdownInterval = setInterval(tick, 1000);
}

function hideExpiryTimer() {
  const el = document.getElementById('expiry-timer');
  if (el) el.style.display = 'none';
  if (expiryCountdownInterval) {
    clearInterval(expiryCountdownInterval);
    expiryCountdownInterval = null;
  }
}

function hideExpiryExpired() {
  const el = document.getElementById('expiry-expired');
  if (el) el.style.display = 'none';
}

// ── FILE CARD ──────────────────────────────────────────

function fileSelected() {
  const input = document.getElementById('file-input');
  if (!input || !input.files[0]) return;
  selectedFile = input.files[0];
  showFileCard(selectedFile);
}

function showFileCard(file) {
  const card  = document.getElementById('send-file-card');
  const label = document.getElementById('send-file-label');
  const size  = document.getElementById('send-file-size');
  const ext   = document.getElementById('send-file-ext');

  if (card)  card.classList.add('show');
  if (label) label.textContent = file.name;
  if (size)  size.textContent  = formatBytes(file.size);
  if (ext)   ext.textContent   = getExt(file.name);
}

// ── DRAG AND DROP ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  if (!dropZone) return;

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    selectedFile = file;
    showFileCard(file);
  });
});

// ── KEYBOARD SHORTCUTS ─────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = document.activeElement && document.activeElement.id;
  if (!id) return;

  if      (id === 'create-msg-input') sendRoomMsg('create');
  else if (id === 'join-msg-input')   sendRoomMsg('join');
  else if (id === 'send-text')        sendContent();
  else if (id === 'receive-code')     receiveContent();
  else if (id === 'join-code')        joinRoom();
});