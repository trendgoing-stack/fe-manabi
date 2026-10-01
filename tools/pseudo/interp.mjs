// 擬似言語インタプリタ（開発用・Node）。科目Bの問題のコードを実行して、正解を機械的に確かめる。
// 記法は IPA「試験で使用する情報技術に関する用語・プログラム言語など Ver.5.0」別紙2 に沿い、
// このアプリで使う範囲を CONTENT.md「擬似言語」に定める。範囲外の書き方はエラーにする。

export class PseudoError extends Error {
  constructor(msg, line) {
    super(line ? `${line}行目: ${msg}` : msg);
    this.line = line;
  }
}

export const UNDEF = Symbol('未定義');
const TYPES = ['整数型', '実数型', '文字型', '文字列型', '論理型'];

// ---------- 字句解析 ----------

const SYMBOLS = [
  ['←', '←'], ['≠', '≠'], ['≦', '≦'], ['≧', '≧'], ['<=', '≦'], ['>=', '≧'], ['!=', '≠'],
  ['＜', '<'], ['＞', '>'], ['＝', '='], ['<', '<'], ['>', '>'], ['=', '='],
  ['＋', '+'], ['+', '+'], ['－', '-'], ['−', '-'], ['-', '-'], ['×', '*'], ['*', '*'], ['÷', '/'], ['/', '/'],
  ['（', '('], ['）', ')'], ['(', '('], [')', ')'], ['[', '['], [']', ']'], ['{', '{'], ['}', '}'], ['，', ','], [',', ','], ['.', '.'],
];

function tokenize(src, line) {
  const t = [];
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m;
    if ((m = rest.match(/^[\s　]+/))) { i += m[0].length; continue; }
    if ((m = rest.match(/^\d+\.\d+|^\d+/))) { t.push({ k: 'num', v: Number(m[0]) }); i += m[0].length; continue; }
    if ((m = rest.match(/^"([^"]*)"|^“([^”]*)”/))) { t.push({ k: 'str', v: m[1] ?? m[2] }); i += m[0].length; continue; }
    if ((m = rest.match(/^'([^']*)'|^‘([^’]*)’/))) { t.push({ k: 'str', v: m[1] ?? m[2] }); i += m[0].length; continue; }
    if ((m = rest.match(/^の\s*要素数/))) { t.push({ k: 'len' }); i += m[0].length; continue; }
    if ((m = rest.match(/^の\s*文字数/))) { t.push({ k: 'len' }); i += m[0].length; continue; }
    if ((m = rest.match(/^未定義の値|^未定義/))) { t.push({ k: 'undef' }); i += m[0].length; continue; }
    if ((m = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/))) {
      const w = m[0];
      if (['and', 'or', 'not', 'mod'].includes(w)) t.push({ k: 'op', v: w });
      else if (w === 'true' || w === 'false') t.push({ k: 'bool', v: w === 'true' });
      else t.push({ k: 'id', v: w });
      i += w.length;
      continue;
    }
    const sym = SYMBOLS.find(([s]) => rest.startsWith(s));
    if (sym) { t.push({ k: 'op', v: sym[1] }); i += sym[0].length; continue; }
    throw new PseudoError(`解釈できない文字「${rest[0]}」`, line);
  }
  return t;
}

// ---------- 式の構文解析（優先順位は別紙2のとおり） ----------

