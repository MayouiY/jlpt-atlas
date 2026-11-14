import { useMemo } from 'react';
import { Card, KpLink } from '../components/ui';
import { all } from '../lib/db';
import { getMeta, mondaiTypes } from '../lib/queries';
import { kindName, pct, sessionLabel } from '../lib/format';

export function About() {
  const meta = useMemo(getMeta, []);
  const sources = useMemo(() => all<{ id: string; name: string; url: string | null; kind: string; note: string }>('SELECT * FROM source'), []);
  const taxa = useMemo(
    () =>
      all<{ id: string; kind: string; label: string; description: string | null }>(
        "SELECT id, kind, label, description FROM knowledge_point WHERE kind IN ('reading_skill','listening_skill','reading_feature','text_function') ORDER BY kind, sort",
      ),
    [],
  );
  const types = useMemo(mondaiTypes, []);
  const check = JSON.parse(meta.answer_check ?? '{"compared":0,"agreed":0}') as { compared: number; agreed: number };

  return (
    <div className="page">
      <header className="page-head">
        <h1>数据与方法</h1>
        <p>
          数据库构建于 {meta.built_at?.slice(0, 10)}，收录截至 {sessionLabel(meta.data_cutoff)} 的 {meta.held_sessions} 场考试、{Number(meta.question_count).toLocaleString('zh-CN')} 道题、
          {Number(meta.kp_count).toLocaleString('zh-CN')} 个考点。数据库是单个 SQLite 文件（<code>data/jlpt-atlas.db</code>），本页面在浏览器中通过 sql.js 直接读取。
        </p>
      </header>

      <Card title="著作权与收录范围">
        <div className="prose">
          <p>
            JLPT 试题的著作权属于国际交流基金与日本国际教育支援协会，2010 年改版后官方不再公开完整真题（仅在两册《公式問題集》中收录了部分真题）。因此本库<strong>不收录</strong>题干、文章、听力原文与整句选项，只保存：
          </p>
          <ul>
            <li>每场考试每道题的结构信息（大题、题型、题号、正确选项序号）；</li>
            <li>短形式事实：词汇题的考查词与读音、语法题的语法形式、构词题的词缀；</li>
            <li>由本项目规则推导出的考点标签（语法句型、读音干扰类型、阅读/听力信息提取方式、听力场景、即时应答话语功能）。</li>
          </ul>
          <p>需要看原题时，可点击各题的「来源」链接，到数据来源网站（需要相应的访问权限）查看。</p>
        </div>
      </Card>

      <Card title="数据来源">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>来源</th>
                <th>类型</th>
                <th>用途与说明</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td>{s.url ? <a href={s.url} target="_blank" rel="noreferrer noopener">{s.name} ↗</a> : s.name}</td>
                  <td className="small secondary">{{ official: '官方', community: '社区整理', commercial: '商业题库', derived: '本项目' }[s.kind] ?? s.kind}</td>
                  <td className="small">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 12 }}>
          两个来源都有答案的 {check.compared.toLocaleString('zh-CN')} 道题中，{check.agreed.toLocaleString('zh-CN')} 道一致（{pct(check.agreed / Math.max(1, check.compared), 1)}）。
          不一致时默认采用 MOJiTest 的答案（经人工确认的个别例外记录在 <code>data/seed/answer-overrides.json</code>），并在题目旁标注「答案存疑」。真题均为社区回忆或整理版本，个别题目可能与原卷存在出入。
        </p>
      </Card>

      <Card title="考点是怎样提取的">
        <div className="prose">
          <h3>语法・句型</h3>
          <p>
            自建的语法词典（<code>data/seed/grammar.yaml</code>）收录 N1/N2 句型及常作为选项出现的基础句型、敬语、接续词、副词，每条带有匹配规则与中文释义。语法形式判断题、文章语法题用正确选项匹配（干扰项另计）；★排序题用四个片段匹配；听力即时应答用台词匹配（此时忽略基础句型以减少噪声）。
          </p>
          <h3>词汇・汉字</h3>
          <p>
            汉字读音、表记、选词填空、近义替换、用法题的考查词经 kuromoji 词形还原后作为词汇考点，并标注词性；汉字读音题再比较正确读音与干扰项，判定考查的是清浊音、长短音、促音、拗音、拨音还是其他读音混淆；考查词中的每个汉字也作为汉字考点。
          </p>
          <h3>阅读・听力的信息提取方式</h3>
          <p>阅读按题干问法、听力按旁白提问句分类；听力还按开场白判定场景，即时应答按台词判定话语功能。分类定义如下：</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>考点</th>
                  <th>种类</th>
                  <th>说明 / 解题要点</th>
                </tr>
              </thead>
              <tbody>
                {taxa.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <KpLink id={t.id} label={t.label} />
                    </td>
                    <td className="small secondary">{kindName(t.kind)}</td>
                    <td className="small">{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card title="题型（大题）与考查目标" sub="依据日本語能力試験官方「問題の構成」">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>题型</th>
                <th>日文名称</th>
                <th>考查目标</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td>{t.name_zh}</td>
                  <td className="jp small">{t.name_ja}</td>
                  <td className="small">{t.aim_zh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="复现规律与预测方法">
        <div className="prose">
          <p>时间轴以“已举行的场次”为单位（2010 年 7 月为第 1 场，2020 年 7 月考试取消不计）。对每个考点统计出现场次、相邻两次出现的间隔（场）及其均值、中位数和变异系数：</p>
          <ul>
            <li>规律复现：出现 ≥3 场且间隔变异系数 ≤0.5；典型周期取间隔中位数；</li>
            <li>按周期到期：距上次出现的场次已达到典型周期；</li>
            <li>预测：语法、词汇、汉字、构词使用逻辑回归，特征包括平滑出现率、近期加权出现率（衰减系数 0.8）、到期程度、上一场是否已考、历史出现次数、是否从未出现；题型类考点给出近期加权（0.7）的预计题数；</li>
            <li>回测：对最近 10 场逐一只用之前的数据训练与预测，报告 Top-K 命中率、召回率，并与“按历史频次排序”和“随机抽取”比较。</li>
          </ul>
        </div>
      </Card>

      <Card title="局限">
        <div className="prose">
          <ul>
            <li>规则标注不可能完全准确：少数正确答案（多为助词或实义词）无法对应到句型，个别句型可能误匹配；</li>
            <li>阅读/听力的分类基于问法，不反映文章题材与难度；</li>
            <li>早期场次（2010–2013）听力原文格式不统一，少量题目的提问句未能识别，归入“其他”；</li>
            <li>预测只反映历史统计规律；官方并未承诺任何出题周期。</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
