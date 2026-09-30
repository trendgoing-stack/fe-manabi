// 検証パス2（実行検証）：checks/*.mjs の計算結果と、問題の answer を照合する。
// 使い方: node tools/verify/run.mjs
import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT, loadAll } from './lib/load.mjs';

const checksDir = path.join(ROOT, 'tools/verify/checks');
const byId = new Map();
for (const { file, questions } of await loadAll()) {
  for (const q of questions) byId.set(q.id, { q, file });
}

let pass = 0;
const problems = [];
const covered = new Set();

for (const name of (await readdir(checksDir)).filter((n) => n.endsWith('.mjs')).sort()) {
  const rel = `tools/verify/checks/${name}`;
  const { checks } = await import(pathToFileURL(path.join(checksDir, name)).href);
  for (const [id, fn] of Object.entries(checks)) {
    const hit = byId.get(id);
    if (!hit) {
      problems.push(`${rel}: ${id} が問題データにない`);
      continue;
    }
    covered.add(id);
    try {
      const expected = fn(hit.q);
      if (expected === hit.q.answer) pass++;
      else problems.push(`${id}: 計算結果は choices[${expected}]、answer は ${hit.q.answer}`);
    } catch (e) {
      problems.push(`${id}: ${e.message}`);
    }
    if (hit.q.verification?.script !== rel) {
      problems.push(`${id}: verification.script が "${rel}" になっていない`);
    }
  }
}

// script を名乗っているのに検証関数がない問題
for (const [id, { q }] of byId) {
  if (q.verification?.script && !covered.has(id)) problems.push(`${id}: verification.script はあるが検証関数がない`);
}

console.log(`実行検証: ${pass} 件一致 / 対象 ${covered.size} 件（全 ${byId.size} 問）`);
if (problems.length) {
  console.log(`\n問題 ${problems.length} 件:`);
  for (const p of problems) console.log('  - ' + p);
  process.exit(1);
}
