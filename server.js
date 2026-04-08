const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 100 * 1024 * 1024  // 100MB for file transfers
});

app.use(express.static('public'));

// ── CODE GENERATOR ────────────────────────────────────
// Characters used: A-Z + a-z + 0-9 = 62 chars
// At length 8: 62^8 = 218 TRILLION combinations
// Even with 1 billion users, collision chance is near zero
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 8;

// Tracks ALL codes ever generated — prevents any repeat forever
const usedSendCodes = new Set();
const usedRoomCodes = new Set();

function generateCode(usedSet) {
  let code;
  let attempts = 0;
  do {
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      // Pick a random character from CODE_CHARS
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    attempts++;
    // Safety valve — should never realistically hit this
    if (attempts > 10000) throw new Error('Code space exhausted');
  } while (usedSet.has(code));

  // Lock this code permanently
  usedSet.add(code);
  return code;
}

// ── STORAGE ───────────────────────────────────────────
// Latest share per send-code
const latestShare = {};

// Room storage: { roomCode: { creator, members: Set, history: [] } }
const rooms = {};

// ── CONNECTIONS ───────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // ── GENERATE SEND CODE ──────────────────────────────
  // Called when user opens Send screen
  socket.on('request-send-code', () => {
    try {
      const code = generateCode(usedSendCodes);
      socket.emit('send-code-generated', code);
    } catch(e) {
      socket.emit('error-msg', 'Could not generate code. Try again.');
    }
  });

  // ── GENERATE ROOM CODE ──────────────────────────────
  socket.on('request-room-code', () => {
    try {
      const code = generateCode(usedRoomCodes);
      socket.emit('room-code-generated', code);
    } catch(e) {
      socket.emit('error-msg', 'Could not generate code. Try again.');
    }
  });

  // ── SIMPLE SEND ─────────────────────────────────────
  socket.on('share-content', ({ code, type, data, name, size }) => {
    // Store content against this send code
    latestShare[code] = { type, data, name, size };
    console.log(`Shared on code ${code} | type: ${type}`);
    socket.emit('share-confirmed', code);
  });

  // ── SIMPLE RECEIVE ──────────────────────────────────
  socket.on('get-content', (code) => {
    if (latestShare[code]) {
      socket.emit('content-received', latestShare[code]);
    } else {
      socket.emit('content-not-found');
    }
  });

  // ── CREATE ROOM ─────────────────────────────────────
  socket.on('create-room', (roomCode) => {
    // Initialize room with creator info and empty history
    rooms[roomCode] = {
      creator: socket.id,   // only creator leaving wipes history
      members: new Set(),
      history: []           // stores all messages/files
    };

    rooms[roomCode].members.add(socket.id);
    socket.join(roomCode);
    socket.currentRoom = roomCode;
    socket.isCreator = true;

    console.log(`Room created: ${roomCode} by ${socket.id}`);
    socket.emit('room-created', roomCode);
    broadcastCount(roomCode);
  });

  // ── JOIN ROOM ───────────────────────────────────────
  socket.on('join-room', (roomCode) => {
    if (!rooms[roomCode]) {
      socket.emit('room-not-found');
      return;
    }

    rooms[roomCode].members.add(socket.id);
    socket.join(roomCode);
    socket.currentRoom = roomCode;
    socket.isCreator = false;

    console.log(`${socket.id} joined room: ${roomCode}`);
    socket.emit('room-joined', roomCode);

    // Send full history to the new joiner immediately
    // This is the fix for Bug 3 — new users see all past messages
    socket.emit('room-history', rooms[roomCode].history);

    // Tell others someone joined
    socket.to(roomCode).emit('user-joined-room');
    broadcastCount(roomCode);
  });

  // ── ROOM TEXT MESSAGE ───────────────────────────────
  socket.on('room-message', ({ roomCode, message }) => {
    if (!rooms[roomCode]) return;

    const payload = { type: 'text', message, side: 'them' };

    // Save to history
    rooms[roomCode].history.push(payload);

    // Send to everyone else in the room
    socket.to(roomCode).emit('room-message-received', payload);
  });

  // ── ROOM FILE ───────────────────────────────────────
  socket.on('room-file', ({ roomCode, data, name, size, fileType }) => {
    if (!rooms[roomCode]) return;

    const payload = { type: 'file', data, name, size, fileType, side: 'them' };

    // Save to history
    rooms[roomCode].history.push(payload);

    // Send to everyone else
    socket.to(roomCode).emit('room-message-received', payload);
    console.log(`File in room ${roomCode}: ${name}`);
  });

  // ── DISCONNECT ──────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);

    const roomCode = socket.currentRoom;
    if (!roomCode || !rooms[roomCode]) return;

    rooms[roomCode].members.delete(socket.id);

    if (socket.isCreator) {
      // Creator left → wipe entire room and history
      console.log(`Creator left. Room ${roomCode} wiped.`);
      io.to(roomCode).emit('room-closed');
      delete rooms[roomCode];
    } else if (rooms[roomCode].members.size === 0) {
      // Last person left
      delete rooms[roomCode];
      console.log(`Room ${roomCode} empty, removed.`);
    } else {
      // Normal member left
      socket.to(roomCode).emit('user-left-room');
      broadcastCount(roomCode);
    }
  });

  function broadcastCount(roomCode) {
    if (!rooms[roomCode]) return;
    io.to(roomCode).emit('room-count', rooms[roomCode].members.size);
  }
});

server.listen(3000, () => {
  console.log('Shreamigo running at http://localhost:3000');
});