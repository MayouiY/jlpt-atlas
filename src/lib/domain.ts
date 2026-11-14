// 领域常量：前端与建库脚本共用。

export type Level = 'N1' | 'N2';
export const LEVELS: Level[] = ['N1', 'N2'];

export type Part = 'language' | 'listening';

/** 大問（题型）标识。名称与官方「問題の構成」一致。 */
export type MondaiType =
  | 'kanji_reading'
  | 'orthography'
  | 'word_formation'
  | 'context'
  | 'paraphrase'
  | 'usage'
  | 'grammar_form'
  | 'sentence_composition'
  | 'text_grammar'
  | 'reading_short'
  | 'reading_mid'
  | 'reading_long'
  | 'reading_integrated'
  | 'reading_thematic'
  | 'info_retrieval'
  | 'listen_task'
  | 'listen_point'
  | 'listen_summary'
  | 'listen_quick'
  | 'listen_integrated';

export type Paper = 'vocab' | 'grammar' | 'reading' | 'listening';

export interface MondaiTypeInfo {
  id: MondaiType;
  nameJa: string;
  nameZh: string;
  paper: Paper;
  /** 官方「ねらい」的中文转述 */
  aimZh: string;
  /** MOJiTest 的 questionType 编码 */
  mojiCode: number;
}

export const MONDAI_TYPES: MondaiTypeInfo[] = [
  { id: 'kanji_reading', nameJa: '漢字読み', nameZh: '汉字读音', paper: 'vocab', mojiCode: 11, aimZh: '考查用汉字书写的词语的读法' },
  { id: 'orthography', nameJa: '表記', nameZh: '汉字书写', paper: 'vocab', mojiCode: 12, aimZh: '考查用平假名书写的词语对应的汉字写法' },
  { id: 'word_formation', nameJa: '語形成', nameZh: '构词', paper: 'vocab', mojiCode: 13, aimZh: '考查派生词与复合词的知识' },
  { id: 'context', nameJa: '文脈規定', nameZh: '选词填空', paper: 'vocab', mojiCode: 14, aimZh: '考查根据上下文语义确定合适的词语' },
  { id: 'paraphrase', nameJa: '言い換え類義', nameZh: '近义替换', paper: 'vocab', mojiCode: 15, aimZh: '考查与题目词语、表达意义相近的词语、表达' },
  { id: 'usage', nameJa: '用法', nameZh: '词语用法', paper: 'vocab', mojiCode: 16, aimZh: '考查题目词语在句子中的正确用法' },
  { id: 'grammar_form', nameJa: '文の文法1（文法形式の判断）', nameZh: '语法形式判断', paper: 'grammar', mojiCode: 21, aimZh: '考查能否判断符合句意的语法形式' },
  { id: 'sentence_composition', nameJa: '文の文法2（文の組み立て）', nameZh: '句子排序（★题）', paper: 'grammar', mojiCode: 22, aimZh: '考查能否组成语法正确且意义通顺的句子' },
  { id: 'text_grammar', nameJa: '文章の文法', nameZh: '文章语法', paper: 'grammar', mojiCode: 23, aimZh: '考查能否判断符合文章脉络的句子与表达' },
  { id: 'reading_short', nameJa: '内容理解（短文）', nameZh: '短篇阅读', paper: 'reading', mojiCode: 31, aimZh: '阅读约200字的说明文、指示文等（含生活、工作话题），考查内容理解' },
  { id: 'reading_mid', nameJa: '内容理解（中文）', nameZh: '中篇阅读', paper: 'reading', mojiCode: 32, aimZh: '阅读约500字的评论、解说、随笔等，考查因果关系、理由等的理解' },
  { id: 'reading_long', nameJa: '内容理解（長文）', nameZh: '长篇阅读', paper: 'reading', mojiCode: 33, aimZh: '阅读约1000字的解说、随笔、小说等，考查概要与作者观点的理解' },
  { id: 'reading_integrated', nameJa: '統合理解', nameZh: '综合理解（A/B比较）', paper: 'reading', mojiCode: 34, aimZh: '对比阅读多篇文章（合计约600字），考查比较、整合理解能力' },
  { id: 'reading_thematic', nameJa: '主張理解（長文）', nameZh: '论点理解（长篇）', paper: 'reading', mojiCode: 35, aimZh: '阅读社论、评论等抽象且逻辑性强的长文，考查能否把握整体主张' },
  { id: 'info_retrieval', nameJa: '情報検索', nameZh: '信息检索', paper: 'reading', mojiCode: 36, aimZh: '从广告、宣传册、信息杂志、商务文书等材料（约700字）中找出所需信息' },
  { id: 'listen_task', nameJa: '課題理解', nameZh: '课题理解', paper: 'listening', mojiCode: 41, aimZh: '听取解决具体课题所需的信息，判断接下来做什么合适' },
  { id: 'listen_point', nameJa: 'ポイント理解', nameZh: '要点理解', paper: 'listening', mojiCode: 42, aimZh: '根据事先给出的提问，有针对性地抓住要点' },
  { id: 'listen_summary', nameJa: '概要理解', nameZh: '概要理解', paper: 'listening', mojiCode: 43, aimZh: '从整段内容中理解说话人的意图与主张' },
  { id: 'listen_quick', nameJa: '即時応答', nameZh: '即时应答', paper: 'listening', mojiCode: 45, aimZh: '听简短的问话等，选择合适的应答' },
  { id: 'listen_integrated', nameJa: '統合理解', nameZh: '综合理解（听力）', paper: 'listening', mojiCode: 46, aimZh: '听较长的内容，比较、整合多项信息后理解内容' },
];

