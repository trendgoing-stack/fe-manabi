// 解説テキストの1章を書くための作業ファイルを作る（開発用）。
// 使い方: node tools/chapter-prep.mjs <syllabus.txt> <出力フォルダ> <章id>...
// 出力: <章id>_syll.txt（シラバスの該当中分類）、<章id>_q.txt（既存問題の要約）、<章id>_g.txt（用語集の用語）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from './verify/lib/load.mjs';

/** 章 id → カテゴリ名・科目・シラバスの中分類番号・ファイル名 */
export const CHAPTERS = {
  t01: { category: '基礎理論', mids: [1], file: 't01-kiso' },
  t02: { category: 'アルゴリズムとプログラミング', mids: [2], file: 't02-algo' },
  t03: { category: 'コンピュータ構成要素', mids: [3, 6], file: 't03-comp' },
  t04: { category: 'システム構成要素', mids: [4], file: 't04-system' },
  t05: { category: 'ソフトウェア', mids: [5], file: 't05-software' },
  t06: { category: 'UIと情報メディア', mids: [7, 8], file: 't06-ui-media' },
  t07: { category: 'データベース', mids: [9], file: 't07-db' },
  t08: { category: 'ネットワーク', mids: [10], file: 't08-network' },
  t09: { category: 'セキュリティ', mids: [11], file: 't09-security' },
  t10: { category: 'システム開発技術', mids: [12], file: 't10-dev' },
  t11: { category: '開発管理', mids: [13], file: 't11-devmgmt' },
  t12: { category: 'プロジェクトマネジメント', mids: [14], file: 't12-pm' },
  t13: { category: 'サービスマネジメント', mids: [15], file: 't13-sm' },
  t14: { category: 'システム監査', mids: [16], file: 't14-audit' },
  t15: { category: 'システム戦略', mids: [17, 18], file: 't15-strategy' },
  t16: { category: '経営戦略', mids: [19, 20, 21], file: 't16-business' },
  t17: { category: '企業と法務', mids: [22, 23], file: 't17-legal' },
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [syllPath, outDir, ...ids] = process.argv.slice(2);
  const src = fs.readFileSync(syllPath, 'utf8');
  const heads = [...src.matchAll(/^大分類\d+：\S+[ \t]+中分類(\d+)：/gm)].map((m) => ({ no: Number(m[1]), at: m.index }));
  const clean = (t) => t.split('\n').filter((l) => l.trim() && !/Copyright|^-\d+-|=====PAGE/.test(l)).join('\n');
  const meta = await readJson('data/meta.json');
  const glossary = (await readJson('data/glossary.json')).terms;
  const questions = [];
  for (const f of meta.files) {
    const j = await readJson(`data/${f}`);
    for (const it of j.items) for (const q of it.questions ?? [it]) if (!q.retired) questions.push(q);
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const id of ids) {
    const c = CHAPTERS[id];
    const parts = c.mids.map((n) => {
      const i = heads.findIndex((h) => h.no === n);
      return clean(src.slice(heads[i].at, heads[i + 1]?.at ?? src.length));
    });
    fs.writeFileSync(`${outDir}/${id}_syll.txt`, parts.join('\n\n'));
    const qs = questions.filter((q) => q.subject === 'A' && q.category === c.category);
    fs.writeFileSync(`${outDir}/${id}_q.txt`, qs.map((q) => `${q.id} | ${q.syllabusRef} | ${(q.tags ?? []).join(',')} | ${q.stem.at(-1).slice(0, 60)}`).join('\n'));
    const gs = glossary.filter((g) => g.category === c.category);
    fs.writeFileSync(`${outDir}/${id}_g.txt`, gs.map((g) => `${g.id} ${g.term}`).join('\n'));
    console.log(id, c.category, `シラバス${parts.join('').length}字／問題${qs.length}／用語${gs.length}`);
  }
}
