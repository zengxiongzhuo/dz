// handlers.js - Socket.IO 事件处理
import Room from '../game/Room.js';
import { Phase } from '../game/Game.js';

const rooms = new Map(); // roomId -> Room
const playerRoomMap = new Map(); // socketId -> roomId

const HAND_RESULT_DELAY_MS = 4000;
const RECONNECT_GRACE_MS = 30000;

export function registerHandlers(io) {
  // ---------- 帮助函数 ----------
  function broadcastRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    io.to(roomId).emit('room-update', room.getPublicState());
  }

  function broadcastGameState(roomId) {
    const room = rooms.get(roomId);
    if (!room || !room.game) return;
    // 公共视图（不含底牌）
    const publicState = room.game.getState(null);
    io.to(roomId).emit('game-state', {
      roomState: room.getPublicState(),
      gameState: publicState
    });
    // 每个玩家单独发送其底牌视图
    for (const p of room.players) {
      const personal = room.game.getState(p.id);
      io.to(p.socketId).emit('your-state', {
        playerId: p.id,
        gameState: personal
      });
    }
  }

  function emitActionRequired(roomId) {
    const room = rooms.get(roomId);
    if (!room || !room.game) return;
    const game = room.game;
    if (game.phase === Phase.WAITING || game.phase === Phase.SHOWDOWN) return;
    const idx = game.currentPlayerIndex;
    if (idx < 0) return;
    const player = game.players[idx];
    const validActions = game.getValidActions(player.id);
    io.to(player.socketId).emit('action-required', {
      playerId: player.id,
      validActions,
      currentBet: game.currentBet,
      minRaise: game.minRaise,
      yourBet: player.currentBet,
      yourChips: player.chips
    });
  }

  function emitHoleCards(roomId) {
    const room = rooms.get(roomId);
    if (!room || !room.game) return;
    for (const p of room.players) {
      if (p.holeCards && p.holeCards.length === 2) {
        io.to(p.socketId).emit('your-cards', {
          holeCards: p.holeCards
        });
      }
    }
  }

  function scheduleNextHand(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    setTimeout(() => {
      const r = rooms.get(roomId);
      if (!r || r.status !== 'playing') return;
      try {
        const ok = r.startNextHand();
        if (!ok) {
          io.to(roomId).emit('game-paused', { reason: '可游戏玩家不足 2 人' });
          broadcastRoom(roomId);
          return;
        }
        emitHoleCards(roomId);
        broadcastGameState(roomId);
        emitActionRequired(roomId);
      } catch (err) {
        io.to(roomId).emit('error-message', { message: err.message });
      }
    }, HAND_RESULT_DELAY_MS);
  }

  function handleAfterAction(roomId) {
    const room = rooms.get(roomId);
    if (!room || !room.game) return;
    broadcastGameState(roomId);

    if (room.game.phase === Phase.SHOWDOWN) {
      io.to(roomId).emit('hand-result', room.game.handResult);
      scheduleNextHand(roomId);
    } else {
      emitActionRequired(roomId);
    }
  }

  // ---------- 连接 ----------
  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // 创建房间
    socket.on('create-room', ({ playerName, avatar, initialChips, smallBlind }, callback) => {
      try {
        const chips = Math.max(100, parseInt(initialChips, 10) || 1000);
        const blind = Math.max(1, parseInt(smallBlind, 10) || Math.floor(chips / 100));
        let roomId;
        do { roomId = Room.generateId(); } while (rooms.has(roomId));

        const room = new Room(roomId, socket.id, chips, blind);
        room.addPlayer(socket.id, playerName || '玩家', avatar || '');
        rooms.set(roomId, room);
        playerRoomMap.set(socket.id, roomId);

        socket.join(roomId);

        socket.emit('room-created', { roomId });
        io.to(roomId).emit('room-joined', {
          players: room.getPublicState().players,
          roomInfo: room.getPublicState()
        });
        if (typeof callback === 'function') callback({ ok: true, roomId });
      } catch (err) {
        socket.emit('error-message', { message: err.message });
        if (typeof callback === 'function') callback({ ok: false, error: err.message });
      }
    });

    // 加入房间
    socket.on('join-room', ({ roomId, playerName, avatar }, callback) => {
      try {
        const room = rooms.get(roomId);
        if (!room) throw new Error('房间不存在');
        if (room.status !== 'waiting') throw new Error('游戏已开始或已结束');
        if (room.players.length >= room.maxPlayers) throw new Error('房间已满');

        room.addPlayer(socket.id, playerName || '玩家', avatar || '');
        playerRoomMap.set(socket.id, roomId);
        socket.join(roomId);

        io.to(roomId).emit('room-joined', {
          players: room.getPublicState().players,
          roomInfo: room.getPublicState()
        });
        if (typeof callback === 'function') callback({ ok: true, roomId });
      } catch (err) {
        socket.emit('error-message', { message: err.message });
        if (typeof callback === 'function') callback({ ok: false, error: err.message });
      }
    });

    // 房主开始游戏
    socket.on('start-game', () => {
      try {
        const roomId = playerRoomMap.get(socket.id);
        const room = rooms.get(roomId);
        if (!room) throw new Error('房间不存在');
        if (room.hostId !== socket.id) throw new Error('只有房主能开始游戏');
        if (room.players.length < 2) throw new Error('至少需要 2 名玩家');

        room.startGame();
        // 通知所有客户端游戏已开始（Lobby 监听此事件切换页面）
        io.to(roomId).emit('game-started', { roomId });
        emitHoleCards(roomId);
        broadcastGameState(roomId);
        emitActionRequired(roomId);
      } catch (err) {
        socket.emit('error-message', { message: err.message });
      }
    });

    // 玩家行动
    socket.on('player-action', ({ action, amount }) => {
      try {
        const roomId = playerRoomMap.get(socket.id);
        const room = rooms.get(roomId);
        if (!room || !room.game) throw new Error('游戏未开始');

        const player = room.getPlayer(socket.id);
        if (!player) throw new Error('玩家不存在');

        room.game.handleAction(player.id, action, amount);
        handleAfterAction(roomId);
      } catch (err) {
        socket.emit('error-message', { message: err.message });
      }
    });

    // 借钱
    socket.on('borrow-chips', () => {
      try {
        const roomId = playerRoomMap.get(socket.id);
        const room = rooms.get(roomId);
        if (!room) throw new Error('房间不存在');
        room.borrowChips(socket.id);
        broadcastRoom(roomId);
        if (room.game) {
          broadcastGameState(roomId);
          // 借钱后检查：如果游戏处于 WAITING 且现在有 >=2 人有筹码，自动开始下一手
          if (room.game.phase === Phase.WAITING) {
            const playable = room.players.filter(p => p.chips > 0).length;
            if (playable >= 2) {
              room.status = 'playing';
              try {
                room.game.startHand();
                room.handCount += 1;
                emitHoleCards(roomId);
                broadcastGameState(roomId);
                emitActionRequired(roomId);
              } catch (e) {
                io.to(roomId).emit('error-message', { message: e.message });
              }
            }
          }
        }
      } catch (err) {
        socket.emit('error-message', { message: err.message });
      }
    });

    // 房主结束对局
    socket.on('end-game', () => {
      try {
        const roomId = playerRoomMap.get(socket.id);
        const room = rooms.get(roomId);
        if (!room) throw new Error('房间不存在');
        if (room.hostId !== socket.id) throw new Error('只有房主能结束对局');
        if (room.game) {
          const phase = room.game.phase;
          if (phase !== Phase.WAITING && phase !== Phase.SHOWDOWN) {
            throw new Error('当前正在牌局中，请等本手结束');
          }
        }
        const results = room.endGame();
        io.to(roomId).emit('game-ended', { results });
      } catch (err) {
        socket.emit('error-message', { message: err.message });
      }
    });

    // 离开房间
    socket.on('leave-room', () => {
      handleLeave(socket, false);
    });

    // 重连：尝试恢复房间状态
    socket.on('rejoin-room', ({ roomId, oldSocketId }) => {
      try {
        const room = rooms.get(roomId);
        if (!room) throw new Error('房间不存在');
        const player = room.players.find(p => p.socketId === oldSocketId);
        if (!player) throw new Error('未找到原玩家');

        // 取消断线计时
        const timer = room.disconnectTimers.get(oldSocketId);
        if (timer) {
          clearTimeout(timer);
          room.disconnectTimers.delete(oldSocketId);
        }

        // 更新 socketId
        player.socketId = socket.id;
        player.id = socket.id; // 同步 id
        player.connected = true;
        player.disconnectedAt = null;

        if (room.hostId === oldSocketId) room.hostId = socket.id;
        playerRoomMap.set(socket.id, roomId);
        socket.join(roomId);

        broadcastRoom(roomId);
        if (room.game) {
          broadcastGameState(roomId);
          if (room.game.currentPlayerIndex >= 0) {
            const cur = room.game.players[room.game.currentPlayerIndex];
            if (cur && cur.socketId === socket.id) {
              emitActionRequired(roomId);
            }
          }
        }
      } catch (err) {
        socket.emit('error-message', { message: err.message });
      }
    });

    // 断线
    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      const roomId = playerRoomMap.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) {
        playerRoomMap.delete(socket.id);
        return;
      }
      const player = room.getPlayer(socket.id);
      if (!player) return;

      if (room.status === 'playing') {
        // 标记断线，保留座位
        player.connected = false;
        player.disconnectedAt = Date.now();
        broadcastRoom(roomId);
        // 30 秒后未重连则视为弃牌并移除
        const timer = setTimeout(() => {
          const r = rooms.get(roomId);
          if (!r) return;
          const p = r.players.find(x => x.socketId === socket.id);
          if (!p || p.connected) return;
          // 自动弃牌
          if (r.game && p.status === 'active') {
            try {
              if (r.game.currentPlayerIndex === r.players.indexOf(p)) {
                r.game.handleAction(p.id, 'fold');
                handleAfterAction(roomId);
              } else {
                p.fold();
              }
            } catch (e) { /* ignore */ }
          }
          r.removePlayer(socket.id);
          broadcastRoom(roomId);
          if (r.players.length === 0) {
            rooms.delete(roomId);
          }
        }, RECONNECT_GRACE_MS);
        room.disconnectTimers.set(socket.id, timer);
      } else {
        // 等待中：直接移除
        room.removePlayer(socket.id);
        playerRoomMap.delete(socket.id);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          broadcastRoom(roomId);
        }
      }
    });
  });

  function handleLeave(socket, silent) {
    const roomId = playerRoomMap.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    socket.leave(roomId);
    playerRoomMap.delete(socket.id);

    // 游戏中且轮到其行动 → 自动弃牌
    if (room.game && room.status === 'playing') {
      const player = room.getPlayer(socket.id);
      if (player && player.status === 'active') {
        const idx = room.players.indexOf(player);
        if (idx === room.game.currentPlayerIndex) {
          try {
            room.game.handleAction(player.id, 'fold');
            handleAfterAction(roomId);
          } catch (e) { /* ignore */ }
        } else {
          player.fold();
        }
      }
    }

    room.removePlayer(socket.id);
    if (room.players.length === 0) {
      rooms.delete(roomId);
    } else {
      broadcastRoom(roomId);
    }
    if (!silent) {
      socket.emit('left-room');
    }
  }

  return { rooms, playerRoomMap };
}
