const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const GameState = require('./server/GameState');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const gameState = new GameState();

// ---------------- SOCKET.IO ----------------
io.on('connection', (socket) => {
  console.log('Un jucător s-a conectat:', socket.id);

  socket.on('player_join', (playerName, playerColor) => {
    console.log(`Jucătorul ${playerName} s-a alăturat cu ID-ul: ${socket.id} și culoarea: ${playerColor}`);
    gameState.addPlayer(socket.id, playerName, playerColor);
    socket.emit('joined', { id: socket.id });
  });

  socket.on('player_move', ({ dx, dy }) => {
    gameState.updatePlayerDirection(socket.id, dx, dy);
  });

  socket.on('player_split', () => {
    gameState.splitPlayer(socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Jucătorul s-a deconectat:', socket.id);
    gameState.removePlayer(socket.id);
  });
});

// update 60 fps
setInterval(() => {
  const currentState = gameState.update();
  const currentLeaderboard = gameState.getLeaderboard();
  io.emit('game_state_update', currentState);
  io.emit('leaderboard_update', currentLeaderboard);
}, 1000 / 60);

// ---------------- SERVIRE FRONTEND ----------------
// după build, React creează folderul client/build
app.use(express.static(path.join(__dirname, 'client', 'build')));

// pentru orice rută, trimite index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
