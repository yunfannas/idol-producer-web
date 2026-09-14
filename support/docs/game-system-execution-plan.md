# 游戏系统执行方案

> 本文是 `idol-producer-web` 的唯一游戏系统实施方案；它定义代码、存档、导出数据和验证的落地工作，**不复制或重述游戏 spec**。
>
> **唯一 spec 来源：** `idol-data-lab`。当前运行时基准为 `support/docs/idol-producer-portable-system-spec.md`（`1c431af988f473deca8ddbf7a81415c43d40b4b2`，unified Condition model）；UI / 信息架构以两个 authoritative overlay 为准：`support/docs/idol-producer-ui-information-architecture-spec.md`（`2ba68759ff0d776258211d1bf34404e215c7e439`）及 `docs/Idol_GPT_03_Game_Design_UI_Overlay_v0.1.md`（`fd828a3dfc9030dab5f468d1939b08190935e98d`）。Policy、fanwork、release 与 live 自动执行以 `support/docs/idol-producer-policy-system-spec.md`（`f25c7b50035b1d256f4f956efba3f9c2cc57242d`）为准。
>
> 任何影响游戏语义、锁定规则、字段含义或校准锚点的决策，必须先在 data-lab 的 spec 中完成；本仓库仅记录对应的实现决策、迁移状态和验证结果。

## 1. 目标与边界

目标是将当前的 Track B 过渡内核迁移为可验证的多时钟运行时：成员能力、统一的 Condition 与离散 Issue 决定逐曲表现；成员主题技能和世界趋势决定主题执行；现场观众状态累积 Impression；Impression 与期待形成 Satisfaction；满意度和成员曝光分别进入扇层转化与个人转化；活动收入再进入财务循环。

本方案不做以下事情：

- 不在网页仓库维护第二份 master GDD、portable spec 或其翻译副本。
- 不把 data-lab 的活目录直接覆盖到 S6；网页仍只消费经审核、时间锁定的导出包。
- 不把 PROVISIONAL 数值冻结在代码文档中；数值取自 data-lab 已锁定或已标注的版本，并由探针校准。
- 不在一次改动中重写 UI、引擎、存档和全量数据；每阶段须保持可加载、可回归、可恢复。

## 2. 文档与所有权切换

### 2.1 权威边界

- `idol-data-lab`：游戏规则、术语、锁定状态、校准锚点、歌曲/团体研究事实和导出合同的语义定义。
- `idol-producer-web`：本执行方案、运行时类型、存档迁移、S6 审核导入、UI、测试、探针和部署前验证。
- `public/data/scenarios/scenario_6/`：网页消费的时间锁定运行时数据；来源和置信度必须可回溯，但它不是 spec。

UI 实现只记录路由、存档状态、组件边界、迁移和验收项；页面信息架构、Meeting 行为及 Policy 的产品语义始终回链至上述 data-lab overlay，不在本仓库重写。

### 2.2 本仓库的清理策略

本阶段先完成方案与引用切换，不删除现有文档。获得实施确认后执行一次独立的文档清理提交：

1. 删除或迁出本地的 `support/docs/idol-producer-portable-system-spec.md`、`game-design-master.en.md`、`game-design-master.zh-CN.md` 等 spec 镜像；不再尝试同步内容。
2. 将旧 `support/reports/game-system-upgrade-plan.md` 保留为历史记录，并仅保留指向本文的简短迁移说明。
3. 在入口文档和自动化说明中只保留 data-lab 的规范路径、固定 commit 和本文路径。
4. 为每次导入记录 `spec_commit`、`export_version`、`generated_at`、`source_provenance`；运行时不得依赖本地 spec 文本。

该清理是可回滚的文档操作，必须与运行时改造分开提交，以免混淆设计差异与代码行为差异。

## 3. 实施顺序

### 准备阶段 — 锁定输入，不做新功能

这不是一个游戏功能阶段。它只解决“后续实现到底按哪份规则、如何证明没有破坏存档”的工程前置问题：

