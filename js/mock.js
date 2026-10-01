// 模擬試験のロジック。残り時間は setInterval の積算ではなく、時刻の差から毎回計算する。
import * as storage from './storage.js';
import { shuffled } from './selector.js';

/** 配分のグループ：科目Aは分野、科目Bは「アルゴリズム」「セキュリティ」 */
export const GROUPS = {
  A: [
    { key: 'technology', label: 'テクノロジ', of: (q) => q.field === 'technology' },
    { key: 'management', label: 'マネジメント', of: (q) => q.field === 'management' },
    { key: 'strategy', label: 'ストラテジ', of: (q) => q.field === 'strategy' },
  ],
  B: [
    { key: 'algorithm', label: 'アルゴリズムとプログラミング', of: (q) => q.category === 'アルゴリズムとプログラミング' },
    { key: 'security', label: '情報セキュリティ', of: (q) => q.category === 'セキュリティ' },
  ],
};
export const groupOf = (subject, q) => GROUPS[subject].find((g) => g.of(q))?.key ?? 'other';

/** 残り時間（ms）。0 未満にはしない */
export function remainingMs(m, now = Date.now()) {
  const used = m.elapsedMs + (m.runningSince != null ? now - m.runningSince : 0);
  return Math.max(0, m.limitMs - used);
}

/** 計時を止める（中断） */
export function pause(m, now = Date.now()) {
  if (m.runningSince == null) return;
  m.elapsedMs += now - m.runningSince;
  m.runningSince = null;
  storage.saveActiveMock(m);
}

/** 計時を再開する */
export function resume(m, now = Date.now()) {
  if (m.runningSince != null) return;
  m.runningSince = now;
  storage.saveActiveMock(m);
}

/**
 * 出題する問題を選ぶ。グループごとに配分どおりの数を、直近の模擬試験で出していない問題から優先して選ぶ。
 * set の設問はまとめて選ぶ（配分を超える set は、収まるものがあればそちらを優先する）。
 * @param {'A'|'B'} subject
 * @param {import('./types.js').Question[]} pool  出題可能なその科目の問題
 * @param {Object<string, number>} ratio          グループごとの問題数
 * @param {import('./types.js').MockExam[]} past  過去の記録（新しい順）
 */
export function pickQuestions(subject, pool, ratio, past) {
  // 問題ごとに「最後に出した模擬試験が何回前か」。出していなければ Infinity
  const lastSeen = new Map();
  past.forEach((m, i) => {
    for (const it of m.items) if (!lastSeen.has(it.id)) lastSeen.set(it.id, i);
  });
  // 出題の単位：set はまとめて1単位、単独問題は1問で1単位
  const units = [];
  const bySet = new Map();
  for (const q of pool) {
    if (!q.setId) units.push([q]);
    else if (!bySet.has(q.setId)) {
      const u = [q];
      bySet.set(q.setId, u);
      units.push(u);
    } else bySet.get(q.setId).push(q);
  }
  const fresh = (u) => Math.min(...u.map((q) => lastSeen.get(q.id) ?? Infinity));
  const rank = (us) => shuffled(us).sort((a, b) => fresh(b) - fresh(a));

  const total = Object.values(ratio).reduce((a, b) => a + b, 0);
  const used = new Set();
  const picked = [];
  const take = (u) => {
    used.add(u);
    picked.push(...u.slice().sort((a, b) => a.id.localeCompare(b.id)));
  };
  for (const g of GROUPS[subject]) {
    let need = ratio[g.key] ?? 0;
    for (const u of rank(units.filter((u) => g.of(u[0])))) {
      if (need <= 0) break;
      if (u.length <= need) {
        take(u);
        need -= u.length;
      }
    }
  }
  // 足りないときは、残りの単位から埋める
  for (const u of rank(units.filter((u) => !used.has(u)))) {
    if (picked.length >= total) break;
    if (picked.length + u.length <= total) take(u);
  }
  // グループ順に並べ、グループ内は単位ごとにランダム（set の設問は続けて出す）
  const order = GROUPS[subject].map((g) => g.key);
  const unitsOf = (key) => {
    const out = [];
    for (const q of picked) {
      if (groupOf(subject, q) !== key) continue;
      const u = q.setId ? picked.filter((x) => x.setId === q.setId) : [q];
      if (!out.some((x) => x[0] === u[0])) out.push(u);
    }
    return shuffled(out).flat();
  };
  return order.flatMap(unitsOf).concat(picked.filter((q) => !order.includes(groupOf(subject, q))));
}

/** @returns {import('./types.js').MockExam} */
export function createMock(subject, questions, minutes, settings) {
  const now = Date.now();
  const m = {
    id: `${subject}-${now}`,
    subject,
    limitMs: minutes * 60 * 1000,
    startedAt: now,
    elapsedMs: 0,
    runningSince: now,
    pos: 0,
    items: questions.map((q) => {
      const base = q.choices.map((_, i) => i);
      return { id: q.id, order: settings.shuffle && !q.fixedOrder ? shuffled(base) : base, selected: null, flagged: false };
    }),
    finishedAt: null,
    result: null,
  };
  storage.saveActiveMock(m);
  return m;
}

/**
 * 採点して記録を保存する。回答した問題は間隔反復にも反映する（未回答は不正解として採点するが、記録はしない）。
 * @param {import('./types.js').MockExam} m
 * @param {Map<string, import('./types.js').Question>} byId
 */
export function finishMock(m, byId) {
  pause(m);
  const byField = {};
  let ok = 0;
  for (const it of m.items) {
    const q = byId.get(it.id);
    if (!q) continue;
    const correct = it.selected === q.answer;
    const f = (byField[groupOf(m.subject, q)] ??= { n: 0, ok: 0 });
    f.n++;
    if (correct) {
      f.ok++;
      ok++;
    }
    if (it.selected != null) storage.recordAnswer(q, correct, 'mock');
  }
  m.finishedAt = Date.now();
  m.result = { ok, total: m.items.length, byField };
  storage.saveMock(m);
  storage.clearActiveMock();
  return m;
}
