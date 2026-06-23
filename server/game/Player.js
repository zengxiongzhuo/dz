// Player.js - 玩家模型
export default class Player {
  constructor({ id, socketId, name, avatar, chips }) {
    this.id = id;
    this.socketId = socketId;
    this.name = name;
    this.avatar = avatar;
    this.chips = chips;
    this.holeCards = [];
    this.currentBet = 0; // 当前轮下注
    this.totalBet = 0;   // 本手累计下注
    this.status = 'waiting'; // 'active' | 'folded' | 'allIn' | 'waiting'
    this.borrowed = 0; // 累计借款
    this.connected = true;
    this.disconnectedAt = null;
  }

  // 下注（不超过现有筹码）；amount 为想下注的额度
  placeBet(amount) {
    const bet = Math.min(amount, this.chips);
    this.chips -= bet;
    this.currentBet += bet;
    this.totalBet += bet;
    if (this.chips === 0) {
      this.status = 'allIn';
    }
    return bet;
  }

  fold() {
    this.status = 'folded';
  }

  // 进入新一手时重置
  resetForNewHand() {
    this.holeCards = [];
    this.currentBet = 0;
    this.totalBet = 0;
    if (this.chips > 0) {
      this.status = 'active';
    } else {
      this.status = 'waiting';
    }
  }

  // 进入下一阶段（翻牌等）时重置当前轮下注
  resetForNewRound() {
    this.currentBet = 0;
  }
}
