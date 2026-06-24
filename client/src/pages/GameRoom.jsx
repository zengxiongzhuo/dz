import React, { useEffect, useMemo, useRef, useState } from 'react';
import PokerTable from '../components/PokerTable';
import HandCards from '../components/HandCards';
import ActionPanel from '../components/ActionPanel';
import RoomHeader from '../components/RoomHeader';
import GameResult from '../components/GameResult';
import { getAvatarById } from '../data/avatars.js';

// 服务端 phase → 前端 phase（小写）
const PHASE_MAP = {
  WAITING: 'waiting',
  PRE_FLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
};

// 服务端 lastAction → 中文标签
function formatLastAction(la) {
  if (!la) return null;
  switch (la.action) {
    case 'fold': return '弃牌';
    case 'check': return '过牌';
    case 'call': return la.amount ? `跟注 ${la.amount}` : '跟注';
    case 'raise': return `加注到 ${la.amount}`;
    case 'allIn': return 'All In';
    default: return la.action;
  }
}

// 服务端给的 status: 'active' | 'folded' | 'allIn' | 'waiting'
// PlayerSeat 期望的 status: 'active' | 'folded' | 'allin'
function normalizeStatus(s) {
  if (s === 'allIn') return 'allin';
  return s || 'active';
}

// 牌型中文（兼容 pokersolver 输出）
const HAND_NAME_MAP = {
  'Royal Flush': '皇家同花顺',
  'Straight Flush': '同花顺',
  'Four of a Kind': '四条',
  'Full House': '葫芦',
  'Flush': '同花',
  'Straight': '顺子',
  'Three of a Kind': '三条',
  'Two Pair': '两对',
  'Pair': '对子',
  'High Card': '高牌',
};

function translateHandName(name) {
  if (!name) return '';
  return HAND_NAME_MAP[name] || name;
}

const ACTION_TIMEOUT_MS = 30000;

