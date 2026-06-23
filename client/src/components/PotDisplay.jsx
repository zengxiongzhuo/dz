import React from 'react';

export default function PotDisplay({ pot = 0 }) {
  const formatted = pot.toLocaleString();

  return (
    <div className="pot-display">
      <div className="pot-display__icon">🏆</div>
      <div className="pot-display__text">
        底池 <span className="pot-display__amount">{formatted}</span>
      </div>
    </div>
  );
}
