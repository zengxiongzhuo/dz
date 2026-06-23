import React from 'react';

export default function RoomHeader({
  roomId = '',
  blinds = { small: 10, big: 20 },
  handCount = 1,
  isHost = false,
  onLeave = () => {},
  onEndGame = () => {},
  gamePhase = 'waiting',
}) {
  const canEndGame = isHost && (gamePhase === 'waiting' || gamePhase === 'handEnd');

  const handleCopyRoom = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomId);
    }
  };

  return (
    <div className="room-header">
      <div className="room-header__left">
        <button className="room-header__back-btn" onClick={onLeave}>
          ← 退出
        </button>
      </div>

      <div className="room-header__center">
        <div className="room-header__room-id" onClick={handleCopyRoom} title="点击复制房间号">
          房间 {roomId}
          <span className="room-header__copy-icon">📋</span>
        </div>
        <div className="room-header__meta">
          <span className="room-header__blinds">
            盲注 {blinds.small}/{blinds.big}
          </span>
          <span className="room-header__divider">·</span>
          <span className="room-header__hand-count">
            第 {handCount} 手
          </span>
        </div>
      </div>

      <div className="room-header__right">
        {canEndGame && (
          <button className="room-header__end-btn" onClick={onEndGame}>
            结束对局
          </button>
        )}
      </div>
    </div>
  );
}