export const MONDAI_BY_ID: Record<MondaiType, MondaiTypeInfo> = Object.fromEntries(
  MONDAI_TYPES.map((m) => [m.id, m]),
) as Record<MondaiType, MondaiTypeInfo>;

export const MONDAI_BY_MOJI_CODE: Record<number, MondaiType> = Object.fromEntries(
  MONDAI_TYPES.map((m) => [m.mojiCode, m.id]),
);

/** 各级别「言語知識・読解」部分 問題N → 题型 */
export const LANGUAGE_MONDAI_ORDER: Record<Level, MondaiType[]> = {
  N1: [
    'kanji_reading', 'context', 'paraphrase', 'usage', 'grammar_form', 'sentence_composition', 'text_grammar',
    'reading_short', 'reading_mid', 'reading_long', 'reading_integrated', 'reading_thematic', 'info_retrieval',
  ],
  N2: [
    'kanji_reading', 'orthography', 'word_formation', 'context', 'paraphrase', 'usage', 'grammar_form',
    'sentence_composition', 'text_grammar', 'reading_short', 'reading_mid', 'reading_integrated', 'reading_thematic',
    'info_retrieval',
  ],
};

export const LISTENING_MONDAI_ORDER: MondaiType[] = [
  'listen_task', 'listen_point', 'listen_summary', 'listen_quick', 'listen_integrated',
];

export const PAPER_NAMES: Record<Paper, string> = {
  vocab: '文字・词汇',
  grammar: '语法',
  reading: '阅读',
  listening: '听力',
};

/** 考点种类 */
export type KpKind =
  | 'grammar'
  | 'vocab'
  | 'kanji'
  | 'reading_feature'
  | 'word_formation'
  | 'reading_skill'
  | 'listening_skill'
  | 'listening_scene'
  | 'utterance_function';

export const KP_KIND_NAMES: Record<KpKind, string> = {
  grammar: '语法・句型',
  vocab: '词汇',
  kanji: '汉字',
  reading_feature: '读音考点',
  word_formation: '构词（词缀）',
  reading_skill: '阅读信息提取方式',
  listening_skill: '听力信息提取方式',
  listening_scene: '听力场景',
  utterance_function: '即时应答・话语功能',
};

/** 问题与考点的关系 */
export type KpRole = 'answer' | 'target' | 'distractor' | 'component' | 'feature' | 'skill';

export const ROLE_NAMES: Record<KpRole, string> = {
  answer: '正确答案',
  target: '考查对象',
  distractor: '干扰项',
  component: '构成成分',
  feature: '读音特征',
  skill: '能力/题型',
};

/** 计入“考查”的角色（干扰项单独统计） */
export const TESTED_ROLES: KpRole[] = ['answer', 'target', 'component', 'feature', 'skill'];

/** 会话编号 'YYYY-MM' → 显示名 */
export function sessionLabel(id: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(id);
  if (!m) return id;
  return `${m[1]}年${Number(m[2])}月`;
}
