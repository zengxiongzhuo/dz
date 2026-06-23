// HandEvaluator.js - 使用 pokersolver 评估牌力
import pkg from 'pokersolver';
const { Hand } = pkg;
import Deck from './Deck.js';

export default class HandEvaluator {
  /**
   * 评估所有未弃牌玩家的最佳手牌
   * @param {Array} players 玩家数组
   * @param {Array} communityCards 5张公共牌
   * @returns {{ winners: Array<string|number>, hands: Object }}
   */
  static evaluateHands(players, communityCards) {
    const contenders = players.filter(p => p.status !== 'folded' && p.holeCards.length === 2);
    if (contenders.length === 0) {
      return { winners: [], hands: {} };
    }

    const communityStrs = communityCards.map(Deck.cardToString);
    const handsMap = new Map(); // pokersolver Hand -> player
    const handsInfo = {};

    for (const p of contenders) {
      const all = [...p.holeCards.map(Deck.cardToString), ...communityStrs];
      const solved = Hand.solve(all);
      solved.__playerId = p.id;
      handsMap.set(solved, p);
      handsInfo[p.id] = {
        name: solved.name,
        descr: solved.descr,
        cards: solved.cards.map(c => c.toString())
      };
    }

    const allHands = Array.from(handsMap.keys());
    const winningHands = Hand.winners(allHands);
    const winners = winningHands.map(h => handsMap.get(h).id);

    return { winners, hands: handsInfo };
  }

  /**
   * 比较两个玩家集合，返回胜者 id 列表
   */
  static compareHands(playerIds, players, communityCards) {
    const subset = players.filter(p => playerIds.includes(p.id) && p.status !== 'folded');
    return HandEvaluator.evaluateHands(subset, communityCards).winners;
  }
}
