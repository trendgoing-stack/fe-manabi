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
