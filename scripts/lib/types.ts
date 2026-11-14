import type { Level, MondaiType, Part } from '../../src/lib/domain.ts';

export type SourceId = 'jlptpracticetest' | 'mojitest';

/**
 * 从数据源解析出的“原始题目”。只在本地处理时存在于内存中，
 * 其中 stem / listen 等字段可能包含试题原文片段，绝不写入仓库。
 */
export interface RawQuestion {
  level: Level;
  session: string; // 'YYYY-MM'
  part: Part;
  mondaiNo: number; // 试卷上的「問題N」（听力从1重新编号）
  type: MondaiType;
  number: string; // 试卷题号：'26'、'1番'、'質問1'
  answerIndex: number | null; // 0 起
  /** 下划线词 / 用法题目词 / 表记题假名 */
  target?: string;
  /** 选项（仅词汇・语法题，均为短形式） */
  options?: string[];
  /** 阅读题干（私有，仅用于分类） */
  stem?: string;
  /** 听力信息（私有，仅用于分类） */
  listen?: { scene?: string; question?: string; utterance?: string; image?: boolean };
  source: SourceId;
  sourceUrl?: string;
}

/**
 * 可提交到仓库的“事实层”记录：只含短形式（词、读音、语法形式）
 * 与派生标签，不含题干、篇章、听力原文或整句选项。
 */
export interface FactQuestion {
  part: Part;
  mondaiNo: number;
  type: MondaiType;
  number: string;
  answerIndex: number | null;
  target?: string;
  options?: string[];
  /** 阅读/听力：信息提取方式标签 */
  skill?: string;
  /** 听力：场景标签 */
  scene?: string;
  /** 即时应答：话语功能标签 */
  func?: string;
  /** 由私有文本（★题片段、即时应答台词）派生出的语法考点 id */
  grammarHits?: string[];
  /** 听力选项是否为图片 */
  image?: boolean;
  /** 两个来源答案不一致时，另一来源给出的答案（0 起） */
  altAnswerIndex?: number;
}

export interface FactSession {
  level: Level;
  session: string;
  /** 各部分采用的数据源 */
  sources: { language: SourceId | null; listening: SourceId | null };
  sourceUrls: Partial<Record<SourceId, string>>;
  /** 每个大問的题数，用于还原试卷结构 */
  structure: { part: Part; mondaiNo: number; type: MondaiType; items: number }[];
  questions: FactQuestion[];
  /** 两个来源的答案交叉核对结果（仅当两边都有「言語知識・読解」答案时） */
  answerCheck?: { compared: number; agreed: number; disagreed: string[] };
}
