// 日付はすべて端末のローカル日付（YYYY-MM-DD）で扱う

const pad = (n) => String(n).padStart(2, '0');

/** @param {number|Date} [t] */
export function localDate(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** @param {string} ymd */
export function parseDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** @param {string} ymd @param {number} days */
export function addDays(ymd, days) {
  const d = parseDate(ymd);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

/** b − a の日数 */
export function diffDays(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

export const today = () => localDate();
