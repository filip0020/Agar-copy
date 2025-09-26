// server/GameState.js
const Player = require('./Player');
const Food = require('./Food');
const { v4: uuidv4 } = require('uuid');

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

class GameState {
  constructor() {
    this.allCells = {};       // id → Player
    this.playerCells = {};    // socketId → [cellIds]
    this.food = [];
    this.mapSize = { width: 3000, height: 3000 };
    this.maxFood = 500;
    this.minSplitRadius = 40;
    this.splitImpulse = 20;
    this.mergeTime = 10000;   // 10 secunde până la fuziune
    this.pullDelay = 2000;    // 2 secunde până începe atracția
    this.pullStrength = 0.05; // ajustabil: cât de tare sunt trase celulele
    this.repulsionStiffness = 1.0; // ajustabil pentru "rigiditate" la corecția overlap
  }

  addPlayer(socketId, playerName, playerColor) {
    const startX = this.mapSize.width / 2;
    const startY = this.mapSize.height / 2;
    const initialRadius = 40;

    const newCell = new Player(
      socketId,
      socketId,
      playerName,
      startX,
      startY,
      initialRadius,
      playerColor || "#FF0000"
    );

    this.allCells[socketId] = newCell;
    this.playerCells[socketId] = [socketId];
  }

  removePlayer(socketId) {
    if (this.playerCells[socketId]) {
      this.playerCells[socketId].forEach(cellId => {
        delete this.allCells[cellId];
      });
      delete this.playerCells[socketId];
    }
  }

  splitPlayer(socketId) {
    if (!this.playerCells[socketId]) return;
    if (this.playerCells[socketId].length >= 20) return; // max 20 cells

    const newCells = [];

    // iterăm peste o copie a listei, ca să nu interferăm cu push-ul
    const currentIds = [...this.playerCells[socketId]];

    currentIds.forEach(cellId => {
      const cell = this.allCells[cellId];
      if (!cell || cell.radius < this.minSplitRadius) return;

      const newRadius = cell.radius / 2;
      cell.radius = newRadius;
      cell.score = Math.floor(newRadius);

      // setăm splitTime și pentru celula originală, ca să nu poată fuziona imediat
      cell.splitTime = Date.now();

      const angle = Math.atan2(cell.dy || 0, cell.dx || 0) || (Math.random() * Math.PI * 2);
      const splitX = cell.x + Math.cos(angle) * (cell.radius * 2);
      const splitY = cell.y + Math.sin(angle) * (cell.radius * 2);

      const newCellId = uuidv4();
      const newCell = new Player(
        newCellId,
        socketId,
        cell.name,
        splitX,
        splitY,
        newRadius,
        cell.color
      );

      // impuls inițial
      newCell.vx = Math.cos(angle) * this.splitImpulse;
      newCell.vy = Math.sin(angle) * this.splitImpulse;
      newCell.splitTime = Date.now();

      this.allCells[newCellId] = newCell;
      newCells.push(newCellId);
    });

    this.playerCells[socketId].push(...newCells);
  }

  getLeaderboard() {
    const playerScores = {};
    for (const socketId in this.playerCells) {
      let totalRadius = 0;
      this.playerCells[socketId].forEach(cellId => {
        const cell = this.allCells[cellId];
        if (cell && cell.isAlive) totalRadius += cell.radius;
      });
      if (this.playerCells[socketId].length > 0) {
        const firstCellId = this.playerCells[socketId][0];
        const name = this.allCells[firstCellId]
          ? this.allCells[firstCellId].name
          : 'Anonim';
        playerScores[socketId] = { id: socketId, name, score: totalRadius };
      }
    }

    return Object.values(playerScores)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  updatePlayerDirection(playerId, dx, dy) {
    if (!this.playerCells[playerId]) return;

    this.playerCells[playerId].forEach(cellId => {
      const cell = this.allCells[cellId];
      if (cell && cell.isAlive) {
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
          cell.dx = dx / length;
          cell.dy = dy / length;
        } else {
          cell.dx = 0;
          cell.dy = 0;
        }
      }
    });
  }

