# 数据库结构（data/jlpt-atlas.db）

单个 SQLite 文件，建库脚本 `scripts/build-db.ts`，表结构定义 `scripts/schema.ts`。

## 基础表

| 表 | 说明 |
|---|---|
| `meta` | 构建时间、数据截止场次（`data_cutoff`）、下次场次（`next_session`）、答案核对汇总等 |
| `source` | 数据来源（jlptpracticetest / mojitest / jlpt-official / jlpt-atlas） |
| `exam_session` | 场次：`id`='YYYY-MM'，`status`=held/cancelled/upcoming，`seq`=已举行场次序号（复现间隔的时间单位） |
| `mondai_type` | 20 种大題（题型），含中日文名称与官方「ねらい」的中文转述 |
| `paper_structure` | 每场每级的大题构成与题数 |
| `session_source` | 每场每级采用的数据来源、来源链接、答案交叉核对结果 |

## 题目与考点

| 表 | 说明 |
|---|---|
| `question` | 题目（不含题干原文）。`target` 考查词，`answer` 正确选项（仅短形式），`answer_index` 正确选项下标（0 起），`alt_answer_index` 另一来源给出的不同答案，`options` 短形式选项（JSON），`skill`/`scene`/`func` 阅读听力标签 |
| `knowledge_point` | 考点。`kind` 见下表，`category` 类别，`reading` 读音，`meaning_zh` 中文释义，`description` 说明/解题要点，`pos` 词性 |
| `question_kp` | 题目 ↔ 考点。`role`：answer 正确答案 / target 考查对象 / distractor 干扰项 / component 构成成分 / feature 读音特征或场景 / skill 题型能力 |

考点种类（`knowledge_point.kind`，id 前缀）：

| kind | 前缀 | 含义 |
|---|---|---|
| grammar | `g:` | 语法句型、敬语、授受、接续词、指示词、副词（来自 `data/seed/grammar.yaml`） |
| vocab | `v:` | 词汇（词形还原后的原形） |
| kanji | `k:` | 汉字 |
| word_formation | `wf:` | 构词题的词缀 |
| reading_feature | `kr:` | 汉字读音题的考查特征：清浊、长短音、促音、拗音、拨音、其他读音混淆、训读/音读 |
| reading_skill | `r:` | 阅读信息提取方式（问法） |
| listening_skill | `l:` | 听力信息提取方式（按大题细分） |
| listening_scene | `s:` | 听力场景 |
| utterance_function | `f:` | 即时应答中对方话语的功能 |
| text_function | `tf:` | 文章语法题的功能（指示词、接续词、文末表达、视点/语态、内容衔接） |

## 统计、预测、回测（建库时预计算）

| 表 | 说明 |
|---|---|
| `kp_session` | 考点 × 级别 × 场次 的考查次数与作干扰项次数 |
| `kp_stats` | 考点 × 级别（N1/N2/ALL）：出现场次、考查次数、干扰项次数、首次/最近出现、间隔均值/中位数/最小/最大/变异系数、距上次出现场次、规律类型（never/single/rare/regular/irregular） |
| `prediction` | 下次场次（2026-12）的预测。存在型考点（语法/词汇/汉字/构词）`score` 为出现概率；题型类考点 `expected` 为预计题数；`reasons` 为特征值 JSON |
| `backtest` | 最近 10 场的滚动回测：Top-K 命中率、召回率、频次基线、随机期望 |
| `model` | 各级别、各考点组的逻辑回归权重 |
| `v_occurrence`（视图） | 考点出现明细（考点 + 题目 + 场次） |

## 查询示例

N2 每场“语法形式判断”考到的句型：

```sql
SELECT q.session_id, q.number, q.answer, k.label
FROM question q
JOIN question_kp qk ON qk.question_id = q.id AND qk.role = 'answer'
JOIN knowledge_point k ON k.id = qk.kp_id AND k.kind = 'grammar'
WHERE q.level = 'N2' AND q.mondai_type = 'grammar_form'
ORDER BY q.session_id, q.seq;
```

规律复现、且按周期已经到期的 N1 语法：

```sql
SELECT k.label, s.sessions, s.median_gap / 2.0 AS cycle_years, s.last_session, s.since_last
FROM kp_stats s JOIN knowledge_point k ON k.id = s.kp_id
WHERE s.level = 'N1' AND k.kind = 'grammar' AND s.pattern = 'regular' AND s.since_last + 1 >= s.median_gap
ORDER BY s.sessions DESC;
```

听力“课题理解”各类问法的逐年题数：

```sql
SELECT ks.session_id, k.label, ks.tested
FROM kp_session ks JOIN knowledge_point k ON k.id = ks.kp_id
WHERE ks.level = 'N1' AND k.id LIKE 'l:task_%'
ORDER BY ks.session_id, ks.tested DESC;
```

汉字读音题中“长短音”陷阱出现过的词：

```sql
SELECT q.session_id, q.level, q.target, q.answer
FROM question_kp qk JOIN question q ON q.id = qk.question_id
WHERE qk.kp_id = 'kr:long' ORDER BY q.session_id;
```
