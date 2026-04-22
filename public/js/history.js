// ═══════════════════════════════════════════════════════
//  js/history.js
//  Fixed:
//  - Works with existing HTML panel (no duplicate injection)
//  - Correct screen IDs (receive-screen not receiveScreen)
//  - Uses showToast not showStatus for non-screen messages
// ═══════════════════════════════════════════════════════

async function addHistoryEntry(type, preview, code, fileType) {
  if (!currentUser) return;

  try {
    await db.collection('users').doc(currentUser.uid)
      .collection('history').add({
        type:      type,
        preview:   (preview || '').slice(0, 100),
        code:      code || '',
        fileType:  fileType || 'text',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

    await pruneHistory();

    // Refresh panel if open
    const panel = document.getElementById('history-panel');
    if (panel && panel.classList.contains('open')) {
      loadHistory();
    }

  } catch (err) {
    console.warn('History save failed:', err);
  }
}

async function pruneHistory() {
  if (!currentUser) return;
  try {
    const snap = await db.collection('users').doc(currentUser.uid)
      .collection('history')
      .orderBy('timestamp', 'desc')
      .get();

    if (snap.size <= 20) return;

    const batch = db.batch();
    snap.docs.slice(20).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  } catch (err) {
    console.warn('History prune failed:', err);
  }
}

async function loadHistory() {
  if (!currentUser) return;

  const listEl = document.getElementById('history-list');
  if (!listEl) return;

  listEl.innerHTML = '<div class="history-empty">Loading...</div>';

  try {
    const snap = await db.collection('users').doc(currentUser.uid)
      .collection('history')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    if (snap.empty) {
      listEl.innerHTML =
        '<div class="history-empty">No history yet.<br>' +
        'Send or receive something to see it here.</div>';
      return;
    }

    listEl.innerHTML = '';

    snap.forEach(doc => {
      const data = doc.data();
      const card = buildHistoryCard(data);
      listEl.appendChild(card);
    });

  } catch (err) {
    console.warn('History load failed:', err);
    listEl.innerHTML =
      '<div class="history-empty" style="color:var(--danger)">' +
      'Could not load history.</div>';
  }
}

function buildHistoryCard(data) {
  const card = document.createElement('div');
  card.className = 'history-card';

  const icon = data.fileType === 'file'
    ? (data.type === 'sent' ? '📤' : '📥')
    : (data.type === 'sent' ? '✉️' : '📨');

  const timeStr = data.timestamp
    ? formatHistoryTime(data.timestamp.toDate())
    : 'Just now';

  const preview = (data.preview || '').slice(0, 60) ||
    (data.fileType === 'file' ? '📎 File' : 'No preview');

  card.innerHTML =
    '<div class="history-card-top">' +
      '<span class="history-card-type ' + data.type + '">' +
        icon + ' ' + (data.type === 'sent' ? 'Sent' : 'Received') +
      '</span>' +
      '<span class="history-card-time">' + timeStr + '</span>' +
    '</div>' +
    '<div class="history-card-preview">' + escapeHtml(preview) + '</div>' +
    (data.code
      ? '<div class="history-card-code">Code: ' + data.code + '</div>'
      : '');

  card.addEventListener('click', () => {
    // Close panel
    const panel    = document.getElementById('history-panel');
    const backdrop = document.getElementById('history-backdrop');
    if (panel)    panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');

    // Go to receive screen with code pre-filled
    if (data.code) {
      showScreen('receive-screen');
      const input = document.getElementById('receive-code');
      if (input) input.value = data.code;
    }
  });

  return card;
}

function formatHistoryTime(date) {
  if (!date) return '';
  const now    = new Date();
  const diffMs = now - date;
  const mins   = Math.floor(diffMs / 60000);
  const hours  = Math.floor(diffMs / 3600000);
  const days   = Math.floor(diffMs / 86400000);

  if (mins < 1)   return 'Just now';
  if (mins < 60)  return mins + 'm ago';
  if (hours < 24) return hours + 'h ago';
  if (days < 7)   return days + 'd ago';
  return date.toLocaleDateString();
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}