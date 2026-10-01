// 問題の terms[] を用語集から自動で付ける（開発用・Node）。
// 解説（explanation）と各選択肢の理由（why）に出てくる用語を、js/terms.js と同じ規則で探す。
// 使い方: node tools/link-terms.mjs
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, readJson } from './verify/lib/load.mjs';
import { findTerms } from '../js/terms.js';
import { CATEGORIES } from '../js/categories.js';

const { terms } = await readJson('data/glossary.json');
const meta = await readJson('data/meta.json');
let linked = 0;
let total = 0;

for (const file of meta.files) {
  const json = await readJson(`data/${file}`);
  for (const item of json.items) {
    for (const q of item.questions ?? [item]) {
      const text = [q.explanation, ...q.choices.map((c) => c.why)].join('\n');
      // 同じ表記の用語が複数ある（例：可用性）ときは、問題と同じカテゴリ、次に同じ分野の用語を優先する
      const fieldOf = (cat) => CATEGORIES.find((c) => c.name === cat)?.field;
      const score = (t) => (t.category === q.category ? 0 : fieldOf(t.category) === q.field ? 1 : 2);
      // linkScope が付いた用語は、同じカテゴリ（category）または同じ分野（field）の問題にだけリンクする
      const inScope = (t) => !t.linkScope || (t.linkScope === 'category' ? t.category === q.category : fieldOf(t.category) === q.field);
      const ordered = terms.filter(inScope).sort((a, b) => score(a) - score(b));
      const ids = [...new Set(findTerms(text, ordered).map((f) => f.id))].sort();
      q.terms = ids;
      total++;
      if (ids.length) linked++;
    }
  }
  await writeFile(path.join(ROOT, 'data', file), JSON.stringify(json, null, 2) + '\n');
}
console.log(`用語リンク: ${linked} / ${total} 問に1語以上`);
