// Room.js - 房间管理
import Player from './Player.js';
import Game from './Game.js';

export default class Room {
  constructor(id, hostSocketId, initialChips, smallBlind) {
    this.id = id;
    this.hostId = hostSocketId;
    this.players = []; // Player 实例数组（按座位顺序）
    this.initialChips = initialChips;
    this.smallBlind = smallBlind || Math.max(1, Math.floor(initialChips / 100));
    this.status = 'waiting'; // 'waiting' | 'playing' | 'ended'
    this.handCount = 0;
    this.game = null;
    this.maxPlayers = 10;
    this.disconnectTimers = new Map(); // socketId -> timeout
  }

  static generateId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // 加入房间
  addPlayer(socketId, name, avatar) {
    if (this.players.length >= this.maxPlayers) {
      throw new Error('房间已满');
    }
    if (this.status === 'playing') {
      throw new Error('游戏进行中，无法加入');
    }
    if (this.players.some(p => p.socketId === socketId)) {
      throw new Error('已在房间中');
    }
    const player = new Player({
      id: socketId, // 用 socketId 作为玩家 id
      socketId,
      name,
      avatar,
      chips: this.initialChips
    });
    this.players.push(player);
    return player;
  }

  // 通过 socketId 找玩家
  getPlayer(socketId) {
    return this.players.find(p => p.socketId === socketId);
  }

  // 移除玩家
  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) return null;
    const player = this.players[idx];

    if (this.status === 'playing' && this.game && this.game.phase !== 'WAITING') {
      // 游戏中：标记弃牌而不是直接移除
      if (player.status === 'active') {
        player.fold();
      }
      // 仍然移除座位
    }
    this.players.splice(idx, 1);

    // 房主转移
    if (this.hostId === socketId && this.players.length > 0) {
      this.hostId = this.players[0].socketId;
    }

    return player;
  }

  // 房主开始游戏
  startGame() {
    if (this.players.length < 2) {
      throw new Error('至少需要 2 名玩家');
    }
    this.status = 'playing';
    if (!this.game) {
      this.game = new Game(this.players, this.initialChips, this.smallBlind);
    }
    this.game.startHand();
    this.handCount += 1;
  }

  // 开始下一手（在SHOWDOWN后）
  startNextHand() {
    if (!this.game) throw new Error('游戏尚未开始');
    // 移除筹码为 0 的玩家不会被踢，但其 status = 'waiting'
    const playable = this.players.filter(p => p.chips > 0);
    if (playable.length < 2) {
      this.status = 'ended';
      return false;
    }
    this.game.startHand();
    this.handCount += 1;
    return true;
  }

  // 结束对局，结算盈亏
  endGame() {
    const results = this.players.map(p => ({
      socketId: p.socketId,
      name: p.name,
      avatar: p.avatar,
      initialChips: this.initialChips,
      finalChips: p.chips,
      borrowed: p.borrowed,
      profit: p.chips - this.initialChips - p.borrowed,
      handsPlayed: p.handsPlayed,
      handsWon: p.handsWon,
      totalWinnings: p.totalWinnings,
    }));
    this.status = 'ended';
    return results;
  }

  // 借钱：仅当 chips=0 时允许，借入 initialChips 数额
  borrowChips(socketId) {
    const player = this.getPlayer(socketId);
    if (!player) throw new Error('玩家不存在');
    if (player.chips > 0) throw new Error('仍有筹码，无法借钱');
    player.chips += this.initialChips;
    player.borrowed += this.initialChips;
    // 借钱后立即设为 active，确保下一手能参与
    player.status = 'active';
    return player;
  }

  // 房间公开信息
  getPublicState() {
    return {
      id: this.id,
      hostId: this.hostId,
      status: this.status,
      initialChips: this.initialChips,
      smallBlind: this.smallBlind,
      bigBlind: this.smallBlind * 2,
      handCount: this.handCount,
      maxPlayers: this.maxPlayers,
      players: this.players.map(p => ({
        id: p.id,
        socketId: p.socketId,
        name: p.name,
        avatar: p.avatar,
        chips: p.chips,
        status: p.status,
        connected: p.connected,
        borrowed: p.borrowed,
        isHost: p.socketId === this.hostId
      }))
    };
  }
}
