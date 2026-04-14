// ── SHARE EXPIRY SYSTEM ───────────────────────────────
// Sender picks a time limit → server auto-deletes after that
// Receiver sees a live countdown timer
// When expired → content is gone, receiver sees message

// Currently selected expiry in milliseconds (null = no expiry)
let selectedExpiry = null;

// Holds the countdown interval so we can clear it
let countdownInterval = null;

// ── EXPIRY BUTTON SELECTION ───────────────────────────
// Called when user clicks 5m / 15m / 30m / 1h button
function selectExpiry(ms, btn) {
  selectedExpiry = ms;

  // Remove selected class from all expiry buttons
  document.querySelectorAll('.expiry-btn').forEach(b => {
    b.classList.remove('selected');
  });

  // Mark this button as selected
  btn.classList.add('selected');
}

// ── FORMAT TIME ───────────────────────────────────────
// Converts milliseconds to "4m 32s" format
function formatCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes      = Math.floor(totalSeconds / 60);
  const seconds      = totalSeconds % 60;

  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// ── START COUNTDOWN TIMER (shown to receiver) ─────────
// Called when receiver gets content that has an expiry
function startCountdown(expiresAt) {
  const timerEl = document.getElementById('expiry-timer');
  if (!timerEl) return;

  timerEl.classList.add('show');

  // Clear any existing countdown
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
      // Time is up — clear content
      clearInterval(countdownInterval);
      timerEl.classList.remove('show');
      showExpired();
      return;
    }

    timerEl.innerHTML =
      `<span class="dot"></span>Expires in ${formatCountdown(remaining)}`;

  }, 1000);
}

// ── SHOW EXPIRED MESSAGE ──────────────────────────────
function showExpired() {
  // Hide received content
  const box = document.getElementById('received-box');
  if (box) box.style.display = 'none';

  // Show expired notice
  const expired = document.getElementById('expiry-expired');
  if (expired) expired.style.display = 'block';

  showToast('⏰ This share has expired', 'warning');
}

// ── GET EXPIRY TIMESTAMP ──────────────────────────────
// Returns Unix timestamp when content should expire
// Returns null if no expiry selected
function getExpiryTimestamp() {
  if (!selectedExpiry) return null;
  return Date.now() + selectedExpiry;
}

// ── CHECK IF CONTENT IS EXPIRED ───────────────────────
// Called when receiver gets content
// Returns true if expired, false if still valid
function isExpired(expiresAt) {
  if (!expiresAt) return false;  // no expiry = never expires
  return Date.now() > expiresAt;
}

// ── RESET EXPIRY STATE ────────────────────────────────
function resetExpiry() {
  selectedExpiry = null;
  if (countdownInterval) clearInterval(countdownInterval);
  document.querySelectorAll('.expiry-btn').forEach(b => {
    b.classList.remove('selected');
  });
}