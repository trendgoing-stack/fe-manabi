// 文章記法（^{上付き} _{下付き}）を DOM にする。textContent だけで組み立てる。

const TOKEN = /([\^_])\{([^{}]*)\}/g;

/**
 * @param {string} text
 * @returns {DocumentFragment}
 */
export function richText(text) {
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of String(text).matchAll(TOKEN)) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const el = document.createElement(m[1] === '^' ? 'sup' : 'sub');
    el.textContent = m[2];
    frag.append(el);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}
