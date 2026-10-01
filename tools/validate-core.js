// データ検証の本体。ブラウザ（validate.html）と Node（validate.mjs）の両方から使う。
import { CATEGORIES } from '../js/categories.js';

const STATUSES = ['unverified', 'ai-verified', 'user-verified', 'disputed'];
const METHODS = ['independent-solve', 'script', 'quality-review', 'web-source'];
const ID_RE = /^(a-(tech|mgmt|strat)|b-(algo|sec))-\d{4}$/;
const ID_FIELD = { tech: 'technology', mgmt: 'management', strat: 'strategy', algo: 'technology', sec: 'technology' };
const B_CATEGORY = { algo: 'アルゴリズムとプログラミング', sec: 'セキュリティ' };
const catByName = new Map(CATEGORIES.map((c) => [c.name, c]));
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

const FIG_TYPES = ['tree', 'state', 'arrow', 'gantt', 'network', 'er', 'logic'];
const NET_KINDS = ['internet', 'router', 'switch', 'fw', 'server', 'pc', 'ap', 'cloud'];
const GATES = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** 図データの形と参照の整合性 */
export function checkFigure(f) {
  const e = [];
  if (!f || !FIG_TYPES.includes(f.type)) return [`figure.type「${f?.type}」は未対応`];
  const ids = (arr) => new Set((arr ?? []).map((x) => x.id));
  const posOk = (arr) => (arr ?? []).every((x) => isNum(x.x) && isNum(x.y));
  if (f.type === 'tree') {
    const walk = (n) => n === null || (isStr(String(n?.label ?? '')) && (n.children ?? []).every(walk));
    if (!f.root || !walk(f.root)) e.push('figure(tree): root の形が不正');
  } else if (f.type === 'state') {
    const s = ids(f.states);
    if (!posOk(f.states)) e.push('figure(state): 座標がない状態がある');
    for (const t of f.transitions ?? []) if (!s.has(t.from) || !s.has(t.to)) e.push(`figure(state): 遷移 ${t.from}→${t.to} の参照先がない`);
  } else if (f.type === 'arrow') {
    const s = ids(f.nodes);
    if (!posOk(f.nodes)) e.push('figure(arrow): 座標がない結合点がある');
    for (const a of f.activities ?? []) if (!s.has(a.from) || !s.has(a.to)) e.push(`figure(arrow): 作業 ${a.from}→${a.to} の参照先がない`);
  } else if (f.type === 'gantt') {
    if (!isNum(f.span) || !(f.tasks ?? []).every((t) => isStr(t.label) && isNum(t.start) && isNum(t.length) && t.start + t.length <= f.span)) e.push('figure(gantt): span と tasks の形が不正');
  } else if (f.type === 'network') {
    const s = ids(f.nodes);
    if (!posOk(f.nodes) || !(f.nodes ?? []).every((n) => NET_KINDS.includes(n.kind))) e.push('figure(network): nodes の座標か kind が不正');
    for (const l of f.links ?? []) if (!s.has(l.from) || !s.has(l.to)) e.push(`figure(network): 接続 ${l.from}-${l.to} の参照先がない`);
  } else if (f.type === 'er') {
    const s = ids(f.entities);
    if (!posOk(f.entities)) e.push('figure(er): 座標がないエンティティがある');
    for (const r of f.relations ?? []) if (!s.has(r.from) || !s.has(r.to)) e.push(`figure(er): リレーションシップ ${r.from}-${r.to} の参照先がない`);
  } else if (f.type === 'logic') {
    const s = new Set([...ids(f.inputs), ...ids(f.gates)]);
    if (!posOk(f.inputs) || !posOk(f.gates) || !posOk(f.outputs)) e.push('figure(logic): 座標がない要素がある');
    for (const g of f.gates ?? []) {
      if (!GATES.includes(g.op)) e.push(`figure(logic): ゲート ${g.id} の op が不正`);
      for (const i of g.in ?? []) if (!s.has(i)) e.push(`figure(logic): ゲート ${g.id} の入力 ${i} がない`);
    }
    for (const o of f.outputs ?? []) if (!s.has(o.from)) e.push(`figure(logic): 出力 ${o.id} の接続元 ${o.from} がない`);
  }
  return e;
}

