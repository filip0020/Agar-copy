// server/Player.js
const { v4: uuidv4 } = require('uuid');

class Player {
  constructor(id, ownerId, name, x, y, radius, color) {
    this.id = id;
    this.ownerId = ownerId; // Proprietatea crucială
    this.name = name;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.score = Math.floor(radius);
    this.isAlive = true;
    this.targetX = x;
    this.targetY = y;
    this.vx = 0;
    this.vy = 0;
    this.splitTime = 0;
    this.dx = 0;
    this.dy = 0;
  }

  updateTarget(dx, dy) {
    this.targetX = this.x + dx;
    this.targetY = this.y + dy;
  }

  updateDirection(dx, dy) {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      this.dx = dx / len;
      this.dy = dy / len;
    } else {
      this.dx = 0;
      this.dy = 0;
    }
  }

  updatePosition() {
    if (!this.isAlive) return;

    // viteza scade dacă radius e mai mare
    const speed = Math.max(1, 10 - this.radius / 50);

    this.vx += this.dx * 0.2;
    this.vy += this.dy * 0.2;

    // limităm viteza în funcție de mărime
    const maxSpeed = speed;
    const len = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (len > maxSpeed) {
      this.vx = (this.vx / len) * maxSpeed;
      this.vy = (this.vy / len) * maxSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;

    // fricțiune
    this.vx *= 0.9;
    this.vy *= 0.9;
  }


  grow(amount) {
    this.radius += amount;
    this.score += amount;
  }
}

module.exports = Player;