# JLPT Atlas · N1/N2 历年考点图谱

把 2010 年新制考试以来 **全部 32 场** JLPT N1、N2 真题（含听力）逐题拆成考点，结构化存进 **一个 SQLite 文件**，并配一个纯前端页面用来：

- 检索考点：语法句型、词汇、汉字、构词、汉字读音的干扰类型、阅读/听力的信息提取方式、听力场景、即时应答的话语功能；
- 看整体总结：哪些考点考得最多、各题型问法的分布、题量结构的变化；
- 看复现规律：哪些考点每隔几年就会再出现、哪些已“按周期到期”、哪些曾高频但近年沉寂；
- 预测下次考试（2026 年 12 月）的重点，并用滚动回测说明预测有多可信。

## 数据规模（截至 2026 年 7 月）

| 项目 | 数量 |
|---|---|
| 场次 | 32 场 × N1/N2（2010-07 – 2026-07，2020-07 考试取消） |
| 题目 | 6,607 题（言语知识・阅读 + 听力） |
| 考点 | 4,051 个：语法 615、词汇 2,350、汉字 731、构词 284、阅读/听力信息提取方式 37、听力场景 9、话语功能 12、读音干扰类型 8、文章语法功能 5 |
| 题目↔考点关联 | 14,612 条 |
| 答案交叉核对 | 两个来源都有答案的 3,827 题中 3,775 题一致（98.6%） |

## 著作权说明

JLPT 试题著作权属于国际交流基金与日本国际教育支援协会，官方在 2010 年后不再公开完整真题。本仓库与数据库 **不包含** 题干、文章、听力原文和整句选项，只包含：

- 每道题的结构信息（场次、大题、题型、题号、正确选项序号）；
- 短形式事实：考查词与读音、语法形式、词缀；
- 由本项目规则推导出的考点标签。

需要看原题时，前端每道题都附有数据来源的链接（需要相应的访问权限）。

## 快速开始

```bash
npm install
npm run dev        # 打开 http://localhost:5173
```

数据库已经构建好并提交在 `data/jlpt-atlas.db`，前端用 [sql.js](https://sql.js.org)（SQLite 的 WebAssembly 版本）在浏览器中直接读取，不需要后端。`npm run build` 生成的 `dist/` 是纯静态站点，可直接部署到任何静态托管。

也可以直接用 SQLite 查询，例如“N1 出现场次最多的 10 个语法句型”：

```bash
sqlite3 data/jlpt-atlas.db "SELECT k.label, s.sessions, s.tested FROM kp_stats s JOIN knowledge_point k ON k.id = s.kp_id WHERE s.level = 'N1' AND k.kind = 'grammar' ORDER BY s.sessions DESC LIMIT 10;"
```

表结构与更多查询示例见 [docs/schema.md](docs/schema.md)，方法细节见 [docs/methodology.md](docs/methodology.md)。

## 目录结构

```
data/
  jlpt-atlas.db            单文件数据库（构建产物，已提交）
  facts/                   事实层：每场每级一个 JSON（只有短形式与派生标签）
  seed/grammar.yaml        语法考点词典（615 条，含匹配规则与中文释义）
  seed/answer-overrides.json  两来源答案冲突时的人工裁定
scripts/
  sources/jlptpracticetest/  爬虫与 Next.js RSC 负载解析
  sources/mojitest/          浏览器内提取脚本与行格式解析
  lib/grammar.ts             语法匹配（重叠时取最长）
  lib/classify.ts            阅读/听力问法、场景、话语功能、读音干扰类型分类
  lib/morph.ts               kuromoji 词形还原与词性
  ingest.ts                  原始缓存 → data/facts
  build-db.ts                data/facts + 种子 → data/jlpt-atlas.db（含统计、预测、回测）
  schema.ts                  数据库表结构
src/
  lib/analysis.ts            复现间隔统计、逻辑回归预测、滚动回测（与建库脚本共用）
  pages/                     总览 / 考点检索 / 考点详情 / 复现规律 / 下次预测 / 历年场次 / 数据与方法
tests/                       单元测试与数据库完整性检查（vitest）
```

## 数据管线

```
jlptpracticetest.com ──crawl:jpt──┐
                                   ├─ ingest ─→ data/facts/*.json ─ build:db ─→ data/jlpt-atlas.db ─→ 前端
MOJiTest（浏览器内提取）──────────┘                  ↑
                                         data/seed/grammar.yaml 等规则
```

1. **言语知识・阅读**：`npm run crawl:jpt` 抓取 jlptpracticetest.com 的场次页面（robots.txt 允许，间隔 1.5 秒）到 `.cache/jlptpracticetest/`。
2. **听力 + 2024-12 之后的场次 + 答案核对**：用自己的 MOJiTest 账号登录后，在浏览器 Console 运行 [`scripts/sources/mojitest/extract-in-browser.js`](scripts/sources/mojitest/extract-in-browser.js)，把结果保存为 `.cache/mojitest/extract.json`（脚本内有步骤说明）。
3. `npm run ingest`：合并两个来源、按题号交叉核对答案、对题干/听力提问句做分类，写出 `data/facts/`。
4. `npm run build:db`：生成考点、统计复现间隔、训练预测模型并回测，写出 `data/jlpt-atlas.db`。

`.cache/` 中的原始页面含有试题原文，已加入 `.gitignore`，只留在本地。事实层已提交，所以修改语法词典或统计方法后，只需 `npm run build:db` 即可重建（★题片段与听力台词的句型匹配除外，它们需要原始缓存）。

`npm run report:untagged` 会列出正确答案没能匹配到任何句型的语法题，方便补充词典。

## 预测有多准？

对最近 10 场做滚动回测（每次只用目标场次之前的数据）：

| 级别 | 语法 Top 10 命中率 | 语法 Top 20 命中率 | 随机抽取 |
|---|---|---|---|
| N1 | 17.0% | 10.5% | 3.6% |
| N2 | 20.0% | 14.5% | 3.4% |

语法句型的命中率是随机抽取的 3–5 倍，与“按历史出现次数排序”的基线相当，说明高频、到期的句型确实更可能再考；词汇和汉字每场大多是新词，几乎不可预测。前端「下次预测」页给出每类考点的完整回测表。

## 开发

```bash
npm run typecheck
npm test
npm run build
```

技术栈：Vite + React + TypeScript，sql.js，ECharts；建库脚本用 tsx 运行，词形分析用 kuromoji。
