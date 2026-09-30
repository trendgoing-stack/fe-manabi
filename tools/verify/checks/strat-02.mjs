import { pick } from '../lib/pick.mjs';

export const checks = {
  // 正味現在価値：各年の現金収入を (1+r)^t で割り引いて合計し、投資額を引く
  'a-strat-0024': (q) => {
    const investment = 900;
    const rate = 0.1;
    const inflows = [440, 726]; // 1年後、2年後
    const pv = inflows.reduce((sum, cf, i) => sum + cf / (1 + rate) ** (i + 1), 0);
    return pick(q, Math.round((pv - investment) * 1e6) / 1e6);
  },

  // 必要台数 = ceil(加工数 × 1個の加工時間 ÷ 1台が加工に使える時間)、加工数 = 良品数 ÷ (1 − 不良率)
  'a-strat-0033': (q) => {
    const good = 270;
    const defectPercent = 10;
    const minutesPerUnit = 9;
    const availablePerMachine = (8 * 60 * 75) / 100; // 360分
    const needed = (good * 100 * minutesPerUnit) / (100 - defectPercent); // 2,700分（整数演算）
    return pick(q, Math.ceil(needed / availablePerMachine));
  },

  // 定額法：帳簿価額 = 取得価額 − (取得価額 − 残存価額) ÷ 耐用年数 × 経過年数
  'a-strat-0034': (q) => {
    const cost = 360;
    const residual = 0;
    const life = 5;
    const years = 3;
    return pick(q, cost - ((cost - residual) / life) * years);
  },

  // マクシミン原理：各案の最小利益が最大の案を選び、その案の期待値を求める（確率は10倍した整数で計算）
  'a-strat-0035': (q) => {
    const weights = [3, 5, 2]; // 好況、普通、不況（合計10）
    const plans = {
      A: [800, 400, -200],
      B: [500, 400, 100],
      C: [300, 300, 200],
    };
    const entries = Object.entries(plans);
    const bestMin = Math.max(...entries.map(([, p]) => Math.min(...p)));
    const chosen = entries.filter(([, p]) => Math.min(...p) === bestMin);
    if (chosen.length !== 1) throw new Error('a-strat-0035: マクシミン原理で選ばれる案が一意でない');
    const expected = chosen[0][1].reduce((sum, v, i) => sum + v * weights[i], 0) / 10;
    return pick(q, expected);
  },

  // ROE(%) = 当期純利益 ÷ 自己資本（純資産） × 100。表の値を読んで計算する
  'a-strat-0036': (q) => {
    const value = (name) => {
      const row = q.table.rows.find((r) => r[0] === name);
      if (!row) throw new Error(`a-strat-0036: 表に「${name}」がない`);
      return Number(row[1].replace(/,/g, ''));
    };
    return pick(q, (value('当期純利益') / value('純資産')) * 100);
  },
};
