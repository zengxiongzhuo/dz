// Game.js - 德州扑克核心状态机
import Deck from './Deck.js';
import HandEvaluator from './HandEvaluator.js';

export const Phase = {
  WAITING: 'WAITING',
  PRE_FLOP: 'PRE_FLOP',
  FLOP: 'FLOP',
  TURN: 'TURN',
  RIVER: 'RIVER',
  SHOWDOWN: 'SHOWDOWN'
};

export default class Game {
  constructor(players, initialChips) {
    this.players = players; // 按座位顺序
    this.initialChips = initialChips;
    this.smallBlind = Math.max(1, Math.floor(initialChips / 100));
    this.bigBlind = this.smallBlind * 2;

    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;          // 总下注汇总
    this.pots = [];        // 边池 [{ amount, eligible: [playerId] }]
    this.phase = Phase.WAITING;
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.lastRaiseIndex = -1;
    this.dealerIndex = -1;
    this.smallBlindIndex = -1;
    this.bigBlindIndex = -1;
    this.currentPlayerIndex = -1;
    this.lastAction = null; // { playerId, action, amount }
    this.handResult = null;
  }

  // ---------- 工具 ----------
  // 找到下一个 chips>0 的玩家索引（不考虑 folded/allIn 状态，仅按筹码）
  nextSeatWithChips(fromIndex) {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (fromIndex + i) % n;
      if (this.players[idx].chips > 0) return idx;
    }
    return -1;
  }

  // 找下一个还能行动（active）的玩家
  nextActingPlayer(fromIndex) {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (fromIndex + i) % n;
      if (this.players[idx].status === 'active') return idx;
    }
    return -1;
  }

  // 参与当前一手的玩家（不是 folded，且本手有发牌）
  inHandPlayers() {
    return this.players.filter(p => p.status !== 'folded' && p.holeCards.length === 2);
  }

  activePlayers() {
    return this.players.filter(p => p.status === 'active');
  }

  // ---------- 开始一手 ----------
  startHand() {
    // 1. 重置玩家
    this.players.forEach(p => p.resetForNewHand());

    // 2. 移动庄家按钮：选择下一个有筹码的玩家作为庄家
    this.dealerIndex = this.nextSeatWithChips(this.dealerIndex);
    if (this.dealerIndex === -1) {
      this.phase = Phase.WAITING;
      return;
    }

    // 3. 设置盲注位
    const playable = this.players.filter(p => p.chips > 0).length;
    if (playable < 2) {
      this.phase = Phase.WAITING;
      return;
    }

    if (playable === 2) {
      // 单挑：庄家 = 小盲，对手 = 大盲
      this.smallBlindIndex = this.dealerIndex;
      this.bigBlindIndex = this.nextSeatWithChips(this.dealerIndex);
    } else {
      this.smallBlindIndex = this.nextSeatWithChips(this.dealerIndex);
      this.bigBlindIndex = this.nextSeatWithChips(this.smallBlindIndex);
    }

    // 4. 新建并洗牌
    this.deck = new Deck();
    this.deck.shuffle();
    this.communityCards = [];
    this.pot = 0;
    this.pots = [];
    this.handResult = null;
    this.lastAction = null;

    // 5. 发底牌（每人2张）
    for (let r = 0; r < 2; r++) {
      for (const p of this.players) {
        if (p.chips > 0) {
          p.holeCards.push(...this.deck.deal(1));
        }
      }
    }

    // 6. 小盲大盲下注
    const sbPlayer = this.players[this.smallBlindIndex];
    const bbPlayer = this.players[this.bigBlindIndex];
    sbPlayer.placeBet(this.smallBlind);
    bbPlayer.placeBet(this.bigBlind);

    this.currentBet = this.bigBlind;
    this.minRaise = this.bigBlind;

    // 7. 设置阶段
    this.phase = Phase.PRE_FLOP;

    // 8. 当前玩家：单挑时庄家(小盲)先行动，否则大盲后第一个 active
    if (playable === 2) {
      this.currentPlayerIndex = this.smallBlindIndex; // 庄家=小盲
    } else {
      this.currentPlayerIndex = this.nextActingPlayer(this.bigBlindIndex);
    }
    // lastRaiseIndex：preflop 视大盲为最后一次"加注"
    this.lastRaiseIndex = this.bigBlindIndex;
    // 所有 active 玩家本轮都需要行动一次
    this.actionsPending = new Set(
      this.players.filter(p => p.status === 'active').map(p => p.id)
    );
  }

  // ---------- 玩家行动 ----------
  handleAction(playerId, action, amount = 0) {
    if (this.phase === Phase.WAITING || this.phase === Phase.SHOWDOWN) {
      throw new Error('当前不在下注阶段');
    }
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx === -1) throw new Error('玩家不存在');
    if (idx !== this.currentPlayerIndex) throw new Error('不是该玩家的回合');

    const player = this.players[idx];
    if (player.status !== 'active') throw new Error('玩家不可行动');

    const toCall = this.currentBet - player.currentBet;

    // 标记该玩家本轮已行动
    this.actionsPending.delete(player.id);

    switch (action) {
      case 'fold':
        player.fold();
        this.lastAction = { playerId, action: 'fold' };
        break;

      case 'check':
        if (toCall !== 0) throw new Error('不能 check，需要跟注');
        this.lastAction = { playerId, action: 'check' };
        break;

      case 'call': {
        if (toCall <= 0) throw new Error('无需跟注');
        const paid = player.placeBet(toCall);
        this.lastAction = { playerId, action: 'call', amount: paid };
        break;
      }

      case 'raise': {
        // amount = 加注后的总下注额度（targetTotal）
        const target = Number(amount);
        if (!Number.isFinite(target) || target <= this.currentBet) {
          throw new Error('加注金额必须高于当前下注');
        }
        const raiseDelta = target - this.currentBet;
        const need = target - player.currentBet;
        if (need > player.chips) {
          throw new Error('筹码不足以加注，请使用 allIn');
        }
        // 必须达到最小加注（除非是 all-in）
        if (raiseDelta < this.minRaise && need < player.chips) {
          throw new Error(`最小加注为 ${this.minRaise}`);
        }
        player.placeBet(need);
        this.currentBet = player.currentBet;
        this.minRaise = Math.max(this.minRaise, raiseDelta);
        this.lastRaiseIndex = idx;
        this.lastAction = { playerId, action: 'raise', amount: this.currentBet };
        // 加注后，所有其他 active 玩家需要重新行动
        this.players.forEach(p => {
          if (p.id !== player.id && p.status === 'active') {
            this.actionsPending.add(p.id);
          }
        });
        break;
      }

      case 'allIn': {
        const allInAmount = player.chips;
        if (allInAmount <= 0) throw new Error('没有筹码');
        const newTotalBet = player.currentBet + allInAmount;
        player.placeBet(allInAmount);
        // 是否构成有效加注
        if (newTotalBet > this.currentBet) {
          const raiseDelta = newTotalBet - this.currentBet;
          if (raiseDelta >= this.minRaise) {
            // 完整加注，重置 lastRaiseIndex
            this.lastRaiseIndex = idx;
            this.minRaise = raiseDelta;
            // 完整加注后其他 active 玩家需重新行动
            this.players.forEach(p => {
              if (p.id !== player.id && p.status === 'active') {
                this.actionsPending.add(p.id);
              }
            });
          } else {
            // 不足最小加注的 all-in：仍需让其他玩家面对新 currentBet
            this.players.forEach(p => {
              if (p.id !== player.id && p.status === 'active' && p.currentBet < newTotalBet) {
                this.actionsPending.add(p.id);
              }
            });
          }
          this.currentBet = newTotalBet;
        }
        this.lastAction = { playerId, action: 'allIn', amount: newTotalBet };
        break;
      }

      default:
        throw new Error('未知操作');
    }

    this.advance();
  }

  // ---------- 推进流程 ----------
  advance() {
    // 仅剩一名未弃牌 → 直接结束
    const remaining = this.players.filter(p => p.status !== 'folded' && p.holeCards.length === 2);
    if (remaining.length === 1) {
      this.collectBetsToPots();
      this.endHandByFold(remaining[0]);
      return;
    }

    // 还能行动的玩家（非 folded、非 allIn）
    const stillActing = this.players.filter(p => p.status === 'active');
    if (stillActing.length === 0) {
      // 大家都 all-in 或弃牌：直接发完剩余公共牌
      this.collectBetsToPots();
      this.runOutAndShowdown();
      return;
    }

    // 仅保留 active 玩家在 pending 中
    for (const id of Array.from(this.actionsPending)) {
      const pl = this.players.find(p => p.id === id);
      if (!pl || pl.status !== 'active') this.actionsPending.delete(id);
    }

    // 一轮结束：active 玩家都匹配 currentBet 且没有人需要再行动
    const activePs = this.players.filter(p => p.status === 'active');
    const allMatched = activePs.every(p => p.currentBet === this.currentBet);
    if (allMatched && this.actionsPending.size === 0) {
      this.collectBetsToPots();
      this.nextPhase();
      return;
    }

    // 找下一个还需行动的 active 玩家
    this.currentPlayerIndex = this.nextActingPlayer(this.currentPlayerIndex);
  }

  // ---------- 收集本轮下注到底池/边池 ----------
  collectBetsToPots() {
    // 收集所有玩家的 currentBet 到 pots（按金额阶梯划分边池）
    const contributions = this.players
      .filter(p => p.currentBet > 0)
      .map(p => ({ player: p, amount: p.currentBet }))
      .sort((a, b) => a.amount - b.amount);

    if (contributions.length === 0) return;

    // 把本轮所有下注简单合并入 pot 总额
    let totalThisRound = 0;
    for (const c of contributions) totalThisRound += c.amount;
    this.pot += totalThisRound;

    // 重置当前轮下注（保留 totalBet，用于最终边池计算）
    this.players.forEach(p => p.resetForNewRound());
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
  }

  // 基于 totalBet 计算最终边池
  computeFinalPots() {
    const all = this.players
      .filter(p => p.totalBet > 0)
      .map(p => ({ player: p, amount: p.totalBet, folded: p.status === 'folded' }))
      .sort((a, b) => a.amount - b.amount);

    const pots = [];
    let prev = 0;
    let working = [...all];
    while (working.length > 0) {
      const min = working[0].amount;
      const layer = min - prev;
      if (layer > 0) {
        const potAmount = layer * working.length;
        const eligible = working.filter(w => !w.folded).map(w => w.player.id);
        pots.push({ amount: potAmount, eligible });
      }
      prev = min;
      working = working.filter(w => w.amount > min);
    }

    // 合并相邻 eligible 完全相同的池（视觉简洁）
    const merged = [];
    for (const p of pots) {
      const last = merged[merged.length - 1];
      if (last && JSON.stringify(last.eligible) === JSON.stringify(p.eligible)) {
        last.amount += p.amount;
      } else {
        merged.push({ ...p });
      }
    }
    return merged;
  }

  // ---------- 进入下一阶段 ----------
  nextPhase() {
    if (this.phase === Phase.PRE_FLOP) {
      this.phase = Phase.FLOP;
      this.deck.burn();
      this.communityCards.push(...this.deck.deal(3));
    } else if (this.phase === Phase.FLOP) {
      this.phase = Phase.TURN;
      this.deck.burn();
      this.communityCards.push(...this.deck.deal(1));
    } else if (this.phase === Phase.TURN) {
      this.phase = Phase.RIVER;
      this.deck.burn();
      this.communityCards.push(...this.deck.deal(1));
    } else if (this.phase === Phase.RIVER) {
      this.runOutAndShowdown();
      return;
    }

    // 如果没人能再行动了，递归发剩余公共牌
    const stillActing = this.players.filter(p => p.status === 'active');
    if (stillActing.length <= 1) {
      // 仍可能有 1 人 active 但其他 all-in；只剩 1 个 active 也直接发到河牌
      this.runOutAndShowdown();
      return;
    }

    // 设置当前玩家：庄家后第一个 active（post-flop 起手）
    // 单挑情况下，庄家后即非庄家（大盲）先行动
    const firstActor = this.nextActingPlayer(this.dealerIndex);
    this.currentPlayerIndex = firstActor;
    this.lastRaiseIndex = firstActor; // 新一轮起点
    // 重置本轮 pending
    this.actionsPending = new Set(
      this.players.filter(p => p.status === 'active').map(p => p.id)
    );
  }

  // 自动发完剩余公共牌并摊牌
  runOutAndShowdown() {
    while (this.communityCards.length < 5) {
      const need = 5 - this.communityCards.length;
      if (this.communityCards.length === 0) {
        this.deck.burn();
        this.communityCards.push(...this.deck.deal(3));
      } else {
        this.deck.burn();
        this.communityCards.push(...this.deck.deal(1));
      }
      if (this.communityCards.length >= 5) break;
      // 防止死循环
      if (need <= 0) break;
    }
    this.showdown();
  }

  // ---------- 摊牌结算 ----------
  showdown() {
    this.phase = Phase.SHOWDOWN;
    const pots = this.computeFinalPots();
    const { winners, hands } = HandEvaluator.evaluateHands(this.players, this.communityCards);

    const distributions = {}; // playerId -> 赢得筹码
    for (const pot of pots) {
      // 该池的胜者：在 winners 中且仍有资格（eligible）
      const eligibleWinners = winners.filter(id => pot.eligible.includes(id));
      // 若胜者中无人 eligible，则 fallback：在 eligible 中比一次
      let actualWinners = eligibleWinners;
      if (actualWinners.length === 0) {
        const subPlayers = this.players.filter(p => pot.eligible.includes(p.id));
        const sub = HandEvaluator.evaluateHands(subPlayers, this.communityCards);
        actualWinners = sub.winners;
      }
      if (actualWinners.length === 0) continue;
      const share = Math.floor(pot.amount / actualWinners.length);
      const remainder = pot.amount - share * actualWinners.length;
      actualWinners.forEach((wid, i) => {
        distributions[wid] = (distributions[wid] || 0) + share + (i < remainder ? 1 : 0);
      });
    }

    // 派发筹码
    for (const [pid, amt] of Object.entries(distributions)) {
      const player = this.players.find(p => String(p.id) === String(pid));
      if (player) player.chips += amt;
    }

    this.pot = 0;
    this.handResult = {
      winners,
      hands,
      pots,
      distributions,
      communityCards: [...this.communityCards],
      // 暴露所有未弃牌玩家的底牌
      revealedHoleCards: this.players
        .filter(p => p.status !== 'folded' && p.holeCards.length === 2)
        .reduce((acc, p) => { acc[p.id] = p.holeCards; return acc; }, {})
    };
  }

  // 因弃牌只剩一人，直接获胜
  endHandByFold(winner) {
    const pots = this.computeFinalPots();
    let total = 0;
    for (const pot of pots) total += pot.amount;
    winner.chips += total;
    this.pot = 0;
    this.phase = Phase.SHOWDOWN;
    this.handResult = {
      winners: [winner.id],
      hands: {},
      pots,
      distributions: { [winner.id]: total },
      communityCards: [...this.communityCards],
      revealedHoleCards: {},
      foldWin: true
    };
  }

  // ---------- 行动选项 ----------
  getValidActions(playerId) {
    if (this.phase === Phase.WAITING || this.phase === Phase.SHOWDOWN) return [];
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.status !== 'active') return [];
    const idx = this.players.indexOf(player);
    if (idx !== this.currentPlayerIndex) return [];

    const toCall = this.currentBet - player.currentBet;
    const actions = [];

    if (toCall > 0) {
      actions.push({ action: 'fold' });
      if (player.chips > toCall) {
        actions.push({ action: 'call', amount: toCall });
      } else {
        // 筹码不足 call 全 → allIn
      }
    } else {
      actions.push({ action: 'check' });
    }

    // raise：需要筹码 > toCall + minRaise
    const minRaiseTotal = this.currentBet + this.minRaise;
    const maxRaiseTotal = player.currentBet + player.chips;
    if (player.chips > toCall && maxRaiseTotal > this.currentBet) {
      const minR = Math.min(minRaiseTotal, maxRaiseTotal);
      actions.push({
        action: 'raise',
        min: minR,
        max: maxRaiseTotal
      });
    }

    if (player.chips > 0) {
      actions.push({ action: 'allIn', amount: player.chips });
    }

    return actions;
  }

  // ---------- 状态视图 ----------
  getState(forPlayerId = null) {
    return {
      phase: this.phase,
      pot: this.pot,
      pots: this.pots,
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      dealerIndex: this.dealerIndex,
      smallBlindIndex: this.smallBlindIndex,
      bigBlindIndex: this.bigBlindIndex,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.currentPlayerIndex >= 0 ? this.players[this.currentPlayerIndex].id : null,
      lastAction: this.lastAction,
      handResult: this.handResult,
      players: this.players.map(p => ({
        id: p.id,
        socketId: p.socketId,
        name: p.name,
        avatar: p.avatar,
        chips: p.chips,
        currentBet: p.currentBet,
        totalBet: p.totalBet,
        status: p.status,
        connected: p.connected,
        // 底牌：自己 / 摊牌阶段未弃牌玩家可见
        holeCards: this.shouldRevealCards(p, forPlayerId) ? p.holeCards : []
      }))
    };
  }

  shouldRevealCards(player, forPlayerId) {
    if (forPlayerId && String(player.id) === String(forPlayerId)) return true;
    if (this.phase === Phase.SHOWDOWN && this.handResult && !this.handResult.foldWin) {
      if (player.status !== 'folded' && player.holeCards.length === 2) return true;
    }
    return false;
  }
}
