const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Allow large file transfers (up to 100MB)
const io = new Server(server, {
  maxHttpBufferSize: 100 * 1024 * 1024
});

app.use(express.static('public'));

// ── STORAGE ──────────────────────────────────────────────
// Stores the latest share for each code { code: { type, data, name } }
const latestShare = {};

// Stores room members { roomCode: Set of socket.ids }
const rooms = {};

// ── CONNECTIONS ───────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // ── SEND (single user) ─────────────────────────────────
  // Sender emits this with a code + content
  socket.on('share-content', ({ code, type, data, name }) => {
    // Save the latest share for this code on the server
    latestShare[code] = { type, data, name };
    console.log(`Content shared on code ${code} | type: ${type}`);

    // Confirm to sender
    socket.emit('share-confirmed', code);
  });

  // ── RECEIVE (single user) ──────────────────────────────
  // Receiver enters a code to get the latest shared content
  socket.on('get-content', (code) => {
    if (latestShare[code]) {
      // Send the stored content back to this user only
      socket.emit('content-received', latestShare[code]);
    } else {
      // Nothing shared on this code yet
      socket.emit('content-not-found');
    }
  });

  // ── CREATE ROOM (multi user) ───────────────────────────
  socket.on('create-room', (roomCode) => {
    // Initialize the room if it doesn't exist
    if (!rooms[roomCode]) {
      rooms[roomCode] = new Set();
    }
    rooms[roomCode].add(socket.id);
    socket.join(roomCode);

    // Store which room this socket is in (for cleanup on disconnect)
    socket.currentRoom = roomCode;

    console.log(`Room created: ${roomCode} by ${socket.id}`);
    socket.emit('room-created', roomCode);
    updateRoomCount(roomCode);
  });

  // ── JOIN ROOM (multi user) ─────────────────────────────
  socket.on('join-room', (roomCode) => {
    if (!rooms[roomCode]) {
      // Room doesn't exist
      socket.emit('room-not-found');
      return;
    }
    rooms[roomCode].add(socket.id);
    socket.join(roomCode);
    socket.currentRoom = roomCode;

    console.log(`${socket.id} joined room: ${roomCode}`);
    socket.emit('room-joined', roomCode);

    // Tell everyone else in the room someone joined
    socket.to(roomCode).emit('user-joined-room');
    updateRoomCount(roomCode);
  });

  // ── ROOM MESSAGE (multi user) ──────────────────────────
  socket.on('room-message', ({ roomCode, message }) => {
    // Send message to everyone ELSE in the room
    socket.to(roomCode).emit('room-message-received', message);
  });

  // ── DISCONNECT ─────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);

    // Remove from room if they were in one
    if (socket.currentRoom && rooms[socket.currentRoom]) {
      rooms[socket.currentRoom].delete(socket.id);

      // Delete room if empty
      if (rooms[socket.currentRoom].size === 0) {
        delete rooms[socket.currentRoom];
        console.log(`Room ${socket.currentRoom} deleted (empty)`);
      } else {
        // Tell others someone left
        socket.to(socket.currentRoom).emit('user-left-room');
        updateRoomCount(socket.currentRoom);
      }
    }
  });

  // ── HELPER: broadcast member count to a room ───────────
  function updateRoomCount(roomCode) {
    const count = rooms[roomCode] ? rooms[roomCode].size : 0;
    io.to(roomCode).emit('room-count', count);
  }
});

server.listen(3000, () => {
  console.log('Shreamigo running at http://localhost:3000');
});