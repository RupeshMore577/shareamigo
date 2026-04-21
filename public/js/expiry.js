/* ============================================
   js/expiry.js
   Share expiry system.
   
   How it works:
   - User picks a duration (or none = no expiry)
   - When content is sent, expiry time is included
   - Server deletes content after that duration
   - Countdown shows on sender's screen
   - When content is fetched past expiry → "not found"
   ============================================ */

// ─── State ─────────────────────────────────

// How long content lives (in milliseconds)
// null = no expiry
window.selectedExpiry = null;

// Timer interval for the countdown display
let countdownInterval = null;

// When the content expires (absolute timestamp)
let expiresAt = null;

// ─── Expiry Options ─────────────────────────

// Minutes → milliseconds
const EXPIRY_OPTIONS = [
  { label: '5 min',  ms: 5  * 60 * 1000 },
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '1 hr',   ms: 60 * 60 * 1000 },
];

// ─── Build the Expiry UI ────────────────────

/*
  Call this from send.js after the send screen appears.
  It injects the expiry row below the send code box.
  
  targetElementId = the element to insert AFTER
*/
function buildExpiryPicker(targetElementId) {
  // Don't build twice
  if (document.getElementById('expiry-row')) return;

  const target = document.getElementById(targetElementId);
  if (!target) return;

  // Build the row
  const row = document.createElement('div');
  row.className = 'expiry-row';
  row.id = 'expiry-row';

  // Label
  const label = document.createElement('span');
  label.className = 'expiry-label';
  label.textContent = 'Expires in:';

  // "None" button (default — no expiry)
  const noneBtn = document.createElement('button');
  noneBtn.className = 'expiry-btn active';   // active by default
  noneBtn.textContent = 'Never';
  noneBtn.dataset.ms = '0';
  noneBtn.addEventListener('click', () => selectExpiry(0, noneBtn));

  // Options container
  const optionsDiv = document.createElement('div');
  optionsDiv.className = 'expiry-options';
  optionsDiv.appendChild(noneBtn);

  // Build one button per option
  EXPIRY_OPTIONS.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'expiry-btn';
    btn.textContent = opt.label;
    btn.dataset.ms = opt.ms;
    btn.addEventListener('click', () => selectExpiry(opt.ms, btn));
    optionsDiv.appendChild(btn);
  });

  row.appendChild(label);
  row.appendChild(optionsDiv);

  // Insert AFTER the target element
  target.parentNode.insertBefore(row, target.nextSibling);

  // Countdown display — appears below picker
  const countdown = document.createElement('div');
  countdown.className = 'expiry-countdown';
  countdown.id = 'expiry-countdown';
  row.parentNode.insertBefore(countdown, row.nextSibling);
}

// ─── Select an Expiry Duration ──────────────

function selectExpiry(ms, clickedBtn) {
  // Update which button looks active
  document.querySelectorAll('.expiry-btn').forEach(b => {
    b.classList.remove('active');
  });
  clickedBtn.classList.add('active');

  // Store selection
  // 0 means "Never" → set to null
  window.selectedExpiry = ms === 0 ? null : ms;

  // Stop any running countdown
  stopCountdown();

  // Clear the display
  const countdownEl = document.getElementById('expiry-countdown');
  if (countdownEl) countdownEl.textContent = '';
}

// ─── Start Countdown After Sending ─────────

/*
  Called after content is successfully sent.
  ms = how many milliseconds until expiry
*/
function startCountdown(ms) {
  if (!ms) return;   // No expiry = nothing to count

  // Calculate when it expires
  expiresAt = Date.now() + ms;

  // Update immediately then every second
  updateCountdownDisplay();
  countdownInterval = setInterval(updateCountdownDisplay, 1000);
}

function updateCountdownDisplay() {
  const countdownEl = document.getElementById('expiry-countdown');
  if (!countdownEl) return;

  const remaining = expiresAt - Date.now();

  if (remaining <= 0) {
    // Expired
    stopCountdown();
    countdownEl.textContent = 'Content has expired and been deleted.';
    countdownEl.classList.add('urgent');
    return;
  }

  // Format into hours / minutes / seconds
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let display = '';
  if (hours > 0) {
    display = `${hours}h ${minutes}m ${seconds}s remaining`;
  } else if (minutes > 0) {
    display = `${minutes}m ${seconds}s remaining`;
  } else {
    display = `${seconds}s remaining`;
  }

  countdownEl.textContent = display;

  // Turn red when under 1 minute
  if (totalSeconds <= 60) {
    countdownEl.classList.add('urgent');
  } else {
    countdownEl.classList.remove('urgent');
  }
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  expiresAt = null;
}

// ─── Reset (called when going back to home) ─

function resetExpiry() {
  stopCountdown();
  window.selectedExpiry = null;

  // Remove the UI elements from DOM
  const row = document.getElementById('expiry-row');
  if (row) row.remove();

  const countdown = document.getElementById('expiry-countdown');
  if (countdown) countdown.remove();
}

// ─── Server-side expiry handling ───────────
/*
  server.js will receive expiryMs in the share-content event.
  It will use setTimeout to delete that code's content after that time.
  
  We don't need extra code here for that part — server handles it.
  See the server.js update in Group 2.
*/

// ─── Expose globally ────────────────────────

window.buildExpiryPicker = buildExpiryPicker;
window.startCountdown    = startCountdown;
window.stopCountdown     = stopCountdown;
window.resetExpiry       = resetExpiry;
window.selectExpiry      = selectExpiry;