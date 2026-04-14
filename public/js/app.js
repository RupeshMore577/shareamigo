// ═══════════════════════════════════════════════════════
//  js/app.js
//  Shared state + navigation + UI helpers + QR + drag-drop
//  Loads first — all other JS files depend on these globals
// ═══════════════════════════════════════════════════════

// ── SHARED STATE ───────────────────────────────────────
// These are the single source of truth used across all files

let currentRoom     = '';   // active room code
let currentRoomType = '';   // 'create' or 'join'
let selectedFile    = null; // file chosen for send
let clipboardContent = '';  // last clipboard text read
let generatedSendCode = ''; // code from server for send screen
let generatedRoomCode = ''; // code from server for room screen
let selectedExpiryMs  = 0;  // 0 = no expiry, else ms duration

// ── NAVIGATION ─────────────────────────────────────────

function showScreen(id) {
  // Hide landing page
  const landing = document.getElementById('landing');
  if (landing) landing.style.display = 'none';

  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });

  // Show the target screen
  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  // Auto-request codes when entering these screens
  // Only request if we don't already have one
  if (id === 'send-screen'   && !generatedSendCode) requestSendCode();
  if (id === 'create-screen' && !generatedRoomCode) requestRoomCode();
}

function goHome() {
  // Show landing, hide all screens
  const landing = document.getElementById('landing');
  if (landing) landing.style.display = 'flex';
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });

  // Reset all shared state
  currentRoom       = '';
  currentRoomType   = '';
  generatedSendCode = '';
  generatedRoomCode = '';
  selectedFile      = null;
  selectedExpiryMs  = 0;

  // Reset expiry button states
  document.querySelectorAll('.expiry-btn').forEach(b => {
    b.classList.remove('active');
  });

  // Hide room chat areas
  const createArea = document.getElementById('room-area-create');
  const joinArea   = document.getElementById('room-area-join');
  if (createArea) createArea.style.display = 'none';
  if (joinArea)   joinArea.style.display   = 'none';

  // Reset code displays
  const sendCodeDisplay   = document.getElementById('send-code-display');
  const createCodeDisplay = document.getElementById('create-code-display');
  if (sendCodeDisplay)   sendCodeDisplay.textContent   = '—';
  if (createCodeDisplay) createCodeDisplay.textContent = '—';

  // Disable create room button until new code arrives
  const createRoomBtn = document.getElementById('create-room-btn');
  if (createRoomBtn) createRoomBtn.disabled = true;

  // Hide QR wrappers
  hideQR('send-qr-wrapper');
  hideQR('room-qr-wrapper-create');
  hideQR('room-qr-wrapper-join');

  // Clear QR boxes so stale QR doesn't show next time
  clearQRBox('send-qr-box');
  clearQRBox('room-qr-box-create');
  clearQRBox('room-qr-box-join');

  // Hide received box
  const receivedBox = document.getElementById('received-box');
  if (receivedBox) receivedBox.style.display = 'none';

  // Hide expiry elements on receive screen
  hideExpiryTimer();
  hideExpiryExpired();

  // Clear send text
  const sendText = document.getElementById('send-text');
  if (sendText) sendText.value = '';

  // Hide file card
  const fileCard = document.getElementById('send-file-card');
  if (fileCard) fileCard.classList.remove('show');

  // Reset progress bar
  const pw = document.getElementById('send-progress-wrap');
  const pb = document.getElementById('send-progress-bar');
  if (pw) pw.classList.remove('show');
  if (pb) pb.style.width = '0%';

  // Hide status pills
  ['send-status', 'receive-status', 'create-status', 'join-status'].forEach(id => {
    hideStatus(id);
  });
}

// ── POPUP ──────────────────────────────────────────────

function closePopup() {
  const popup = document.getElementById('clipboard-popup');
  if (popup) popup.classList.remove('show');
}

// ── STATUS PILL HELPERS ────────────────────────────────
// type: 'info' | 'success' | 'error'

function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `status-pill ${type} show`;
  el.innerHTML = `<span class="dot"></span>${msg}`;
}

function hideStatus(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'status-pill';
  el.textContent = '';
}

// ── FILE HELPERS ───────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024)          return bytes + ' B';
  if (bytes < 1024 * 1024)   return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getExt(name) {
  if (!name) return 'FILE';
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
}