function parseExpr(src, line) {
  const t = tokenize(src, line);
  let p = 0;
  const peek = (v) => t[p] && t[p].k === 'op' && t[p].v === v;
  const eat = (v) => {
    if (!peek(v)) throw new PseudoError(`「${v}」が必要（${src}）`, line);
    p++;
  };
  const bin = (next, ops) => () => {
    let left = next();
    while (t[p] && t[p].k === 'op' && ops.includes(t[p].v)) {
      const op = t[p++].v;
      left = { k: 'bin', op, a: left, b: next() };
    }
    return left;
  };
  const primary = () => {
    const tok = t[p];
    if (!tok) throw new PseudoError(`式が途中で終わっている（${src}）`, line);
    p++;
    if (tok.k === 'num' || tok.k === 'str' || tok.k === 'bool') return { k: 'lit', v: tok.v };
    if (tok.k === 'undef') return { k: 'lit', v: UNDEF };
    if (tok.k === 'id') {
      if (peek('(')) {
        p++;
        const args = [];
        if (!peek(')')) {
          do args.push(or()); while (peek(',') && ++p);
        }
        eat(')');
        return { k: 'call', name: tok.v, args };
      }
      return { k: 'var', name: tok.v };
    }
    if (tok.k === 'op' && tok.v === '(') {
      const e = or();
      eat(')');
      return e;
    }
    if (tok.k === 'op' && tok.v === '{') {
      const items = [];
      if (!peek('}')) {
        do items.push(or()); while (peek(',') && ++p);
      }
      eat('}');
      return { k: 'arr', items };
    }
    throw new PseudoError(`式を解釈できない（${src}）`, line);
  };
  const postfix = () => {
    let e = primary();
    for (;;) {
      if (peek('[')) {
        p++;
        const idx = [or()];
        while (peek(',')) { p++; idx.push(or()); }
        eat(']');
        e = { k: 'idx', target: e, idx };
      } else if (peek('.')) {
        p++;
        const name = t[p++];
        if (!name || name.k !== 'id') throw new PseudoError('「.」の後にメンバ名が必要', line);
        e = { k: 'member', target: e, name: name.v };
      } else if (t[p] && t[p].k === 'len') {
        p++;
        e = { k: 'len', target: e };
      } else return e;
    }
  };
  const unary = () => {
    if (peek('not')) { p++; return { k: 'not', a: unary() }; }
    if (peek('-')) { p++; return { k: 'neg', a: unary() }; }
    if (peek('+')) { p++; return unary(); }
    return postfix();
  };
  const mul = bin(unary, ['*', '/', 'mod']);
  const add = bin(mul, ['+', '-']);
  const rel = bin(add, ['≠', '≦', '≧', '<', '=', '>']);
  const and = bin(rel, ['and']);
  const or = bin(and, ['or']);
  const e = or();
  if (p !== t.length) throw new PseudoError(`式の後に余分な記述がある（${src}）`, line);
  return e;
}

/** 括弧の外にある区切り文字で分割する */
function splitTop(s, sep) {
  const out = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === '“') quote = ch === '"' ? '"' : '”';
    else if ('([{（'.includes(ch)) depth++;
    else if (')]}）'.includes(ch)) depth--;
    if (depth === 0 && !quote && ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

// ---------- 文の構文解析 ----------

function stripComment(s) {
  return s.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '').trim();
}

/**
 * @param {string[]} lines  1行目が lines[0]
 */
