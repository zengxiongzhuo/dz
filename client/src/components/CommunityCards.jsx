import React from 'react';
import Card from './Card';

export default function CommunityCards({ cards = [], phase = 'preflop' }) {
  // Always show 5 slots
  const slots = [];
  for (let i = 0; i < 5; i++) {
    if (i < cards.length) {
      slots.push(
        <div className="community-cards__slot" key={i}>
          <Card rank={cards[i].rank} suit={cards[i].suit} size="large" />
        </div>
      );
    } else {
      slots.push(
        <div className="community-cards__slot community-cards__slot--empty" key={i}>
          <div className="community-cards__placeholder" />
        </div>
      );
    }
  }

  return (
    <div className="community-cards">
      {slots}
    </div>
  );
}
