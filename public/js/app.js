// ── SHARED STATE ──────────────────────────────────────
// These variables are used across all JS files
// app.js loads first so all other files can access these

let currentRoom     = '';   // active room code
let currentRoomType = '';   // 'create' or 'join'
let selectedFile    = null; // file chosen in send screen
let clipboardContent = '';  // last clipboard text
let generatedSendCode = ''; // auto-generated send code
let generatedRoomCode = ''; // auto-generated room code

// ── NAVIGATION ────────────────────────────────────────
function showScreen(id) {
  // Hide landing
  document.getElementById('landing').style.display = 'none';

  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Show target screen
  document.getElementById(id).classList.add('active');

  // Auto-request codes when entering these screens
  if (id === 'send-screen' && !generatedSendCode) requestSendCode();
  if (id === 'create-screen' && !generatedRoomCode) requestRoomCode();
}

function goHome() {
  document.getElementById('landing').style.display = 'flex';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Reset all state
  currentRoom       = '';
  currentRoomType   = '';
  generatedSendCode = '';
  generatedRoomCode = '';
  selectedFile      = null;

  // Hide room chat areas
  document.getElementById('room-area-create').style.display = 'none';
  document.getElementById('room-area-join').style.display   = 'none';

  // Reset code displays
  document.getElementById('send-code-display').textContent   = '—';
  document.getElementById('create-code-display').textContent = '—';

  // Disable create button until new code is generated
  document.getElementById('create-room-btn').disabled = true;
}

// ── STATUS HELPERS ────────────────────────────────────
function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.className = `status-pill ${type} show`;
  el.innerHTML = `<span class="dot"></span>${msg}`;
}

function hideStatus(id) {
  document.getElementById(id).className = 'status-pill';
}

// ── FILE HELPERS ──────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024)              return bytes + ' B';
  if (bytes < 1024 * 1024)       return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function getExt(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
}

// ── DRAG AND DROP ON SEND SCREEN ─────────────────────
const dropZone = document.getElementById('drop-zone');

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

function fileSelected() {
  const file = document.getElementById('file-input').files[0];
  if (!file) return;
  selectedFile = file;
  showFileCard(file);
}

function showFileCard(file) {
  const card = document.getElementById('send-file-card');
  card.classList.add('show');
  document.getElementById('send-file-label').textContent = file.name;
  document.getElementById('send-file-size').textContent  = formatBytes(file.size);
  document.getElementById('send-file-ext').textContent   = getExt(file.name);
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = document.activeElement?.id;
  if (id === 'create-msg-input') sendRoomMsg('create');
  else if (id === 'join-msg-input')  sendRoomMsg('join');
  else if (id === 'send-text')       sendContent();
  else if (id === 'receive-code')    receiveContent();
  else if (id === 'join-code')       joinRoom();
});