1. 在 S6 导出 manifest、存档升级日志和探针报告中写入 `spec_commit = 1c431af...`、导出版本和校验值；不复制 spec 正文。
2. 为当前版本建立四个 canary 的可重复测试存档，记录现有的旧工作量字段、P/O/C、特典和财务输出。
3. 明确旧存档的迁移规则：`Condition = clamp(100 - 0.5 × (vocal_fatigue + physical_fatigue), 0, 100)` 仅用于一次性初始迁移；它是兼容近似值，不是新系统的运行时公式。迁移完成后两者不再被读取或写入。

它的产物是“明确的输入版本 + 可复现的旧档迁移夹具”，而不是 UI 或数值变化。

**完成门槛：** 类型检查、S6 引用完整性检查和四个固定存档夹具都可重复运行；每份报告带 data-lab spec commit。

### Phase 1 — 数据合同与存档迁移

把运行时输入收敛为新版 spec 所需的最小合同：

- Song：`vocal_difficulty`、`dance_difficulty`、`sing_lead_count`、`dance_lead_count`、`appeal`、五维 `theme`、`formation`、`bpm`、`vocal_range`、`popularity`。
- Member：17 项可见属性、`Condition`、`Vocal Issue` / `Physical Issue`、Member Theme Skill/XP、必要的公开或模糊展示状态。
- Group：P/O/C、主题技能派生结果、世界主题初始引用、活动/财务状态。
- Scenario export：字段来源、置信度、导出版本；未知数据使用受记录的默认值，而不是运行时标题猜测。

删除运行时对 `formation_difficulty`、`tone_factor`、`power_factor`、`freshness`、隐藏 `professionalism/ambition/sensitivity`、Trait XP，以及双疲劳字段的新增依赖。为旧存档提供一次性迁移：按已记录的合成规则生成 `Condition`，随后旧字段只作兼容读取，不再作为新内核输入。

**完成门槛：** schema 有版本与 migrator；四个 S6 canary 的歌曲字段、成员 17 属性和引用完整；未知字段能被报告，不被静默随机化为事实。

### Phase 2 — Condition、Stamina、恢复与 Issue

实现一个连续资源与两类离散异常，而不是两条疲劳资源：

- `Condition`：唯一连续短期工作量状态，100 为完全新鲜；所有演出、训练、录音、特典、直播、外务、移动和休息都改变同一数值。
- 工作量计算：可在单曲内部组合 dance/vocal/lead/舞台参与等临时分量，但组合后只扣除一份 Condition；这些分量不是持久状态。
- Stamina：降低 Condition 消耗；Natural Fitness：提高按时间恢复的 Condition；低 Condition 会降低 Breath、Rhythm、Power 与学习效率。
- Issue：持续低 Condition 加相关工作量才有概率形成 Vocal Issue 或 Physical Issue（mild/moderate/severe）；它们是独立状态，恢复 Condition 不会立即清除 Issue。
- 旧双疲劳的数值锚点改为 Condition 校准：38 曲 iLiFE! canary 的代表 Sta18 结束约 28–35、Sta19 约 33–40，15 分钟真实休息约恢复 3 Condition。

**完成门槛：** 引擎中没有新的 `vocal_fatigue` / `physical_fatigue` 写入路径；每种活动均通过同一 Condition 更新函数；低 Condition 与 Issue 的效果能在固定 seed 探针中解释。

### Phase 3 — 主题状态层

新增独立于 UI 的纯引擎模块：

- `MemberThemeSkill[member][theme]` 与本月 `MemberThemeXP`；按维度 floor 初始化，创建/训练/演出仅累计 XP。
- 月初结算：递减增长、长期不使用衰减、基于当前 roster 与角色/曝光导出的 Team Theme Profile。
- `WorldThemeScore[theme]`：季节由日历驱动；其余主题按月运行均值回归、动量、饱和与随机扰动。
- 新成员以既往表演经验和 17 属性估算初值；不回填完整的外部主题履历。

**完成门槛：** roster 变动会自然改变派生团队主题能力；主题状态只在月初变化；存档可升级且不暴露精确隐藏分数。

