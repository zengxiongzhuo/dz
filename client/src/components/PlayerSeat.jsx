import React from 'react';

export default function PlayerSeat({ player, isCurrentTurn = false, isMe = false }) {
  if (!player) return null;

  const { name, avatar, chips, currentBet, status, isDealer, lastAction, borrowed } = player;
  const isFolded = status === 'folded';
  const isAllIn = status === 'allin';

  const seatClasses = [
    'player-seat',
    isCurrentTurn && 'player-seat--active',
    isMe && 'player-seat--me',
    isFolded && 'player-seat--folded',
  ].filter(Boolean).join(' ');

  return (
    <div className={seatClasses}>
      <div className="player-seat__avatar-wrap">
        <div className="player-seat__avatar">
          {avatar || '😀'}
        </div>
        {isDealer && (
          <div className="player-seat__dealer-badge">D</div>
        )}
        {isCurrentTurn && <div className="player-seat__turn-ring" />}
      </div>

      <div className="player-seat__info">
        <div className="player-seat__name">{name}</div>
        <div className="player-seat__chips">
          💰 {chips?.toLocaleString()}
        </div>
        {borrowed > 0 && (
          <div className="player-seat__borrowed">
            借: {borrowed.toLocaleString()}
          </div>
        )}
      </div>

      {isFolded && (
        <div className="player-seat__status-tag player-seat__status-tag--fold">
          已弃牌
        </div>
      )}

      {isAllIn && (
        <div className="player-seat__status-tag player-seat__status-tag--allin">
          All In
        </div>
      )}

      {currentBet > 0 && !isFolded && (
        <div className="player-seat__bet">
          <span className="player-seat__bet-chip">🪙</span>
          {currentBet.toLocaleString()}
        </div>
      )}

      {lastAction && (
        <div className="player-seat__action-label">
          {lastAction}
        </div>
      )}
    </div>
  );
}
