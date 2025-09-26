// client/src/components/SplitButton.jsx
import React from 'react';
import './SplitButton.css';

const SplitButton = ({ onClick }) => {
  return (
    <button className="split-button" onClick={onClick}>
      Split
    </button>
  );
};

export default SplitButton;