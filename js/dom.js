// DOM生成ヘルパー。データは必ず textContent 経由で入れる（innerHTML は使わない）。

/**
 * @param {string} tag
 * @param {Object<string, any>|null} [props]  class / dataset / on* / 属性
 * @param {...(Node|string|number|null|undefined|false|Array)} children
 * @returns {HTMLElement}
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const clear = (el) => el.replaceChildren();

export const pct = (ok, n) => (n ? Math.round((ok / n) * 100) : 0);

/** 中身を差し替える。h() と同じく null / false / 配列を受け付ける */
export function fill(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}
