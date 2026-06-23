import React from 'react';
import PlayerSeat from './PlayerSeat';
import CommunityCards from './CommunityCards';
import PotDisplay from './PotDisplay';

/**
 * Calculate seat positions on an ellipse.
 * Current player (myIndex) is always at bottom center.
 * Other players distribute clockwise from bottom.
 */
function getSeatPositions(totalPlayers, myIndex) {
  const positions = [];

  for (let i = 0; i < totalPlayers; i++) {
    // Offset so that myIndex maps to bottom (angle = π/2 i.e. 90° pointing down)
    const offset = i - myIndex;
    const angle = (Math.PI / 2) + (offset * 2 * Math.PI) / totalPlayers;

    // Ellipse parametric: x = cos(angle), y = sin(angle)
    // Map to percentage positions (50% center)
    const x = 50 + 45 * Math.cos(angle);
    const y = 50 + 40 * Math.sin(angle);

    positions.push({ left: `${x}%`, top: `${y}%` });
  }

  return positions;
}

export default function PokerTable({
  players = [],
  currentPlayerIndex = 0,
  myIndex = 0,
  dealerIndex = 0,
  communityCards = [],
  pot = 0,
  phase = 'preflop',
}) {
  const positions = getSeatPositions(players.length, myIndex);

  return (
    <div className="poker-table-container">
      <div className="poker-table">
        <div className="poker-table__felt">
          {/* Community cards + Pot at center */}
          <div className="poker-table__center">
            <PotDisplay pot={pot} />
            <CommunityCards cards={communityCards} phase={phase} />
          </div>

          {/* Player seats around the ellipse */}
          {players.map((player, idx) => (
            <div
              className="poker-table__seat-position"
              key={player.id || idx}
              style={{
                left: positions[idx]?.left,
                top: positions[idx]?.top,
              }}
            >
              <PlayerSeat
                player={{ ...player, isDealer: idx === dealerIndex }}
                isCurrentTurn={idx === currentPlayerIndex}
                isMe={idx === myIndex}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
