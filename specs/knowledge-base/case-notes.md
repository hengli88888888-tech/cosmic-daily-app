# Case Notes

Use this file for:

- interpretation examples
- edge cases
- conflicting-rule notes
- unresolved metaphysical questions
- product wording experiments

## Template

### Case

- chart summary:
- main signals:
- likely interpretation:
- safe user-facing framing:
- notes:

## Seed Example

### Case

- chart summary: weak earth, strong fire, moderate wood
- main signals: active outward energy with weaker grounding
- likely interpretation: strong momentum and visibility, but pacing and emotional steadiness require support
- safe user-facing framing: good day to move visible tasks forward, but leave more buffer around decisions and conversations
- notes: avoid language that implies guaranteed conflict

## Teacher Notes

### WenZeng

- teacher rule source: [teacher-rule-library.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/teacher-rule-library.json)
- current status: first-batch PDF and transcript knowledge has been normalized into the library; duplicate lessons are cross-referenced instead of stored twice
- transcript-backed structure modules already merged:
  - 制用结构
  - 生化结构
  - 合制结构
  - 墓制结构
  - 复合结构
  - 合制效率
  - 刑冲穿制效率
- transcript-backed application modules already merged:
  - 墓库基础象法
  - 四墓库阴阳湿燥总结
  - 出行远近与方位
  - 干支象法
  - 神煞使用边界
  - 特殊象法
  - 房产与搬家
  - 职业与行业区分
- transcript-backed remaining first-batch modules now merged:
  - 八字哲学本质
  - 盲派思路看局案例
  - 盲派八字定层次
  - 低层次八字论法
  - 正局与反局案例版
  - 正用与反用案例版
  - 四墓库高级象法丑未
  - 四墓库高级象法辰戌
  - 墓库高级用法案例
  - 敏感职业高风险识别（内部规则）
- second-batch foundation modules now merged:
  - 八字的时空时间概念
  - 克的原理与周期
  - 五行相生与五行相克
  - 一生万物变 / 一克万物动
  - 四绝无情、四正不生
  - 合会力量
  - 关于墓库 / 墓库用法
  - 通气连支
  - 格局的分析思路
  - 根基出处
  - 不完整的论法（虚实）
  - 虚神的用法
  - 十神的用法
  - 十天干的做工
- second-batch structure and yongshen modules now merged:
  - 比劫制财（上 / 下）
  - 食伤用法（上 / 下）
  - 制印与坏印（上 / 下）
  - 食神制官杀
  - 印禄相随
  - 官杀生印
  - 食伤印枭
  - 找用神（上 / 下）
- second-batch difficult modules partially merged:
  - 刑冲破害各种关系代表
  - 官印（方法论层）
- second-batch life-event modules now merged:
  - 健康的断法（上 / 下）
  - 婚姻的断法（上 / 下）
  - 学历的断法（上 / 下）
  - 看应期（上 / 下）
- second-batch high-risk and edge modules now merged:
  - 从格、六亲健康寿元（方法论层）
  - 一格二用（方法论层）
  - 车灾的论法
  - 牢狱之灾的论法（内部高风险规则）
  - 论丢职破产（上）
- document-backed lower-volume modules now merged:
  - 宾主体用
  - 正制反制
  - 找父母星 / 克父母断法（方法论层）
  - 富位和健康的关系
  - 木火局 / 水土局 / 火金局 / 金木局 / 木土局要点
- document-backed upper-volume modules now merged:
  - 大运流年（时间层）
  - 婚姻推进与合婚（补充层）
  - 子女线与子女成就
  - 事业天赋与能力映射
  - 学业信号
  - 化解层
  - 特殊格局 / 从格 / 一字连珠（高门槛规则）
  - 星宫位 / 位像解析 / 根基出处 / 脉络（推理链层）
  - 取用神总结（校验层）
  - 选数字 / 选日子（低权重应用层）
- repeated recordings cross-linked to canonical topics:
  - 25/26 出行远近与方位 -> 19/20 的同主题重复录制
  - 29 职业象法-会计 -> 21 的同主题重复录制
- repetition rule:
  - 课程里反复重复的内容不当作冗余噪音处理，而是优先视为基础主干或重点模块
  - 在 [teacher-rule-library.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/teacher-rule-library.json) 中用 `knowledge_priority` 和 `repetition_signal` 明确标记
- transcript-backed occupation modules already merged into:
  - [occupation-patterns.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/occupation-patterns.json)
- external document sources now registered in:
  - [document-sources.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/document-sources.json)
- current external document intake:
  - [文曾易学实操教学.txt](/Users/liheng/Desktop/cosmic-daily-app/data/raw-documents/文曾/文曾易学实操教学.txt) extracted from the new DOCX and mapped as a reinforcement source for the 82 集实操班 rules
  - [文曾八字高级班上册_combined.txt](/Users/liheng/Desktop/cosmic-daily-app/data/raw-documents/文曾/文曾八字高级班上册_combined.txt) completed via full batched OCR; segmented source files are kept alongside it for page-range tracing
  - [下册文曾公字高级班_combined.txt](/Users/liheng/Desktop/cosmic-daily-app/data/raw-documents/文曾/下册文曾公字高级班_combined.txt) completed via full batched OCR; confirms coverage for 会党成势、宾主体用、父母、车灾、牢狱、破产 and 局法要点
- integration guidance:
  - use WenZeng rules as an internal retrieval layer, not as direct user-facing copy
  - prefer cross-confirming with chart structure and general rules before output
  - keep OCR-derived phrase corrections in the teacher glossary, not in canonical rule files
  - keep sensitive career material in internal rules only, never as user-visible labels
