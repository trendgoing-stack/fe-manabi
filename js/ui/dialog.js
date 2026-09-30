import { h } from '../dom.js';

/**
 * モーダルを開く。build は close(value) を受け取り、中身の要素を返す。
 * @template T
 * @param {(close:(value:T)=>void)=>Node|Node[]} build
 * @returns {Promise<T|undefined>}  背景タップや Esc で閉じたときは undefined
 */
export function openDialog(build) {
  return new Promise((resolve) => {
    let result;
    const dlg = h('dialog', { class: 'dialog' });
    const close = (value) => {
      result = value;
      dlg.close();
    };
    dlg.append(h('div', { class: 'dialog-inner' }, build(close)));
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(result);
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/** 確認ダイアログ */
export function confirmDialog(message, { ok = 'OK', cancel = 'キャンセル', danger = false } = {}) {
  return openDialog((close) => [
    h('p', { class: 'dialog-msg' }, message),
    h(
      'div',
      { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', onClick: () => close(false) }, cancel),
      h('button', { type: 'button', class: 'btn ' + (danger ? 'danger' : 'primary'), onClick: () => close(true) }, ok),
    ),
  ]).then((v) => v === true);
}