export function parse(lines) {
  const items = lines.map((raw, i) => ({ no: i + 1, text: stripComment(raw) })).filter((x) => x.text);
  let p = 0;
  const funcs = new Map();
  const globals = [];

  const parseDecl = (text, no) => {
    const m = text.match(/^(大域\s*:\s*)?(整数型|実数型|文字型|文字列型|論理型)(の(二次元)?配列)?\s*:\s*(.+)$/);
    if (!m) return null;
    const vars = splitTop(m[5], ',').map((part) => {
      const [name, init] = splitTop(part, '←');
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new PseudoError(`変数名「${name}」が不正`, no);
      return { name, init: init != null ? parseExpr(init, no) : null };
    });
    return { k: 'decl', no, global: !!m[1], type: m[2], array: !!m[3], vars };
  };

  const block = (enders) => {
    const body = [];
    while (p < items.length) {
      const { no, text } = items[p];
      if (enders.some((e) => (e instanceof RegExp ? e.test(text) : text === e))) return body;
      if (text.startsWith('○')) {
        if (enders.length) throw new PseudoError('ブロックが閉じていない', no);
        return body;
      }
      p++;
      let m;
      if ((m = text.match(/^if\s*\((.*)\)$/))) {
        const branches = [{ cond: parseExpr(m[1], no), body: block([/^elseif\s*\(/, 'else', 'endif']) }];
        let elseBody = null;
        for (;;) {
          const cur = items[p];
          if (!cur) throw new PseudoError('endif がない', no);
          p++;
          let em;
          if ((em = cur.text.match(/^elseif\s*\((.*)\)$/))) branches.push({ cond: parseExpr(em[1], cur.no), body: block([/^elseif\s*\(/, 'else', 'endif']) });
          else if (cur.text === 'else') elseBody = block(['endif']);
          else if (cur.text === 'endif') break;
        }
        body.push({ k: 'if', no, branches, elseBody });
      } else if ((m = text.match(/^while\s*\((.*)\)$/))) {
        const b = block(['endwhile']);
        if (!items[p]) throw new PseudoError('endwhile がない', no);
        p++;
        body.push({ k: 'while', no, cond: parseExpr(m[1], no), body: b });
      } else if (text === 'do') {
        // do 〜 while (条件式)。do の中では while 文を使わない（CONTENT.md の制限）
        const b = block([/^while\s*\(.*\)$/]);
        const end = items[p];
        if (!end) throw new PseudoError('do に対応する while がない', no);
        p++;
        body.push({ k: 'do', no, endNo: end.no, cond: parseExpr(end.text.match(/^while\s*\((.*)\)$/)[1], end.no), body: b });
      } else if ((m = text.match(/^for\s*\((.+)\)$/))) {
        const fm = m[1].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*を\s*(.+?)\s*から\s*(.+?)\s*まで\s*(.+?)\s*ずつ\s*(増やす|減らす)$/);
        if (!fm) throw new PseudoError(`for の制御記述を解釈できない（${m[1]}）`, no);
        const b = block(['endfor']);
        if (!items[p]) throw new PseudoError('endfor がない', no);
        p++;
        body.push({ k: 'for', no, v: fm[1], from: parseExpr(fm[2], no), to: parseExpr(fm[3], no), step: parseExpr(fm[4], no), down: fm[5] === '減らす', body: b });
      } else if ((m = text.match(/^return(?:\s+(.+))?$/))) {
        body.push({ k: 'return', no, e: m[1] ? parseExpr(m[1], no) : null });
      } else if ((m = text.match(/^(.+?)\s*の末尾に\s*(.+?)\s*を追加する$/))) {
        body.push({ k: 'append', no, target: parseExpr(m[1], no), e: parseExpr(m[2].replace(/\s*の値$/, ''), no) });
      } else if ((m = text.match(/^(.+?)\s*を出力する$/))) {
        body.push({ k: 'print', no, es: splitTop(m[1].replace(/\s*の値$/, ''), ',').map((x) => parseExpr(x, no)) });
      } else {
        const decl = parseDecl(text, no);
        if (decl) body.push(decl);
        else {
          const parts = splitTop(text, '←');
          if (parts.length === 2) body.push({ k: 'assign', no, target: parseExpr(parts[0], no), e: parseExpr(parts[1], no) });
          else if (parts.length === 1) body.push({ k: 'expr', no, e: parseExpr(text, no) });
          else throw new PseudoError(`文を解釈できない（${text}）`, no);
        }
      }
    }
    if (enders.length) throw new PseudoError(`${enders.map(String).join('/')} がない`);
    return body;
  };

  while (p < items.length) {
    const { no, text } = items[p];
    if (text.startsWith('○')) {
      p++;
      const m = text.match(/^○\s*(?:(?:整数型|実数型|文字型|文字列型|論理型)(?:の(?:二次元)?配列)?\s*:\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/);
      if (!m) throw new PseudoError(`手続・関数の宣言を解釈できない（${text}）`, no);
      const params = m[2].trim()
        ? splitTop(m[2], ',').map((s) => {
            const pm = s.match(/^(?:整数型|実数型|文字型|文字列型|論理型)(?:の(?:二次元)?配列)?\s*:\s*([A-Za-z_][A-Za-z0-9_]*)$/);
            if (!pm) throw new PseudoError(`引数の宣言を解釈できない（${s}）`, no);
            return pm[1];
          })
        : [];
      funcs.set(m[1], { name: m[1], params, body: block([]), no });
    } else {
      const decl = parseDecl(text, no);
      if (!decl || !decl.global) throw new PseudoError(`手続の外には大域変数の宣言だけを書ける（${text}）`, no);
      globals.push(decl);
      p++;
    }
  }
  return { funcs, globals };
}

// ---------- 実行 ----------

class Return {
  constructor(v) {
    this.v = v;
  }
}

const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

/**
 * プログラムを実行する。
 * @param {string[]} lines
 * @param {Object} o
 * @param {string} o.call                 呼び出す手続・関数の名前
 * @param {any[]} [o.args]                引数（配列は JS の配列で渡す。要素番号は1から）
 * @param {Object} [o.globals]            大域変数の初期値を上書きする
 * @param {(no:number, env:Object)=>void} [o.onLine]  各文を実行する直前に呼ばれる
 * @param {number} [o.maxSteps]
 * @returns {{ value:any, output:string[], counts:Map<number,number>, globals:Object }}
 */
export function run(lines, o) {
  const prog = parse(lines);
  const output = [];
  const counts = new Map();
  let steps = 0;
  const maxSteps = o.maxSteps ?? 1e6;
  const g = {};
  const fmt = (v) => (v === UNDEF ? '未定義' : Array.isArray(v) ? `{${v.map(fmt).join(', ')}}` : String(v));

  const lookup = (env, name, no) => {
    if (name in env) return env;
    if (name in g) return g;
    throw new PseudoError(`変数 ${name} が宣言されていない`, no);
  };

  const ev = (e, env, no) => {
    switch (e.k) {
      case 'lit':
        return e.v;
      case 'var': {
        const v = lookup(env, e.name, no)[e.name];
        return v;
      }
      case 'arr':
        return e.items.map((x) => ev(x, env, no));
      case 'neg':
        return -num(ev(e.a, env, no), no);
      case 'not':
        return !bool(ev(e.a, env, no), no);
      case 'len': {
        const v = ev(e.target, env, no);
        if (!Array.isArray(v) && typeof v !== 'string') throw new PseudoError('要素数を求められない値', no);
        return v.length;
      }
      case 'idx': {
        let v = ev(e.target, env, no);
        for (const ie of e.idx) {
          const i = ev(ie, env, no);
          if (!Array.isArray(v) && typeof v !== 'string') throw new PseudoError('配列でない値に要素番号を付けた', no);
          if (!isInt(i) || i < 1 || i > v.length) throw new PseudoError(`要素番号 ${fmt(i)} が範囲外（要素数 ${v.length}）`, no);
          v = v[i - 1];
        }
        return v;
      }
      case 'member': {
        const obj = ev(e.target, env, no);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !(e.name in obj)) throw new PseudoError(`メンバ ${e.name} がない`, no);
        return obj[e.name];
      }
      case 'call':
        return call(e.name, e.args.map((a) => ev(a, env, no)), no);
      case 'bin': {
        if (e.op === 'and') return bool(ev(e.a, env, no), no) && bool(ev(e.b, env, no), no);
        if (e.op === 'or') return bool(ev(e.a, env, no), no) || bool(ev(e.b, env, no), no);
        const a = ev(e.a, env, no);
        const b = ev(e.b, env, no);
        if (e.op === '=' || e.op === '≠') {
          if (typeof a === 'object' || typeof b === 'object') throw new PseudoError('配列どうしは比較できない', no);
          return e.op === '=' ? a === b : a !== b;
        }
        if (e.op === '+' && (typeof a === 'string' || typeof b === 'string')) return fmt(a) + fmt(b);
        if (['<', '>', '≦', '≧'].includes(e.op) && typeof a === 'string' && typeof b === 'string') {
          return { '<': a < b, '>': a > b, '≦': a <= b, '≧': a >= b }[e.op];
        }
        const x = num(a, no);
        const y = num(b, no);
        switch (e.op) {
          case '+': return x + y;
          case '-': return x - y;
          case '*': return x * y;
          case '/':
            if (y === 0) throw new PseudoError('0 で割った', no);
            return isInt(x) && isInt(y) ? Math.trunc(x / y) : x / y;
          case 'mod':
            if (y === 0) throw new PseudoError('0 で割った余りを求めた', no);
            return x % y;
          case '<': return x < y;
          case '>': return x > y;
          case '≦': return x <= y;
          case '≧': return x >= y;
        }
      }
    }
    throw new PseudoError(`未対応の式（${e.k}）`, no);
  };

  const num = (v, no) => {
    if (typeof v !== 'number') throw new PseudoError(`数値が必要な所に ${fmt(v)} がある`, no);
    return v;
  };
  const bool = (v, no) => {
    if (typeof v !== 'boolean') throw new PseudoError(`論理値が必要な所に ${fmt(v)} がある`, no);
    return v;
  };

  const assign = (target, value, env, no) => {
    if (target.k === 'var') {
      lookup(env, target.name, no)[target.name] = value;
      return;
    }
    if (target.k === 'idx') {
      let arr = ev(target.target, env, no);
      const idx = target.idx.map((ie) => ev(ie, env, no));
      for (let d = 0; d < idx.length; d++) {
        if (!Array.isArray(arr)) throw new PseudoError('配列でない値に要素番号を付けた', no);
        const i = idx[d];
        if (!isInt(i) || i < 1 || i > arr.length) throw new PseudoError(`要素番号 ${fmt(i)} が範囲外（要素数 ${arr.length}）`, no);
        if (d === idx.length - 1) arr[i - 1] = value;
        else arr = arr[i - 1];
      }
      return;
    }
    if (target.k === 'member') {
      const obj = ev(target.target, env, no);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new PseudoError('メンバに代入できない', no);
      obj[target.name] = value;
      return;
    }
    throw new PseudoError('代入できない左辺', no);
  };

  const exec = (stmts, env) => {
    for (const s of stmts) {
      if (++steps > maxSteps) throw new PseudoError('実行ステップ数が上限を超えた（無限ループの可能性）', s.no);
      counts.set(s.no, (counts.get(s.no) ?? 0) + 1);
      o.onLine?.(s.no, { ...g, ...env });
      switch (s.k) {
        case 'decl':
          for (const v of s.vars) (s.global ? g : env)[v.name] = v.init ? ev(v.init, env, s.no) : s.array ? [] : UNDEF;
          break;
        case 'assign':
          assign(s.target, ev(s.e, env, s.no), env, s.no);
          break;
        case 'expr':
          ev(s.e, env, s.no);
          break;
        case 'append': {
          const arr = ev(s.target, env, s.no);
          if (!Array.isArray(arr)) throw new PseudoError('配列でないものに追加しようとした', s.no);
          arr.push(ev(s.e, env, s.no));
          break;
        }
        case 'print':
          output.push(s.es.map((e) => fmt(ev(e, env, s.no))).join(' '));
          break;
        case 'if': {
          const br = s.branches.find((b) => bool(ev(b.cond, env, s.no), s.no));
          if (br) exec(br.body, env);
          else if (s.elseBody) exec(s.elseBody, env);
          break;
        }
        case 'while':
          while (bool(ev(s.cond, env, s.no), s.no)) {
            exec(s.body, env);
            if (++steps > maxSteps) throw new PseudoError('実行ステップ数が上限を超えた', s.no);
            counts.set(s.no, counts.get(s.no) + 1);
          }
          break;
        case 'do':
          do {
            exec(s.body, env);
            counts.set(s.endNo, (counts.get(s.endNo) ?? 0) + 1);
            if (++steps > maxSteps) throw new PseudoError('実行ステップ数が上限を超えた', s.no);
          } while (bool(ev(s.cond, env, s.endNo), s.endNo));
          break;
        case 'for': {
          const from = num(ev(s.from, env, s.no), s.no);
          const to = num(ev(s.to, env, s.no), s.no);
          const step = num(ev(s.step, env, s.no), s.no);
          if (step <= 0) throw new PseudoError('for の増分は正の値にする', s.no);
          lookup(env, s.v, s.no)[s.v] = from;
          const cont = () => {
            const v = lookup(env, s.v, s.no)[s.v];
            return s.down ? v >= to : v <= to;
          };
          while (cont()) {
            exec(s.body, env);
            const holder = lookup(env, s.v, s.no);
            holder[s.v] = holder[s.v] + (s.down ? -step : step);
            if (++steps > maxSteps) throw new PseudoError('実行ステップ数が上限を超えた', s.no);
          }
          break;
        }
        case 'return':
          throw new Return(s.e ? ev(s.e, env, s.no) : undefined);
      }
    }
  };

  const call = (name, args, no) => {
    const f = prog.funcs.get(name);
    if (!f) {
      if (o.builtins?.[name]) return o.builtins[name](...args);
      throw new PseudoError(`手続・関数 ${name} が定義されていない`, no);
    }
    if (args.length !== f.params.length) throw new PseudoError(`${name} の引数の数が合わない`, no);
    const env = Object.fromEntries(f.params.map((p, i) => [p, args[i]]));
    try {
      exec(f.body, env);
    } catch (e) {
      if (e instanceof Return) return e.v;
      throw e;
    }
    return undefined;
  };

  // 大域変数を初期化してから呼び出す
  for (const d of prog.globals) for (const v of d.vars) g[v.name] = v.init ? ev(v.init, {}, d.no) : d.array ? [] : UNDEF;
  Object.assign(g, o.globals ?? {});
  const value = call(o.call, o.args ?? [], 0);
  return { value, output, counts, globals: g };
}

/**
 * トレース表を作る：指定した行を実行する直前の変数の値を、実行のたびに1行ずつ記録する。
 * @returns {string[][]}
 */
export function traceAt(lines, o, lineNo, vars) {
  const rows = [];
  const fmtv = (v) => (v === UNDEF || v === undefined ? '未定義' : Array.isArray(v) ? `{${v.join(', ')}}` : String(v));
  run(lines, {
    ...o,
    onLine: (no, env) => {
      if (no === lineNo) rows.push(vars.map((v) => fmtv(env[v])));
    },
  });
  return rows;
}
