// 系统头像列表（emoji）
export const avatars = [
  { id: 1, emoji: '🐱', name: '小猫' },
  { id: 2, emoji: '🐶', name: '小狗' },
  { id: 3, emoji: '🦊', name: '狐狸' },
  { id: 4, emoji: '🐻', name: '小熊' },
  { id: 5, emoji: '🐼', name: '熊猫' },
  { id: 6, emoji: '🐨', name: '考拉' },
  { id: 7, emoji: '🦁', name: '狮子' },
  { id: 8, emoji: '🐯', name: '老虎' },
  { id: 9, emoji: '🐮', name: '奶牛' },
  { id: 10, emoji: '🐷', name: '小猪' },
  { id: 11, emoji: '🐸', name: '青蛙' },
  { id: 12, emoji: '🐵', name: '猴子' },
  { id: 13, emoji: '🐔', name: '小鸡' },
  { id: 14, emoji: '🦄', name: '独角兽' },
  { id: 15, emoji: '🐲', name: '龙' },
  { id: 16, emoji: '🦅', name: '老鹰' },
  { id: 17, emoji: '🐙', name: '章鱼' },
  { id: 18, emoji: '🦋', name: '蝴蝶' },
  { id: 19, emoji: '🐺', name: '狼' },
  { id: 20, emoji: '🦈', name: '鲨鱼' },
];

// 随机昵称库
export const randomNames = [
  '赌神', '扑克脸', '梭哈王', '筹码收割机', '运气爆棚',
  '皇家同花顺', '河牌奇迹', '冷面杀手', '深夜牌手', '底池猎人',
  '全押狂人', '慢打大师', '诈唬专家', '读心术士', '暗三达人',
  '幸运星', '常胜将军', '逢赌必赢', '一夜暴富', '稳如泰山',
  '风林火山', '牌桌霸主', '筹码之王', '德州老司机', '淡定哥',
  '心态大师', '翻牌必中', '河牌之神', '底注收割者', '精准计算',
  '大力出奇迹', '随缘玩家', '佛系牌手', '小赌怡情', '快乐扑克',
  '夜猫子', '手气之王', '永不弃牌', '疯狂加注', '稳健派',
  '搏一搏单车变摩托', '富贵险中求', '淡定从容', '看破红尘', '天选之子',
  '锦鲤附体', '欧皇降临', '非酋本酋', '血赚不亏', '小富即安',
];

export function getRandomName() {
  return randomNames[Math.floor(Math.random() * randomNames.length)];
}

export function getAvatarById(id) {
  return avatars.find((a) => a.id === id) || avatars[0];
}
