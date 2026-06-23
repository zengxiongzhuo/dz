import React from 'react';

const SUIT_MAP = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

const SUIT_COLOR = {
  h: '#e53935',
  d: '#e53935',
  c: '#1a1a1a',
  s: '#1a1a1a',
};

const RANK_MAP = {
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

export default function Card({ rank, suit, faceDown = false, size = 'small' }) {
  const sizeClass = size === 'large' ? 'card--large' : 'card--small';
  const suitSymbol = SUIT_MAP[suit] || suit;
  const suitColor = SUIT_COLOR[suit] || '#1a1a1a';
  const displayRank = RANK_MAP[rank] || rank;

  if (faceDown) {
    return (
      <div className={`card card--back ${sizeClass}`}>
        <div className="card__back-pattern">
          <div className="card__diamond" />
          <div className="card__diamond card__diamond--2" />
          <div className="card__diamond card__diamond--3" />
        </div>
      </div>
    );
  }

  return (
    <div className={`card card--front ${sizeClass}`} style={{ color: suitColor }}>
      <div className="card__corner card__corner--top">
        <span className="card__rank">{displayRank}</span>
        <span className="card__suit-small">{suitSymbol}</span>
      </div>
      <div className="card__center">
        <span className="card__suit-large">{suitSymbol}</span>
      </div>
      <div className="card__corner card__corner--bottom">
        <span className="card__rank">{displayRank}</span>
        <span className="card__suit-small">{suitSymbol}</span>
      </div>
    </div>
  );
}
