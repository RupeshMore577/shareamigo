'use strict';

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const crypto  = require('crypto');
const path    = require('path');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 100 * 1024 * 1024,
  pingTimeout:  60000,
  pingInterval: 25000,
});

// ── STATIC FILES ──────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── SECURITY HEADERS ──────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── RATE LIMITING ─────────────────────────────────────
// Each IP gets max 100 socket connections per minute
const rateLimit   = new Map();
const RATE_LIMIT  = 100;
const RATE_WINDOW = 60 * 1000;

io.use((socket, next) => {
  const ip = socket.handshake.address;

  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 0, resetAt: Date.now() + RATE_WINDOW });
  }

  const entry = rateLimit.get(ip);

  if (Date.now() > entry.resetAt) {
    entry.count   = 0;
    entry.resetAt = Date.now() + RATE_WINDOW;
  }

  entry.count++;

  if (entry.count > RATE_LIMIT) {
    console.log('🚫  Rate limited:', ip);
    return next(new Error('Too many requests. Please wait.'));
  }

  next();
});

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateLimit.forEach((entry, ip) => {
    if (now > entry.resetAt) rateLimit.delete(ip);
  });
}, 5 * 60 * 1000);

// ── HEALTH CHECK ──────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── CODE GENERATOR ────────────────────────────────────
const CODE_CHARS  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 8;

const usedSendCodes = new Set();
const usedRoomCodes = new Set();

function generateCode(usedSet) {
  let code;
  let attempts = 0;

  do {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    }
    attempts++;
    if (attempts >= 10000) throw new Error('Code space exhausted');
  } while (usedSet.has(code));

  usedSet.add(code);
  return code;
}

// ── STORAGE ───────────────────────────────────────────
/*
  latestShare[code] = {
    type:           'text' | 'file'
    data:           string (plain text OR base64 data URL)
    name:           string (filename — empty for text)
    size:           string (formatted size — empty for text)
    expiresAt:      number | null
    expiryTimer:    Timeout | null
    senderSocketId: string
  }
*/
const latestShare = {};

/*
  rooms[roomCode] = {
    creator:  string (socket.id)
    members:  Set<string>
    history:  Array
  }
*/
const rooms = {};

// ── EXPIRE SHARE ──────────────────────────────────────
function expireShare(code) {
  const share = latestShare[code];
  if (!share) return;

  if (share.expiryTimer) {
    clearTimeout(share.expiryTimer);
    share.expiryTimer = null;
  }

  delete latestShare[code];
  console.log('⏰  Expired:', code);

  // Notify sender if still connected
  const senderSocket = io.sockets.sockets.get(share.senderSocketId);
  if (senderSocket) {
    senderSocket.emit('share-expired', { code });
  }
}

