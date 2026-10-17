// 読み上げ用の文字列への変換。ブラウザにも Node にも依存しない。

export const ASCII_TERM = /^[A-Za-z0-9][A-Za-z0-9 .\-/+]*$/;

/** 英字だけの用語（DRAM・RAID など）と、用語集の「読み」の対応表。長い表記を先に並べる */
export function buildReadings(glossary) {
  const list = (glossary ?? []).filter((t) => ASCII_TERM.test(t.term) && t.reading).map((t) => [t.term, t.reading]);
  list.sort((a, b) => b[0].length - a[0].length);
  return list;
}

/**
 * 音声合成が読み間違える語の読み替え表（長い語を先に書く）。
 * 聞いて誤読に気付いたら、ここに「表記 → ひらがな」を足す。
 */
export const PRONUNCIATION = [
  ['再帰的', 'さいきてき'],
  ['再帰', 'さいき'],
];

/** 画面用の文章記法や記号を、読み上げに向く文字列に直す */
export function toSpeechText(text, readings) {
  let t = String(text);
  for (const [word, kana] of PRONUNCIATION) t = t.split(word).join(kana);
  t = t
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
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, 'g'), reading);
  }
  return t;
}

/** 用語名そのものを読ませるときの文字列（英字だけの用語は「読み」を使う） */
export const termSpeechText = (t, readings) => (ASCII_TERM.test(t.term) && t.reading ? t.reading : toSpeechText(t.term, readings));

/** 用語の読み上げ全文（用語名＋定義）。アプリの読み上げボタンで使う */
export const termFullText = (t, readings) => `${termSpeechText(t, readings)}。${toSpeechText(t.definition, readings)}`;

const SPEECH_NOTE = { point: 'ポイント', pitfall: '取り違えに注意', tip: 'コツ' };
const SPEECH_SUMMARY_TYPES = new Set(['h', 'note']);

/** 文の終わりを句点にそろえる（読み上げは句点で区切って順に読ませるため） */
const sentence = (t) => {
  const x = String(t).trim();
  return x && !/[。！？!?]$/.test(x) ? `${x}。` : x;
};

/**
 * 解説テキストの節を読み上げる文字列にする。図・表・プログラム・例題の答えは読まない。
 * summary が true なら、要約表示と同じ内容（要約・要点・小見出し・メモ）だけを読む。
 */
export function sectionSpeechText(section, summary, readings) {
  const sp = (t) => sentence(toSpeechText(t, readings));
  const out = [sp(section.title)];
  if (section.points?.length) out.push('要点。', ...section.points.map(sp));
  if (summary && section.digest) {
    out.push(sp(section.digest.text), ...(section.digest.keys ?? []).map(sp));
  }
  for (const b of section.blocks ?? []) {
    if (summary && !SPEECH_SUMMARY_TYPES.has(b.type)) continue;
    if (b.type === 'h') out.push(sp(b.text));
    else if (b.type === 'p') out.push(sp(b.text));
    else if (b.type === 'list' || b.type === 'steps') out.push(...(b.title ? [sp(b.title)] : []), ...b.items.map(sp));
    else if (b.type === 'note') out.push(sentence(SPEECH_NOTE[b.kind] ?? 'ポイント'), sp(b.text));
    else if (b.type === 'example') out.push(sp(`${b.title ?? '例題'}。${b.text}`));
  }
  return out.filter(Boolean).join('\n');
}
