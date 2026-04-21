/* ============================================================
   server.js
   Shareamigo — Main server
   
   Handles:
   - Static file serving
   - Unique code generation (send codes + room codes)
   - Real-time send/receive via Socket.io
   - Room create/join/message/file/disconnect
   - Share expiry — auto-deletes after timer, notifies sender
   ============================================================ */

'use strict';

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const crypto  = require('crypto');
const path    = require('path');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  // 100 MB max per message — covers large file transfers
  maxHttpBufferSize: 100 * 1024 * 1024,

  // Keep alive settings — helps on free hosting platforms
  pingTimeout:  60000,
  pingInterval: 25000,
});

// ── STATIC FILES ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint — useful for uptime monitors
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── CODE GENERATOR ───────────────────────────────────────────
/*
  Characters: A-Z + a-z + 0-9 = 62 chars
  Length: 8
  Combinations: 62^8 = 218 trillion
  
  Uses crypto.randomBytes for true randomness.
  Tracks ALL used codes forever — zero repeats.
*/

const CODE_CHARS  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 8;

// Separate sets — send codes and room codes never collide
const usedSendCodes = new Set();
const usedRoomCodes = new Set();

function generateCode(usedSet) {
  let code;
  let attempts = 0;
  const maxAttempts = 10000;

  do {
    // crypto.randomBytes gives true randomness unlike Math.random()
    const bytes = crypto.randomBytes(CODE_LENGTH);
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      // Modulo maps 0-255 to 0-61 (slight bias but negligible at 62 chars)
      code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    }
    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error('Code space exhausted — this should never happen');
    }
  } while (usedSet.has(code));

  usedSet.add(code);
  return code;
}

// ── IN-MEMORY STORAGE ────────────────────────────────────────
/*
  latestShare structure:
  {
    [code]: {
      type:        'text' | 'file'
      data:        string (text content or base64 data URL)
      name:        string (filename, empty for text)
      size:        string (formatted size, empty for text)
      expiresAt:   number | null (Date.now() + ms, or null)
      expiryTimer: NodeJS.Timeout | null (the setTimeout handle)
      senderSocketId: string
    }
  }
*/
const latestShare = {};

/*
  rooms structure:
  {
    [roomCode]: {
      creator:  string (socket.id of creator)
      members:  Set<string> (socket.ids of all current members)
      history:  Array (all messages/files — max 200)
    }
  }
*/
const rooms = {};

// ── HELPER — delete a share and notify sender ────────────────
function expireShare(code) {
  const share = latestShare[code];
  if (!share) return;

  // Clear the timer reference
  if (share.expiryTimer) {
    clearTimeout(share.expiryTimer);
    share.expiryTimer = null;
  }

  // Delete the content
  delete latestShare[code];
  console.log(`⏰  Share expired: ${code}`);

  // Notify the sender if they are still connected
  const senderSocket = io.sockets.sockets.get(share.senderSocketId);
  if (senderSocket) {
    senderSocket.emit('share-expired', { code });
  }
}

