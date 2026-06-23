import React, { useEffect, useRef, useState } from 'react';
import Lobby from './pages/Lobby.jsx';
import GameRoom from './pages/GameRoom.jsx';
import useSocket from './hooks/useSocket.js';

// 路由：通过 state 在 Lobby / GameRoom 之间切换
export default function App() {
  const { socket, connected } = useSocket();

  const [page, setPage] = useState('lobby');
  // 玩家信息：{ name, avatar, confirmed }
  const [player, setPlayer] = useState(null);
  // 进入 GameRoom 时携带的房间快照
  const [roomState, setRoomState] = useState(null);
  // Lobby 内部缓存的等待室房间数据（创建/加入后服务端返回）
  const [pendingRoom, setPendingRoom] = useState(null);

  // 缓存"开始游戏"瞬间到 GameRoom 挂载之间到达的事件
  // 这些事件在 GameRoom 挂载之前就已经被服务端 emit 了
  // App 在最顶层一直监听并把最近一次值缓存起来交给 GameRoom 作为初始 state
  const initialEventsRef = useRef({});

  useEffect(() => {
    if (!socket) return;

    const onGameState = (data) => {
      initialEventsRef.current.gameState = data;
      // 第一次收到 game-state 时如果还在 lobby，则切换到 room
      setPage((prev) => {
        if (prev === 'lobby') {
          const rid = data?.roomState?.id;
          setRoomState((prevR) => ({
            ...(prevR || {}),
            roomId: rid || prevR?.roomId,
            roomInfo: data?.roomState || prevR?.roomInfo,
          }));
          return 'room';
        }
        return prev;
      });
    };
    const onYourCards = (d) => { initialEventsRef.current.yourCards = d; };
    const onYourState = (d) => { initialEventsRef.current.yourState = d; };
    const onActionRequired = (d) => { initialEventsRef.current.actionRequired = d; };

    socket.on('game-state', onGameState);
    socket.on('your-cards', onYourCards);
    socket.on('your-state', onYourState);
    socket.on('action-required', onActionRequired);

    return () => {
      socket.off('game-state', onGameState);
      socket.off('your-cards', onYourCards);
      socket.off('your-state', onYourState);
      socket.off('action-required', onActionRequired);
    };
  }, [socket]);

  const goToRoom = (roomId, gameSnapshot) => {
    setRoomState({ roomId, ...(gameSnapshot || {}) });
    setPage('room');
  };

  const goToLobby = () => {
    setRoomState(null);
    setPendingRoom(null);
    initialEventsRef.current = {};
    setPage('lobby');
  };

  return (
    <div className="app-root">
      {page === 'lobby' && (
        <Lobby
          socket={socket}
          connected={connected}
          player={player}
          setPlayer={setPlayer}
          pendingRoom={pendingRoom}
          setPendingRoom={setPendingRoom}
          onEnterRoom={goToRoom}
        />
      )}
      {page === 'room' && (
        <GameRoom
          socket={socket}
          player={player}
          room={roomState || pendingRoom}
          initialEvents={initialEventsRef.current}
          onLeave={goToLobby}
        />
      )}
    </div>
  );
}