export default function GameRoom({
  socket,
  player,
  room,
  initialEvents,
  onLeave = () => {},
}) {
  // ─── 初始 state（来自 App 缓存的早期事件） ───
  const init = initialEvents || {};
  const initGameState = init.gameState?.gameState || init.yourState?.gameState || null;
  const initRoomState = init.gameState?.roomState || null;

  const [gameState, setGameState] = useState(initGameState);
  const [roomState, setRoomState] = useState(initRoomState);
  const [myCards, setMyCards] = useState(init.yourCards?.holeCards || []);
  const [actionRequired, setActionRequired] = useState(init.actionRequired || null);

  // 用 ref 跟踪最新 actionRequired，解决 stale closure 问题
  const actionRequiredRef = useRef(actionRequired);
  actionRequiredRef.current = actionRequired;

  const [handResult, setHandResult] = useState(null);
  const [gameResult, setGameResult] = useState(null);

  const [errorMsg, setErrorMsg] = useState('');
  const errorTimerRef = useRef(null);

  // 行动倒计时
  const [actionDeadline, setActionDeadline] = useState(null);
  const [, setNowTick] = useState(0);

  // hand-result 弹窗自动关闭
  const handResultTimerRef = useRef(null);

  // ─── socket 监听 ───
  useEffect(() => {
    if (!socket) return;

    const onGameState = (data) => {
      if (data?.gameState) setGameState(data.gameState);
      if (data?.roomState) setRoomState(data.roomState);
      // 新一手开始 → 清空上一手的结果弹窗
      if (data?.gameState?.phase && data.gameState.phase !== 'SHOWDOWN') {
        setHandResult(null);
        if (handResultTimerRef.current) {
          clearTimeout(handResultTimerRef.current);
          handResultTimerRef.current = null;
        }
      }
    };

    const onYourState = (data) => {
      if (data?.gameState) setGameState(data.gameState);
    };

    const onYourCards = (data) => {
      setMyCards(data?.holeCards || []);
    };

    const onActionRequired = (data) => {
      setActionRequired(data || null);
    };

    const onHandResult = (data) => {
      setHandResult(data || null);
      setActionRequired(null);
      if (handResultTimerRef.current) clearTimeout(handResultTimerRef.current);
      handResultTimerRef.current = setTimeout(() => {
        setHandResult(null);
        handResultTimerRef.current = null;
      }, 4500);
    };

    const onGameEnded = (data) => {
      setGameResult(data?.results || []);
      setActionRequired(null);
      setHandResult(null);
    };

    const onGamePaused = (data) => {
      showError(data?.reason || '游戏暂停');
    };

    const onError = (data) => {
      showError(data?.message || '操作失败');
    };

    const onLeftRoom = () => {
      onLeave();
    };

    const onRoomUpdate = (data) => {
      if (data) setRoomState(data);
    };

    socket.on('game-state', onGameState);
    socket.on('your-state', onYourState);
    socket.on('your-cards', onYourCards);
    socket.on('action-required', onActionRequired);
    socket.on('hand-result', onHandResult);
    socket.on('game-ended', onGameEnded);
    socket.on('game-paused', onGamePaused);
    socket.on('error-message', onError);
    socket.on('left-room', onLeftRoom);
    socket.on('room-update', onRoomUpdate);
    socket.on('room-joined', onRoomUpdate);

    // ── 补偿：挂载后立即检查 initialEvents 中是否有未被 state 消费的事件 ──
    // 解决 action-required 在 GameRoom mount 前就到达的竞态问题
    if (init.actionRequired && !actionRequiredRef.current) {
      setActionRequired(init.actionRequired);
    }
    if (init.yourCards?.holeCards?.length && myCards.length === 0) {
      setMyCards(init.yourCards.holeCards);
    }

    return () => {
      socket.off('game-state', onGameState);
      socket.off('your-state', onYourState);
      socket.off('your-cards', onYourCards);
      socket.off('action-required', onActionRequired);
      socket.off('hand-result', onHandResult);
      socket.off('game-ended', onGameEnded);
      socket.off('game-paused', onGamePaused);
      socket.off('error-message', onError);
      socket.off('left-room', onLeftRoom);
      socket.off('room-update', onRoomUpdate);
      socket.off('room-joined', onRoomUpdate);
      if (handResultTimerRef.current) clearTimeout(handResultTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  function showError(msg) {
    setErrorMsg(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMsg(''), 2800);
  }

  // ─── 行动倒计时 ───
  useEffect(() => {
    if (actionRequired) {
      setActionDeadline(Date.now() + ACTION_TIMEOUT_MS);
    } else {
      setActionDeadline(null);
    }
  }, [actionRequired]);

  useEffect(() => {
    if (!actionDeadline) return undefined;
    const t = setInterval(() => setNowTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [actionDeadline]);

  const remainingSec = actionDeadline
    ? Math.max(0, Math.ceil((actionDeadline - Date.now()) / 1000))
    : 0;

  // ─── 派生数据 ───
  const myId = socket?.id;

  // 优先使用 gameState.players（含 currentBet/totalBet/holeCards），无则用 roomState.players
  const sourcePlayers = gameState?.players?.length
    ? gameState.players
    : (roomState?.players || []);

  const myIndex = useMemo(() => {
    if (!myId) return 0;
    const i = sourcePlayers.findIndex((p) => p.id === myId || p.socketId === myId);
    return i >= 0 ? i : 0;
  }, [sourcePlayers, myId]);

  const me = sourcePlayers[myIndex] || null;

  // 把服务端 player 数据映射为 PlayerSeat 期望的格式
  const uiPlayers = useMemo(() => {
    const lastActionPid = gameState?.lastAction?.playerId;
    const lastActionLabel = formatLastAction(gameState?.lastAction);
    return sourcePlayers.map((p) => {
      const av = getAvatarById(p.avatar);
      return {
        id: p.id,
        name: p.name || '玩家',
        avatar: av?.emoji || '😀',
        chips: p.chips ?? 0,
        currentBet: p.currentBet || 0,
        status: normalizeStatus(p.status),
        lastAction: p.id === lastActionPid ? lastActionLabel : null,
        connected: p.connected !== false,
        borrowed: p.borrowed || 0,
      };
    });
  }, [sourcePlayers, gameState?.lastAction]);

  // 显示用底池 = 收集到的底池 + 本轮所有玩家的当前下注
  const totalPot = useMemo(() => {
    const collected = gameState?.pot || 0;
    const current = sourcePlayers.reduce((s, p) => s + (p.currentBet || 0), 0);
    return collected + current;
  }, [gameState?.pot, sourcePlayers]);

  // ─── 双重来源判断 isMyTurn ───
  // 不仅依赖 action-required 事件，还从 gameState.currentPlayerId 推导
  const isMyTurn = useMemo(() => {
    // 来源1：已有 action-required 数据且 playerId 匹配
    if (actionRequired && actionRequired.playerId === myId) return true;
    // 来源2：没有 action-required 但 gameState 显示轮到自己
    if (gameState && gameState.currentPlayerId === myId &&
        gameState.phase !== 'WAITING' && gameState.phase !== 'SHOWDOWN') {
      return true;
    }
    return false;
  }, [actionRequired, myId, gameState]);

  const validActionStrings = useMemo(() => {
    // 优先使用 action-required 事件中的 validActions
    if (actionRequired?.validActions?.length) {
      return actionRequired.validActions.map((a) => a.action);
    }
    // Fallback：如果没有 action-required 但确定是自己的回合，从 gameState 推导基本操作
    if (isMyTurn && gameState) {
      const myPlayer = sourcePlayers[myIndex];
      const toCall = (gameState.currentBet || 0) - (myPlayer?.currentBet || 0);
      if (toCall > 0) {
        return ['fold', 'call', 'raise', 'allIn'];
      } else {
        return ['check', 'raise', 'allIn'];
      }
    }
    return [];
  }, [actionRequired, isMyTurn, gameState, sourcePlayers, myIndex]);

  const callAction = (actionRequired?.validActions || []).find((a) => a.action === 'call');
  const raiseAction = (actionRequired?.validActions || []).find((a) => a.action === 'raise');
  const allInAction = (actionRequired?.validActions || []).find((a) => a.action === 'allIn');

  // callAmount / minRaise / maxRaise 也添加 gameState fallback
  const callAmount = useMemo(() => {
    if (callAction?.amount) return callAction.amount;
    // Fallback：从 gameState 推导
    if (isMyTurn && gameState && !actionRequired) {
      const myPlayer = sourcePlayers[myIndex];
      return Math.max(0, (gameState.currentBet || 0) - (myPlayer?.currentBet || 0));
    }
    return 0;
  }, [callAction, isMyTurn, gameState, actionRequired, sourcePlayers, myIndex]);

  const minRaise = useMemo(() => {
    if (raiseAction?.min) return raiseAction.min;
    // Fallback：从 gameState 推导
    if (isMyTurn && gameState && !actionRequired) {
      return (gameState.currentBet || 0) + (gameState.minRaise || gameState.bigBlind || 0);
    }
    return gameState?.bigBlind || 0;
  }, [raiseAction, isMyTurn, gameState, actionRequired]);

  const maxRaise = useMemo(() => {
    if (raiseAction?.max) return raiseAction.max;
    if (allInAction?.amount) return allInAction.amount;
    // Fallback：从 gameState 推导（自己的 currentBet + chips）
    if (isMyTurn && gameState && !actionRequired) {
      const myPlayer = sourcePlayers[myIndex];
      return (myPlayer?.currentBet || 0) + (myPlayer?.chips || 0);
    }
    return me?.chips || 0;
  }, [raiseAction, allInAction, isMyTurn, gameState, actionRequired, sourcePlayers, myIndex, me]);

  // 阶段
  const uiPhase = PHASE_MAP[gameState?.phase] || 'waiting';
  const headerPhase =
    !gameState || gameState.phase === 'WAITING'
      ? 'waiting'
      : gameState.phase === 'SHOWDOWN'
        ? 'handEnd'
        : 'playing';

  // 房主判断
  const hostId = roomState?.hostId || room?.hostId;
  const isHost = !!myId && hostId === myId;

  // ─── 行动发送 ───
  const sendAction = ({ type, amount }) => {
    if (!socket || !isMyTurn) return;
    const payload = { action: type };
    if (typeof amount === 'number') payload.amount = amount;
    socket.emit('player-action', payload);
    // 立即关闭面板，避免重复点击；服务端会广播 game-state
    setActionRequired(null);
    setActionDeadline(null);
  };

  const handleEndGame = () => {
    if (!socket) return;
    socket.emit('end-game');
  };

  const handleLeave = () => {
    if (socket) socket.emit('leave-room');
    onLeave();
  };

  const handleBorrow = () => {
    if (socket) socket.emit('borrow-chips');
  };

  // 只有在两手之间（waiting 或 showdown）且筹码为 0 时允许借入
  const canBorrow = !!me
    && me.chips === 0
    && (!gameState
      || gameState.phase === 'WAITING'
      || gameState.phase === 'SHOWDOWN');

  // ─── 渲染 ───
  const roomId = roomState?.id || room?.roomId || '';
  const blinds = {
    small: gameState?.smallBlind || roomState?.smallBlind || 0,
    big: gameState?.bigBlind || roomState?.bigBlind || 0,
  };
  const handCount = roomState?.handCount || 0;

  return (
    <div className="game-room">
      <RoomHeader
        roomId={roomId}
        blinds={blinds}
        handCount={handCount}
        isHost={isHost}
        onLeave={handleLeave}
        onEndGame={handleEndGame}
        gamePhase={headerPhase}
      />

      <div className="table-area">
        <PokerTable
          players={uiPlayers}
          currentPlayerIndex={gameState?.currentPlayerIndex ?? -1}
          myIndex={myIndex}
          dealerIndex={gameState?.dealerIndex ?? -1}
          communityCards={gameState?.communityCards || []}
          pot={totalPot}
          phase={uiPhase}
        />
      </div>

      <HandCards cards={myCards} />

      {me?.borrowed > 0 && (
        <div className="my-borrowed-info">
          已借入: {me.borrowed.toLocaleString()}
        </div>
      )}

      {isMyTurn && actionDeadline && (
        <div className="action-timer" aria-live="polite">
          <span className="action-timer__label">剩余</span>
          <span className="action-timer__value">{remainingSec}s</span>
          <div
            className="action-timer__bar"
            style={{ width: `${(remainingSec / (ACTION_TIMEOUT_MS / 1000)) * 100}%` }}
          />
        </div>
      )}

      <ActionPanel
        validActions={validActionStrings}
        callAmount={callAmount}
        minRaise={minRaise}
        maxRaise={maxRaise}
        playerChips={me?.chips || 0}
        pot={totalPot}
        onAction={sendAction}
        isMyTurn={isMyTurn}
      />

      {canBorrow && (
        <button
          className="borrow-chips-btn"
          onClick={handleBorrow}
          type="button"
        >
          💸 筹码用完啦，借入 {(roomState?.initialChips ?? room?.initialChips ?? 0).toLocaleString()}
        </button>
      )}

      {handResult && !gameResult && (
        <HandResultOverlay
          result={handResult}
          players={sourcePlayers}
        />
      )}

      {gameResult && (
        <GameResult
          results={gameResult}
          onBackToLobby={() => {
            if (socket) socket.emit('leave-room');
            onLeave();
          }}
        />
      )}

      {errorMsg && (
        <div className="game-toast" role="alert">{errorMsg}</div>
      )}
    </div>
  );
}

/* ────────── 单手结算浮层 ────────── */
function HandResultOverlay({ result, players }) {
  if (!result) return null;
  const { winners = [], hands = {}, distributions = {}, foldWin } = result;
  const winnerSet = new Set(winners.map(String));
  const winnerPlayers = players.filter((p) => winnerSet.has(String(p.id)));

  return (
    <div className="hand-result">
      <div className="hand-result__panel">
        <div className="hand-result__title">
          {foldWin ? '弃牌获胜' : '本手结算'}
        </div>
        <div className="hand-result__winners">
          {winnerPlayers.map((p) => {
            const av = getAvatarById(p.avatar);
            const hand = hands?.[p.id];
            const handName = hand?.name || hand?.descr || hand;
            const win = distributions?.[p.id] || 0;
            return (
              <div key={p.id} className="hand-result__winner">
                <div className="hand-result__avatar">{av?.emoji || '😀'}</div>
                <div className="hand-result__meta">
                  <div className="hand-result__name">{p.name}</div>
                  {!foldWin && handName && (
                    <div className="hand-result__hand-name">
                      {translateHandName(typeof handName === 'string' ? handName : handName?.name || '')}
                    </div>
                  )}
                </div>
                <div className="hand-result__win">+{Number(win).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
