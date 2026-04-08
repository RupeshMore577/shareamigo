// ── THEME SYSTEM ──────────────────────────────────────
// Handles dark / light / system modes
// Saves preference to localStorage so it persists

function setTheme(mode) {
  // Remove active from all buttons
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));

  // Find the clicked button and mark it active
  // We match by text content
  document.querySelectorAll('.theme-btn').forEach(b => {
    const label = b.textContent.trim().toLowerCase();
    if (
      (mode === 'light'  && label === 'light') ||
      (mode === 'dark'   && label === 'dark')  ||
      (mode === 'system' && label === 'auto')
    ) {
      b.classList.add('active');
    }
  });

  // Apply the theme to <html>
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', mode);
  }

  // Save for next visit
  localStorage.setItem('shreamigo-theme', mode);
}

// ── RESTORE THEME ON PAGE LOAD ────────────────────────
(function restoreTheme() {
  const saved = localStorage.getItem('shreamigo-theme') || 'dark';

  // Apply theme to html element immediately
  if (saved === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', saved);
  }

  // Mark correct button as active
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.remove('active');
    const label = b.textContent.trim().toLowerCase();
    if (
      (saved === 'light'  && label === 'light') ||
      (saved === 'dark'   && label === 'dark')  ||
      (saved === 'system' && label === 'auto')
    ) {
      b.classList.add('active');
    }
  });

  // Watch for system theme changes when in auto mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (localStorage.getItem('shreamigo-theme') === 'system') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
})();