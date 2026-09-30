import { pick } from '../lib/pick.mjs';

/** 問題の表（作業・所要日数・先行作業）から、指定した作業のトータルフロートを求める */
function totalFloat(table, target) {
  const tasks = new Map(
    table.rows.map(([name, days, preds]) => [
      name,
      { days: Number(days), preds: preds === 'なし' ? [] : preds.split(/[,、，]\s*/).map((s) => s.trim()) },
    ]),
  );
  const names = [...tasks.keys()];

  // 最早終了時刻
  const ef = new Map();
  const earliestFinish = (name) => {
    if (!ef.has(name)) {
      const t = tasks.get(name);
      if (!t) throw new Error(`作業 ${name} が表にない`);
      ef.set(name, t.days + Math.max(0, ...t.preds.map(earliestFinish)));
    }
    return ef.get(name);
  };
  const projectEnd = Math.max(...names.map(earliestFinish));

  // 最遅終了時刻（後続作業の最遅開始時刻の最小値）
  const lf = new Map();
  const latestFinish = (name) => {
    if (!lf.has(name)) {
      const succs = names.filter((n) => tasks.get(n).preds.includes(name));
      lf.set(name, Math.min(projectEnd, ...succs.map((s) => latestFinish(s) - tasks.get(s).days)));
    }
    return lf.get(name);
  };
  return latestFinish(target) - earliestFinish(target);
}

const paths = (n) => (n * (n - 1)) / 2;

export const checks = {
  'a-mgmt-0013': (q) => pick(q, totalFloat(q.table, 'C')),

  // コミュニケーション経路数：n(n−1)/2 の差
  'a-mgmt-0014': (q) => pick(q, paths(6 + 3) - paths(6)),

  // 期待金額：対策なしの期待損失 −（対策費＋対策後の期待損失）。単位は万円
  'a-mgmt-0015': (q) => {
    const loss = 1500;
    const without = (loss * 20) / 100;
    const withMeasure = 120 + (loss * 8) / 100;
    return pick(q, without - withMeasure);
  },

  // 差分バックアップ：フル＋（月〜土の累積更新量の合計）
  'a-mgmt-0019': (q) => {
    const full = 200;
    const daily = 10;
    let total = full;
    for (let day = 1; day <= 6; day++) total += daily * day;
    return pick(q, total);
  },

  // 逓減課金：表の区分ごとに、その区分に入る時間だけ単価を掛ける
  'a-mgmt-0020': (q) => {
    const hours = 380;
    let lower = 0;
    let total = 0;
    for (const [label, price] of q.table.rows) {
      const m = label.normalize('NFKC').match(/(\d+)時間までの部分/);
      const upper = m ? Number(m[1]) : Infinity;
      total += Math.max(0, Math.min(hours, upper) - lower) * Number(price);
      lower = upper;
    }
    return pick(q, total);
  },
};
