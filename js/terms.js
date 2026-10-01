// 用語の検出（解説中の用語にリンクを付ける）。tools/link-terms.mjs と同じ規則で探す。

const ASCII_WORD = /^[A-Za-z0-9]/;
const KATAKANA = /[ァ-ヺー]/;

/** 用語の表記一覧（用語名と別名）。2文字未満は誤検出が多いので使わない */
export const namesOf = (t) => [t.term, ...(t.aliases ?? [])].filter((n) => n && n.length >= 2);

/**
 * text 中の用語の出現位置を、重ならないように長いもの優先で返す。
 * 英数字で始まる表記は、前後が英数字でないときだけ一致とみなす（「AC」が「ACID」に一致しないように）。
 * @param {string} text
 * @param {{id:string, term:string, aliases?:string[]}[]} terms
 * @returns {{start:number, end:number, id:string}[]}  start の昇順
 */
export function findTerms(text, terms) {
  const cands = [];
  for (const t of terms) {
    for (const name of namesOf(t)) {
      let i = text.indexOf(name);
      while (i >= 0) {
        const end = i + name.length;
        // 英数字の語は前後が英数字でないとき、カタカナで始まる／終わる語は前後がカタカナでないときだけ一致とする
        //（「AC」が「ACID」に、「ロック」が「クロック」に、「ビュー」が「レビュー」に一致しないように）
        const before = text[i - 1] ?? '';
        const after = text[end] ?? '';
        const ok =
          (!ASCII_WORD.test(name) || (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after))) &&
          (!KATAKANA.test(name[0]) || !KATAKANA.test(before)) &&
          (!KATAKANA.test(name[name.length - 1]) || !KATAKANA.test(after));
        if (ok) cands.push({ start: i, end, id: t.id });
        i = text.indexOf(name, i + 1);
      }
    }
  }
  cands.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const taken = [];
  for (const c of cands) {
    if (taken.some((t) => c.start < t.end && t.start < c.end)) continue;
    taken.push(c);
  }
  return taken.sort((a, b) => a.start - b.start);
}
