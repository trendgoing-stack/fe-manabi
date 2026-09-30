// データ検証の本体。ブラウザ（validate.html）と Node（validate.mjs）の両方から使う。
import { CATEGORIES } from '../js/categories.js';

const STATUSES = ['unverified', 'ai-verified', 'user-verified', 'disputed'];
const METHODS = ['independent-solve', 'script', 'quality-review', 'web-source'];
const ID_RE = /^(a-(tech|mgmt|strat)|b-(algo|sec))-\d{4}$/;
const ID_FIELD = { tech: 'technology', mgmt: 'management', strat: 'strategy' };
const catByName = new Map(CATEGORIES.map((c) => [c.name, c]));
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

/** 1問のスキーマ違反を文字列の配列で返す */
export function checkQuestion(q, glossaryIds) {
  const e = [];
  if (!ID_RE.test(q.id ?? '')) e.push('id の形式が不正');
  if (!['A', 'B'].includes(q.subject)) e.push('subject が不正');
  if (q.id && q.subject && q.id[0].toUpperCase() !== q.subject) e.push('id と subject が一致しない');
  const cat = catByName.get(q.category);
  if (!cat) e.push(`category「${q.category}」は固定リストにない`);
  else {
    if (cat.field !== q.field) e.push(`field が category と合わない（${cat.field} のはず）`);
    if (!cat.syllabusRefs.includes(q.syllabusRef)) e.push(`syllabusRef「${q.syllabusRef}」が category と合わない`);
  }
  const idField = ID_FIELD[q.id?.split('-')[1]];
  if (idField && q.field !== idField) e.push('id の分野と field が一致しない');
  if (![1, 2, 3].includes(q.difficulty)) e.push('difficulty は 1〜3');
  if (!Array.isArray(q.stem) || !q.stem.length || !q.stem.every(isStr)) e.push('stem は空でない文字列の配列');
  if (q.table && !(Array.isArray(q.table.header) && Array.isArray(q.table.rows) && q.table.rows.every((r) => Array.isArray(r) && r.length === q.table.header.length))) {
    e.push('table の形が不正（各行の列数は header と同じ）');
  }
  if (!Array.isArray(q.choices) || q.choices.length !== 4) e.push('choices は長さ4');
  else {
    q.choices.forEach((c, i) => {
      if (!isStr(c?.text)) e.push(`choices[${i}].text が空`);
      if (!isStr(c?.why)) e.push(`choices[${i}].why が空`);
    });
    if (new Set(q.choices.map((c) => c?.text)).size !== 4) e.push('選択肢の文言が重複している');
  }
  if (![0, 1, 2, 3].includes(q.answer)) e.push('answer は 0〜3');
  if (!isStr(q.explanation)) e.push('explanation が空');
  const prose = [q.explanation, ...(q.choices ?? []).map((c) => c?.why)].join(' ');
  if (/選択肢[ア-エ]|[ア-エ]が正|[ア-エ]は誤|[1-4１-４]番目の選択肢/.test(prose)) e.push('解説が選択肢の記号・位置に言及している');
  if (/<\/?[a-z][^>]*>/i.test(JSON.stringify([q.stem, q.choices, q.explanation, q.table]))) e.push('HTMLタグが含まれている');
  if (!Array.isArray(q.terms)) e.push('terms は配列');
  else for (const t of q.terms) if (!glossaryIds.has(t)) e.push(`terms「${t}」が用語集にない`);
  if (!Array.isArray(q.tags)) e.push('tags は配列');
  if (q.asOf != null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(q.asOf)) e.push('asOf は YYYY-MM');
  const v = q.verification;
  if (!v || !STATUSES.includes(v.status)) e.push('verification.status が不正');
  else {
    if (!Array.isArray(v.methods) || !v.methods.every((m) => METHODS.includes(m))) e.push('verification.methods が不正');
    if (v.status !== 'unverified' && v.status !== 'disputed') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.verifiedAt ?? '')) e.push('検証済みなのに verifiedAt がない');
      for (const m of ['independent-solve', 'quality-review']) if (!v.methods?.includes(m)) e.push(`検証済みなのに methods に ${m} がない`);
    }
    if (v.script && !v.methods?.includes('script') && v.status !== 'unverified') e.push('script があるのに methods に script がない');
  }
  if (q.source !== 'original') e.push('source は "original"');
  return e;
}

