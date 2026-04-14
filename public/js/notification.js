// ── NOTIFICATION SYSTEM ───────────────────────────────
// Two types:
// 1. Toast — small popup inside the app (always works)
// 2. Push  — browser notification (works in background,
//            requires user permission)

// ── TOAST NOTIFICATIONS ───────────────────────────────
// Small pill that slides up from bottom, auto-disappears
// type: 'success' | 'info' | 'warning'

let toastTimeout = null;

function showToast(message, type = 'info') {
  let toast = document.getElementById('app-toast');

  // Create toast element if it doesn't exist
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  // Clear existing timeout
  if (toastTimeout) clearTimeout(toastTimeout);

  // Set content and type
  toast.textContent = message;
  toast.className   = `toast ${type}`;

  // Show it
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-hide after 3 seconds
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ── PUSH NOTIFICATION PERMISSION ─────────────────────
// Ask user for permission to send browser notifications
async function requestNotifPermission() {
  if (!('Notification' in window)) {
    showToast('Your browser does not support notifications', 'warning');
    return;
  }

  if (Notification.permission === 'granted') {
    showToast('Notifications already enabled ✅', 'success');
    hideNotifBanner();
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      showToast('Notifications enabled ✅', 'success');
      hideNotifBanner();
      // Save preference
      localStorage.setItem('shareamigo-notif', 'granted');
    } else {
      showToast('Notifications blocked — you can enable in browser settings', 'warning');
    }
  } catch(e) {
    console.error('Notification permission error:', e);
  }
}

// ── SEND PUSH NOTIFICATION ────────────────────────────
// Only fires if user has granted permission
// Also falls back to toast if tab is visible
function sendPushNotif(title, body, icon = '📤') {
  // Always show toast regardless
  showToast(`${icon} ${body}`, 'info');

  // Only send push if tab is hidden (user is on another tab)
  if (document.visibilityState === 'visible') return;

  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, {
      body,
      icon: '/icon.png',   // we'll add this later
      badge: '/icon.png',
      tag: 'shareamigo',   // replaces previous notif instead of stacking
    });
  } catch(e) {
    console.error('Push notif failed:', e);
  }
}

// ── SPECIFIC NOTIFICATION TRIGGERS ───────────────────

// Someone joined your room
function notifUserJoined() {
  sendPushNotif(
    'Shareamigo — Someone joined!',
    'A new member joined your room',
    '👋'
  );
}

// Content was received (sender gets this)
function notifContentReceived(code) {
  sendPushNotif(
    'Shareamigo — Content received!',
    `Your share (code: ${code}) was picked up`,
    '✅'
  );
}

// Clipboard synced from another device
function notifClipboardSynced() {
  sendPushNotif(
    'Shareamigo — Clipboard synced!',
    'New clipboard content from your other device',
    '📲'
  );
}

// New room message when tab is hidden
function notifRoomMessage(preview) {
  sendPushNotif(
    'Shareamigo — New message!',
    preview.length > 50 ? preview.slice(0, 50) + '...' : preview,
    '💬'
  );
}

// ── NOTIF BANNER (shown on first visit) ──────────────
function showNotifBanner() {
  // Don't show if already granted or denied
  if (Notification.permission !== 'default') return;
  if (localStorage.getItem('shareamigo-notif-dismissed')) return;

  const banner = document.getElementById('notif-banner');
  if (banner) banner.classList.add('show');
}

function hideNotifBanner() {
  const banner = document.getElementById('notif-banner');
  if (banner) banner.classList.remove('show');
  localStorage.setItem('shareamigo-notif-dismissed', 'true');
}

// ── AUTO-SHOW BANNER ON LOAD ──────────────────────────
window.addEventListener('load', () => {
  // Wait 3 seconds before asking — don't be annoying immediately
  setTimeout(showNotifBanner, 3000);
});