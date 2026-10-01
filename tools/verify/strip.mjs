// 検証パス1（独立解答）用：正解・理由・解説を取り除いた問題を出力する。
// 使い方: node tools/verify/strip.mjs data/questions/a/tech-kiso-01.json > blind.json
import { readFile } from 'node:fs/promises';
import { flatten } from './lib/load.mjs';

const file = process.argv[2];
if (!file) {
  console.error('使い方: node tools/verify/strip.mjs <問題ファイル>');
  process.exit(1);
}

const { items } = JSON.parse(await readFile(file, 'utf8'));
const blind = flatten(items).map((q) => ({
  id: q.id,
  ...(q.setId ? { set: { setId: q.setId, title: q.setTitle, stem: q.setStem, ...(q.setCode ? { code: q.setCode } : {}), ...(q.setTable ? { table: q.setTable } : {}), ...(q.setFigure ? { figure: q.setFigure } : {}) } } : {}),
  stem: q.stem,
  ...(q.table ? { table: q.table } : {}),
  ...(q.code ? { code: q.code } : {}),
  ...(q.figure ? { figure: q.figure } : {}),
  choices: q.choices.map((c) => c.text),
}));
console.log(JSON.stringify(blind, null, 2));
