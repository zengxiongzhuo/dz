import React, { useState, useEffect } from 'react';
import Card from './Card';

export default function HandCards({ cards = [] }) {
  // 每张牌的翻转状态：true = 正面（可见），false = 背面（默认）
  const [flipped, setFlipped] = useState([false, false]);

  // 新一手发牌时重置为背面
  useEffect(() => {
    if (cards.length === 2) {
      setFlipped([false, false]);
    }
  }, [cards[0]?.rank, cards[0]?.suit, cards[1]?.rank, cards[1]?.suit]);

  if (cards.length === 0) return null;

  const toggleCard = (idx) => {
    setFlipped(prev => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  return (
    <div className="hand-cards">
      {cards.map((card, idx) => (
        <div
          className="hand-cards__card hand-cards__card--clickable"
          key={idx}
          onClick={() => toggleCard(idx)}
        >
          <Card rank={card.rank} suit={card.suit} size="large" faceDown={!flipped[idx]} />
        </div>
      ))}
    </div>
  );
}
