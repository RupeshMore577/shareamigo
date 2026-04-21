// ═══════════════════════════════════════════════════════
//  js/qrcode-helper.js
//
//  QR codes that actually DO something when scanned.
//
//  HOW IT WORKS:
//  1. Sender opens Send screen
//     → QR is generated encoding this URL:
//        https://yoursite.com/?receive=aB3xYz9Q
//
//  2. Receiver scans QR with phone camera
//     → Phone opens browser to that URL
//     → app.js reads ?receive= from URL
//     → Receive screen opens with code auto-filled
//     → User taps "Get Content" → done
//
//  3. Room creator opens Create Room
//     → QR encodes: https://yoursite.com/?join=aB3xYz9Q
//
//  4. Member scans QR
//     → Phone opens browser to that URL
//     → Join screen opens with code auto-filled
//     → User taps "Join Room" → done
//
//  URL PARAMETERS USED:
//  ?receive=CODE   → opens receive screen with code filled
//  ?join=CODE      → opens join screen with code filled
// ═══════════════════════════════════════════════════════


// ── GET THE BASE URL ───────────────────────────────────
// Works on localhost AND on deployed domain automatically
// window.location.origin = "http://localhost:3000"
//                       or "https://yourdomain.com"

function getBaseUrl() {
  return window.location.origin;
}


// ── GENERATE QR INTO A BOX ─────────────────────────────
//
//  boxId  = id of the div to draw QR inside
//  url    = the FULL url to encode
//           e.g. "http://localhost:3000/?receive=aB3xYz9Q"

function generateQR(boxId, url) {

  if (typeof QRCode === 'undefined') {
    console.warn('QRCode library not loaded');
    return;
  }

  if (!url || url.trim() === '') {
    console.warn('generateQR: no url provided');
    return;
  }

  const box = document.getElementById(boxId);
  if (!box) {
    console.warn('generateQR: box not found:', boxId);
    return;
  }

  // Clear previous QR — library does not clean itself
  box.innerHTML = '';

  try {
    new QRCode(box, {
      text:         url,
      width:        180,
      height:       180,
      colorDark:    '#1a1a1a',   // dark dots — always dark for scanning
      colorLight:   '#ffffff',   // white background — always white
      correctLevel: QRCode.CorrectLevel.M
    });

    console.log('QR generated:', url);

  } catch (err) {
    console.error('QR generation failed:', err);
    box.innerHTML =
      '<div style="padding:16px;font-size:13px;color:var(--muted);' +
      'text-align:center;border:1px dashed var(--border);border-radius:8px">' +
      'QR unavailable<br>Share the code manually</div>';
  }
}


// ── SHOW QR FOR A SEND/RECEIVE CODE ───────────────────
//
//  Call this when a send code is generated.
//  wrapperId = outer div to show
//  boxId     = inner div to draw QR in
//  code      = the 8-char send code

function showReceiveQR(wrapperId, boxId, code) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;

  // Build the URL that receiver's phone will open
  // ?receive=CODE tells the app to open receive screen
  const url = getBaseUrl() + '/?receive=' + code;

  wrapper.style.display = 'flex';

  // Small delay so browser paints wrapper visible before canvas draws
  setTimeout(function() {
    generateQR(boxId, url);
  }, 60);
}


// ── SHOW QR FOR A ROOM JOIN CODE ──────────────────────
//
//  Call this when a room is created or joined.
//  wrapperId = outer div to show
//  boxId     = inner div to draw QR in
//  code      = the 8-char room code

function showJoinQR(wrapperId, boxId, code) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;

  // Build the URL that joiner's phone will open
  // ?join=CODE tells the app to open join screen
  const url = getBaseUrl() + '/?join=' + code;

  wrapper.style.display = 'flex';

  setTimeout(function() {
    generateQR(boxId, url);
  }, 60);
}


// ── HIDE QR WRAPPER ────────────────────────────────────

function hideQR(wrapperId) {
  const wrapper = document.getElementById(wrapperId);
  if (wrapper) wrapper.style.display = 'none';
}


// ── CLEAR QR BOX ───────────────────────────────────────

function clearQRBox(boxId) {
  const box = document.getElementById(boxId);
  if (box) box.innerHTML = '';
}


// ── REFRESH ALL VISIBLE QR CODES ──────────────────────
// Called from theme.js when theme changes

function refreshAllQRCodes() {
  // Send QR
  const sendWrapper = document.getElementById('send-qr-wrapper');
  if (sendWrapper &&
      sendWrapper.style.display !== 'none' &&
      generatedSendCode) {
    generateQR('send-qr-box', getBaseUrl() + '/?receive=' + generatedSendCode);
  }

  // Room create QR
  const createWrapper = document.getElementById('room-qr-wrapper-create');
  if (createWrapper &&
      createWrapper.style.display !== 'none' &&
      generatedRoomCode) {
    generateQR('room-qr-box-create', getBaseUrl() + '/?join=' + generatedRoomCode);
  }

  // Room join QR
  const joinWrapper = document.getElementById('room-qr-wrapper-join');
  if (joinWrapper &&
      joinWrapper.style.display !== 'none' &&
      currentRoom) {
    generateQR('room-qr-box-join', getBaseUrl() + '/?join=' + currentRoom);
  }
}


// ═══════════════════════════════════════════════════════
//  AUTO-FILL FROM URL
//
//  This runs on page load.
//  If the URL has ?receive=CODE or ?join=CODE
//  (from scanning a QR) it auto-fills and triggers the action.
//
//  Flow:
//  Phone scans QR → opens http://yoursite.com/?receive=aB3xYz9Q
//  → This code reads ?receive from URL
//  → Opens receive screen
//  → Fills in the code
//  → User just taps "Get Content"
// ═══════════════════════════════════════════════════════

function handleURLParams() {
  const params = new URLSearchParams(window.location.search);

  const receiveCode = params.get('receive');
  const joinCode    = params.get('join');

  if (receiveCode && receiveCode.length === 8) {
    // Someone scanned a receive QR
    // Open receive screen with code pre-filled

    console.log('QR scan detected — receive code:', receiveCode);

    // Small delay to let the app finish initializing
    setTimeout(function() {
      showScreen('receive-screen');

      const input = document.getElementById('receive-code');
      if (input) {
        input.value = receiveCode;
        input.focus();
      }

      // Clean URL so refreshing doesn't re-trigger
      window.history.replaceState({}, '', '/');
    }, 300);

  } else if (joinCode && joinCode.length === 8) {
    // Someone scanned a room QR
    // Open join screen with code pre-filled

    console.log('QR scan detected — join code:', joinCode);

    setTimeout(function() {
      showScreen('join-screen');

      const input = document.getElementById('join-code');
      if (input) {
        input.value = joinCode;
        input.focus();
      }

      // Clean URL
      window.history.replaceState({}, '', '/');
    }, 300);
  }
}

// Run on page load — after all scripts are ready
window.addEventListener('load', function() {
  // Small delay so auth check and socket connect first
  setTimeout(handleURLParams, 500);
});