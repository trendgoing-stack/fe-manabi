// シラバス Ver.9.2 の用語例ごとに、用語集・問題・解説テキストで扱っているかを調べ、SYLLABUS_COVERAGE.md を作る。
// 使い方: node tools/syllabus-coverage.mjs <syllabus.txt>   （syllabus.txt は tools/syllabus-extract.py で作る）
import fs from 'node:fs';
import { ROOT, readJson } from './verify/lib/load.mjs';

const norm = (s) => String(s).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const src = fs.readFileSync(process.argv[2], 'utf8');

// ---- シラバスの解析：中分類 → 小分類 → 細目 → 用語例 ----
const mids = [];
let mid = null;
let sub = null;
let item = null;
let inTerms = false;
for (const raw of src.split('\n')) {
  const line = raw.trim();
  if (!line || /^Copyright|^-\d+-$|^=====PAGE/.test(line)) continue;
  let m;
  if ((m = line.match(/^大分類\d+：\S+\s+中分類(\d+)：(.+)$/))) {
    mid = { no: Number(m[1]), name: m[2].trim(), subs: [] };
    mids.push(mid);
    sub = item = null;
    inTerms = false;
  } else if (!mid) continue;
  else if ((m = line.match(/^(\d+)\.\s*(.+)$/)) && !sub?.isFirstLine) {
    sub = { no: Number(m[1]), name: m[2].trim(), items: [] };
    mid.subs.push(sub);
    item = null;
    inTerms = false;
  } else if (sub && (m = line.match(/^[（(](\d+)[）)]\s*(.+)$/))) {
    item = { name: m[2].trim(), terms: '' };
    sub.items.push(item);
    inTerms = false;
  } else if (sub && (m = line.match(/^([①-⑳])\s*(.+)$/))) {
    item = { name: m[1] + m[2].trim(), terms: '' };
    sub.items.push(item);
    inTerms = false;
  } else if (item && line.startsWith('用語例')) {
    item.terms += line.replace(/^用語例\s*/, '');
    inTerms = true;
  } else if (item && inTerms && !/^【|^➢/.test(line)) {
    item.terms += line;
  } else {
    inTerms = false;
  }
}

/** 「A，B（C，D），E」→ A, B, C, D, E（括弧内も別の語として数える） */
function splitTerms(s) {
  const out = [];
  const walk = (str) => {
    let depth = 0;
    let cur = '';
    const flush = () => cur.trim() && out.push(cur.trim());
    for (const ch of str) {
      if ('（('.includes(ch)) {
        if (!depth) {
          flush();
          cur = '';
        }
        depth++;
        if (depth > 1) cur += ch;
      } else if ('）)'.includes(ch)) {
        depth--;
        if (!depth) {
          // 括弧の中身。「（Binary Coded Decimal：2 進化10 進）」のような説明は語として数えない
          if (!/[：:]/.test(cur)) walk(cur);
          cur = '';
        } else cur += ch;
      } else if ((ch === '，' || ch === '、' || ch === ',') && depth <= 1) {
        if (depth === 0) flush();
        else if (depth === 1) {
          out.push(...cur.split(/[，、,]/).map((x) => x.trim()).filter(Boolean));
          cur = '';
        }
        if (depth === 0) cur = '';
      } else cur += ch;
    }
    flush();
  };
  walk(s);
  return [...new Set(out.filter((t) => t.length >= 1))];
}

// ---- 教材側のコーパス ----
const meta = await readJson('data/meta.json');
const glossary = (await readJson('data/glossary.json')).terms;
const glossNames = new Set(glossary.flatMap((t) => [t.term, ...(t.aliases ?? [])]).map(norm));
const glossText = norm(glossary.map((t) => [t.term, ...(t.aliases ?? []), t.definition].join(' ')).join('\n'));