/**
 * @param {object} meta
 * @param {{file:string, json:object|null}[]} files
 * @param {string|null} swText  sw.js の中身
 * @param {object|null} glossary
 */
export function validateAll(meta, files, swText, glossary) {
  const errors = [];
  const questions = [];
  const seen = new Map();
  const glossaryIds = new Set((glossary?.terms ?? []).map((t) => t.id));

  for (const { file, json } of files) {
    if (!json || !Array.isArray(json.items)) {
      errors.push({ where: file, msg: '読み込めない、または items がない' });
      continue;
    }
    if (json.schemaVersion !== meta.schemaVersion) errors.push({ where: file, msg: 'schemaVersion が meta.json と違う' });
    for (const item of json.items) {
      for (const q of item.questions ?? [item]) {
        questions.push(q);
        if (seen.has(q.id)) errors.push({ where: q.id, msg: `id が重複（${seen.get(q.id)} と ${file}）` });
        else seen.set(q.id, file);
        for (const msg of checkQuestion(q, glossaryIds)) errors.push({ where: q.id ?? file, msg });
      }
    }
  }

  const count = (keyFn, list = questions) => {
    const m = new Map();
    for (const q of list) m.set(keyFn(q), (m.get(keyFn(q)) ?? 0) + 1);
    return m;
  };
  const live = questions.filter((q) => !q.retired);

  for (const s of ['A', 'B']) {
    const n = live.filter((q) => q.subject === s).length;
    if (meta.counts?.[s] !== n) errors.push({ where: 'meta.json', msg: `counts.${s} は ${meta.counts?.[s]} だが実際は ${n}` });
  }

  const swVersion = swText?.match(/const VERSION = '([^']+)'/)?.[1] ?? null;
  if (swVersion !== meta.dataVersion) errors.push({ where: 'sw.js', msg: `VERSION（${swVersion}）が meta.json の dataVersion（${meta.dataVersion}）と違う` });

  // 正解の選択肢だけが長い／短い傾向がないか
  const lens = live.map((q) => {
    const l = q.choices.map((c) => c.text.length);
    const others = l.filter((_, i) => i !== q.answer);
    return { id: q.id, ans: l[q.answer], avgOther: others.reduce((a, b) => a + b, 0) / 3, longest: l[q.answer] > Math.max(...others), shortest: l[q.answer] < Math.min(...others) };
  });
  const textual = lens.filter((x) => x.avgOther >= 8); // 数値だけの選択肢は除く

  return {
    errors,
    questions,
    swVersion,
    byStatus: count((q) => q.verification?.status ?? '(なし)'),
    byField: count((q) => q.field, live),
    byCategory: count((q) => q.category, live),
    bySyllabusRef: count((q) => q.syllabusRef, live),
    byDifficulty: count((q) => q.difficulty, live),
    byAnswer: count((q) => q.answer, live),
    retired: questions.length - live.length,
    needsUserCheck: live.filter((q) => q.needsUserCheck).map((q) => q.id),
    disputed: questions.filter((q) => q.verification?.status === 'disputed').map((q) => q.id),
    bias: {
      n: textual.length,
      longest: textual.filter((x) => x.longest).length,
      shortest: textual.filter((x) => x.shortest).length,
      ratio: textual.length ? textual.reduce((a, x) => a + x.ans / x.avgOther, 0) / textual.length : 0,
      outliers: textual.filter((x) => x.ans > x.avgOther * 1.6).map((x) => x.id),
    },
  };
}
