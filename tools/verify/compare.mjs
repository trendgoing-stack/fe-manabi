// 検証パス1（独立解答）の照合：解答者が出した JSON と、問題の answer を比べる。
// 使い方: node tools/verify/compare.mjs <解答JSON> [<解答JSON> ...]
// 解答JSONの形: [{ "id", "answer", "confidence", "ambiguous", "reason", "note" }]
import { readFile } from 'node:fs/promises';
import { loadAll } from './lib/load.mjs';

const byId = new Map();
for (const { questions } of await loadAll()) for (const q of questions) byId.set(q.id, q);

let match = 0;
const mismatches = [];
const remarks = [];
const solved = new Set();

for (const file of process.argv.slice(2)) {
  for (const s of JSON.parse(await readFile(file, 'utf8'))) {
    const q = byId.get(s.id);
    if (!q) {
      mismatches.push(`${s.id}: 問題データにない`);
      continue;
    }
    solved.add(s.id);
    if (s.answer === q.answer) match++;
    else mismatches.push(`${s.id}: 解答者 choices[${s.answer}]「${q.choices[s.answer]?.text}」／作成時 choices[${q.answer}]「${q.choices[q.answer].text}」\n      根拠: ${s.reason}`);
    if (s.ambiguous || s.confidence === 'low' || s.note) remarks.push(`${s.id}: ${s.ambiguous ? '[一意でない] ' : ''}${s.confidence === 'low' ? '[自信なし] ' : ''}${s.note ?? ''}`);
  }
}

console.log(`独立解答: ${match} 件一致 / ${solved.size} 件（全 ${byId.size} 問）`);
const unsolved = [...byId.keys()].filter((id) => !solved.has(id));
if (unsolved.length) console.log(`未解答: ${unsolved.join(' ')}`);
if (remarks.length) console.log(`\n解答者の指摘 ${remarks.length} 件:\n` + remarks.map((r) => '  - ' + r).join('\n'));
if (mismatches.length) {
  console.log(`\n不一致 ${mismatches.length} 件:\n` + mismatches.map((m) => '  - ' + m).join('\n'));
  process.exit(1);
}
