import React from 'react';

export default function GameResult({ results = [], onBackToLobby = () => {} }) {
  // Sort by profit descending
  const sorted = [...results].sort((a, b) => (b.profit || 0) - (a.profit || 0));

  return (
    <div className="game-result-overlay">
      <div className="game-result">
        <h2 className="game-result__title">🏆 对局结算</h2>

        <div className="game-result__list">
          {sorted.map((player, idx) => {
            const profit = player.profit || (player.finalChips - player.initialChips);
            const isPositive = profit > 0;
            const isNegative = profit < 0;
            const winRate = player.handsPlayed > 0
              ? Math.round((player.handsWon / player.handsPlayed) * 100)
              : 0;

            return (
              <div className="game-result__item" key={player.socketId || player.name || idx}>
                <div className="game-result__rank">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </div>
                <div className="game-result__avatar">{player.avatar || '😀'}</div>
                <div className="game-result__player-info">
                  <div className="game-result__name">{player.name}</div>
                  <div className="game-result__chips-detail">
                    {player.initialChips?.toLocaleString()} → {player.finalChips?.toLocaleString()}
                    {player.borrowed > 0 && (
                      <span className="game-result__borrowed">
                        (借: {player.borrowed.toLocaleString()})
                      </span>
                    )}
                  </div>
                  <div className="game-result__stats">
                    <span className="game-result__stat">
                      参与 {player.handsPlayed || 0} 手
                    </span>
                    <span className="game-result__stat-divider">·</span>
                    <span className="game-result__stat">
                      胜 {player.handsWon || 0} 手
                    </span>
                    <span className="game-result__stat-divider">·</span>
                    <span className="game-result__stat">
                      胜率 {winRate}%
                    </span>
                  </div>
                </div>
                <div
                  className={`game-result__profit ${
                    isPositive ? 'game-result__profit--positive' : ''
                  } ${isNegative ? 'game-result__profit--negative' : ''}`}
                >
                  {isPositive ? '+' : ''}{profit.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>

        <button className="game-result__back-btn" onClick={onBackToLobby}>
          返回大厅
        </button>
      </div>
    </div>
  );
}
