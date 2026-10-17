// 読み上げ（端末内蔵の音声合成 speechSynthesis）。外部への送信はしない。
// iPhone では、ボタンをタップした操作から始める必要がある。長い文章は文ごとに分けて読ませる。
import * as storage from './storage.js';
import { app } from './state.js';

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let playing = null; // いま読んでいるものの識別子（ボタンの表示切り替えに使う）
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(playing));

/** 再生状態の変化を受け取る。戻り値で解除 */
export function onSpeechChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isPlaying = (id) => playing === id;

const ASCII_TERM = /^[A-Za-z0-9][A-Za-z0-9 .\-/+]*$/;
let readings = null;

/** 英字だけの用語（DRAM・RAID など）を、用語集の「読み」に置き換えるための表 */
function readingTable() {
  if (readings?.src !== app.data.glossary) {
    const list = (app.data.glossary ?? []).filter((t) => ASCII_TERM.test(t.term) && t.reading).map((t) => [t.term, t.reading]);
    list.sort((a, b) => b[0].length - a[0].length);
    readings = { src: app.data.glossary, list };
  }
  return readings.list;
}

/** 画面用の文章記法や記号を、読み上げに向く文字列に直す */
export function toSpeech(text) {
  let t = String(text)
    .replace(/\^\{([^{}]*)\}/g, 'の$1乗')
    .replace(/\^\(([^()]*)\)/g, 'の$1乗') // 2^(n−1) → 2のn−1乗
    .replace(/\^([A-Za-z0-9]+)/g, 'の$1乗') // 2^n → 2のn乗
    .replace(/_\{([^{}]*)\}/g, '$1')
    .replace(/÷/g, 'わる')
    .replace(/×/g, 'かける')
    .replace(/[＝=]/g, 'イコール')
    .replace(/−/g, 'マイナス');
  for (const [term, reading] of readingTable()) {
    if (!t.includes(term)) continue;
    const esc = term.replace(/[.*+?^${}()|[\]\/]/g, '\$&');
    t = t.replace(new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, 'g'), reading);
  }
  return t;
}

/** 用語名そのものを読ませるときの文字列（英字だけの用語は「読み」を使う） */
export const termSpeech = (t) => (ASCII_TERM.test(t.term) && t.reading ? t.reading : toSpeech(t.term));

function japaneseVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'ja-JP') ?? voices.find((v) => v.lang?.startsWith('ja')) ?? null;
}

export function stop() {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  if (playing !== null) {
    playing = null;
    notify();
  }
}

/** 文のまとまりに分ける（長い文章を一度に渡すと、iPhone で途中から止まることがあるため） */
function chunks(text) {
  return text
    .split(/(?<=[。！？\n])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * 読み上げる。すでに読んでいるものは止めてから始める。
 * @param {string} id  再生中の表示に使う識別子
 * @param {string} text  読み上げる文字列（toSpeech を通したもの）
 */
export function speak(id, text) {
  if (!speechSupported() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const parts = chunks(text);
  if (!parts.length) return;
  const rate = storage.getSettings().speechRate;
  const voice = japaneseVoice();
  playing = id;
  notify();
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    u.lang = 'ja-JP';
    if (voice) u.voice = voice;
    u.rate = rate;
    const finish = () => {
      if (i === parts.length - 1 && playing === id) {
        playing = null;
        notify();
      }
    };
    u.onend = finish;
    u.onerror = finish;
    synth.speak(u);
  });
}

/** 同じ識別子を読んでいる最中なら止め、そうでなければ読み始める */
export function toggle(id, text) {
  if (playing === id) stop();
  else speak(id, text);
}
