// client/src/components/Leaderboard.jsx
import React, { useRef, useEffect } from 'react';
import './Leaderboard.css';

const Leaderboard = ({ players }) => {
  return (
    <div className="leaderboard-container">
      <h3>Clasament</h3>
      <ol>
        {players.map((player, index) => (
          <li key={player.id}>
            <span>{index + 1}. {player.name}</span>
            <span>{Math.floor(player.score)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default Leaderboard;