/** 用語集の検査 */
export function checkGlossary(glossary) {
  const e = [];
  if (!glossary) return e;
  const seen = new Set();
  const ids = new Set(glossary.terms.map((t) => t.id));
  for (const t of glossary.terms) {
    const where = t.id ?? '(id なし)';
    if (!/^g-\d{4}$/.test(t.id ?? '')) e.push({ where, msg: '用語の id の形式が不正' });
    if (seen.has(t.id)) e.push({ where, msg: '用語の id が重複' });
    seen.add(t.id);
    if (!isStr(t.term)) e.push({ where, msg: 'term が空' });
    if (!/^[ぁ-ゖー]+$/.test(t.reading ?? '')) e.push({ where, msg: 'reading はひらがなのみ' });
    if (!catByName.has(t.category)) e.push({ where, msg: `category「${t.category}」は固定リストにない` });
    if (!isStr(t.definition)) e.push({ where, msg: 'definition が空' });
    if (/<\/?[a-z][^>]*>/i.test(t.definition ?? '')) e.push({ where, msg: 'definition にHTMLタグ' });
    for (const r of t.related ?? []) if (!ids.has(r) || r === t.id) e.push({ where, msg: `related「${r}」が不正` });
  }
  return e;
}

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
  const kind = q.id?.split('-')[1];
  if (B_CATEGORY[kind] && q.category !== B_CATEGORY[kind]) e.push(`科目Bの ${kind} の問題は category「${B_CATEGORY[kind]}」`);
  if (q.code && !(Array.isArray(q.code.lines) && q.code.lines.every((l) => typeof l === 'string'))) e.push('code.lines は文字列の配列');
  if (q.trace) {
    const t = q.trace;
    if (!Array.isArray(t.vars) || !t.vars.length || !Array.isArray(t.rows) || !t.rows.every((r) => Array.isArray(r) && r.length === t.vars.length)) e.push('trace の形が不正（rows の各行は vars と同じ長さ）');
  }
  if (![1, 2, 3].includes(q.difficulty)) e.push('difficulty は 1〜3');
  if (!Array.isArray(q.stem) || !q.stem.length || !q.stem.every(isStr)) e.push('stem は空でない文字列の配列');
  if (q.table && !(Array.isArray(q.table.header) && Array.isArray(q.table.rows) && q.table.rows.every((r) => Array.isArray(r) && r.length === q.table.header.length))) {
    e.push('table の形が不正（各行の列数は header と同じ）');
  }
  if (q.figure) e.push(...checkFigure(q.figure));
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
  errors.push(...checkGlossary(glossary));
  if ((meta.counts?.glossary ?? 0) !== (glossary?.terms?.length ?? 0)) errors.push({ where: 'meta.json', msg: `counts.glossary は ${meta.counts?.glossary} だが実際は ${glossary?.terms?.length ?? 0}` });

  for (const { file, json } of files) {
    if (!json || !Array.isArray(json.items)) {
      errors.push({ where: file, msg: '読み込めない、または items がない' });
      continue;
    }
    if (json.schemaVersion !== meta.schemaVersion) errors.push({ where: file, msg: 'schemaVersion が meta.json と違う' });
    for (const item of json.items) {
      if (item.questions) {
        if (!/^b-(algo|sec)-set-\d{4}$/.test(item.setId ?? '')) errors.push({ where: item.setId ?? file, msg: 'setId の形式が不正' });
        if (!Array.isArray(item.stem) || !item.stem.length) errors.push({ where: item.setId, msg: 'set の stem が空' });
        if (item.questions.length < 2) errors.push({ where: item.setId, msg: 'set の設問は2問以上' });
        if (item.code && !(Array.isArray(item.code.lines) && item.code.lines.length)) errors.push({ where: item.setId, msg: 'set の code.lines が不正' });
        if (item.figure) for (const msg of checkFigure(item.figure)) errors.push({ where: item.setId, msg });
        if (seen.has(item.setId)) errors.push({ where: item.setId, msg: 'setId が重複' });
        else seen.set(item.setId, file);
      }
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
    byFigure: count((q) => q.figure?.type ?? '(なし)', live),
    glossaryCount: glossary?.terms?.length ?? 0,
    linked: live.filter((q) => q.terms?.length).length,
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
