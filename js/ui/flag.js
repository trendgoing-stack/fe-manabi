// 誤りフラグ（自分用）の入力ダイアログ
import { h } from '../dom.js';
import { openDialog } from './dialog.js';
import { FLAG_KINDS } from '../categories.js';
import * as storage from '../storage.js';
import { toast } from './toast.js';

/**
 * @param {string} id 問題id
 * @returns {Promise<boolean>} フラグの状態が変わったか
 */
export async function openFlagDialog(id) {
  const current = storage.getFlags()[id];
  let kind = current?.kind ?? FLAG_KINDS[0].id;
  const memo = h('textarea', { class: 'input', rows: 3, placeholder: 'メモ（任意）', maxlength: 500 });
  memo.value = current?.memo ?? '';

  const result = await openDialog((close) => [
    h('h2', null, '誤りを報告'),
    h('p', { class: 'muted small' }, `${id}（この端末にだけ保存されます）`),
    h(
      'div',
      { class: 'radio-list' },
      FLAG_KINDS.map((k) =>
        h(
          'label',
          { class: 'radio-item' },
          h('input', { type: 'radio', name: 'flag-kind', checked: k.id === kind, onChange: () => (kind = k.id) }),
          k.label,
        ),
      ),
    ),
    memo,
    h(
      'div',
      { class: 'btn-row' },
      current ? h('button', { type: 'button', class: 'btn danger', onClick: () => close('remove') }, '取り消す') : null,
      h('button', { type: 'button', class: 'btn', onClick: () => close(null) }, '閉じる'),
      h('button', { type: 'button', class: 'btn primary', onClick: () => close('save') }, '保存'),
    ),
  ]);

  if (result === 'save') {
    if (storage.setFlag(id, kind, memo.value.trim())) toast('誤りフラグを保存しました');
    return true;
  }
  if (result === 'remove') {
    storage.removeFlag(id);
    toast('誤りフラグを取り消しました');
    return true;
  }
  return false;
}

/** 「あとで見直す」印の付け外しボタン（押すとその場で表示が変わる） */
export function markButton(id) {
  const btn = h('button', { type: 'button', class: 'chip mark-btn' });
  const draw = () => {
    const on = !!storage.getMarks()[id];
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? '★ 見直す印あり' : '☆ あとで見直す';
  };
  btn.addEventListener('click', () => {
    const on = !storage.getMarks()[id];
    if (storage.setMark(id, on)) toast(on ? '見直す印を付けました（復習タブに並びます）' : '見直す印を外しました');
    draw();
  });
  draw();
  return btn;
}