// ── SOCKET EVENTS ─────────────────────────────────────
io.on('connection', (socket) => {
  console.log('✅  Connected:', socket.id);

  socket.currentRoom = null;
  socket.isCreator   = false;

  // ── REQUEST SEND CODE ─────────────────────────────
  socket.on('request-send-code', () => {
    try {
      const code = generateCode(usedSendCodes);
      socket.emit('send-code-generated', code);
      console.log('📤  Send code:', code);
    } catch (err) {
      socket.emit('server-error', { message: 'Could not generate code. Please refresh.' });
    }
  });

  // ── REQUEST ROOM CODE ─────────────────────────────
  socket.on('request-room-code', () => {
    try {
      const code = generateCode(usedRoomCodes);
      socket.emit('room-code-generated', code);
      console.log('🏠  Room code:', code);
    } catch (err) {
      socket.emit('server-error', { message: 'Could not generate room code. Please refresh.' });
    }
  });

  // ── SHARE CONTENT ─────────────────────────────────
  socket.on('share-content', (payload) => {
    if (!payload || typeof payload !== 'object') {
      socket.emit('server-error', { message: 'Invalid payload.' });
      return;
    }

    const { code, type, data, name, size, expiresIn } = payload;

    if (!code || typeof code !== 'string' || code.trim().length !== CODE_LENGTH) {
      socket.emit('server-error', { message: 'Invalid code.' });
      return;
    }

    if (!type || (type !== 'text' && type !== 'file')) {
      socket.emit('server-error', { message: 'Invalid type.' });
      return;
    }

    if (!data || typeof data !== 'string' || data.trim() === '') {
      socket.emit('server-error', { message: 'No content to share.' });
      return;
    }

    // Cancel existing timer for this code
    if (latestShare[code] && latestShare[code].expiryTimer) {
      clearTimeout(latestShare[code].expiryTimer);
    }

    const expiresAt = (expiresIn && typeof expiresIn === 'number' && expiresIn > 0)
      ? Date.now() + expiresIn
      : null;

    latestShare[code] = {
      type,
      data,
      name:           name  || '',
      size:           size  || '',
      expiresAt,
      expiryTimer:    null,
      senderSocketId: socket.id,
    };

    if (expiresAt && expiresIn) {
      latestShare[code].expiryTimer = setTimeout(
        () => expireShare(code),
        expiresIn
      );
    }

    console.log(
      '📦  Stored:', code,
      '| type:', type,
      '| name:', name || '(text)',
      expiresAt ? '| expires in: ' + Math.round(expiresIn / 1000) + 's' : '| no expiry'
    );

    socket.emit('share-confirmed', {
      code,
      expiresAt,
    });
  });

  // ── GET CONTENT ───────────────────────────────────
  socket.on('get-content', (code) => {
    if (!code || typeof code !== 'string' || code.trim() === '') {
      socket.emit('content-not-found', { reason: 'invalid-code' });
      return;
    }

    const cleanCode = code.trim();
    const share     = latestShare[cleanCode];

    if (!share) {
      socket.emit('content-not-found', { reason: 'not-found' });
      console.log('❌  Not found:', cleanCode);
      return;
    }

    if (share.expiresAt && Date.now() > share.expiresAt) {
      expireShare(cleanCode);
      socket.emit('content-not-found', { reason: 'expired' });
      console.log('⏰  Expired on fetch:', cleanCode);
      return;
    }

    socket.emit('content-received', {
      type:      share.type,
      data:      share.data,
      name:      share.name,
      size:      share.size,
      expiresAt: share.expiresAt,
    });

    console.log('📥  Retrieved:', cleanCode, '| type:', share.type);
  });

  // ── CREATE ROOM ───────────────────────────────────
  socket.on('create-room', (roomCode) => {
    if (!roomCode || typeof roomCode !== 'string') {
      socket.emit('server-error', { message: 'Invalid room code.' });
      return;
    }

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

    console.log('🏠  Room created:', roomCode);
  });

  // ── JOIN ROOM ─────────────────────────────────────
  socket.on('join-room', (roomCode) => {
    if (!roomCode || !rooms[roomCode]) {
      socket.emit('room-not-found');
      return;
    }

    rooms[roomCode].members.add(socket.id);
    socket.join(roomCode);
    socket.currentRoom = roomCode;
    socket.isCreator   = false;

    socket.emit('room-joined', roomCode);
    socket.emit('room-history', rooms[roomCode].history);
    socket.to(roomCode).emit('user-joined-room');
    broadcastCount(roomCode);

    console.log('👤  Joined:', roomCode);
  });

  // ── ROOM TEXT MESSAGE ─────────────────────────────
  socket.on('room-message', ({ roomCode, message }) => {
    if (!roomCode || !rooms[roomCode] || !message) return;

    const safeMessage = String(message).slice(0, 5000);

    const payload = {
      type:    'text',
      message: safeMessage,
      side:    'them',
    };

    rooms[roomCode].history.push(payload);
    if (rooms[roomCode].history.length > 200) {
      rooms[roomCode].history.shift();
    }

    socket.to(roomCode).emit('room-message-received', payload);
  });

  // ── ROOM FILE ─────────────────────────────────────
  socket.on('room-file', ({ roomCode, data, name, size, fileType }) => {
    if (!roomCode || !rooms[roomCode] || !data) return;

    const payload = {
      type:     'file',
      data,
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
    console.log('📎  Room file:', roomCode, name);
  });

  // ── DISCONNECT ────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log('❌  Disconnected:', socket.id, '(', reason, ')');

    const roomCode = socket.currentRoom;
    if (!roomCode || !rooms[roomCode]) return;

    rooms[roomCode].members.delete(socket.id);

    if (socket.isCreator) {
      console.log('🗑️   Room closed:', roomCode);
      io.to(roomCode).emit('room-closed');
      delete rooms[roomCode];
    } else if (rooms[roomCode].members.size === 0) {
      delete rooms[roomCode];
      console.log('🗑️   Room empty — removed:', roomCode);
    } else {
      socket.to(roomCode).emit('user-left-room');
      broadcastCount(roomCode);
    }
  });

  // ── HELPER ────────────────────────────────────────
  function broadcastCount(roomCode) {
    if (!rooms[roomCode]) return;
    io.to(roomCode).emit('room-count', rooms[roomCode].members.size);
  }
});

// ── START ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('\n🚀  Shareamigo running on http://localhost:' + PORT + '\n');
});