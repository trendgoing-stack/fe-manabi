import { pick, pickBy } from '../lib/pick.mjs';

/** アローダイアグラムの作業を { from, to, name, days } の配列にする。override で作業ごとの日数を差し替えられる */
function activities(figure, override = {}) {
  return figure.activities.map((a) => {
    if (a.dummy) return { from: a.from, to: a.to, name: null, days: 0 };
    const [name, days] = a.label.split(/\s+/);
    return { from: a.from, to: a.to, name, days: name in override ? override[name] : Number(days) };
  });
}

/** 各結合点の最早結合点時刻 */
function earliest(figure, override) {
  const acts = activities(figure, override);
  const memo = new Map();
  const et = (id) => {
    if (!memo.has(id)) {
      const ins = acts.filter((a) => a.to === id);
      memo.set(id, Math.max(0, ...ins.map((a) => et(a.from) + a.days)));
    }
    return memo.get(id);
  };
  return new Map(figure.nodes.map((n) => [n.id, et(n.id)]));
}

/** 全体の所要日数（最終結合点の最早結合点時刻の最大） */
const projectLength = (figure, override) => Math.max(...earliest(figure, override).values());

/** ガントチャートの「X（計画）」「X（実績）」から、現在時点で計画より遅れている作業名の一覧 */
function behindTasks(figure) {
  const now = figure.marker;
  const byName = new Map();
  for (const t of figure.tasks) {
    const m = t.label.match(/^(.+)（(計画|実績)）$/);
    if (!m) throw new Error(`ラベルの形式が想定外: ${t.label}`);
    const rec = byName.get(m[1]) ?? { plan: 0, actual: 0 };
    const done = Math.max(0, Math.min(now, t.start + t.length) - t.start);
    if (t.kind === 'actual') rec.actual += done;
    else rec.plan += done;
    byName.set(m[1], rec);
  }
  return [...byName].filter(([, r]) => r.actual < r.plan).map(([name]) => name);
}

/** ガントチャートと要員表から、指定した作業の開始日を動かしたときの最大要員数の最小値 */
function minPeak(figure, table, movable) {
  const persons = new Map(table.rows.map(([name, n]) => [name, Number(n)]));
  const peakWith = (shift) => {
    const load = new Array(figure.span).fill(0);
    for (const t of figure.tasks) {
      const start = t.label === movable ? shift : t.start;
      for (let d = start; d < start + t.length; d++) load[d] += persons.get(t.label);
    }
    return Math.max(...load);
  };
  const task = figure.tasks.find((t) => t.label === movable);
  let best = Infinity;
  for (let s = 0; s + task.length <= figure.span; s++) best = Math.min(best, peakWith(s));
  return best;
}

export const checks = {
  // 結合点5の最早結合点時刻（ダミー作業を所要日数0として扱う）
  'a-mgmt-0026': (q) => pick(q, earliest(q.figure).get('5')),

  // 作業Cを4日短縮した後の全体の所要日数
  'a-mgmt-0027': (q) => {
    const c = activities(q.figure).find((a) => a.name === 'C');
    return pick(q, projectLength(q.figure, { C: c.days - 4 }));
  },

  // 現在時点で、実績の作業日数が計画上の作業日数に届いていない作業
  'a-mgmt-0028': (q) => {
    const behind = behindTasks(q.figure);
    if (behind.length !== 1) throw new Error(`遅れている作業が ${behind.length} 個`);
    return pickBy(q, (t) => t === `作業${behind[0]}`);
  },

  // 作業Dだけを期間内で動かしたときの、1日当たり最大要員数の最小値
  'a-mgmt-0029': (q) => pick(q, minPeak(q.figure, q.table, 'D')),

  // 未調整FP（個数×重みの合計）× 調整係数1.1
  'a-mgmt-0030': (q) => {
    const ufp = q.table.rows.reduce((s, [, n, w]) => s + Number(n) * Number(w), 0);
    return pick(q, ufp * 1.1);
  },

  // SV＝EV−PV、CV＝EV−AC の符号で判断する
  'a-mgmt-0031': (q) => {
    const [pv, ev, ac] = [500, 450, 420];
    const sv = ev - pv;
    const cv = ev - ac;
    return pickBy(
      q,
      (t) => t.includes(sv < 0 ? '遅れて' : '進んで') && t.includes(cv >= 0 ? '予算内' : '超過'),
    );
  },

  // MTBF＝（運用時間−修理時間の合計）÷故障回数
  'a-mgmt-0037': (q) => {
    const repairs = [2, 3, 1, 4];
    const up = 1000 - repairs.reduce((s, h) => s + h, 0);
    return pick(q, up / repairs.length);
  },
};
