// 模擬試験のロジック。残り時間は setInterval の積算ではなく、時刻の差から毎回計算する。
import * as storage from './storage.js';
import { shuffled } from './selector.js';

const FIELD_ORDER = ['technology', 'management', 'strategy'];

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
 * 出題する問題を選ぶ。分野ごとに配分どおりの数を、直近の模擬試験で出していない問題から優先して選ぶ。
 * @param {import('./types.js').Question[]} pool  出題可能な科目Aの問題
 * @param {Object<string, number>} ratio          分野ごとの問題数
 * @param {import('./types.js').MockExam[]} past  過去の記録（新しい順）
 */
export function pickQuestions(pool, ratio, past) {
  // 問題ごとに「最後に出した模擬試験が何回前か」。出していなければ Infinity
  const lastSeen = new Map();
  past.forEach((m, i) => {
    for (const it of m.items) if (!lastSeen.has(it.id)) lastSeen.set(it.id, i);
  });
  const rank = (qs) =>
    shuffled(qs).sort((a, b) => (lastSeen.get(b.id) ?? Infinity) - (lastSeen.get(a.id) ?? Infinity));

  const total = Object.values(ratio).reduce((a, b) => a + b, 0);
  const chosen = new Set();
  const picked = [];
  for (const field of FIELD_ORDER) {
    for (const q of rank(pool.filter((q) => q.field === field)).slice(0, ratio[field] ?? 0)) {
      chosen.add(q.id);
      picked.push(q);
    }
  }
  // 分野の問題が足りないときは、他の分野で埋める
  if (picked.length < total) {
    for (const q of rank(pool.filter((q) => !chosen.has(q.id))).slice(0, total - picked.length)) picked.push(q);
  }
  // 本試験と同じく分野順に並べ、分野内はランダム
  return FIELD_ORDER.flatMap((f) => shuffled(picked.filter((q) => q.field === f))).concat(picked.filter((q) => !FIELD_ORDER.includes(q.field)));
}

/** @returns {import('./types.js').MockExam} */
export function createMock(questions, minutes, settings) {
  const now = Date.now();
  const m = {
    id: `A-${now}`,
    subject: 'A',
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
    const f = (byField[q.field] ??= { n: 0, ok: 0 });
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
