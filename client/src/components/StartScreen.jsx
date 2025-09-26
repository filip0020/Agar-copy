// client/src/components/StartScreen.jsx
import React, { useState } from 'react';
import './StartScreen.css';

const StartScreen = ({ onStartGame }) => {
  const [playerName, setPlayerName] = useState('');
  const [playerColor, setPlayerColor] = useState('#ff5733'); // Culoare inițială implicită

  const handleStart = () => {
    if (playerName.trim()) {
      onStartGame(playerName, playerColor); // Trimitem și culoarea
    }
  };

  return (
    <div className="start-screen-container">
      <div className="start-screen-box">
        <h1>Intră în Joc</h1>
        <p>Alege un nume și o culoare.</p>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Nume jucător"
        />
        <div className="color-picker-container">
          <label htmlFor="color-picker">Culoarea ta:</label>
          <input
            type="color"
            id="color-picker"
            value={playerColor}
            onChange={(e) => setPlayerColor(e.target.value)}
          />
        </div>
        <button onClick={handleStart}>
          Go!
        </button>
      </div>
    </div>
  );
};

export default StartScreen;