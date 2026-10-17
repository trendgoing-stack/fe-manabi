// 読み上げ（端末内蔵の音声合成 speechSynthesis）。外部への送信はしない。
// iPhone では、ボタンをタップした操作から始める必要がある。長い文章は文ごとに分けて読ませる。
import * as storage from './storage.js';
import { app } from './state.js';
import { buildReadings, toSpeechText, termSpeechText, termFullText, sectionSpeechText } from './speech-text.js';

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

let readings = null;

/** 英字だけの用語を「読み」に置き換えるための表（用語集が読み込まれたら一度だけ作る） */
function readingTable() {
  if (readings?.src !== app.data.glossary) readings = { src: app.data.glossary, list: buildReadings(app.data.glossary) };
  return readings.list;
}

/** 画面用の文章記法や記号を、読み上げに向く文字列に直す */
export const toSpeech = (text) => toSpeechText(text, readingTable());

/** 用語名そのものを読ませるときの文字列（英字だけの用語は「読み」を使う） */
export const termSpeech = (t) => termSpeechText(t, readingTable());

/** 用語の読み上げ全文（用語名＋定義） */
export const termFull = (t) => termFullText(t, readingTable());

/** 解説テキストの節の読み上げ全文。summary が true なら要約表示の内容 */
export const sectionFull = (section, summary) => sectionSpeechText(section, summary, readingTable());

const QUALITY_NAME = /premium|enhanced|プレミアム|拡張|高品質|siri/i;

/** 声の品質の目安（大きいほど自然）。名前に「拡張」「プレミアム」などが付く声は、端末に追加ダウンロードした高品質版 */
const quality = (v) => (QUALITY_NAME.test(v.name) ? 2 : /compact/i.test(v.name) ? 0 : 1);

/** 端末の日本語の声を、品質の高い順に返す */
export function japaneseVoices() {
  if (!speechSupported()) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang === 'ja-JP' || v.lang?.replace('_', '-').startsWith('ja'))
    .sort((a, b) => quality(b) - quality(a) || a.name.localeCompare(b.name));
}

export const voiceLabel = (v) => `${v.name}${quality(v) === 2 ? '（高品質）' : ''}`;

/** 「声を指定しない」を表す設定値。端末の既定の声（設定アプリで選んだ声）に任せる */
export const SYSTEM_VOICE = '__system__';

/**
 * 読み上げに使う声。null は「声を指定しない」で、端末が既定の声を選ぶ。
 * 未選択のときは、高品質な声が公開されていればそれを、無ければ端末の既定に任せる
 * （iPhone の Safari は「拡張」「Siri」の声を公開しないことがあるため）。
 */
export function currentVoice() {
  const list = japaneseVoices();
  const chosen = storage.getSettings().speechVoice;
  if (chosen === SYSTEM_VOICE) return null;
  const picked = list.find((v) => v.voiceURI === chosen);
  if (picked) return picked;
  return list[0] && quality(list[0]) === 2 ? list[0] : null;
}

/** 声の一覧が読み込まれた（または変わった）ときに呼ぶ。戻り値で解除 */
export function onVoicesChanged(fn) {
  if (!speechSupported()) return () => {};
  window.speechSynthesis.addEventListener('voiceschanged', fn);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', fn);
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
  const voice = currentVoice();
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
