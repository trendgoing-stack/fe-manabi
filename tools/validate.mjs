// validate.html と同じ検査をコマンドラインで行う（開発用・Node）
// 使い方: node tools/validate.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, readJson } from './verify/lib/load.mjs';
import { validateAll } from './validate-core.js';

const meta = await readJson('data/meta.json');
const files = await Promise.all(meta.files.map(async (file) => ({ file, json: await readJson(`data/${file}`).catch(() => null) })));
const swText = await readFile(path.join(ROOT, 'sw.js'), 'utf8').catch(() => null);
const glossary = await readJson('data/glossary.json').catch(() => null);
const r = validateAll(meta, files, swText, glossary);

const show = (title, map) => console.log(`${title}: ` + [...map].map(([k, v]) => `${k}=${v}`).join(', '));
console.log(`問題数 ${r.questions.length}（retired ${r.retired}）／dataVersion ${meta.dataVersion}／sw.js ${r.swVersion}`);
show('ステータス', r.byStatus);
show('分野', r.byField);
show('カテゴリ', r.byCategory);
show('中分類', r.bySyllabusRef);
show('難易度', r.byDifficulty);
show('正解位置', r.byAnswer);
console.log(`文章選択肢 ${r.bias.n}問：正解が最長 ${r.bias.longest}、最短 ${r.bias.shortest}、長さ比 ${r.bias.ratio.toFixed(2)}、外れ値 ${r.bias.outliers.join(' ') || 'なし'}`);
console.log(`needsUserCheck: ${r.needsUserCheck.join(' ') || 'なし'}／disputed: ${r.disputed.join(' ') || 'なし'}`);
if (r.errors.length) {
  console.log(`\nエラー ${r.errors.length} 件:`);
  for (const e of r.errors) console.log(`  - ${e.where}: ${e.msg}`);
  process.exit(1);
}
console.log('エラーなし');
