// ═══════════════════════════════════════════════════════
//  js/theme.js  (was theam.js — rename the file)
//  Handles dark / light / system theme toggle
//
//  ROOT CAUSE OF BUG:
//  CSS uses [data-theme] on <html> element
//  → must use document.documentElement.setAttribute
//  → NOT document.body.setAttribute
//  → NOT document.querySelector('html').className
// ═══════════════════════════════════════════════════════

// The <html> element — this is where data-theme lives
const htmlEl = document.documentElement;

// Storage key
const THEME_KEY = 'shareamigo-theme';

// Holds the matchMedia listener so we can remove it later
let systemThemeListener = null;

// ── APPLY A THEME ──────────────────────────────────────
// This is the ONE place that actually changes the theme.
// Everything else calls this.
function applyTheme(theme) {
  // theme = 'dark' | 'light'
  // This is what your CSS listens to:
  //   [data-theme="light"] { ... }
  htmlEl.setAttribute('data-theme', theme);
  console.log('Theme applied:', theme);
}

// ── SET THEME (called by buttons) ─────────────────────
// mode = 'dark' | 'light' | 'system'
function setTheme(mode) {
  // Save preference
  localStorage.setItem(THEME_KEY, mode);

  // Remove any existing system listener
  removeSystemListener();

  if (mode === 'dark') {
    applyTheme('dark');

  } else if (mode === 'light') {
    applyTheme('light');

  } else if (mode === 'system') {
    // Match OS preference right now
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');

    // Watch for OS changes while in system mode
    attachSystemListener();
  }

  // Update button active states
  updateThemeButtons(mode);
}

// ── SYSTEM THEME LISTENER ──────────────────────────────
function attachSystemListener() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  systemThemeListener = (e) => {
    // Only fire if still in system mode
    if (localStorage.getItem(THEME_KEY) === 'system') {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  };

  // Modern API
  if (mq.addEventListener) {
    mq.addEventListener('change', systemThemeListener);
  } else {
    // Safari fallback
    mq.addListener(systemThemeListener);
  }
}

function removeSystemListener() {
  if (!systemThemeListener) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.removeEventListener) {
    mq.removeEventListener('change', systemThemeListener);
  } else {
    mq.removeListener(systemThemeListener);
  }
  systemThemeListener = null;
}

// ── UPDATE BUTTON STATES ───────────────────────────────
function updateThemeButtons(activeMode) {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Buttons call setTheme('light'), setTheme('system'), setTheme('dark')
  // Match by what's in their onclick attribute
  document.querySelectorAll('.theme-btn').forEach(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    if (onclick.includes(`'${activeMode}'`)) {
      btn.classList.add('active');
    }
  });
}

// ── RESTORE ON PAGE LOAD ───────────────────────────────
// Runs immediately when this script loads
(function restoreTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  setTheme(saved);
})();