// ── EXPIRY SELECTOR ────────────────────────────────────
// Called by the expiry buttons in the HTML

function selectExpiry(ms, btn) {
  selectedExpiryMs = ms;

  // Update button active state
  document.querySelectorAll('.expiry-btn').forEach(b => {
    b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');

  console.log('Expiry set to:', ms ? ms / 60000 + ' minutes' : 'none');
}

// ── QR CODE HELPERS ────────────────────────────────────
// QRCode library is loaded via CDN in index.html

function generateQR(boxId, text) {
  const box = document.getElementById(boxId);
  if (!box) return;

  // Clear any previous QR
  box.innerHTML = '';

  // QRCode library must be loaded
  if (typeof QRCode === 'undefined') {
    console.warn('QRCode library not loaded yet');
    return;
  }

  try {
    new QRCode(box, {
      text:         text,
      width:        148,
      height:       148,
      // Use CSS variable values — must read computed style
      colorDark:    getComputedStyle(document.documentElement)
                      .getPropertyValue('--text').trim() || '#f0f0f0',
      colorLight:   getComputedStyle(document.documentElement)
                      .getPropertyValue('--surface').trim() || '#111111',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (err) {
    console.warn('QR generation failed:', err);
  }
}

function showQR(wrapperId, boxId, text) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  wrapper.style.display = 'flex';
  generateQR(boxId, text);
}

function hideQR(wrapperId) {
  const wrapper = document.getElementById(wrapperId);
  if (wrapper) wrapper.style.display = 'none';
}

function clearQRBox(boxId) {
  const box = document.getElementById(boxId);
  if (box) box.innerHTML = '';
}

// ── EXPIRY TIMER HELPERS (receive screen) ──────────────

let expiryCountdownTimer = null;

function showExpiryTimer(expiresAt) {
  // expiresAt = Unix timestamp in ms

  const timerEl   = document.getElementById('expiry-timer');
  const expiredEl = document.getElementById('expiry-expired');

  if (!timerEl) return;

  // Clear any existing countdown
  if (expiryCountdownTimer) {
    clearInterval(expiryCountdownTimer);
    expiryCountdownTimer = null;
  }

  function tick() {
    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
      clearInterval(expiryCountdownTimer);
      expiryCountdownTimer = null;
      timerEl.style.display = 'none';
      if (expiredEl) expiredEl.style.display = 'block';
      return;
    }

    // Format remaining time
    const totalSec = Math.ceil(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    let display = '';
    if (h > 0)      display = `${h}h ${m}m ${s}s`;
    else if (m > 0) display = `${m}m ${s}s`;
    else            display = `${s}s`;

    timerEl.style.display = 'flex';
    timerEl.innerHTML = `<span class="dot"></span>Expires in: <strong>${display}</strong>`;

    // Turn red when under 60 seconds
    if (totalSec <= 60) {
      timerEl.style.color = 'var(--danger)';
    } else {
      timerEl.style.color = '';
    }
  }

  tick(); // Show immediately
  expiryCountdownTimer = setInterval(tick, 1000);
}

function hideExpiryTimer() {
  const timerEl = document.getElementById('expiry-timer');
  if (timerEl) timerEl.style.display = 'none';
  if (expiryCountdownTimer) {
    clearInterval(expiryCountdownTimer);
    expiryCountdownTimer = null;
  }
}

function hideExpiryExpired() {
  const expiredEl = document.getElementById('expiry-expired');
  if (expiredEl) expiredEl.style.display = 'none';
}

// ── DRAG AND DROP (send screen) ────────────────────────

const dropZone = document.getElementById('drop-zone');

if (dropZone) {
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
}

function fileSelected() {
  const input = document.getElementById('file-input');
  if (!input) return;
  const file = input.files[0];
  if (!file) return;
  selectedFile = file;
  showFileCard(file);
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

// ── KEYBOARD SHORTCUTS ─────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = document.activeElement && document.activeElement.id;
  if (!id) return;

  if (id === 'create-msg-input') sendRoomMsg('create');
  else if (id === 'join-msg-input')  sendRoomMsg('join');
  else if (id === 'send-text')       sendContent();
  else if (id === 'receive-code')    receiveContent();
  else if (id === 'join-code')       joinRoom();
});