### Phase 4 — 逐曲 live 内核

替换 Track B 的整场聚合 `audienceSatisfaction`：

1. 读取当前曲开始时由 Condition 和 active Issue 修正后的 Breath/Rhythm/Power、队形和 lead 分工。
2. 分开计算唱与跳；Pitch/Agility 只提供低于要求时的概率性下行，Tone/Power 只提供有限正向质量，Stage Presence 在技术表现后生效。
3. 以真实舞台参与、vocal share、lead、简化舞蹈和人数组成统一的单曲 Condition cost；曲间/换装/离场走同一 Condition 恢复系统。
4. 从 BPM、音域与五维主题导出 Live Function；根据 Event Context + Audience State 推导下一曲需求。
5. 为 Public/Otaku/Core 各自计算 Song Impression，更新 `activation/immersion/participation/impression`。
6. 在每曲后分配 Member Exposure Impression 并累计 Member Theme XP，再立即施加 Condition cost。

保留 Stamina 倍率和经 `Depletion = 100 - Condition` 转换后的平滑 Condition-cost amplifier；以 iLiFE! 38 曲锚点验证实际工作量，而非沿用旧的整场分数。

**完成门槛：** 逐曲事件日志能解释 Condition、Issue、状态转场、Impression 与曝光来源；Condition 约 30–40 的 D14 后段失败仍是尾部事件；38 曲 canary 满足 Sta18/Sta19 的 Condition 区间。

### Phase 5 — 满意度、扇层与特典

实现新的结算路径，而非给 live 一个统一的 `fan_gain`：

- 完整 live：Song Impression 累积为 Total Impression，与按 segment/context 得出的 Expected Impression 形成 Satisfaction。
- 单曲曝光：直接以 `Song Impression × Reach` 产生 Exposure Effect，不进入完整 live 满意度循环。
- Sunday：group Satisfaction 进入 Public→Otaku、Otaku→Core 与 Core 留存；Member Exposure Impression 进入成员亲和力/个人转化的周动量。
- Tokuten：只对实际完成的互动计近似线性的 Condition cost；强现场产生首次需求，互动质量决定即时 Public→Otaku 转化，并在周结算前从 Public 扣除以防双计。

**完成门槛：** 转化来源在调试报告中互斥可追溯；特典即时转化与普通周转化不会重复；Core 对世界主题的敏感度显著低于 Public。

### Phase 6 — 活动财务与策略衔接

继续使用 `financeSystem.ts` 的账本，但输入改为活动实际发生的消费与成本：tokuten、直销 merch、own live、FC、外部活动、零售/分发等分别使用 capture 和成本。年度 ARPU 只作为回归目标，不得变成 `fan_count × ARPU` 的直接周收入。

月度报告需要同时呈现：现金、收入/成本、渠道 capture、成员薪酬与 tokuten back、P/O/C、满意度、Condition 风险、Issue、成员曝光和每成员工时收入。策略会议只配置资源方向；它不能绕过工作量、产能、合同或市场反馈。

**完成门槛：** 财务结果由已结算活动可回溯；D/C/B/A canary 的收入结构与 margin 在容差内；策略变化通过同一引擎链条而非临时乘数生效。

### Phase 7 — UI、可观测性与清理

UI 只展示可解释但不反向破解的报告：工作人员对节奏/主题/转场的文字诊断、模糊的 Condition/Issue 与趋势观察、分渠道经营报告。精确 Condition、World Theme、Audience State、Natural Fitness 和转换器权重保持隐藏。

UI 路由、固定壳层、玩家本团/成员 Status、Meeting 的可恢复状态、Continue 的未决 Meeting 回跳，以及 Policy 驱动的 non-blocking 默认执行，按 data-lab 的 UI overlay 分拆实现并逐项验收。旧的“月度 Strategy Meeting 必然 blocking”仅是历史行为，不能作为新实现前提。