  update() {
    // 1️⃣ Update poziții și limite hartă
    for (const cellId in this.allCells) {
      const cell = this.allCells[cellId];
      if (!cell.isAlive) continue;
      cell.updatePosition();
      cell.x = Math.max(cell.radius, Math.min(this.mapSize.width - cell.radius, cell.x));
      cell.y = Math.max(cell.radius, Math.min(this.mapSize.height - cell.radius, cell.y));
    }

    // 1.5️⃣ Atracție către celula principală după pullDelay
    for (const playerId in this.playerCells) {
      const ids = this.playerCells[playerId];
      if (ids.length < 2) continue;
      const main = this.allCells[ids[0]]; // presupunem că prima e "principală"
      if (!main || !main.isAlive) continue;

      for (let i = 1; i < ids.length; i++) {
        const c = this.allCells[ids[i]];
        if (!c || !c.isAlive) continue;
        const age = Date.now() - (c.splitTime || 0);
        if (age >= this.pullDelay) {
          const dx = main.x - c.x;
          const dy = main.y - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          // aplicăm o mică accelerație în direcția principală
          c.vx += (dx / dist) * this.pullStrength;
          c.vy += (dy / dist) * this.pullStrength;
          // optional: limităm impulsul maxim pentru a nu zbura prea tare
          const vlen = Math.hypot(c.vx, c.vy);
          const vmax = Math.max(1, 10 - c.radius / 50);
          if (vlen > vmax) {
            c.vx = (c.vx / vlen) * vmax;
            c.vy = (c.vy / vlen) * vmax;
          }
        }
      }
    }

    // 2️⃣ Corecție / repulsie între celulele aceluiași jucător (menține distanța r1+r2)
    for (const playerId in this.playerCells) {
      const ids = this.playerCells[playerId];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const c1 = this.allCells[ids[i]];
          const c2 = this.allCells[ids[j]];
          if (!c1 || !c2 || !c1.isAlive || !c2.isAlive) continue;

          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const minDist = c1.radius + c2.radius;

          // dacă sunt prea aproape (suprapunere), separăm astfel încât distanța să fie ~minDist
          if (dist < minDist) {
            // cât trebuie să împingem (factor stiffness pentru control)
            const overlap = (minDist - dist) * this.repulsionStiffness;
            const nx = dx / dist;
            const ny = dy / dist;

            // împărțim corecția proporțional cu mărimea (pot ajusta dacă vrei ca cea mai mare să se miște mai puțin)
            // aici împingem fiecare cu jumătate din corecție
            const pushX = nx * overlap * 0.5;
            const pushY = ny * overlap * 0.5;

            c1.x -= pushX;
            c1.y -= pushY;
            c2.x += pushX;
            c2.y += pushY;

            // corectăm și vitezele ușor, pentru stabilitate (reduce componenta normală)
            const relVx = c2.vx - c1.vx;
            const relVy = c2.vy - c1.vy;
            const relNormal = relVx * nx + relVy * ny;
            // eliminăm o parte din viteza normală la impact (amortizare)
            const damping = 0.6;
            const correctionV = relNormal * (1 - damping);
            c1.vx -= nx * correctionV * 0.5;
            c1.vy -= ny * correctionV * 0.5;
            c2.vx += nx * correctionV * 0.5;
            c2.vy += ny * correctionV * 0.5;
          }
        }
      }
    }

    // 3️⃣ Coliziuni cu mâncare
    for (const cellId in this.allCells) {
      const cell = this.allCells[cellId];
      if (!cell.isAlive) continue;

      this.food = this.food.filter(foodItem => {
        const distance = Math.hypot(cell.x - foodItem.x, cell.y - foodItem.y);
        if (distance < cell.radius + foodItem.radius) {
          cell.grow(foodItem.points);
          return false;
        }
        return true;
      });
    }

    // 4️⃣ Coliziuni între celule (merge / mâncare între jucători)
    const allCellIds = Object.keys(this.allCells);
    for (let i = 0; i < allCellIds.length; i++) {
      for (let j = i + 1; j < allCellIds.length; j++) {
        const cell1 = this.allCells[allCellIds[i]];
        const cell2 = this.allCells[allCellIds[j]];
        if (!cell1 || !cell2 || !cell1.isAlive || !cell2.isAlive) continue;

        const distance = Math.hypot(cell1.x - cell2.x, cell1.y - cell2.y);

        if (cell1.ownerId === cell2.ownerId) {
          // merge după timp (doar după mergeTime)
          if (
            Date.now() - (cell1.splitTime || 0) > this.mergeTime &&
            Date.now() - (cell2.splitTime || 0) > this.mergeTime &&
            distance < cell1.radius + cell2.radius
          ) {
            cell1.grow(cell2.radius);
            cell2.isAlive = false;
            this.playerCells[cell2.ownerId] =
              this.playerCells[cell2.ownerId].filter(id => id !== cell2.id);
            delete this.allCells[cell2.id];
          }
        } else {
          // mănâncă alt jucător
          if (distance < cell1.radius && cell1.radius > cell2.radius * 1.1) {
            cell1.grow(cell2.radius);
            cell2.isAlive = false;
            this.playerCells[cell2.ownerId] =
              this.playerCells[cell2.ownerId].filter(id => id !== cell2.id);
            delete this.allCells[cell2.id];
          } else if (distance < cell2.radius && cell2.radius > cell1.radius * 1.1) {
            cell2.grow(cell1.radius);
            cell1.isAlive = false;
            this.playerCells[cell1.ownerId] =
              this.playerCells[cell1.ownerId].filter(id => id !== cell1.id);
            delete this.allCells[cell1.id];
          }
        }
      }
    }

    // 5️⃣ Regenerare mâncare
    while (this.food.length < this.maxFood) {
      const randomRadius = Math.random() * 2 + 1;
      const randomPoints = Math.floor(randomRadius);
      this.food.push(
        new Food(
          Math.random() * this.mapSize.width,
          Math.random() * this.mapSize.height,
          randomRadius,
          randomPoints,
          getRandomColor()
        )
      );
    }

    // Returnează starea curentă
    const activeCells = Object.values(this.allCells).filter(c => c.isAlive);
    return { players: activeCells, food: this.food };
  }
}

module.exports = GameState;
