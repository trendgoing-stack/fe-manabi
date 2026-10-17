// 読み上げ用の文字列への変換。ブラウザにも Node（音声ファイルの作成ツール）にも依存しない。

export const ASCII_TERM = /^[A-Za-z0-9][A-Za-z0-9 .\-/+]*$/;

/** 英字だけの用語（DRAM・RAID など）と、用語集の「読み」の対応表。長い表記を先に並べる */
export function buildReadings(glossary) {
  const list = (glossary ?? []).filter((t) => ASCII_TERM.test(t.term) && t.reading).map((t) => [t.term, t.reading]);
  list.sort((a, b) => b[0].length - a[0].length);
  return list;
}

/** 画面用の文章記法や記号を、読み上げに向く文字列に直す */
export function toSpeechText(text, readings) {
  let t = String(text)
    .replace(/\^\{([^{}]*)\}/g, 'の$1乗')
    .replace(/\^\(([^()]*)\)/g, 'の$1乗') // 2^(n−1) → 2のn−1乗
    .replace(/\^([A-Za-z0-9]+)/g, 'の$1乗') // 2^n → 2のn乗
    .replace(/_\{([^{}]*)\}/g, '$1')
    .replace(/÷/g, 'わる')
    .replace(/×/g, 'かける')
    .replace(/[＝=]/g, 'イコール')
    .replace(/−/g, 'マイナス');
  for (const [term, reading] of readings) {
    if (!t.includes(term)) continue;
    const esc = term.replace(/[.*+?^${}()|[\]\/]/g, '\$&');
    t = t.replace(new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, 'g'), reading);
  }
  return t;
}

/** 用語名そのものを読ませるときの文字列（英字だけの用語は「読み」を使う） */
export const termSpeechText = (t, readings) => (ASCII_TERM.test(t.term) && t.reading ? t.reading : toSpeechText(t.term, readings));

/** 用語の読み上げ全文（用語名＋定義）。アプリの読み上げボタンと音声ファイルで同じ文字列を使う */
export const termFullText = (t, readings) => `${termSpeechText(t, readings)}。${toSpeechText(t.definition, readings)}`;
