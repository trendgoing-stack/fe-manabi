// 「AIに聞く」用のプロンプトを組み立てる（方式C：外部のAIに貼り付けて使う）。
// アプリは通信しない。ここで作るのは文字列だけ。
import { LABELS } from './render/question.js';

export const MODES = [
  { id: 'explain', label: '解説', ask: '選択した部分の意味と、なぜそうなるのかを解説してください。' },
  { id: 'easy', label: 'やさしく', ask: '初学者にも分かるように、専門用語をかみ砕いて説明してください。用語を使うときは一言で言い換えを添えてください。' },
  { id: 'analogy', label: '例え話', ask: '身近な例え話を1つ使って説明してください。例えのどこが実際の仕組みのどこに対応するかも書いてください。' },
  { id: 'exam', label: '試験の観点', ask: '試験でどう問われやすいか（よくあるひっかけ、似た用語との違い、計算の注意点）を中心に説明してください。' },
  { id: 'quiz', label: '確認問題', ask: '選択した部分の理解を確かめる四択問題を1問作ってください。正解と、各選択肢が正しい／誤りである理由も付けてください。' },
];

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};

/** ^{上付き} _{下付き} の記法を、AIに貼っても読める形に戻す */
const plain = (s) => String(s ?? '').replace(/\^\{([^{}]*)\}/g, '^$1').replace(/_\{([^{}]*)\}/g, '_$1');

/** 出どころ（章・節、または問題）を文章にする */
export function describeContext(ctx) {
  if (!ctx) return '';
  if (ctx.kind === 'section') {
    return [`学習アプリの解説テキスト（分野：${ctx.chapter.category}）`, `章：${plain(ctx.chapter.title)}`, `節：${plain(ctx.section.title)}`].join('\n');
  }
  if (ctx.kind === 'question') {
    const q = ctx.q;
    const order = ctx.order ?? q.choices.map((_, i) => i);
    const lines = [`学習アプリの問題（${q.subject === 'B' ? '科目B' : '科目A'}・${q.category}）`];
    const stem = [...(q.setStem ?? []), ...q.stem].map(plain).join('\n');
    lines.push('問題文：', stem);
    if (q.table) lines.push('表：', [q.table.header, ...q.table.rows].map((r) => r.map(plain).join(' | ')).join('\n'));
    if (q.code || q.setCode) lines.push('プログラム：', [...(q.setCode?.lines ?? []), ...(q.code?.lines ?? [])].join('\n'));
    lines.push('選択肢：', order.map((ci, pos) => `${LABELS[pos]}. ${plain(q.choices[ci].text)}`).join('\n'));
    // 答え合わせ前は、正解や解説を渡さない（自分で考える前に答えが見えないように）
    if (ctx.revealed) {
      lines.push(`正解：${LABELS[order.indexOf(q.answer)]}`, '解説：' + plain(q.explanation));
    }
    return lines.join('\n');
  }
  return '';
}

/**
 * @param {Object} o
 * @param {string} o.selection   選択した文字列
 * @param {string} [o.around]    選択を含む段落・項目の文
 * @param {string} o.mode        MODES の id
 * @param {string} [o.extra]     追加の質問
 * @param {Object|null} o.ctx    setAiContext で渡された文脈
 */
export function buildPrompt({ selection, around, mode, extra, ctx }) {
  const m = MODES.find((x) => x.id === mode) ?? MODES[0];
  const out = [];
  out.push('あなたは基本情報技術者試験（シラバス Ver.9.2）の家庭教師です。学習アプリで選択した部分について、次の依頼に答えてください。', '');
  out.push('# 依頼', m.ask);
  if (extra?.trim()) out.push(`追加の質問：${extra.trim()}`);
  out.push('', '# 選択した部分', `「${plain(selection).trim()}」`);
  const a = clip(plain(around), 400);
  if (a && a !== clip(plain(selection), 400)) out.push('', '# 選択を含む文', a);
  const src = describeContext(ctx);
  if (src) out.push('', '# 出どころ（背景として使ってください）', src);
  out.push(
    '',
    '# 回答の条件',
    '- 日本語で、400字程度を目安に簡潔に書く',
    '- 基本情報技術者試験の範囲に絞り、範囲外の話は広げない',
    '- 確かでない点は断定せず「確実ではない」と書く',
    '- 最後に「覚えるポイント」を1行で添える',
  );
  return out.join('\n');
}
