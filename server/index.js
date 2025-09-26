// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const GameState = require('./GameState');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const gameState = new GameState();

io.on('connection', (socket) => {
  console.log('Un jucător s-a conectat:', socket.id);

  // Când un jucător intră în joc
  socket.on('player_join', (playerName, playerColor) => {
    console.log(`Jucătorul ${playerName} s-a alăturat cu ID-ul: ${socket.id} și culoarea: ${playerColor}`);
    gameState.addPlayer(socket.id, playerName, playerColor);

    // Trimitem un mic "bun venit" doar acestui socket
    socket.emit('joined', { id: socket.id });
  });

  // Când jucătorul își schimbă direcția
  socket.on('player_move', ({ dx, dy }) => {
    gameState.updatePlayerDirection(socket.id, dx, dy);
  });

  // Când jucătorul apasă pe "split"
  socket.on('player_split', () => {
    gameState.splitPlayer(socket.id);
  });

  // Când jucătorul iese
  socket.on('disconnect', () => {
    console.log('Jucătorul s-a deconectat:', socket.id);
    gameState.removePlayer(socket.id);
  });
});

// Trimitem starea jocului la toți clienții (60 fps)
setInterval(() => {
  const currentState = gameState.update();
  const currentLeaderboard = gameState.getLeaderboard();

  io.emit('game_state_update', currentState);
  io.emit('leaderboard_update', currentLeaderboard);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serverul rulează pe portul ${PORT}`);
});
