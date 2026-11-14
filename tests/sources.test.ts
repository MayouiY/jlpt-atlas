// 数据源解析器测试（使用自行构造的样例，不含真实试题内容）
import { describe, expect, it } from 'vitest';
import { decodeRscChunks, findObjectsWithKey, mondaiNoFromInstruction, parseSessionPage } from '../scripts/sources/jlptpracticetest/parse';
import { parseMojiText, sessionFromTitle } from '../scripts/sources/mojitest/parse';

function rscHtml(payload: unknown): string {
  const json = JSON.stringify(payload);
  return `<script>self.__next_f.push([1,${JSON.stringify(json)}])</script>`;
}

describe('jlptpracticetest 解析', () => {
  it('还原 RSC 负载并找出题组', () => {
    const html = rscHtml({
      groups: [
        { instruction: '問題１ ___の言葉の読み方として最もよいものを選びなさい。', questions: [{ questionNumber: 1, text: '例文', textHtml: '例[[u]]試験[[/u]]文', options: ['しけん', 'じけん', 'しげん', 'じげん'], correctAnswer: 1 }] },
        { instruction: '問題5 次の文の（ ）に入れるのに最もよいものを選びなさい。', questions: [{ questionNumber: 26, options: ['にかけて', 'にわたって', 'までは', 'では'], correctAnswer: 2 }] },
      ],
    });
    expect(decodeRscChunks(html)).toContain('instruction');
    expect(findObjectsWithKey(decodeRscChunks(html), 'instruction')).toHaveLength(2);
    const qs = parseSessionPage(html, 'N1', '2099-07', 'https://example.invalid');
    expect(qs).toHaveLength(2);
    expect(qs[0]).toMatchObject({ type: 'kanji_reading', target: '試験', answerIndex: 0, number: '1' });
    expect(qs[1]).toMatchObject({ type: 'grammar_form', answerIndex: 1, number: '26' });
    expect(qs[1].stem).toBeUndefined();
  });

  it('全角题号', () => {
    expect(mondaiNoFromInstruction('問題１2.次の文章')).toBe(12);
    expect(mondaiNoFromInstruction('問題 7 次の文章')).toBe(7);
  });
});

describe('MOJiTest 行格式解析', () => {
  const sample = [
    '#EXAM|abc|N2|2099年7月|v1|g1|r1|l2',
    '@L|11|問題1|1',
    '11|1|2|例|れい/りい/れえ/れー',
    '@L|21|問題7|1',
    '21|2|0||ものの/ものか/ものだ/もので',
    '@L|41|問題1|1',
    '41|1番|1|0|会社|この後、まず何をしますか',
    '@L|45|問題4|2',
    '45|1番|0|0||サンプルの台詞です。',
    '45|1番|2|0||もう一つのサンプル。',
    '#KEY|20',
  ].join('\n');

  it('解析题目、结构与答案序列', () => {
    const s = parseMojiText(sample);
    expect(s.level).toBe('N2');
    expect(s.session).toBe('2099-07');
    expect(s.full).toBe(true);
    expect(s.answerKey).toBe('20');
    expect(s.structure.map((x) => x.mondaiNo)).toEqual([1, 2, 1, 2]);
    const kanji = s.questions.find((q) => q.type === 'kanji_reading')!;
    expect(kanji).toMatchObject({ target: '例', answerIndex: 2, options: ['れい', 'りい', 'れえ', 'れー'] });
    const task = s.questions.find((q) => q.type === 'listen_task')!;
    expect(task.listen).toMatchObject({ scene: '会社', question: 'この後、まず何をしますか' });
  });

  it('题号重复时按顺序重新编号', () => {
    const s = parseMojiText(sample);
    expect(s.questions.filter((q) => q.type === 'listen_quick').map((q) => q.number)).toEqual(['1番', '2番']);
  });

  it('题型顺序不符时给出警告', () => {
    const s = parseMojiText(sample);
    expect(s.warnings.some((w) => w.includes('不一致'))).toBe(true); // 样例中问题2是语法题
  });

  it('场次标题', () => {
    expect(sessionFromTitle('2010年7月')).toBe('2010-07');
    expect(sessionFromTitle('2025年12月')).toBe('2025-12');
  });
});
