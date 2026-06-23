import React from 'react';
import Card from './Card';

export default function HandCards({ cards = [] }) {
  if (cards.length === 0) return null;

  return (
    <div className="hand-cards">
      {cards.map((card, idx) => (
        <div className="hand-cards__card" key={idx}>
          <Card rank={card.rank} suit={card.suit} size="large" />
        </div>
      ))}
    </div>
  );
}
