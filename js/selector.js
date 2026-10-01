// 出題可否の判定と絞り込み

/**
 * 出題してよい問題か。
 * disputed と retired は常に除外。unverified は設定でONのときだけ。
 * @param {import('./types.js').Question} q
 * @param {import('./types.js').Settings} settings
 * @param {Object<string, any>} flags
 */
export function isAvailable(q, settings, flags) {
  if (q.retired) return false;
  const status = q.verification?.status;
  if (status === 'disputed') return false;
  if (status !== 'ai-verified' && status !== 'user-verified') {
    if (!(status === 'unverified' && settings.includeUnverified)) return false;
  }
  if (settings.excludeFlagged && flags[q.id]) return false;
  return true;
}

/**
 * @typedef {Object} Criteria
 * @property {'A'|'B'|''} subject
 * @property {string[]} fields        空なら全分野
 * @property {string[]} categories    空なら全カテゴリ
 * @property {number[]} difficulties  空なら全難易度
 * @property {'all'|'unanswered'|'recentWrong'|'due'} state
 */

/** @type {Criteria} */
export const DEFAULT_CRITERIA = { subject: 'A', fields: [], categories: [], difficulties: [], state: 'all' };

/**
 * @param {import('./types.js').Question[]} questions  出題可能なもの
 * @param {Criteria} c
 * @param {Object<string, import('./types.js').Stat>} stats
 * @param {string} today
 */
export function filterQuestions(questions, c, stats, today) {
  return questions.filter((q) => {
    if (c.subject && q.subject !== c.subject) return false;
    if (c.fields.length && !c.fields.includes(q.field)) return false;
    if (c.categories.length && !c.categories.includes(q.category)) return false;
    if (c.difficulties.length && !c.difficulties.includes(q.difficulty)) return false;
    const s = stats[q.id];
    if (c.state === 'unanswered') return !s;
    if (c.state === 'recentWrong') return !!s && s.lastOk === false;
    if (c.state === 'due') return !!s && s.due <= today;
    return true;
  });
}

/** 復習期限が来ている問題を、期限の古い順に返す */
export function dueQuestions(questions, stats, today) {
  return questions
    .filter((q) => stats[q.id] && stats[q.id].due <= today)
    .sort((a, b) => stats[a.id].due.localeCompare(stats[b.id].due) || stats[a.id].lastAt - stats[b.id].lastAt);
}

/** set の設問がばらばらにならないよう、最初に現れた位置にまとめて並べる（set 内は id 順） */
export function groupSets(questions) {
  const out = [];
  const done = new Set();
  for (const q of questions) {
    if (!q.setId) out.push(q);
    else if (!done.has(q.setId)) {
      done.add(q.setId);
      out.push(...questions.filter((x) => x.setId === q.setId).sort((a, b) => a.id.localeCompare(b.id)));
    }
  }
  return out;
}

/**
 * 先頭から n 問を、set を途中で切らずに取り出す（収まらない set は飛ばし、足りなければ後ろから埋める）。
 * @param {import('./types.js').Question[]} questions  groupSets 済みの並び
 */
export function takeWhole(questions, n) {
  const units = [];
  for (const q of questions) {
    const last = units[units.length - 1];
    if (q.setId && last && last[0].setId === q.setId) last.push(q);
    else units.push([q]);
  }
  const out = [];
  for (const u of units) if (out.length + u.length <= n) out.push(...u);
  return out;
}

/** Fisher–Yates */
export function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
