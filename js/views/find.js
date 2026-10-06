// #/find：問題IDやキーワードで問題を探す（結果から #/q/<id> で正解・解説を開く）
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import { app } from '../state.js';

const LIMIT = 50;
const norm = (s) => String(s).normalize('NFKC').toLowerCase().trim();
const plain = (q) => [q.setTitle, ...(q.stem ?? []), ...(q.choices ?? []).map((c) => c.text)].filter(Boolean).join(' ');

/** 小さいほど上位。該当しなければ null。ID一致を本文一致より優先する */
function rank(q, query, digits) {
  const id = q.id;
  if (id === query) return 0;
  if (id.startsWith(query)) return 1;
  if (id.includes(query)) return 2;
  if (digits !== null && Number(id.slice(id.lastIndexOf('-') + 1)) === digits) return 3; // 「49」→ a-tech-0049 など
  const m = /^(?:[ab]-)?([a-z]+)-?(\d+)$/.exec(query); // 「tech-49」「a-tech49」→ a-tech-0049（桁ゼロの省略を許す）
  if (m && id.includes(`-${m[1]}-`) && Number(id.slice(id.lastIndexOf('-') + 1)) === Number(m[2]) && (query[1] !== '-' || id.startsWith(query.slice(0, 2)))) return 3;
  if (norm(plain(q)).includes(query)) return 4;
  return null;
}

function stateLabel(id) {
  const s = storage.getStats()[id];
  if (!s) return '未回答';
  return s.lastOk ? '直近 正解' : '直近 誤答';
}

export function findView(root, [initial = '']) {
  const input = h('input', {
    type: 'search',
    class: 'input',
    placeholder: '問題ID（例：a-tech-0049、49）またはキーワード',
    value: initial,
    enterkeyhint: 'search',
    autocomplete: 'off',
    autocapitalize: 'off',
    'aria-label': '問題を探す',
    onInput: () => draw(),
  });
  const list = h('div');

  const draw = () => {
    const query = norm(input.value).replace(/[\s_　]+/g, '-');
    if (!query) return fill(list, h('p', { class: 'muted' }, '問題IDの一部（数字だけでも可）か、問題文の語句を入力してください。'));
    const digits = /^\d+$/.test(query) ? Number(query) : null;
    const hits = app.data.questions
      .map((q) => [q, rank(q, query, digits)])
      .filter(([, r]) => r !== null)
      .sort((a, b) => a[1] - b[1] || a[0].id.localeCompare(b[0].id));
    if (!hits.length) return fill(list, h('p', { class: 'muted' }, '該当する問題がありません。'));
    fill(
      list,
      h('p', { class: 'muted small' }, hits.length > LIMIT ? `${hits.length}問が該当（先頭${LIMIT}問を表示）` : `${hits.length}問が該当`),
      h(
        'ul',
        { class: 'link-list' },
        hits.slice(0, LIMIT).map(([q]) =>
          h(
            'li',
            null,
            h(
              'a',
              { href: `#/q/${encodeURIComponent(q.id)}` },
              h('span', { class: 'link-title' }, (q.stem?.[0] ?? q.setTitle ?? '').replace(/\s+/g, ' ')),
              h(
                'span',
                { class: 'muted small' },
                `${q.id}・${q.subject === 'B' ? '科目B・' : ''}${q.category}・${stateLabel(q.id)}`,
              ),
            ),
          ),
        ),
      ),
    );
  };

  root.append(
    h('header', { class: 'run-head' }, h('button', { type: 'button', class: 'btn small', onClick: () => history.back() }, '戻る'), h('span', { class: 'run-progress' }, '問題を探す')),
    input,
    list,
  );
  draw();
  input.focus();
}
