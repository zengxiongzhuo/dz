import React, { useState, useEffect } from 'react';

export default function ActionPanel({
  validActions = ['fold', 'call', 'raise'],
  callAmount = 0,
  minRaise = 0,
  maxRaise = 1000,
  playerChips = 0,
  pot = 0,
  currentBet = 0,
  onAction = () => {},
  isMyTurn = false,
}) {
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(minRaise);

  // 当轮次切换或 minRaise 变化时，重置加注金额
  useEffect(() => {
    setRaiseAmount(minRaise);
  }, [minRaise, isMyTurn]);

  const canFold = validActions.includes('fold');
  const canCall = validActions.includes('call');
  const canCheck = validActions.includes('check');
  const canRaise = validActions.includes('raise');

  // 判断是否是全押跟注（筹码不够匹配当前下注，需要全押）
  const isAllInCall = canCall && callAmount > 0 && callAmount >= playerChips && playerChips > 0;

  const handleFold = () => {
    onAction({ type: 'fold' });
  };

  const handleCallOrCheck = () => {
    if (canCheck) {
      onAction({ type: 'check' });
    } else {
      onAction({ type: 'call', amount: callAmount });
    }
  };

  const handleRaiseClick = () => {
    setShowRaiseSlider(!showRaiseSlider);
    setRaiseAmount(minRaise);
  };

  const handleConfirmRaise = () => {
    const final = Math.max(minRaise, Math.min(raiseAmount, maxRaise));
    onAction({ type: 'raise', amount: final });
    setShowRaiseSlider(false);
  };

  // 快速加注：基于当前下注 + 底池百分比
  // "50%底池" = 加注到 currentBet + pot * 0.5
  const handleQuickRaise = (multiplier) => {
    const raiseDelta = Math.floor(pot * multiplier);
    const target = currentBet + raiseDelta;
    const clamped = Math.max(minRaise, Math.min(target, maxRaise));
    setRaiseAmount(clamped);
  };

  const handleAllIn = () => {
    setRaiseAmount(maxRaise);
  };

  const callLabel = canCheck ? '过牌' : isAllInCall ? `全押 ${callAmount.toLocaleString()}` : `跟注 ${callAmount.toLocaleString()}`;

  return (
    <div className={`action-panel ${!isMyTurn ? 'action-panel--disabled' : ''}`}>
      {showRaiseSlider && isMyTurn && (
        <div className="action-panel__raise-controls">
          <div className="action-panel__raise-header">
            <span className="action-panel__raise-label">加注到</span>
            <span className="action-panel__raise-value">{raiseAmount.toLocaleString()}</span>
          </div>
          <input
            type="range"
            className="action-panel__slider"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
          />
          <div className="action-panel__quick-buttons">
            <button className="action-panel__quick-btn" onClick={() => handleQuickRaise(0.5)}>
              50%底池
            </button>
            <button className="action-panel__quick-btn" onClick={() => handleQuickRaise(0.75)}>
              75%底池
            </button>
            <button className="action-panel__quick-btn" onClick={() => handleQuickRaise(1)}>
              100%底池
            </button>
            <button className="action-panel__quick-btn action-panel__quick-btn--allin" onClick={handleAllIn}>
              All In
            </button>
          </div>
          <button className="action-panel__confirm-btn" onClick={handleConfirmRaise}>
            确认加注 {raiseAmount.toLocaleString()}
          </button>
        </div>
      )}

      <div className="action-panel__buttons">
        <button
          className="action-panel__btn action-panel__btn--fold"
          onClick={handleFold}
          disabled={!isMyTurn || !canFold}
        >
          弃牌
        </button>

        <button
          className="action-panel__btn action-panel__btn--call"
          onClick={handleCallOrCheck}
          disabled={!isMyTurn || (!canCall && !canCheck)}
        >
          {callLabel}
        </button>

        <button
          className="action-panel__btn action-panel__btn--raise"
          onClick={handleRaiseClick}
          disabled={!isMyTurn || !canRaise}
        >
          加注
        </button>
      </div>
    </div>
  );
}
