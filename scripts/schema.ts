// 数据库结构（SQLite）。字段含义见 docs/schema.md。
export const SCHEMA_SQL = /* sql */ `
PRAGMA foreign_keys = ON;

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE source (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url  TEXT,
  kind TEXT NOT NULL,          -- official | community | commercial | derived
  note TEXT
);

-- 考试场次（每年 7 月、12 月）
CREATE TABLE exam_session (
  id     TEXT PRIMARY KEY,      -- 'YYYY-MM'
  year   INTEGER NOT NULL,
  month  INTEGER NOT NULL,
  label  TEXT NOT NULL,         -- '2024年12月'
  status TEXT NOT NULL CHECK (status IN ('held', 'cancelled', 'upcoming')),
  seq    INTEGER                -- 已举行场次的序号（1 起），用于计算复现间隔
);

-- 大問（题型）
CREATE TABLE mondai_type (
  id      TEXT PRIMARY KEY,
  name_ja TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  paper   TEXT NOT NULL,        -- vocab | grammar | reading | listening
  aim_zh  TEXT,                 -- 官方「ねらい」中文转述
  sort    INTEGER NOT NULL
);

-- 每场试卷的大題构成与题数
CREATE TABLE paper_structure (
  level       TEXT NOT NULL,
  session_id  TEXT NOT NULL REFERENCES exam_session(id),
  part        TEXT NOT NULL,    -- language（言語知識・読解）| listening（聴解）
  mondai_no   INTEGER NOT NULL,
  mondai_type TEXT NOT NULL REFERENCES mondai_type(id),
  items       INTEGER NOT NULL,
  PRIMARY KEY (level, session_id, part, mondai_no)
);

-- 每场数据的来源与交叉核对结果
CREATE TABLE session_source (
  level            TEXT NOT NULL,
  session_id       TEXT NOT NULL REFERENCES exam_session(id),
  language_source  TEXT REFERENCES source(id),
  listening_source TEXT REFERENCES source(id),
  jpt_url          TEXT,
  moji_url         TEXT,
  check_compared   INTEGER,
  check_agreed     INTEGER,
  PRIMARY KEY (level, session_id)
);

-- 题目（不含题干原文）
CREATE TABLE question (
  id               TEXT PRIMARY KEY,   -- 例：N1-2024-12-L5-26 / N1-2024-12-H2-3番
  level            TEXT NOT NULL,
  session_id       TEXT NOT NULL REFERENCES exam_session(id),
  part             TEXT NOT NULL,
  mondai_no        INTEGER NOT NULL,
  mondai_type      TEXT NOT NULL REFERENCES mondai_type(id),
  number           TEXT NOT NULL,      -- 试卷题号（'26'、'3番'、'質問1'）
  seq              INTEGER NOT NULL,   -- 卷内顺序
  target           TEXT,               -- 考查词（下划线词/用法词/表记假名）
  answer           TEXT,               -- 正确选项（仅短形式：读音、词语、语法形式）
  answer_index     INTEGER,            -- 正确选项下标（0 起）
  alt_answer_index INTEGER,            -- 两来源答案不一致时另一来源的答案
  options          TEXT,               -- JSON 数组（仅短形式选项）
  skill            TEXT,               -- 阅读/听力信息提取方式
  scene            TEXT,               -- 听力场景
  func             TEXT,               -- 即时应答话语功能
  image            INTEGER NOT NULL DEFAULT 0,
  source_id        TEXT REFERENCES source(id)
);
CREATE INDEX idx_question_session ON question(level, session_id);
CREATE INDEX idx_question_type ON question(mondai_type);

-- 考点
CREATE TABLE knowledge_point (
  id          TEXT PRIMARY KEY,   -- g:语法 v:词汇 k:汉字 wf:构词 kr:读音特征 r:阅读 l:听力 s:场景 f:话语功能 tf:文章语法功能
  kind        TEXT NOT NULL,
  category    TEXT,
  label       TEXT NOT NULL,
  reading     TEXT,
  level_hint  TEXT,               -- 教材常见级别（语法）
  meaning_zh  TEXT,
  description TEXT,
  pos         TEXT,               -- 词性（词汇）
  sort        INTEGER NOT NULL,
  search_text TEXT NOT NULL
);
CREATE INDEX idx_kp_kind ON knowledge_point(kind);

-- 题目 ↔ 考点
CREATE TABLE question_kp (
  question_id TEXT NOT NULL REFERENCES question(id),
  kp_id       TEXT NOT NULL REFERENCES knowledge_point(id),
  role        TEXT NOT NULL,      -- answer | target | distractor | component | feature | skill
  PRIMARY KEY (question_id, kp_id, role)
);
CREATE INDEX idx_qkp_kp ON question_kp(kp_id);

-- 考点 × 场次 出现次数（预计算，便于热力图）
CREATE TABLE kp_session (
  kp_id      TEXT NOT NULL REFERENCES knowledge_point(id),
  level      TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES exam_session(id),
  tested     INTEGER NOT NULL,
  distractor INTEGER NOT NULL,
  PRIMARY KEY (kp_id, level, session_id)
);
CREATE INDEX idx_kps_session ON kp_session(level, session_id);

-- 考点统计（level = N1 / N2 / ALL）
CREATE TABLE kp_stats (
  kp_id         TEXT NOT NULL REFERENCES knowledge_point(id),
  level         TEXT NOT NULL,
  tested        INTEGER NOT NULL,   -- 被考查次数
  sessions      INTEGER NOT NULL,   -- 出现场次数
  distractor    INTEGER NOT NULL,   -- 作为干扰项出现次数
  first_session TEXT,
  last_session  TEXT,
  session_list  TEXT,               -- JSON：出现过的场次
  mean_gap      REAL,               -- 平均复现间隔（场，2 场≈1 年）
  median_gap    REAL,
  min_gap       INTEGER,
  max_gap       INTEGER,
  gap_cv        REAL,               -- 间隔变异系数
  since_last    INTEGER,            -- 距最近一次出现过了几场
  pattern       TEXT,               -- never | single | rare | regular | irregular
  PRIMARY KEY (kp_id, level)
);

-- 下次考试预测
CREATE TABLE prediction (
  level          TEXT NOT NULL,
  target_session TEXT NOT NULL REFERENCES exam_session(id),
  kp_id          TEXT NOT NULL REFERENCES knowledge_point(id),
  grp            TEXT NOT NULL,     -- grammar | vocab | kanji | word_formation | *_skill 等
  score          REAL NOT NULL,     -- 出现概率（或预计题数）
  rank           INTEGER NOT NULL,
  expected       REAL,              -- 题型类：预计题数
  reasons        TEXT,              -- JSON：特征值与统计
  PRIMARY KEY (level, target_session, kp_id)
);

-- 滚动回测（只用目标场次之前的数据预测）
CREATE TABLE backtest (
  level            TEXT NOT NULL,
  grp              TEXT NOT NULL,
  session_id       TEXT NOT NULL REFERENCES exam_session(id),
  k                INTEGER NOT NULL,
  hits             INTEGER NOT NULL,
  actual           INTEGER NOT NULL,
  candidates       INTEGER NOT NULL,
  precision        REAL NOT NULL,
  recall           REAL NOT NULL,
  base_precision   REAL NOT NULL,
  base_recall      REAL NOT NULL,
  random_precision REAL NOT NULL,
  PRIMARY KEY (level, grp, session_id, k)
);

CREATE TABLE model (
  level   TEXT NOT NULL,
  grp     TEXT NOT NULL,
  weights TEXT NOT NULL,
  bias    REAL NOT NULL,
  PRIMARY KEY (level, grp)
);

-- 便捷视图：考点出现明细
CREATE VIEW v_occurrence AS
SELECT qk.kp_id, qk.role, q.id AS question_id, q.level, q.session_id, s.seq AS session_seq, s.year,
       q.part, q.mondai_no, q.mondai_type, q.number, q.target, q.answer
FROM question_kp qk
JOIN question q ON q.id = qk.question_id
JOIN exam_session s ON s.id = q.session_id;
`;
