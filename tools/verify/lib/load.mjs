// data/meta.json の files[] をたどって問題を読み込む（開発用・Node）
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const readJson = async (rel) => JSON.parse(await readFile(path.join(ROOT, rel), 'utf8'));

/** set 形式を設問単位に展開する */
export const flatten = (items) => items.flatMap((it) => (it.questions ? it.questions : [it]));

/** @returns {Promise<{file:string, questions:object[]}[]>} */
export async function loadAll() {
  const meta = await readJson('data/meta.json');
  const out = [];
  for (const file of meta.files) {
    const json = await readJson(path.posix.join('data', file));
    out.push({ file, questions: flatten(json.items) });
  }
  return out;
}
