const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 100 * 1024 * 1024 // 100MB
});

app.use(express.static('public'));

// ── STORAGE ──────────────────────────────────────────
const latestShare = {};   // { code: { type, data, name, size } }
const rooms = {};         // { roomCode: Set of socket.ids }
const usedCodes = new Set(); // tracks all ever-used room codes

// ── GENERATE UNIQUE ROOM CODE ─────────────────────────
// Uses UUID + timestamp to guarantee uniqueness even at scale
function generateRoomCode() {
  let code;
  do {
    // Take first 4 chars of a uuid-based number
    const raw = uuidv4().replace(/-/g, '');
    // Convert hex chunk to a 4-digit number (1000–9999)
    code = String(parseInt(raw.slice(0, 4), 16) % 9000 + 1000);
  } while (usedCodes.has(code) || rooms[code]);
  // Mark this code as permanently used
  usedCodes.add(code);
  return code;
}

// ── CONNECTIONS ───────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // ── REQUEST A NEW ROOM CODE ───────────────────────
  socket.on('request-room-code', () => {
    const code = generateRoomCode();
    socket.emit('room-code-generated', code);
  });

  // ── SIMPLE SEND ───────────────────────────────────
  socket.on('share-content', ({ code, type, data, name, size }) => {
    latestShare[code] = { type, data, name, size };
    console.log(`Shared on code ${code} | type: ${type} | name: ${name}`);
    socket.emit('share-confirmed', code);
  });

  // ── SIMPLE RECEIVE ────────────────────────────────
  socket.on('get-content', (code) => {
    if (latestShare[code]) {
      socket.emit('content-received', latestShare[code]);
    } else {
      socket.emit('content-not-found');
    }
  });

  // ── CREATE ROOM ───────────────────────────────────
  socket.on('create-room', (roomCode) => {
    if (!rooms[roomCode]) rooms[roomCode] = new Set();
    rooms[roomCode].add(socket.id);
    socket.join(roomCode);
    socket.currentRoom = roomCode;
    console.log(`Room created: ${roomCode}`);
    socket.emit('room-created', roomCode);
    broadcastRoomCount(roomCode);
  });

  // ── JOIN ROOM ─────────────────────────────────────
  socket.on('join-room', (roomCode) => {
    if (!rooms[roomCode]) {
      socket.emit('room-not-found');
      return;
    }
    rooms[roomCode].add(socket.id);
    socket.join(roomCode);
    socket.currentRoom = roomCode;
    console.log(`${socket.id} joined room: ${roomCode}`);
    socket.emit('room-joined', roomCode);
    socket.to(roomCode).emit('user-joined-room');
    broadcastRoomCount(roomCode);
  });

  // ── ROOM TEXT MESSAGE ─────────────────────────────
  socket.on('room-message', ({ roomCode, message }) => {
    socket.to(roomCode).emit('room-message-received', {
      type: 'text',
      message
    });
  });

  // ── ROOM FILE SHARE ───────────────────────────────
  socket.on('room-file', ({ roomCode, data, name, size, fileType }) => {
    // Forward file to everyone else in the room
    socket.to(roomCode).emit('room-message-received', {
      type: 'file',
      data,
      name,
      size,
      fileType
    });
    console.log(`File shared in room ${roomCode}: ${name}`);
  });

  // ── DISCONNECT ────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    if (socket.currentRoom && rooms[socket.currentRoom]) {
      rooms[socket.currentRoom].delete(socket.id);
      if (rooms[socket.currentRoom].size === 0) {
        delete rooms[socket.currentRoom];
        console.log(`Room ${socket.currentRoom} closed`);
      } else {
        socket.to(socket.currentRoom).emit('user-left-room');
        broadcastRoomCount(socket.currentRoom);
      }
    }
  });

  function broadcastRoomCount(roomCode) {
    const count = rooms[roomCode] ? rooms[roomCode].size : 0;
    io.to(roomCode).emit('room-count', count);
  }
});

server.listen(3000, () => {
  console.log('Shreamigo running at http://localhost:3000');
});