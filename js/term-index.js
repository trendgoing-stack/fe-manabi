// 用語 → その用語が出てくる解説テキストの節。節の本文を一度だけ走査して索引にする（初回の呼び出し時）。
import { app } from './state.js';
import { findTerms } from './terms.js';
import { linkable } from './render/lesson.js';

/** @type {Map<string, {chapter:object, section:object, score:number}[]>|null} */
let index = null;
let indexedFor = null;

const TITLE_WEIGHT = 5;
const HEADING_WEIGHT = 3;

/** 節から (本文, 重み) の並びを取り出す */
function* texts(section) {
  yield [section.title, TITLE_WEIGHT];
  for (const p of section.points ?? []) yield [p, 1];
  for (const b of section.blocks ?? []) {
    if (b.type === 'h') yield [b.text, HEADING_WEIGHT];
    else if (b.type === 'p' || b.type === 'note') yield [b.text, 1];
    else if (b.type === 'list' || b.type === 'steps') for (const t of b.items) yield [t, 1];
    else if (b.type === 'example') yield [b.text, 1], yield [b.answer ?? '', 1];
  }
}

function build() {
  const map = new Map();
  for (const chapter of app.data.texts) {
    const terms = linkable(chapter.category);
    for (const section of chapter.sections) {
      const score = new Map();
      for (const [text, w] of texts(section)) {
        for (const f of findTerms(text, terms)) score.set(f.id, (score.get(f.id) ?? 0) + w);
      }
      for (const [id, s] of score) {
        if (!map.has(id)) map.set(id, []);
        map.get(id).push({ chapter, section, score: s });
      }
    }
  }
  for (const list of map.values()) list.sort((a, b) => b.score - a.score);
  return map;
}

/**
 * その用語が出てくる節を、関連の強い順に返す（節の題名・小見出しに出るものを上位にする）。
 * @param {string} termId
 */
export function sectionsFor(termId) {
  if (!index || indexedFor !== app.data.texts) {
    index = build();
    indexedFor = app.data.texts;
  }
  return index.get(termId) ?? [];
}

export const sectionHref = ({ chapter, section }) => `#/learn/${encodeURIComponent(chapter.id)}/${encodeURIComponent(section.id)}`;

// ---- 問題 → 関連する節（問題の tags と節の questionTags の重なりで探す） ----

/** @type {Map<string, Map<string, {chapter:object, section:object}[]>>|null} 「科目:カテゴリ」→ タグ → 節 */
let tagIndex = null;
let tagIndexedFor = null;

const chapterKey = (subject, category) => `${subject}:${category}`;

function buildTagIndex() {
  const map = new Map();
  for (const chapter of app.data.texts) {
    const key = chapterKey(chapter.subject, chapter.category);
    if (!map.has(key)) map.set(key, new Map());
    const byTag = map.get(key);
    for (const section of chapter.sections) {
      for (const tag of new Set(section.questionTags ?? [])) {
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag).push({ chapter, section });
      }
    }
  }
  return map;
}

/**
 * 問題に関連する節を、関連の強い順に返す。多くの節に付いているタグ（「計算」など）は軽く数える。
 * 合う節が無ければ空の配列。
 * @param {import('./types.js').Question} q
 * @param {number} [limit]
 */
export function sectionsForQuestion(q, limit = 3) {
  if (!tagIndex || tagIndexedFor !== app.data.texts) {
    tagIndex = buildTagIndex();
    tagIndexedFor = app.data.texts;
  }
  const byTag = tagIndex.get(chapterKey(q.subject, q.category));
  if (!byTag) return [];
  const score = new Map();
  for (const tag of new Set(q.tags ?? [])) {
    const hits = byTag.get(tag) ?? [];
    for (const hit of hits) {
      const cur = score.get(hit.section.id) ?? { ...hit, score: 0 };
      cur.score += 1 / hits.length;
      score.set(hit.section.id, cur);
    }
  }
  return [...score.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** 問題と同じ科目・カテゴリの章（関連する節が見つからないときの行き先） */
export const chapterForQuestion = (q) => app.data.texts.find((c) => c.subject === q.subject && c.category === q.category) ?? null;
