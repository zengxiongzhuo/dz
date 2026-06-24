import React, { useEffect, useMemo, useState } from 'react';
import AvatarPicker from '../components/AvatarPicker.jsx';
import { getAvatarById, getRandomName } from '../data/avatars.js';

const CHIP_PRESETS = [1000, 2000, 5000, 10000];

export default function Lobby({
  socket,
  player,
  setPlayer,
  onEnterRoom,
  pendingRoom,
  setPendingRoom,
}) {
  // 阶段：profile -> action -> waiting
  const [stage, setStage] = useState(player?.confirmed ? 'action' : 'profile');

  // profile stage state
  const [avatarId, setAvatarId] = useState(player?.avatar ?? 1);
  const [nickname, setNickname] = useState(player?.name ?? '');

  // action stage state
  const [tab, setTab] = useState('create'); // 'create' | 'join'
  const [chipChoice, setChipChoice] = useState(2000);
  const [customChips, setCustomChips] = useState('');
  const [smallBlind, setSmallBlind] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // waiting room state
  const [room, setRoom] = useState(pendingRoom || null);
  const [copied, setCopied] = useState(false);

  // 监听 socket 房间事件
  useEffect(() => {
    if (!socket) return;
    const handleRoomCreated = (data) => {
      console.log('[lobby] room-created', data);
      setRoom(data);
      setPendingRoom?.(data);
      setStage('waiting');
    };
    const handleRoomJoined = (data) => {
      console.log('[lobby] room-joined', data);
      // 服务端的 room-joined 不带顶层 roomId，需要从 roomInfo.id 提取
      const enriched = {
        ...data,
        roomId: data?.roomId || data?.roomInfo?.id,
        hostId: data?.hostId || data?.roomInfo?.hostId,
        initialChips: data?.roomInfo?.initialChips,
        smallBlind: data?.roomInfo?.smallBlind,
        bigBlind: data?.roomInfo?.bigBlind,
      };
      setRoom((prev) => ({ ...(prev || {}), ...enriched }));
      setPendingRoom?.((prev) => ({ ...(prev || {}), ...enriched }));
      setStage('waiting');
    };
    const handleRoomUpdate = (data) => {
      console.log('[lobby] room-update', data);
      // 服务端的 room-update 携带 id 字段，做一层兼容
      const enriched = {
        ...data,
        roomId: data?.roomId || data?.id,
      };
      setRoom((prev) => ({ ...(prev || {}), ...enriched }));
      setPendingRoom?.((prev) => ({ ...(prev || {}), ...enriched }));
    };
    const handleGameStarted = (data) => {
      console.log('[lobby] game-started', data);
      onEnterRoom?.(room?.roomId || data?.roomId, data);
    };
    const handleError = (data) => {
      console.warn('[lobby] error', data);
      setErrorMsg(data?.message || '操作失败，请重试');
    };

    socket.on('room-created', handleRoomCreated);
    socket.on('room-joined', handleRoomJoined);
    socket.on('room-update', handleRoomUpdate);
    socket.on('player-joined', handleRoomUpdate);
    socket.on('player-left', handleRoomUpdate);
    socket.on('game-started', handleGameStarted);
    socket.on('error-message', handleError);

    return () => {
      socket.off('room-created', handleRoomCreated);
      socket.off('room-joined', handleRoomJoined);
      socket.off('room-update', handleRoomUpdate);
      socket.off('player-joined', handleRoomUpdate);
      socket.off('player-left', handleRoomUpdate);
      socket.off('game-started', handleGameStarted);
      socket.off('error-message', handleError);
    };
  }, [socket, onEnterRoom, room?.roomId, setPendingRoom]);

  const currentAvatar = useMemo(() => getAvatarById(avatarId), [avatarId]);
  const finalChips = useMemo(() => {
    if (chipChoice === 'custom') {
      const n = parseInt(customChips, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    return chipChoice;
  }, [chipChoice, customChips]);

  // ─── handlers ───
  const handleConfirmProfile = () => {
    const trimmed = nickname.trim() || getRandomName();
    const next = { name: trimmed, avatar: avatarId, confirmed: true };
    setPlayer?.(next);
    setNickname(trimmed);
    setStage('action');
  };

  const handleRandomName = () => {
    setNickname(getRandomName());
  };

  const handleCreateRoom = () => {
    setErrorMsg('');
    if (!finalChips || finalChips < 100) {
      setErrorMsg('初始筹码至少 100');
      return;
    }
    const blindVal = smallBlind ? parseInt(smallBlind, 10) : 0;
    if (smallBlind && (!Number.isFinite(blindVal) || blindVal < 1)) {
      setErrorMsg('小盲注金额至少为 1');
      return;
    }
    const payload = {
      playerName: nickname,
      avatar: avatarId,
      initialChips: finalChips,
      ...(blindVal > 0 ? { smallBlind: blindVal } : {}),
    };
    console.log('[lobby] emit create-room', payload);
    socket?.emit('create-room', payload);
  };

  const handleJoinRoom = () => {
    setErrorMsg('');
    const id = joinRoomId.trim().toUpperCase();
    if (id.length !== 6) {
      setErrorMsg('房间号需为 6 位');
      return;
    }
    const payload = { roomId: id, playerName: nickname, avatar: avatarId };
    console.log('[lobby] emit join-room', payload);
    socket?.emit('join-room', payload);
  };

  const handleStartGame = () => {
    console.log('[lobby] emit start-game');
    socket?.emit('start-game', {});
  };

  const handleCopy = async () => {
    if (!room?.roomId) return;
    try {
      await navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleLeaveRoom = () => {
    socket?.emit('leave-room', {});
    setRoom(null);
    setPendingRoom?.(null);
    setStage('action');
  };

  // ─── render ───
  return (
    <div className="lobby-shell">
      <div className="lobby-bg" aria-hidden="true">
        <span className="bg-suit suit-spade">♠</span>
        <span className="bg-suit suit-heart">♥</span>
        <span className="bg-suit suit-diamond">♦</span>
        <span className="bg-suit suit-club">♣</span>
      </div>

      <header className="lobby-brand">
        <div className="brand-rule" />
        <h1 className="brand-title">朋友局德州</h1>
        <p className="brand-sub">FRIENDS · TEXAS HOLD&apos;EM · NIGHT TABLE</p>
        <div className="brand-rule" />
      </header>

      <main className="lobby-card">
        {stage === 'profile' && (
          <ProfileStage
            avatarId={avatarId}
            setAvatarId={setAvatarId}
            nickname={nickname}
            setNickname={setNickname}
            onRandom={handleRandomName}
            onConfirm={handleConfirmProfile}
          />
        )}

        {stage === 'action' && (
          <ActionStage
            avatar={currentAvatar}
            nickname={nickname}
            tab={tab}
            setTab={setTab}
            chipChoice={chipChoice}
            setChipChoice={setChipChoice}
            customChips={customChips}
            setCustomChips={setCustomChips}
            smallBlind={smallBlind}
            setSmallBlind={setSmallBlind}
            joinRoomId={joinRoomId}
            setJoinRoomId={setJoinRoomId}
            onCreate={handleCreateRoom}
            onJoin={handleJoinRoom}
            onEditProfile={() => setStage('profile')}
            errorMsg={errorMsg}
          />
        )}

        {stage === 'waiting' && room && (
          <WaitingStage
            room={room}
            socket={socket}
            copied={copied}
            onCopy={handleCopy}
            onStart={handleStartGame}
            onLeave={handleLeaveRoom}
          />
        )}
      </main>

      <footer className="lobby-footer">
        <span>· 仅限好友 ·</span>
      </footer>
    </div>
  );
}

/* ────────── Profile Stage ────────── */
function ProfileStage({
  avatarId,
  setAvatarId,
  nickname,
  setNickname,
  onRandom,
  onConfirm,
}) {
  return (
    <section className="stage stage-profile">
      <StageHeader index="01" label="入座准备" hint="选择你的桌面身份" />

      <div className="field">
        <label className="field-label">头像</label>
        <AvatarPicker value={avatarId} onChange={setAvatarId} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="nick">
          昵称
        </label>
        <div className="input-row">
          <input
            id="nick"
            className="input"
            type="text"
            placeholder="给自己取个响亮的名号"
            value={nickname}
            maxLength={16}
            onChange={(e) => setNickname(e.target.value)}
          />
          <button type="button" className="btn btn-ghost" onClick={onRandom}>
            随机
          </button>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={onConfirm}
      >
        确认 &nbsp;→
      </button>
    </section>
  );
}

/* ────────── Action Stage ────────── */
function ActionStage({
  avatar,
  nickname,
  tab,
  setTab,
  chipChoice,
  setChipChoice,
  customChips,
  setCustomChips,
  smallBlind,
  setSmallBlind,
  joinRoomId,
  setJoinRoomId,
  onCreate,
  onJoin,
  onEditProfile,
  errorMsg,
}) {
  return (
    <section className="stage stage-action">
      <StageHeader index="02" label="入场方式" hint="开桌或加入" />

      <button type="button" className="player-chip" onClick={onEditProfile}>
        <span className="chip-avatar">{avatar.emoji}</span>
        <span className="chip-name">{nickname}</span>
        <span className="chip-edit">编辑</span>
      </button>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'create' ? 'is-active' : ''}`}
          onClick={() => setTab('create')}
        >
          创建房间
        </button>
        <button
          type="button"
          className={`tab ${tab === 'join' ? 'is-active' : ''}`}
          onClick={() => setTab('join')}
        >
          加入房间
        </button>
      </div>

      {tab === 'create' && (
        <div className="tab-panel">
          <div className="field">
            <label className="field-label">初始筹码</label>
            <div className="chip-options">
              {CHIP_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`chip-pill ${chipChoice === n ? 'is-active' : ''}`}
                  onClick={() => setChipChoice(n)}
                >
                  {n.toLocaleString()}
                </button>
              ))}
              <button
                type="button"
                className={`chip-pill ${chipChoice === 'custom' ? 'is-active' : ''}`}
                onClick={() => setChipChoice('custom')}
              >
                自定义
              </button>
            </div>
            {chipChoice === 'custom' && (
              <input
                type="number"
                className="input"
                placeholder="输入金额（≥100）"
                value={customChips}
                onChange={(e) => setCustomChips(e.target.value)}
                style={{ marginTop: 12 }}
              />
            )}
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label className="field-label">小盲注 <span style={{ opacity: 0.5, fontSize: 11 }}>（留空自动 = 筹码/100）</span></label>
            <input
              type="number"
              className="input"
              placeholder={`默认 ${Math.max(1, Math.floor((chipChoice === 'custom' ? (parseInt(customChips, 10) || 0) : chipChoice) / 100))}`}
              value={smallBlind}
              min={1}
              onChange={(e) => setSmallBlind(e.target.value)}
            />
          </div>

          {errorMsg && <p className="error-text">{errorMsg}</p>}

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={onCreate}
          >
            发牌开桌
          </button>
        </div>
      )}

      {tab === 'join' && (
        <div className="tab-panel">
          <div className="field">
            <label className="field-label">房间号</label>
            <input
              type="text"
              className="input input-room"
              placeholder="输入 6 位房间号"
              value={joinRoomId}
              maxLength={6}
              onChange={(e) =>
                setJoinRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }
            />
          </div>

          {errorMsg && <p className="error-text">{errorMsg}</p>}

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={onJoin}
          >
            落座
          </button>
        </div>
      )}
    </section>
  );
}

/* ────────── Waiting Stage ────────── */
function WaitingStage({ room, socket, copied, onCopy, onStart, onLeave }) {
  const players = room.players || [];
  const hostId = room.hostId || room.host || players[0]?.id;
  const myId = socket?.id;
  const isHost = myId && hostId && myId === hostId;
  const canStart = players.length >= 2;
  const smallBlind = room.smallBlind ?? 10;
  const bigBlind = room.bigBlind ?? 20;

  return (
    <section className="stage stage-waiting">
      <StageHeader index="03" label="等待入席" hint="召集牌友中" />

      <div className="room-code">
        <span className="room-code-label">ROOM</span>
        <div className="room-code-row">
          <span className="room-code-value">{room.roomId}</span>
          <button
            type="button"
            className="btn-copy"
            onClick={onCopy}
            aria-label="复制房间号"
          >
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>

      <div className="meta-row">
        <div className="meta-cell">
          <span className="meta-key">小盲</span>
          <span className="meta-val">{smallBlind}</span>
        </div>
        <div className="meta-divider" />
        <div className="meta-cell">
          <span className="meta-key">大盲</span>
          <span className="meta-val">{bigBlind}</span>
        </div>
        <div className="meta-divider" />
        <div className="meta-cell">
          <span className="meta-key">人数</span>
          <span className="meta-val">{players.length}/9</span>
        </div>
      </div>

      <div className="players-list">
        <div className="players-list-head">
          <span>已入座</span>
          <span className="players-count">{players.length}</span>
        </div>
        <ul className="players-ul">
          {players.map((p, i) => {
            const av = getAvatarById(p.avatar);
            const isP = p.id === hostId;
            return (
              <li key={p.id || i} className="player-row">
                <span className="player-emoji">{av.emoji}</span>
                <span className="player-name">{p.name || p.playerName}</span>
                {isP && <span className="badge-host">房主</span>}
                {p.id === myId && <span className="badge-me">我</span>}
              </li>
            );
          })}
          {players.length === 0 && (
            <li className="player-row player-row-empty">等待玩家加入…</li>
          )}
        </ul>
      </div>

      {isHost ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!canStart}
          onClick={onStart}
        >
          {canStart ? '开始游戏' : '至少 2 人方可开始'}
        </button>
      ) : (
        <div className="waiting-hint">等待房主开始游戏…</div>
      )}

      <button type="button" className="btn btn-link" onClick={onLeave}>
        离开房间
      </button>
    </section>
  );
}

/* ────────── Stage Header ────────── */
function StageHeader({ index, label, hint }) {
  return (
    <div className="stage-head">
      <div className="stage-index">{index}</div>
      <div className="stage-meta">
        <div className="stage-label">{label}</div>
        <div className="stage-hint">{hint}</div>
      </div>
      <div className="stage-ornament" aria-hidden="true">
        ◆
      </div>
    </div>
  );
}
