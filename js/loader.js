// 問題データの読み込み。meta.json を先に読み、files[] を並列で取得する。

/**
 * @typedef {Object} Loaded
 * @property {import('./types.js').Meta|null} meta
 * @property {import('./types.js').Question[]} questions
 * @property {Map<string, import('./types.js').Question>} byId
 * @property {string[]} failed   読み込めなかったファイル名
 * @property {import('./types.js').GlossaryTerm[]} glossary
 * @property {Map<string, import('./types.js').GlossaryTerm>} termById
 * @property {import('./types.js').TextChapter[]} texts   解説テキストの章（meta.textFiles の順）
 */

const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

/** @returns {Promise<Loaded>} */
export async function loadData() {
  /** @type {Loaded} */
  const out = { meta: null, questions: [], byId: new Map(), failed: [], glossary: [], termById: new Map(), texts: [] };
  try {
    out.meta = await getJson('data/meta.json');
  } catch {
    out.failed.push('meta.json');
    return out;
  }

  const textFiles = out.meta.textFiles ?? [];
  const [glossary, ...all] = await Promise.allSettled([getJson('data/glossary.json'), ...out.meta.files.map((f) => getJson(`data/${f}`)), ...textFiles.map((f) => getJson(`data/${f}`))]);
  const results = all.slice(0, out.meta.files.length);
  all.slice(out.meta.files.length).forEach((r, i) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value?.sections)) out.texts.push(r.value);
    else out.failed.push(textFiles[i]);
  });
  if (glossary.status === 'fulfilled' && Array.isArray(glossary.value?.terms)) {
    out.glossary = glossary.value.terms;
    out.termById = new Map(out.glossary.map((t) => [t.id, t]));
  } else if (out.meta.counts?.glossary) {
    out.failed.push('glossary.json');
  }
  results.forEach((r, i) => {
    const file = out.meta.files[i];
    if (r.status !== 'fulfilled' || !Array.isArray(r.value?.items)) {
      out.failed.push(file);
      return;
    }
    for (const item of r.value.items) {
      // set 形式は設問単位に展開し、題材（setStem・setCode など）を各設問に付ける
      const qs = item.questions
        ? item.questions.map((q) => ({ ...q, setId: item.setId, setTitle: item.title, setStem: item.stem, setCode: item.code, setTable: item.table, setFigure: item.figure }))
        : [item];
      for (const q of qs) {
        if (out.byId.has(q.id)) continue; // id 重複は先勝ち（validate.html で検出する）
        out.byId.set(q.id, q);
        out.questions.push(q);
      }
    }
  });
  return out;
}
