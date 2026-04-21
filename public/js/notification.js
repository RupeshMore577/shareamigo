/* ============================================
   js/notifications.js
   
   Two layers:
   1. In-app toasts — always work, no permission needed
      showToast(title, message, type, duration)
      Types: 'info' | 'success' | 'warning' | 'error'
   
   2. Browser push notifications — only when tab is hidden
      and user has granted permission
      Shown via the Notifications API (no server needed)
   ============================================ */

// ─── Create Toast Container ─────────────────

// Make sure the container exists in the DOM
function ensureToastContainer() {
  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return document.getElementById('toast-container');
}

// ─── Show In-App Toast ──────────────────────

/*
  title    = bold heading line
  message  = smaller detail text
  type     = 'info' | 'success' | 'warning' | 'error'
  duration = milliseconds before auto-dismiss (default 4000)
             pass 0 to keep it until manually closed
*/
function showToast(title, message = '', type = 'info', duration = 4000) {
  const container = ensureToastContainer();

  // ── Icon per type ──
  const icons = {
    info:    'ℹ️',
    success: '✅',
    warning: '⚠️',
    error:   '❌',
  };

  // ── Build toast element ──
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
    </div>
    <button class="toast-close" title="Dismiss">✕</button>
    ${duration > 0 ? '<div class="toast-progress"></div>' : ''}
  `;

  container.appendChild(toast);

  // ── Close button ──
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => dismissToast(toast));

  // ── Progress bar animation ──
  // We use a CSS transition so it's smooth
  if (duration > 0) {
    const bar = toast.querySelector('.toast-progress');
    // Start at full width
    bar.style.width = '100%';
    bar.style.transitionDuration = duration + 'ms';

    // Trigger shrink on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.width = '0%';
      });
    });

    // Auto-dismiss after duration
    setTimeout(() => dismissToast(toast), duration);
  }

  // ── Limit to 5 toasts max ──
  const allToasts = container.querySelectorAll('.toast:not(.hiding)');
  if (allToasts.length > 5) {
    dismissToast(allToasts[0]);
  }

  return toast;
}

// ─── Dismiss a Toast ────────────────────────

function dismissToast(toast) {
  if (!toast || toast.classList.contains('hiding')) return;

  toast.classList.add('hiding');

  // Remove after animation completes
  setTimeout(() => {
    toast.remove();
  }, 350);
}

// ─── Browser Push Notifications ─────────────

let pushPermission = Notification?.permission || 'default';

/*
  Ask the user for notification permission.
  Call this on first meaningful action 
  (don't ask on page load — bad UX).
*/
async function requestNotificationPermission() {
  // Browser doesn't support it
  if (!('Notification' in window)) return false;

  // Already decided
  if (pushPermission === 'granted')  return true;
  if (pushPermission === 'denied')   return false;

  // Ask
  try {
    const result = await Notification.requestPermission();
    pushPermission = result;
    return result === 'granted';
  } catch (err) {
    console.warn('Notification permission request failed:', err);
    return false;
  }
}

/*
  Show a browser push notification.
  Only fires when the tab is hidden (backgrounded).
  Falls back to in-app toast if tab is visible.
  
  title   = notification heading
  body    = detail text
  type    = for the in-app fallback toast
  icon    = optional emoji or URL for notification icon
*/
function showPushNotification(title, body = '', type = 'info') {
  // If user can see the tab → use in-app toast
  if (!document.hidden) {
    showToast(title, body, type);
    return;
  }

  // Tab is hidden → try browser notification
  if (pushPermission === 'granted' && 'Notification' in window) {
    try {
      const note = new Notification(title, {
        body: body,
        icon: '/favicon.ico',  // add a favicon later
        badge: '/favicon.ico',
        tag: 'shareamigo',     // replaces previous notification of same tag
        silent: false,
      });

      // Clicking notification brings tab to front
      note.onclick = () => {
        window.focus();
        note.close();
      };

      // Auto-close after 6 seconds
      setTimeout(() => note.close(), 6000);

    } catch (err) {
      // Fallback if something goes wrong
      showToast(title, body, type);
    }
  } else {
    // No permission → in-app toast anyway
    showToast(title, body, type);
  }
}

// ─── Pre-Built Notification Helpers ─────────
// These are called from socket.js, sync.js, room.js

// Someone shared content to a code you're watching
function notifyContentReceived(preview) {
  showPushNotification(
    '📥 Content Received',
    preview ? `"${truncate(preview, 50)}"` : 'New content is ready to view',
    'success'
  );
}

// Someone joined your room
function notifyRoomJoin(name) {
  showToast('👋 Someone Joined', `${name || 'A user'} joined the room`, 'info', 3000);
}

// Someone left your room
function notifyRoomLeave(name) {
  showToast('👋 Someone Left', `${name || 'A user'} left the room`, 'info', 2500);
}

// Cross-device clipboard sync arrived
function notifyClipboardSync() {
  showPushNotification(
    '📋 Clipboard Synced',
    'New content synced from another device',
    'info'
  );
}

// Content expired and was deleted
function notifyExpired() {
  showToast('⏰ Share Expired', 'Your shared content has been deleted', 'warning', 5000);
}

// Generic error
function notifyError(message) {
  showToast('Something went wrong', message, 'error', 5000);
}

// ─── Utility ────────────────────────────────

// Prevent XSS in toast content
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

// ─── Expose globally ────────────────────────

window.showToast                     = showToast;
window.showPushNotification          = showPushNotification;
window.requestNotificationPermission = requestNotificationPermission;
window.notifyContentReceived         = notifyContentReceived;
window.notifyRoomJoin                = notifyRoomJoin;
window.notifyRoomLeave               = notifyRoomLeave;
window.notifyClipboardSync           = notifyClipboardSync;
window.notifyExpired                 = notifyExpired;
window.notifyError                   = notifyError;
window.dismissToast                  = dismissToast;