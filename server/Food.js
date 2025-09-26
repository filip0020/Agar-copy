// server/Food.js
const { v4: uuidv4 } = require('uuid');

class Food {
  constructor(x, y, radius, points, color) {
    this.id = uuidv4();
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.points = points;
    this.color = color;
  }
}

module.exports = Food;