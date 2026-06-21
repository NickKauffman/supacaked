/*
 * SupaCaked — relay server
 * --------------------------------
 * This server does NOT run the games. Each TV page runs its own game; the server
 * only serves the pages, tracks rooms + rosters, and relays messages.
 *
 *   phone --(inputs)--> server --(forward to that room's TV)--> TV runs the game
 *   TV    --(state)---> server --(broadcast to that room's phones)
 *
 * Rooms: every TV opens an isolated room with a 4-letter code. Phones join a room
 * by code, so multiple groups can play different games at the same time, and a
 * phone can drive the room's menu to pick which game to play.
 */

const path = require('path');
const os = require('os');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve pages with no-store so phones always pick up the latest build.
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false, lastModified: false,
  setHeaders: (res) => res.set('Cache-Control', 'no-store'),
}));
const noStore = { headers: { 'Cache-Control': 'no-store' } };
const page = (file) => (_req, res) => res.sendFile(path.join(__dirname, 'public', file), noStore);
app.get('/', page('launcher.html'));        // SupaCaked room + menu (the TV)
app.get('/couch', page('host.html'));        // Couch Cannons (the TV)
app.get('/frogger', page('frogger.html'));   // Fowl Crossing (the TV)
app.get('/play', page('controller.html'));   // phone controller

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}
const LAN_IP = getLanIp();
// When hosted on a public domain, set PUBLIC_URL (e.g. https://www.supacaked.com)
// so the QR/join link points players at the domain instead of the LAN IP.
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const JOIN_URL = PUBLIC_URL ? `${PUBLIC_URL}/play` : `http://${LAN_IP}:${PORT}/play`;

// The TV builds its own QR with its room code; this just hands over the base join URL.
app.get('/config', (_req, res) => res.json({ joinUrl: JOIN_URL }));

// ---- Rooms ----
const PLAYER_COLORS = [
  '#FF5C49', '#34D399', '#FBBF24', '#60A5FA',
  '#F472B6', '#A78BFA', '#22D3EE', '#FB923C',
];
const MAX_PLAYERS = 8;

// code -> { code, hostId, players: Map(token -> {id,name,color,connected,socketId}), nextId }
const rooms = new Map();
function genCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join(''); }
  while (rooms.has(c));
  return c;
}
function getOrMakeRoom(code) {
  const up = (code || '').toUpperCase();
  if (up && rooms.has(up)) return rooms.get(up);
  const c = (/^[A-Z]{4}$/.test(up) && !rooms.has(up)) ? up : genCode();
  const room = { code: c, hostId: null, players: new Map(), nextId: 1 };
  rooms.set(c, room);
  return room;
}
function rosterArray(room) {
  return [...room.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, connected: p.connected }));
}
function usedColors(room) { return new Set([...room.players.values()].map((p) => p.color)); }
function cleanupSoon(room) {
  if (room.hostId || [...room.players.values()].some((p) => p.connected)) return;
  setTimeout(() => {
    const r = rooms.get(room.code);
    if (r && !r.hostId && ![...r.players.values()].some((p) => p.connected)) rooms.delete(r.code);
  }, 60000);
}

io.on('connection', (socket) => {
  let role = null;   // 'host' | 'controller'
  let token = null;
  let code = null;   // room this socket belongs to

  // ---- TV opens or rejoins a room (carries its code across page navigations) ----
  socket.on('host:hello', (arg) => {
    role = 'host';
    const room = getOrMakeRoom(arg && arg.code);
    code = room.code; room.hostId = socket.id; socket.join(code);
    socket.emit('host:room', { code: room.code, joinUrl: JOIN_URL });
    socket.emit('host:roster', rosterArray(room));
  });

  // TV render-state -> only this room's phones.
  socket.on('host:state', (state) => { if (code && rooms.has(code)) io.to(code).emit('ctrl:state', state); });

  // ---- Phone joins a specific room by code ----
  socket.on('ctrl:join', ({ name, token: t, color, code: c }) => {
    role = 'controller'; token = t;
    const room = rooms.get((c || '').toUpperCase());
    if (!room) { socket.emit('ctrl:badroom'); return; }
    code = room.code; socket.join(code);
    const trimmed = (name || '').trim().slice(0, 12) || 'Player';
    let player = room.players.get(token);
    if (player) { player.connected = true; player.socketId = socket.id; player.name = trimmed; }
    else {
      if (room.players.size >= MAX_PLAYERS) { socket.emit('ctrl:full'); return; }
      const requested = (PLAYER_COLORS.includes(color) && !usedColors(room).has(color)) ? color : null;
      const avail = requested || PLAYER_COLORS.find((cc) => !usedColors(room).has(cc)) || PLAYER_COLORS[0];
      player = { id: room.nextId++, name: trimmed, color: avail, connected: true, socketId: socket.id };
      room.players.set(token, player);
    }
    socket.emit('ctrl:joined', { id: player.id, name: player.name, color: player.color, code: room.code });
    if (room.hostId) io.to(room.hostId).emit('host:playerJoined', { id: player.id, name: player.name, color: player.color });
    io.to(code).emit('ctrl:roster', rosterArray(room));
  });

  // Forward a phone input to its room's TV, tagged with the player id.
  const forward = (type) => (payload) => {
    const room = code && rooms.get(code);
    if (!room || !room.hostId) return;
    const player = token && room.players.get(token);
    if (player) io.to(room.hostId).emit('host:input', { id: player.id, type, payload });
  };
  socket.on('ctrl:aim', forward('aim'));            // Couch Cannons
  socket.on('ctrl:move', forward('move'));          // Couch Cannons drive
  socket.on('ctrl:weapon', forward('weapon'));      // Couch Cannons
  socket.on('ctrl:fire', forward('fire'));          // Couch Cannons
  socket.on('ctrl:hop', forward('hop'));            // Fowl Crossing
  socket.on('ctrl:ride', forward('ride'));          // Fowl Crossing piggyback jump-off
  socket.on('ctrl:rocket', forward('rocket'));      // Fowl Crossing rocket launch
  socket.on('ctrl:char', forward('char'));          // Fowl Crossing bird choice
  socket.on('ctrl:menu', forward('menu'));             // phone moves the menu cursor
  socket.on('ctrl:selectGame', forward('selectGame')); // phone confirms a game
  socket.on('ctrl:start', forward('start'));
  socket.on('ctrl:rematch', forward('rematch'));

  socket.on('disconnect', () => {
    const room = code && rooms.get(code);
    if (!room) return;
    if (role === 'host' && room.hostId === socket.id) { room.hostId = null; cleanupSoon(room); return; }
    const player = token && room.players.get(token);
    if (player) {
      player.connected = false;
      if (room.hostId) io.to(room.hostId).emit('host:playerLeft', { id: player.id });
      io.to(code).emit('ctrl:roster', rosterArray(room));
    }
    cleanupSoon(room);
  });
});

server.listen(PORT, () => {
  console.log('\n  🍰  SupaCaked is live!\n');
  console.log(`  TV (this computer):  http://localhost:${PORT}      (opens a room, pick games)`);
  console.log(`  Phones join at:      ${JOIN_URL}   (enter the room code shown on the TV)`);
  if (PUBLIC_URL) console.log('\n  🌍  Hosted publicly — friends can join from anywhere with the room code.\n');
  else console.log('\n  📶  Local game: phones must be on the same WiFi. (Deploy with PUBLIC_URL to play from anywhere.)\n');
});
