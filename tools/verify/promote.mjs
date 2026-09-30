// 検証結果を問題データに反映する：unverified → ai-verified
// パス3（品質検査）の指摘をすべて直し終えてから実行すること。
// 使い方: node tools/verify/promote.mjs <解答JSON> [<解答JSON> ...] [--web=id,id,...]
//   - 独立解答が answer と一致し、ambiguous でない問題だけを昇格する
//   - verification.script がある問題は、実行検証（run.mjs）が通っていることが前提
//   - --web で一次情報を確認できた問題を指定すると methods に web-source を加える
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, readJson } from './lib/load.mjs';

const args = process.argv.slice(2);
const web = new Set((args.find((a) => a.startsWith('--web='))?.slice(6) ?? '').split(',').filter(Boolean));
const solved = new Map();
for (const file of args.filter((a) => !a.startsWith('--'))) {
  for (const s of JSON.parse(await readFile(file, 'utf8'))) solved.set(s.id, s);
}

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const meta = await readJson('data/meta.json');
let promoted = 0;
const skipped = [];

for (const file of meta.files) {
  const json = await readJson(`data/${file}`);
  let changed = false;
  for (const item of json.items) {
    for (const q of item.questions ?? [item]) {
      if (q.verification.status !== 'unverified') continue;
      const s = solved.get(q.id);
      if (!s || s.answer !== q.answer || s.ambiguous) {
        skipped.push(`${q.id}: ${!s ? '独立解答がない' : s.ambiguous ? '一意でないとの指摘' : '独立解答と不一致'}`);
        continue;
      }
      const methods = ['independent-solve'];
      if (q.verification.script) methods.push('script');
      methods.push('quality-review');
      if (web.has(q.id)) methods.push('web-source');
      q.verification = { ...q.verification, status: 'ai-verified', methods, verifiedAt: today };
      promoted++;
      changed = true;
    }
  }
  if (changed) await writeFile(path.join(ROOT, 'data', file), JSON.stringify(json, null, 2) + '\n');
}

console.log(`ai-verified に昇格: ${promoted} 問`);
if (skipped.length) console.log(`見送り ${skipped.length} 問:\n` + skipped.map((s) => '  - ' + s).join('\n'));
