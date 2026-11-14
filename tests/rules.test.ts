import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadGrammarDict, matchGrammar } from '../scripts/lib/grammar';
import {
  classifyListening,
  classifyReadingStem,
  classifyScene,
  classifyTextFunction,
  classifyUtterance,
  kanjiReadingFeatures,
} from '../scripts/lib/classify';

const dict = loadGrammarDict(join(__dirname, '../data/seed/grammar.yaml'));
const ids = (s: string, basic = true) => matchGrammar(dict, s, basic).map((h) => h.id);

describe('语法词典', () => {
  it('词典条目合法且 id 唯一', () => {
    expect(dict.entries.length).toBeGreaterThan(500);
    expect(new Set(dict.entries.map((e) => e.id)).size).toBe(dict.entries.length);
  });

  it.each([
    ['をものともせず', 'をものともせず'],
    ['にもほどがある', 'にもほどがある'],
    ['ずにはいられない', 'ずにはいられない'],
    ['ないではいられない', 'ずにはいられない'],
    ['を余儀なくされた', 'を余儀なくされる'],
    ['といったらない', 'といったらない'],
    ['からといって', 'からといって'],
    ['ものの', 'ものの'],
    ['にほかならない', 'にほかならない'],
    ['いかんによらず', 'いかんによらず'],
    ['させていただけないでしょうか', 'させていただく'],
  ])('%s → %s', (text, id) => {
    expect(ids(text)).toContain(id);
  });

  it('重叠时保留更长的句型', () => {
    const r = ids('ないではいられない');
    expect(r).toContain('ずにはいられない');
    expect(r).not.toContain('てはいられない');
  });

  it('长文本中忽略基础句型', () => {
    expect(ids('そんなことを言っても', false)).not.toContain('このような');
    expect(ids('そんなことを言っても', true)).toContain('このような');
  });

  it('「ようとはしなかった」不误判为让步「(よ)うと」', () => {
    expect(ids('着ようとはしなかった')).not.toContain('(よ)うが');
    expect(ids('着ようとはしなかった')).toContain('ようとする');
  });
});

describe('汉字读音干扰类型', () => {
  it('清浊、长短、促音、拗音', () => {
    expect(kanjiReadingFeatures('絶叫', 'ぜっきょう', ['せっきょう'])).toContain('kr:dakuten');
    expect(kanjiReadingFeatures('消毒', 'しょうどく', ['しょどく'])).toContain('kr:long');
    expect(kanjiReadingFeatures('楽器', 'がっき', ['がき'])).toContain('kr:sokuon');
    expect(kanjiReadingFeatures('競技', 'きょうぎ', ['きゅうぎ'])).toContain('kr:yoon');
    expect(kanjiReadingFeatures('契約', 'けいやく', ['せいやく'])).toContain('kr:other_reading');
  });

  it('训读词与音读熟语', () => {
    expect(kanjiReadingFeatures('潤って', 'うるおって', [])).toContain('kr:kun');
    expect(kanjiReadingFeatures('管轄', 'かんかつ', [])).toContain('kr:on');
  });
});

describe('阅读题干分类', () => {
  it.each([
    ['筆者の考えに合うのはどれか。', 'reading_short', 'r:author_claim'],
    ['とても惜しいことですとあるが、なぜか。', 'reading_mid', 'r:reason'],
    ['「受け売り」とはどういうことか。', 'reading_mid', 'r:underline'],
    ['AとBで共通して述べられていることは何か。', 'reading_integrated', 'r:compare_ab'],
    ['応募できるものはどれか。', 'info_retrieval', 'r:info_search'],
    ['このメールで伝えたいことは何か。', 'reading_short', 'r:message_purpose'],
    ['筆者は、弱者をどのようにとらえているか。', 'reading_long', 'r:explanation'],
  ] as const)('%s', (stem, type, expected) => {
    expect(classifyReadingStem(type, stem)).toBe(expected);
  });
});

describe('听力分类', () => {
  it('提问焦点', () => {
    expect(classifyListening('listen_task', 'この後、まず何をしますか')).toBe('l:task_first');
    expect(classifyListening('listen_task', '何をしなければなりませんか')).toBe('l:task_obligation');
    expect(classifyListening('listen_point', '痛みの原因は何だと言っていますか')).toBe('l:point_reason');
    expect(classifyListening('listen_point', '一番の特徴は何だと言っていますか')).toBe('l:point_most');
    expect(classifyListening('listen_summary', '何について話していますか')).toBe('l:sum_theme');
    expect(classifyListening('listen_integrated', 'どのコースにしますか')).toBe('l:int_choice');
  });

  it('场景', () => {
    expect(classifyScene('会社')).toBe('s:office');
    expect(classifyScene('大学の事務室')).toBe('s:school');
    expect(classifyScene('テレビ')).toBe('s:media');
    expect(classifyScene('')).toBe('s:other');
  });

  it('即时应答话语功能', () => {
    expect(classifyUtterance('明日の会議に出てもらえると助かるんですが……')).toBe('f:request');
    expect(classifyUtterance('すみません、遅れてしまって。')).toBe('f:apology');
    expect(classifyUtterance('あの演技は、彼ならではだよね。')).toBe('f:praise');
    expect(classifyUtterance('日曜に引っ越すんだって？')).toBe('f:hearsay');
  });
});

describe('文章语法功能', () => {
  it('兜底分类', () => {
    expect(classifyTextFunction('そうした')).toBe('tf:demonstrative');
    expect(classifyTextFunction('つまり')).toBe('tf:connective');
    expect(classifyTextFunction('示すのです')).toBe('tf:ending');
    expect(classifyTextFunction('親しまれてきた')).toBe('tf:voice');
  });
});
