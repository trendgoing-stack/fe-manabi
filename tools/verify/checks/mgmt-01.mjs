import { pick } from '../lib/pick.mjs';

/** 問題の表（作業・所要日数・先行作業）から、最長経路の所要日数を求める */
function criticalPathLength(table) {
  const tasks = new Map(
    table.rows.map(([name, days, preds]) => [
      name,
      { days: Number(days), preds: preds === 'なし' ? [] : preds.split(/[,、，]\s*/).map((s) => s.trim()) },
    ]),
  );
  const memo = new Map();
  const finish = (name) => {
    if (!memo.has(name)) {
      const t = tasks.get(name);
      if (!t) throw new Error(`作業 ${name} が表にない`);
      memo.set(name, t.days + Math.max(0, ...t.preds.map(finish)));
    }
    return memo.get(name);
  };
  return Math.max(...[...tasks.keys()].map(finish));
}

export const checks = {
  'a-mgmt-0002': (q) => pick(q, criticalPathLength(q.table)),

  // EVM：EAC = BAC ÷ CPI
  'a-mgmt-0003': (q) => {
    const budgetPerFeature = 80;
    const bac = budgetPerFeature * 10;
    const ev = budgetPerFeature * 3 + budgetPerFeature * 0.5;
    const ac = 350;
    const cpi = ev / ac;
    return pick(q, Math.round(bac / cpi));
  },

  // 工数：実績の生産性で残作業に必要な要員数を求め、現在の要員数を引く
  'a-mgmt-0004': (q) => {
    const staff = 10;
    const months = 12;
    const total = staff * months;
    const elapsed = 6;
    const done = total * 0.4;
    const productivity = done / (staff * elapsed);
    const needed = Math.ceil((total - done) / productivity / (months - elapsed) - 1e-9);
    return pick(q, needed - staff);
  },

  // 可用性：提供時間帯 18時間×30日 のうち、許容される停止は 0.5%
  'a-mgmt-0007': (q) => {
    const minutes = (24 - 6) * 30 * 60;
    return pick(q, Math.floor((minutes * (1000 - 995)) / 1000));
  },
};
