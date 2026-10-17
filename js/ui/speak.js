// 読み上げボタン。端末が読み上げに対応していなければ何も出さない。
import { h } from '../dom.js';
import { speechSupported, toggle, toggleClip, isPlaying, onSpeechChange } from '../speech.js';

/**
 * @param {string} id  読み上げ中の表示を合わせるための識別子
 * @param {() => string} getText  押した時点で読み上げる文字列を返す（toSpeech を通したもの）
 * @param {{label?:string, small?:boolean, grow?:boolean}} [opt]
 */
export function speakButton(id, getText, { label = '読み上げ', small = true, grow = false } = {}) {
  if (!speechSupported()) return null;
  const btn = h('button', { type: 'button', class: 'btn speak-btn' + (small ? ' small' : '') + (grow ? ' grow' : ''), onClick: () => toggle(id, getText()) });
  const draw = () => {
    const on = isPlaying(id);
    btn.textContent = on ? '■ 停止' : `♪ ${label}`;
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? '読み上げを止める' : `${label}（端末の音声で読み上げます）`);
  };
  draw();
  const off = onSpeechChange(() => {
    if (!btn.isConnected) return off(); // 画面が切り替わって外れたボタンは購読をやめる
    draw();
  });
  return btn;
}

/** 事前に作った音声（試作）の索引。無い・読めないときは空として扱う */
let pilotIndex = null;
export function loadPilotIndex() {
  pilotIndex ??= fetch('audio/pilot/index.json')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return pilotIndex;
}

/**
 * 用語の音声ファイル（試作）の再生ボタン。音声が無い用語では何も追加しない。
 * @param {HTMLElement} box  ボタンを入れる要素
 * @param {string} termId
 */
export function addPilotButtons(box, termId, { small = true } = {}) {
  loadPilotIndex().then((index) => {
    const entry = index[termId];
    if (!entry) return;
    for (const c of entry.clips) {
      const id = `clip-${termId}-${c.voice}`;
      const url = `audio/pilot/${c.file}`;
      const btn = h('button', { type: 'button', class: 'btn speak-btn' + (small ? ' small' : ''), onClick: () => toggleClip(id, url) });
      const draw = () => {
        const on = isPlaying(id);
        btn.textContent = on ? '■ 停止' : `♪ 高品質（試作）${c.label}`;
        btn.setAttribute('aria-pressed', String(on));
      };
      draw();
      const off = onSpeechChange(() => (btn.isConnected ? draw() : off()));
      box.append(btn);
    }
  });
}
