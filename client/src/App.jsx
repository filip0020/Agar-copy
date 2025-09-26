// client/src/App.jsx
import React, { useEffect, useRef, useState } from 'react';
import { io } from "socket.io-client";
import MobileJoystick from './components/MobileJoystick';
import StartScreen from './components/StartScreen';
import Leaderboard from './components/Leaderboard';
import SplitButton from './components/SplitButton';
import './index.css';

const socket = io("http://localhost:3000"); // ok aici, dar ascultările le atașăm o singură dată

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [movementVector, setMovementVector] = useState({ x: 0, y: 0 });
  const [gameState, setGameState] = useState({ players: [], food: [] });
  const [leaderboard, setLeaderboard] = useState([]);
  const canvasRef = useRef(null);

  const [myPlayerCells, setMyPlayerCells] = useState([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // ref pentru throttled logging (o dată pe 1000ms)
  const lastLogRef = useRef(0);

  // --- SOCKET: înregistrăm o singură dată listener-ele ---
  useEffect(() => {
    const detectMobile = () => {
      setIsMobile(
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      );
    };
    detectMobile();
    window.addEventListener('resize', detectMobile);

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    // nu afisam tot state-ul (foarte charges) — in schimb doar sumar
    socket.on('game_state_update', (state) => {
      // uncomment daca vrei inspect complet (dar va umple consola)
      // console.debug('game_state_update full:', state);

      setGameState(state);
      const myCells = state.players.filter(p => p.ownerId === socket.id);
      setMyPlayerCells(myCells);

      // log throttled: o dată pe secundă
      const now = Date.now();
      if (now - lastLogRef.current > 1000) {
        lastLogRef.current = now;
        console.log(`DBG: players=${state.players.length} food=${state.food.length} myCells=${myCells.length}`);
      }
    });

    socket.on('leaderboard_update', (data) => {
      setLeaderboard(data);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('game_state_update');
      socket.off('leaderboard_update');
      window.removeEventListener('resize', detectMobile);
    };
  }, []);

  // --- Movement emitter (separate effect) ---
  useEffect(() => {
    const movementInterval = setInterval(() => {
      if (isConnected && isGameStarted && myPlayerCells.length > 0) {
        const mainCell = myPlayerCells[0];
        let dx = 0, dy = 0;

        if (isMobile) {
          dx = movementVector.x;
          dy = movementVector.y;
        } else {
          const canvas = canvasRef.current;
          if (canvas) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            dx = mousePosition.x - centerX;
            dy = mousePosition.y - centerY;
          }
        }
        socket.emit('player_move', { cellId: mainCell.id, dx, dy });
      }
    }, 16);

    const handleKeyDown = (e) => {
      if (e.code === 'Space' && isGameStarted && myPlayerCells.length > 0) {
        handleSplit();
      }
    };
    const handleMouseMove = (e) => {
      if (!isMobile && isGameStarted) {
        setMousePosition({ x: e.clientX, y: e.clientY });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      clearInterval(movementInterval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isConnected, isGameStarted, myPlayerCells, movementVector, isMobile, mousePosition]); // dependente pentru a folosi latest values

  // --- CANVAS RENDER cu zoom dinamic ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isGameStarted) return;
    const ctx = canvas.getContext('2d');

    // setăm dimensiunea canvas-ului
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // curățăm ecranul înainte de transformări
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // calculăm bounding box-ul celulelor mele
    let focusX = canvas.width / 2;
    let focusY = canvas.height / 2;
    let zoom = 1;

    if (myPlayerCells.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      myPlayerCells.forEach(cell => {
        minX = Math.min(minX, cell.x - cell.radius);
        maxX = Math.max(maxX, cell.x + cell.radius);
        minY = Math.min(minY, cell.y - cell.radius);
        maxY = Math.max(maxY, cell.y + cell.radius);
      });

      const worldWidth = maxX - minX;
      const worldHeight = maxY - minY;

      // scale pentru canvas (100px padding)
      const scaleX = canvas.width / (worldWidth + 200);
      const scaleY = canvas.height / (worldHeight + 200);

      zoom = Math.min(scaleX, scaleY, 1); // zoom maxim = 1 (nu mărește ecranul peste 100%)
      focusX = (minX + maxX) / 2;
      focusY = (minY + maxY) / 2;
    } else if (gameState.players.length > 0) {
      focusX = gameState.players[0].x;
      focusY = gameState.players[0].y;
      zoom = 1;
    } else {
      focusX = 1500;
      focusY = 1500;
      zoom = 1;
    }

    // aplicăm transformările pentru camera
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-focusX, -focusY);

    // desenăm mâncare
    gameState.food.forEach(foodItem => {
      ctx.beginPath();
      ctx.arc(foodItem.x, foodItem.y, Math.max(1, foodItem.radius), 0, Math.PI * 2);
      ctx.fillStyle = foodItem.color || '#999';
      ctx.fill();
      ctx.closePath();
    });

    // desenăm jucători
    gameState.players.forEach(player => {
      ctx.beginPath();
      ctx.arc(player.x, player.y, Math.max(2, player.radius), 0, Math.PI * 2);
      ctx.fillStyle = player.color || 'red';
      ctx.fill();
      ctx.closePath();

      // text adaptiv la zoom
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      const fontSize = Math.max(8, 12 / zoom);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillText(player.name, player.x, player.y - player.radius * 0.1);
      ctx.font = `${Math.max(6, 10 / zoom)}px Arial`;
      ctx.fillText(Math.floor(player.score || 0), player.x, player.y + fontSize * 1.1);
    });

    ctx.restore();

    // overlay crosshair pentru debug
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,0,0,0.8)';
    ctx.lineWidth = 1;
    ctx.moveTo(canvas.width / 2 - 10, canvas.height / 2);
    ctx.lineTo(canvas.width / 2 + 10, canvas.height / 2);
    ctx.moveTo(canvas.width / 2, canvas.height / 2 - 10);
    ctx.lineTo(canvas.width / 2, canvas.height / 2 + 10);
    ctx.stroke();
    ctx.closePath();

    // DEBUG: verificăm dacă toate celulele mele sunt vizibile
    const now = Date.now();
    if (now - lastLogRef.current > 1000) {
      lastLogRef.current = now;
      if (myPlayerCells.length > 0) {
        myPlayerCells.forEach(p => {
          const screenX = (p.x - focusX) * zoom + canvas.width / 2;
          const screenY = (p.y - focusY) * zoom + canvas.height / 2;
          const onScreen = screenX >= 0 && screenX <= canvas.width && screenY >= 0 && screenY <= canvas.height;
          console.log(`DBG: player(${p.id}) screen=(${Math.round(screenX)},${Math.round(screenY)}) onScreen=${onScreen}`);
        });
      }
    }

  }, [gameState, isGameStarted, myPlayerCells]);

  const handleJoystickMove = (x, y) => {
    setMovementVector({ x, y });
  };

  const handleStartGame = (playerName, playerColor) => {
    socket.emit('player_join', playerName, playerColor);
    setIsGameStarted(true);
  };

  const handleSplit = () => {
    if (myPlayerCells.length > 0) {
      const mainCell = myPlayerCells[0];
      let directionVector = { x: 0, y: 0 };
      if (isMobile) {
        directionVector = movementVector;
      } else {
        const canvas = canvasRef.current;
        if (canvas) {
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          directionVector.x = mousePosition.x - centerX;
          directionVector.y = mousePosition.y - centerY;
        }
      }
      socket.emit('player_split', mainCell.id, directionVector);
    }
  };

  return (
    <div className="App">
      {!isGameStarted && <StartScreen onStartGame={handleStartGame} />}

      {isGameStarted && (
        <>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100vw', height: '100vh' }} />
          {isMobile && <MobileJoystick onMove={handleJoystickMove} />}
          {isMobile && <SplitButton onClick={handleSplit} />}
          <Leaderboard players={leaderboard} />
        </>
      )}
    </div>
  );
}

export default App;
