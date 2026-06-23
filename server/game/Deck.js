// Deck.js - 52张扑克牌的牌堆实现
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['h', 'd', 'c', 's']; // hearts, diamonds, clubs, spades

export default class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({ rank, suit });
      }
    }
  }

  // Fisher-Yates 洗牌
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    return this;
  }

  // 发牌：发出 n 张并返回
  deal(n = 1) {
    return this.cards.splice(0, n);
  }

  // 烧牌（弃一张）
  burn() {
    this.cards.shift();
  }

  // 将牌对象转为 pokersolver 格式: { rank:'10', suit:'s' } -> 'Ts'
  static cardToString(card) {
    const rank = card.rank === '10' ? 'T' : card.rank;
    return `${rank}${card.suit}`;
  }
}
