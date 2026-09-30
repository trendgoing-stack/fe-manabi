// 型定義（JSDoc）。実行時のコードは持たない。

/**
 * @typedef {'A'|'B'} Subject
 * @typedef {'technology'|'management'|'strategy'} Field
 * @typedef {'unverified'|'ai-verified'|'user-verified'|'disputed'} VerificationStatus
 * @typedef {'independent-solve'|'script'|'quality-review'|'web-source'} VerificationMethod
 */

/**
 * @typedef {Object} Choice
 * @property {string} text
 * @property {string} why   その選択肢が正しい／誤りである理由（1文）
 */

/**
 * @typedef {Object} Verification
 * @property {VerificationStatus} status
 * @property {VerificationMethod[]} methods
 * @property {string|null} verifiedAt   YYYY-MM-DD
 * @property {string} [script]          tools/verify/checks/*.mjs
 * @property {string} [note]
 */

/**
 * @typedef {Object} TableData
 * @property {string[]} header
 * @property {string[][]} rows
 */

/**
 * @typedef {Object} CodeData  擬似言語（フェーズ4）
 * @property {string[]} lines
 */

/**
 * @typedef {Object} FigureData  図データ（フェーズ3）
 * @property {'tree'|'state'|'er'|'network'|'logic'|'gantt'|'arrow'} type
 */

/**
 * @typedef {Object} Question
 * @property {string} id                 例: a-tech-0012。全ファイルで一意・不変
 * @property {Subject} subject
 * @property {Field} field
 * @property {string} category           categories.js の固定リストから1つ
 * @property {string} syllabusRef        シラバス中分類名
 * @property {1|2|3} difficulty
 * @property {string[]} stem             段落ごとの問題文
 * @property {TableData} [table]
 * @property {CodeData} [code]
 * @property {FigureData} [figure]
 * @property {Choice[]} choices          長さ4
 * @property {0|1|2|3} answer            choices の index
 * @property {boolean} [fixedOrder]
 * @property {string} explanation
 * @property {string[]} terms
 * @property {string[]} tags
 * @property {string} [asOf]             YYYY-MM
 * @property {Verification} verification
 * @property {boolean} [needsUserCheck]
 * @property {boolean} [retired]
 * @property {'original'} source
 * @property {string} [setId]            set に属する場合、ローダーが付与する
 */

/**
 * 科目B用：共通の題材＋複数の設問（フェーズ4で実装）
 * @typedef {Object} QuestionSet
 * @property {string} setId
 * @property {Subject} subject
 * @property {string} title
 * @property {string[]} stem
 * @property {CodeData} [code]
 * @property {FigureData} [figure]
 * @property {TableData} [table]
 * @property {Question[]} questions
 */

/**
 * @typedef {Object} QuestionFile
 * @property {number} schemaVersion
 * @property {(Question|QuestionSet)[]} items
 */

/**
 * @typedef {Object} Meta
 * @property {string} dataVersion
 * @property {number} schemaVersion
 * @property {string} syllabusVersion
 * @property {{A:{count:number,minutes:number,ratio:Object<string,number>}, B:{count:number,minutes:number,ratio:Object<string,number>}}} examSpec
 * @property {{A:number,B:number,glossary:number}} counts
 * @property {string[]} files
 */

/**
 * 問題ごとの成績
 * @typedef {Object} Stat
 * @property {number} attempts
 * @property {number} correct
 * @property {number} lastAt     最終回答時刻（ms）
 * @property {boolean} lastOk    直近の回答が正解か
 * @property {1|2|3|4|5} box     ライトナーの箱
 * @property {string} due        次回の復習日（ローカル日付 YYYY-MM-DD）
 */

/**
 * 回答履歴の1件
 * @typedef {Object} HistoryEntry
 * @property {number} ts
 * @property {string} id
 * @property {boolean} ok
 * @property {'drill'|'review'|'mock'|'retry'} mode
 * @property {Field} field
 * @property {string} category
 */

/**
 * 日別集計：daily[YYYY-MM-DD][category] = { n, ok }
 * @typedef {Object<string, Object<string, {n:number, ok:number}>>} Daily
 */

/**
 * @typedef {Object} Flag
 * @property {'wrong-answer'|'unclear'|'typo'|'other'} kind
 * @property {string} memo
 * @property {number} at
 */

/**
 * @typedef {Object} Settings
 * @property {'normal'|'large'} fontSize
 * @property {boolean} shuffle
 * @property {string} examDate           YYYY-MM-DD または ''
 * @property {number} dailyGoal
 * @property {number} reviewLimit
 * @property {boolean} excludeFlagged
 * @property {boolean} includeUnverified
 */

/**
 * セッション内の1問
 * @typedef {Object} SessionItem
 * @property {string} id
 * @property {number[]} order            表示順 → choices の index
 * @property {number|null} selected      選択中の choices の index（表示位置ではない）
 * @property {boolean} done
 * @property {boolean|null} ok
 * @property {boolean} unknown           「わからない」で確定したか
 */

/**
 * @typedef {Object} Session
 * @property {'drill'|'review'|'retry'} mode
 * @property {string} label
 * @property {number} startedAt
 * @property {number} pos
 * @property {SessionItem[]} items
 * @property {boolean} finished
 */

export {};
