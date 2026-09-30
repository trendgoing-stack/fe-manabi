import { pick } from '../lib/pick.mjs';

export const checks = {
  // 回収期間法：純効果（業務効果−運用費）が年内均等に発生するとして、累計が初期投資に達する時点
  'a-strat-0005': (q) => {
    const investment = 2400;
    const opex = 200;
    const effects = [600, 900, 1200, 1400, 1400];
    let remaining = investment;
    let years = 0;
    for (const e of effects) {
      const net = e - opex;
      if (net >= remaining) {
        years += remaining / net;
        remaining = 0;
        break;
      }
      remaining -= net;
      years += 1;
    }
    if (remaining > 0) throw new Error('a-strat-0005: 期間内に回収できない');
    return pick(q, years);
  },

  // MRP：上位品目から順に 正味所要量 = max(総所要量 − 在庫, 0) を展開
  'a-strat-0012': (q) => {
    const levels = [
      { stock: 20, perParent: 1 }, // 製品X
      { stock: 60, perParent: 3 }, // 部品Y（X 1個に3個）
      { stock: 100, perParent: 2 }, // 部品Z（Y 1個に2個）
    ];
    let net = 120; // 製品Xの出荷必要数
    for (const { stock, perParent } of levels) {
      net = Math.max(net * perParent - stock, 0);
    }
    return pick(q, net);
  },

  // 目標利益を得る販売数量 = (固定費 + 目標利益) ÷ (単価 − 変動費)
  'a-strat-0013': (q) => {
    const price = 2500;
    const variable = 1500;
    const fixed = 3_600_000;
    const target = 900_000;
    return pick(q, (fixed + target) / (price - variable));
  },

  // 先入先出法：受入ロットをキューに積み、古いロットから払い出して原価を合計
  'a-strat-0014': (q) => {
    const moves = [
      { type: 'in', qty: 100, price: 200 },
      { type: 'in', qty: 200, price: 230 },
      { type: 'out', qty: 150 },
      { type: 'in', qty: 100, price: 260 },
      { type: 'out', qty: 180 },
    ];
    const lots = [];
    let cost = 0;
    for (const m of moves) {
      if (m.type === 'in') {
        lots.push({ qty: m.qty, price: m.price });
        continue;
      }
      let need = m.qty;
      while (need > 0) {
        const lot = lots[0];
        if (!lot) throw new Error('a-strat-0014: 在庫不足');
        const used = Math.min(lot.qty, need);
        cost += used * lot.price;
        lot.qty -= used;
        need -= used;
        if (lot.qty === 0) lots.shift();
      }
    }
    return pick(q, cost);
  },

  // 線形計画：整数格子を全探索して利益の最大値を求める（最適解は整数点 (40, 20)）
  'a-strat-0015': (q) => {
    const hours = 100;
    const material = 80;
    let best = 0;
    for (let p = 0; 2 * p <= hours; p++) {
      for (let r = 0; 2 * p + r <= hours; r++) {
        if (p + 2 * r > material) continue;
        best = Math.max(best, 4 * p + 3 * r);
      }
    }
    return pick(q, best);
  },
};
