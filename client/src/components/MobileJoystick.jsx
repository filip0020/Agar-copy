// client/src/components/MobileJoystick.jsx
import React, { useRef, useEffect } from 'react';
import './MobileJoystick.css';

const MobileJoystick = ({ onMove }) => {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleStart = (e) => {
      isDragging.current = true;
      e.preventDefault();
    };

    const handleMove = (e) => {
      if (!isDragging.current) return;

      const outer = outerRef.current;
      const inner = innerRef.current;
      const rect = outer.getBoundingClientRect();
      let touch = e.touches ? e.touches[0] : e;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = rect.width / 2;

      if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
      }

      inner.style.transform = `translate(${dx}px, ${dy}px)`;
      onMove(dx, dy);
    };

    const handleEnd = () => {
      isDragging.current = false;
      innerRef.current.style.transform = `translate(0, 0)`;
      onMove(0, 0); // Oprim mișcarea
    };

    const outer = outerRef.current;
    if (outer) {
      outer.addEventListener('touchstart', handleStart);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);

      // Cleanup
      return () => {
        outer.removeEventListener('touchstart', handleStart);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
      };
    }
  }, [onMove]);

  return (
    <div className="joystick-container" ref={outerRef}>
      <div className="joystick-stick" ref={innerRef}></div>
    </div>
  );
};

export default MobileJoystick;