const qTexts = [];
for (const f of meta.files) {
  const j = await readJson(`data/${f}`);
  for (const it of j.items) {
    for (const q of it.questions ?? [it]) {
      if (q.retired) continue;
      qTexts.push(norm([it.stem, q.stem, q.explanation, q.tags, q.terms?.map((id) => glossary.find((g) => g.id === id)?.term), q.choices?.map((c) => c.text + c.why), it.title, q.setStem].flat(3).join(' ')));
    }
  }
}
const qAll = qTexts.join('\n');
const countQ = (t) => qTexts.filter((x) => x.includes(t)).length;

const textBodies = [];
for (const f of meta.textFiles ?? []) {
  const j = await readJson(`data/${f}`);
  for (const s of j.sections) textBodies.push({ id: s.id, text: norm(JSON.stringify(s.blocks) + s.title + s.points.join('')) });
}
const textHits = (t) => textBodies.filter((b) => b.text.includes(t)).map((b) => b.id);

// ---- 集計 ----
const lines = [];
const sumRows = [];
let all = { terms: 0, gloss: 0, q: 0, text: 0, none: 0 };
for (const m of mids) {
  const c = { terms: 0, gloss: 0, q: 0, text: 0, none: 0 };
  const body = [];
  for (const s of m.subs) {
    const gaps = [];
    for (const it of s.items) {
      for (const term of splitTerms(it.terms)) {
        const t = norm(term);
        const inGloss = glossNames.has(t) || glossText.includes(t);
        const nq = countQ(t);
        const inText = textHits(t).length > 0;
        c.terms++;
        if (inGloss) c.gloss++;
        if (nq) c.q++;
        if (inText) c.text++;
        const status = [inGloss ? '' : '用語集なし', nq ? '' : '問題なし', inText ? '' : 'テキストなし'].filter(Boolean);
        if (!inGloss && !nq) c.none++;
        if (status.length) gaps.push({ item: it.name, term, status });
      }
    }
    const worst = gaps.filter((g) => g.status.includes('用語集なし') && g.status.includes('問題なし'));
    if (worst.length) body.push(`- **${s.no}. ${s.name}**：用語集にも問題にも出てこない語 ${worst.length}件\n` + worst.map((g) => `  - ${g.term}（${g.item.replace(/^[①-⑳]/, '')}）`).join('\n'));
  }
  for (const k of Object.keys(all)) all[k] += c[k];
  sumRows.push(`| ${m.no} | ${m.name} | ${c.terms} | ${c.gloss} | ${c.q} | ${c.text} | ${c.none} |`);
  lines.push(`### 中分類${m.no}：${m.name}\n\n${body.length ? body.join('\n') : '（用語集にも問題にも出てこない語はありません）'}\n`);
}

const out = `# SYLLABUS_COVERAGE.md — シラバス Ver.9.2 の用語例の対応表

\`node tools/syllabus-coverage.mjs <syllabus.txt>\` で自動生成（手で編集しない）。シラバスの「用語例」（括弧内の語も別に数える）を、用語集（用語・別名・定義文）、問題（題材・問い・選択肢・解説）、解説テキストの本文に、表記の一致で探した結果。**表記の一致なので目安**（言い換えや略称は「なし」と出る。逆に、別の文脈で偶然出た語は「あり」と出る）。

## 全体

用語例 ${all.terms}語：用語集に出る ${all.gloss}／問題に出る ${all.q}／テキストに出る ${all.text}／**用語集にも問題にも出ない ${all.none}**

| 中分類 | 名称 | 用語例 | 用語集 | 問題 | テキスト | どちらにも無し |
|---|---|---|---|---|---|---|
${sumRows.join('\n')}

## 用語集にも問題にも出てこない語（中分類別）

${lines.join('\n')}`;
fs.writeFileSync(`${ROOT}/SYLLABUS_COVERAGE.md`, out);
console.log(`中分類 ${mids.length}／小分類 ${mids.reduce((n, m) => n + m.subs.length, 0)}／細目 ${mids.reduce((n, m) => n + m.subs.reduce((k, s) => k + s.items.length, 0), 0)}／用語例 ${all.terms}語`);
console.log(sumRows.join('\n'));
