/* ============================================
   js/history.js
   
   Share history for logged-in users.
   Stores last 20 sends and receives in Firestore.
   Guests don't get history (no account to store it).
   
   Firestore path:
   users/{uid}/history/{autoId}
   Each doc: { type, preview, code, timestamp, fileType }
   ============================================ */

// ─── Add a history entry ────────────────────

/*
  Called after a successful send or receive.
  
  type     = 'sent' | 'received'
  preview  = text snippet or filename
  code     = the share code used
  fileType = 'text' | 'file' (optional)
*/
async function addHistoryEntry(type, preview, code, fileType = 'text') {
  // Only save for logged-in users
  if (!auth.currentUser) return;

  const uid = auth.currentUser.uid;

  try {
    const historyRef = db
      .collection('users')
      .doc(uid)
      .collection('history');

    // Save the new entry
    await historyRef.add({
      type:      type,              // 'sent' or 'received'
      preview:   preview || '',     // first 100 chars of text or filename
      code:      code || '',        // share code
      fileType:  fileType,          // 'text' or 'file'
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Enforce the 20-item limit
    // Fetch oldest entries beyond 20 and delete them
    await pruneHistory(historyRef);

    // Refresh the panel if it's open
    if (document.getElementById('history-panel')?.classList.contains('open')) {
      loadHistory();
    }

  } catch (err) {
    // History is non-critical — don't crash the app
    console.warn('History save failed:', err);
  }
}

// ─── Keep only the latest 20 entries ────────

async function pruneHistory(historyRef) {
  try {
    const snap = await historyRef
      .orderBy('timestamp', 'desc')
      .get();

    // If 20 or fewer, nothing to delete
    if (snap.size <= 20) return;

    // Everything after index 19 is too old
    const toDelete = snap.docs.slice(20);

    // Delete in a batch for efficiency
    const batch = db.batch();
    toDelete.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

  } catch (err) {
    console.warn('History prune failed:', err);
  }
}

// ─── Load and display history ───────────────

async function loadHistory() {
  if (!auth.currentUser) return;

  const uid = auth.currentUser.uid;
  const listEl = document.getElementById('history-list');
  if (!listEl) return;

  // Show loading state
  listEl.innerHTML = `
    <div class="history-empty">Loading history...</div>
  `;

  try {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('history')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    if (snap.empty) {
      listEl.innerHTML = `
        <div class="history-empty">
          No history yet.<br>
          Send or receive something to see it here.
        </div>
      `;
      return;
    }

    // Clear and rebuild the list
    listEl.innerHTML = '';

    snap.forEach(doc => {
      const data = doc.data();
      const card = buildHistoryCard(data, doc.id);
      listEl.appendChild(card);
    });

  } catch (err) {
    listEl.innerHTML = `
      <div class="history-empty">
        Couldn't load history. Please try again.
      </div>
    `;
    console.warn('History load failed:', err);
  }
}

// ─── Build a history card element ───────────

function buildHistoryCard(data, docId) {
  const card = document.createElement('div');
  card.className = 'history-card';
  card.dataset.docId = docId;

  // Format the timestamp
  const timeStr = formatHistoryTime(data.timestamp);

  // Truncate preview text
  const preview = data.preview
    ? truncateText(data.preview, 60)
    : (data.fileType === 'file' ? '📎 File' : 'No preview');

  // Icon based on what it is
  const icon = data.fileType === 'file'
    ? (data.type === 'sent' ? '📤' : '📥')
    : (data.type === 'sent' ? '✉️' : '📨');

  card.innerHTML = `
    <div class="history-card-top">
      <span class="history-card-type ${data.type}">
        ${icon} ${data.type === 'sent' ? 'Sent' : 'Received'}
      </span>
      <span class="history-card-time">${timeStr}</span>
    </div>
    <div class="history-card-preview">${escapeHtml(preview)}</div>
    ${data.code ? `<div class="history-card-code">Code: ${data.code}</div>` : ''}
  `;

  // Clicking a "sent" card re-opens send screen with that code
  // Clicking a "received" card re-opens receive screen with that code
  card.addEventListener('click', () => {
    handleHistoryCardClick(data);
  });

  return card;
}

// ─── Handle clicking a history card ─────────

function handleHistoryCardClick(data) {
  // Close the history panel
  closeHistoryPanel();

  if (data.type === 'sent' && data.code) {
    // Go to receive screen with the code pre-filled
    // (Useful to re-check if content still exists)
    showScreen('receiveScreen');
    const codeInput = document.getElementById('receiveCode');
    if (codeInput) {
      codeInput.value = data.code;
    }
    showToast('Code loaded', `Code ${data.code} filled in — tap Receive`, 'info');

  } else if (data.type === 'received' && data.code) {
    // Same — go to receive with code pre-filled
    showScreen('receiveScreen');
    const codeInput = document.getElementById('receiveCode');
    if (codeInput) {
      codeInput.value = data.code;
    }
    showToast('Code loaded', `Code ${data.code} filled in — tap Receive`, 'info');
  }
}

// ─── Clear all history ───────────────────────

async function clearHistory() {
  if (!auth.currentUser) return;

  const confirmed = confirm('Clear all share history? This cannot be undone.');
  if (!confirmed) return;

  const uid = auth.currentUser.uid;
  const listEl = document.getElementById('history-list');

  try {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('history')
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Refresh the display
    if (listEl) {
      listEl.innerHTML = `
        <div class="history-empty">
          History cleared.
        </div>
      `;
    }

    showToast('History cleared', '', 'success', 2500);

  } catch (err) {
    console.warn('Clear history failed:', err);
    showToast('Could not clear history', err.message, 'error');
  }
}

// ─── Open / Close the panel ─────────────────

function openHistoryPanel() {
  const panel    = document.getElementById('history-panel');
  const backdrop = document.getElementById('history-backdrop');

  if (!panel) return;

  panel.classList.add('open');
  if (backdrop) backdrop.classList.add('show');

  // Load fresh data every time 