// ── SOCKET.IO ────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅  Connected:    ${socket.id}`);

  // Per-socket state
  socket.currentRoom = null;
  socket.isCreator   = false;

  // ── REQUEST SEND CODE ───────────────────────────────────
  socket.on('request-send-code', () => {
    try {
      const code = generateCode(usedSendCodes);
      socket.emit('send-code-generated', code);
    } catch (err) {
      console.error('Code generation failed:', err);
      socket.emit('server-error', { message: 'Could not generate code. Refresh and try again.' });
    }
  });

  // ── REQUEST ROOM CODE ───────────────────────────────────
  socket.on('request-room-code', () => {
    try {
      const code = generateCode(usedRoomCodes);
      socket.emit('room-code-generated', code);
    } catch (err) {
      console.error('Room code generation failed:', err);
      socket.emit('server-error', { message: 'Could not generate room code. Refresh and try again.' });
    }
  });

  // ── SHARE CONTENT ───────────────────────────────────────
  /*
    Expected payload:
    {
      code:      string   — the send code
      type:      string   — 'text' | 'file'
      data:      string   — content or base64 data URL
      name:      string   — filename (empty for text)
      size:      string   — formatted size (empty for text)
      expiresIn: number|null — milliseconds until expiry, or null
    }
  */
  socket.on('share-content', (payload) => {
    const { code, type, data, name, size, expiresIn } = payload;

    // Basic validation
    if (!code || typeof code !== 'string' || code.length !== CODE_LENGTH) {
      socket.emit('server-error', { message: 'Invalid share code.' });
      return;
    }
    if (!data) {
      socket.emit('server-error', { message: 'No content to share.' });
      return;
    }

    // Cancel any existing content on this code
    if (latestShare[code]?.expiryTimer) {
      clearTimeout(latestShare[code].expiryTimer);
    }

    // Store the share
    const expiresAt = (expiresIn && expiresIn > 0) ? Date.now() + expiresIn : null;

    latestShare[code] = {
      type:           type  || 'text',
      data:           data,
      name:           name  || '',
      size:           size  || '',
      expiresAt:      expiresAt,
      expiryTimer:    null,
      senderSocketId: socket.id,
    };

    // Schedule auto-deletion if expiry was set
    if (expiresAt) {
      latestShare[code].expiryTimer = setTimeout(
        () => expireShare(code),
        expiresIn
      );
    }

    // Confirm to sender — send back the expiry timestamp so
    // the client can show an accurate countdown
    socket.emit('share-confirmed', {
      code,
      expiresAt: expiresAt,   // null or absolute timestamp
    });

    console.log(
      `📤  Shared:       ${code}` +
      (expiresAt ? `  (expires in ${Math.round(expiresIn / 1000)}s)` : '  (no expiry)')
    );
  });

  // ── GET CONTENT ─────────────────────────────────────────
  socket.on('get-content', (code) => {
    if (!code || typeof code !== 'string') {
      socket.emit('content-not-found', { reason: 'invalid-code' });
      return;
    }

    const share = latestShare[code];

    if (!share) {
      socket.emit('content-not-found', { reason: 'not-found' });
      return;
    }

    // Check expiry (belt-and-suspenders — timer should handle it,
    // but cover the case where server just restarted)
    if (share.expiresAt && Date.now() > share.expiresAt) {
      expireShare(code);
      socket.emit('content-not-found', { reason: 'expired' });
      return;
    }

    // Send content to receiver
    socket.emit('content-received', {
      type:      share.type,
      data:      share.data,
      name:      share.name,
      size:      share.size,
      expiresAt: share.expiresAt,   // receiver can show countdown too
    });

    console.log(`📥  Retrieved:    ${code}`);
  });

  // ── CREATE ROOM ─────────────────────────────────────────
  socket.on('create-room', (roomCode) => {
    if (!roomCode || typeof roomCode !== 'string') {
      socket.emit('server-error', { message: 'Invalid room code.' });
      return;
    }

    // Initialise room
    rooms[roomCode] = {
      creator: socket.id,
      members: new Set([socket.id]),
      history: [],
    };

    socket.join(roomCode);
    socket.currentRoom = roomCode;
    socket.isCreator   = true;

    socket.emit('room-created', roomCode);
    broadcastCount(roomCode);

    console.log(`🏠  Room created: ${roomCode}  by ${socket.id}`);
  });

  // ── JOIN ROOM ────────────────────────────────────────────
  socket.on('join-room', (roomCode) => {
    if (!roomCode || !rooms[roomCode]) {
      socket.emit('room-not-found');
      return;
    }

    rooms[roomCode].members.add(socket.id);
    socket.join(roomCode);
    socket.currentRoom = roomCode;
    socket.isCreator   = false;

    // Confirm join + send full history to new member
    socket.emit('room-joined', roomCode);
    socket.emit('room-history', rooms[roomCode].history);

    // Notify everyone else
    socket.to(roomCode).emit('user-joined-room');
    broadcastCount(roomCode);

    console.log(`👤  Joined:       ${roomCode}  by ${socket.id}`);
  });

  // ── ROOM TEXT MESSAGE ────────────────────────────────────
  socket.on('room-message', ({ roomCode, message }) => {
    if (!roomCode || !rooms[roomCode] || !message) return;

    // Sanitise length — prevent abuse
    const safeMessage = String(message).slice(0, 5000);

    const payload = {
      type:    'text',
      message: safeMessage,
      side:    'them',
    };

    // Save to history (cap at 200)
    rooms[roomCode].history.push(payload);
    if (rooms[roomCode].history.length > 200) {
      rooms[roomCode].history.shift();
    }

    socket.to(roomCode).emit('room-message-received', payload);
  });

  // ── ROOM FILE ────────────────────────────────────────────
  socket.on('room-file', ({ roomCode, data, name, size, fileType }) => {
    if (!roomCode || !rooms[roomCode] || !data) return;

    const payload = {
      type:     'file',
      data:     data,
      name:     name     || 'file',
      size:     size     || '',
      fileType: fileType || 'FILE',
      side:     'them',
    };

    rooms[roomCode].history.push(payload);
    if (rooms[roomCode].history.length > 200) {
      rooms[roomCode].history.shift();
    }

    socket.to(roomCode).emit('room-message-received', payload);
    console.log(`📎  Room file:    ${roomCode}  "${name}"`);
  });

  // ── DISCONNECT ───────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`❌  Disconnected: ${socket.id}  (${reason})`);

    const roomCode = socket.currentRoom;
    if (!roomCode || !rooms[roomCode]) return;

    rooms[roomCode].members.delete(socket.id);

    if (socket.isCreator) {
      // Creator left — close room, notify everyone, clean up
      console.log(`🗑️   Room closed:  ${roomCode}  (creator left)`);
      io.to(roomCode).emit('room-closed');
      delete rooms[roomCode];

    } else if (rooms[roomCode].members.size === 0) {
      // Last person left — clean up silently
      delete rooms[roomCode];
      console.log(`🗑️   Room removed: ${roomCode}  (empty)`);

    } else {
      // Regular member left
      socket.to(roomCode).emit('user-left-room');
      broadcastCount(roomCode);
    }
  });

  // ── HELPER ───────────────────────────────────────────────
  function broadcastCount(roomCode) {
    if (!rooms[roomCode]) return;
    io.to(roomCode).emit('room-count', rooms[roomCode].members.size);
  }
});

// ── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀  Shareamigo running on http://localhost:${PORT}\n`);
});