完成旧 Track B 字段、legacy `livePerformanceWeb` 路径及已废弃 spec 镜像的移除；在移除前，以迁移夹具验证旧存档可读取或得到明确的不兼容提示。

**完成门槛：** 无运行时路径读取废弃字段；UI 与报告术语统一为 Impression / Expected Impression / Satisfaction；文档边界完成 §2.2 的清理。

## 4. 验证矩阵

每个 Phase 至少提供以下验证，并在报告中记录 data-lab spec commit：

- 类型与构建：`npm run typecheck`、`npm run build`。
- 数据：S6 结构、引用、时间边界、字段来源/覆盖率、四个 canary 的人工抽样。
- 引擎：固定 seed 的单曲、完整 live、Tokuten、周结算、月结算和旧存档迁移夹具。
- 校准：普通 5 曲 taiban、15 曲 one-man、iLiFE! 38 曲的 Condition/Issue 轨迹、Akishibu D-tier、Nadeshiko C-tier、iLiFE! B-tier、=LOVE A-tier。
- 回归：财务账本平衡、P/O/C 非负且守恒、同一互动不双计、无精确 Condition 或 Issue hazard 泄漏到 UI。

## 5. 实施纪律

- 先改 data contract 和纯函数，再改 UI；不得以 UI 标记代替运行时状态。
- 先交付可独立验证的 Phase，再开始依赖它的下一 Phase。
- 每个 PR 写明：`spec_commit`、所覆盖的 section、存档版本变化、导出合同变化、探针结果和遗留项。
- 如果 data-lab spec 或 authoritative overlay 有新 commit，先生成差异摘要；仅对受影响的 Phase 更新实现方案，不复制 spec 内容。
- 出现“新增第二个规则表/主题表/歌曲配置表”的需求时，先确认其所有权；研究事实归 data-lab，运行时派生状态归 web，避免双权威。

## 6. 当前分支实施状态

`feat/unified-condition-live-loop` 已将以下执行项落入运行时：

- 新存档启用 `track_b_v2`；旧 Track B 存档会一次性合成 `Condition` 并清除旧双疲劳字段。
- 训练、日恢复、Live、特典和日程媒体工作量均进入同一份 Condition；旧日状态更新器仅为没有 Track B 的兼容存档保留。
- Vocal/Physical Issue 使用离散 severity 与多日恢复，不会因单次休息自动消失。
- Live 使用逐曲 Audience State、Song Impression、Satisfaction、P/O/C 与即时 Tokuten 转化；成员曝光另行累积。
- 所有当前歌曲均使用明确的中性 L3 fallback：`appeal=普通`、`theme=[]`、`vocal_difficulty=12`、`dance_difficulty=12`、无 sing/dance lead，且 `formation/BPM/vocal_range=null`。这是未知数据的运行时默认，不是歌曲事实回填。
- Group Role 已降级为成员履历/公开资料：它不再重算属性或作为 Training 的可编辑分配表。Team Policy 只保留轻量的 `role_stability` 等默认分工方向。
- Training 与 Policy 已改为状态优先。Policy 主页只读；Policy Meeting 使用未提交草案，只有 `Submit Resolution` 才会替换模拟实际使用的 Policy。Training 不再从 Policy 直接改写每名成员的训练值。

### 待 data-lab 明确后实施的会议边界

- **大型单独 Live：** 必须有独立项目 Meeting，产出项目、预算、场地/日期、节目与特典决议；不能继续复用旧的直接 Arrange 表单。
- **Upcoming Live：** 保留到详情页的小幅、受约束修改入口；外部邀约与日常活动按 Policy/staff 自动处理。
- **Audition：** 现有 Scout 的公司/候选人工作台是旧模型，不能作为新 spec 的替身。在 data-lab 给出候选来源、阶段、staff 建议、Meeting 决策和合同/入团结果的合同前，只做只读审计，不扩展旧页面。

本分支尚待 data-lab 提供并审核的输入是 L3 歌曲事实与 canary 校准数据；拿到导出包后，只替换该 fallback/导入层并运行 §4 的验证，不在本仓库再维护一份 spec。
