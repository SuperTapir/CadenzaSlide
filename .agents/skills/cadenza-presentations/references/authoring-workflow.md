# Authoring workflow

## New deck

1. 在用户指定目录运行 `cadenza init <workspace>`（已有 `cadenza.config.json` 时跳过），然后从该配置发现 workspace。不得把 Cadenza 源码、`dist`、`node_modules` 或 Demo 复制进 workspace。
2. 按 [creation-guidance.md](creation-guidance.md) 选择快速路径或引导路径，形成 creation contract。确认主题、观众、演讲时长、目标页数范围、屏幕比例、重点章节和结构方向；视觉选择不询问用户。若只有时长，先说明节奏依据并确认页数范围；不要根据源材料长度自行猜测页数。无法确认时要明确记录假设。
3. 原地读取素材，把理解写入 deck 的 `.cadenza/source-analysis.json`；本地媒体复制到 `decks/<deck-id>/assets/`，JSON 只写 `assets/<path>`。
4. Host Agent 把 creation contract 和完整 outline 展示给用户校正，不创建第二份 `creation-brief.json` 内容源。
5. 运行 `cadenza --workspace <workspace> new <deck-id> --title=<title>` 创建带默认母版快照的合法 `DeckDocument`，再编辑公开 JSON；不得从 Cadenza 源码导入 `createDefaultDeckMaster()`。
6. 使用 14 个核心 layout 生成 `status: "outline"` 的稳定 slide ID 和可审阅 outline；按 creation guidance 展示每页主张、叙事作用和证据来源，打开 Overview 等待确认。
7. 确认后读取 `master.layouts.<layout>.authoring`，按 complete、startup、canvas 顺序决定页面路径；按 creation guidance 记录决策、准备资源并分批填充内容与 notes。全部批次完成后改为 `status: "complete"`，运行 `cadenza verify <deck-id> --browser` 并在真实 Audience viewport review。

## Master changes

Studio 只查看 Deck Master。用户要求调整视觉时，由当前 Agent 直接修改 deck 的 `master`，随后对全部受影响页面运行 verify 并在 Overview/Audience 复查；需要时调整个别页面的内容、slot override 或组件位置。Design Library 只作参考，永不 apply。

## Visual quality loop

先读取 [visual-review-contract.md](visual-review-contract.md)，把其中的自动拦截规则与 Audience 人工审查都纳入本轮 acceptance。该文件是视觉失败模式的单一事实来源；本节只规定执行顺序和证据闭环。

### 批次质量状态机

- 每个生成批次依次经过 `draft → preflight → written → static-verified → browser-verified → visually-reviewed → accepted`。任一 finding 未解决时进入 `repairing`，修复后必须重新运行受影响的公开验证和审阅步骤，不得直接改为 accepted。
- 写入过程中可反复运行 `cadenza verify <deck-id>` 做快速确定性检查；完成后运行 `cadenza verify <deck-id> --browser` 补充真实页面 geometry/smoke 证据，再由 Host Agent 在 Audience 与 Overview 完成全尺寸审美和叙事复核。Cadenza 不维护额外的 channel/run 状态机。
- 技术通过不等于视觉完成。没有溢出、schema 合法或 fast/browser 通过，只能证明对应契约成立；全尺寸页面仍空洞、拥挤、层级错误或调性失真时必须继续 repairing。
- 在 host-native 页面质量账本中记录每页的 authoring path、内容 signal ID、preflight/verifier rule ID、repair reason 与 acceptance；账本只能引用 ID 和验证证据，`deck.cadenza.json` 始终是唯一内容来源，禁止在账本复制 title、body、slides 或 master。
- 中途用户反馈先分类：同类输入可能重现的问题必须沉淀为 rule、Skill、组件/renderer 或测试，并复验原案例和不同案例；内容特例必须记录理由，只能留在当前 deck，禁止借特例污染公共能力。

- Cover、Title & Photo、Title & Photo Alt 和 Section 才使用海报式 hero 标题；普通内容页使用低强度标题。
- Cover 默认从 `title` 的传统环境背景开始，可加入一至三个能通过删除测试的语义 icon；生成图或全幅媒体封面是升级路径，不是默认路径。主图经过 One Bit 或 `cover` 后失去可读轮廓时，回退到传统背景。
- 中文标题使用共享行高并限制最多三行，不做脚本分支 metrics。
- Gallery 检查 1–4 图、横竖混排、裁切与 focal point。
- 信息文字不得低于 12px；低于 12px 的文字只能作为 `aria-hidden="true"` 的纯装饰，不能承载名称、说明、来源、状态或操作含义。
- `title-photo` 是无图注的全幅海报式媒体。图片带 caption/source 时禁止图注进入该 layout，必须选择 `title-photo-alt`、图文页、Gallery 或显式 caption 组件；renderer 隐藏图注只用于防御，不代表输入合法。
- 图文媒体写入时声明 `kind: photo | product | illustration | screenshot | diagram`。高信息量 `screenshot`/`diagram` 默认使用 `tonal + contain` 保留细节并统一色调；颜色本身是证据时才用 `original`。`title-photo-alt` 根据 `aspectRatio` 自动选择 portrait、balanced 或 landscape 几何，必要时启用 `frameMode: compact`；Gallery 对超宽单图和纵向截图对使用紧凑网格。不要用逐页 slot override 重复修同一种比例问题。
- 三页及以上共享一个有序方法、原则、阶段或 Agent 序列时，优先使用 `custom:numbered-series`：`seriesLabel`、`seriesNumber`、title、subtitle 固定在统一页头，底部固定序列导航，变化内容放在 y=31–88 的安全区。连续编号表达顺序，内部可使用媒体、代码、流程、对照或其他合法 composition，不要求相同剪影；不得把单行文字放进巨型空框。
- 连续编号中的抽象原则需要真实案例支撑时，使用 `series-evidence-split` 复制同一标题与编号做一张证据展开页，只深入其中一条并加入新媒体或真实输出；若只是重复卡片文案，删除展开页。
- 普通 agenda 不得推断 active，也不得默认把第一项涂黑；只有内容明确表达当前章节或当前步骤时才写入 `state: "active"`，并且同页最多一个。
- 纸面表面必须不透明；禁止半透明纸面、遮罩或 `color-mix(... transparent)` 改写品牌底色。透明度只可用于非纸面的纯装饰，并不得遮挡或改变信息区域的真实颜色。
- taxonomy、能力清单或分类词表应使用同级类别面板加可换行标签族表达；用 `cluster` 的 `wrap: "wrap"` 让容器换行，单个标签保持不换行。不得把分类关系降格成横线表格，也不得用低于 12px 的微缩文字塞入一页。
- 先判断是内容问题还是 Design System 问题。同类问题优先修母版/renderer/CSS 和 fixture，不要逐页打补丁；内容特例才做页面 override。
- 特殊一次性页面先从 Blank 与现有组件组合；只有用户明确要求且组件不足时才使用 sandboxed deck-local HTML/CSS。
- 技术 smoke 不能证明视觉质量，必须在实际 Audience viewport 复查。标题末行只剩一两个字属于孤字行，应先调整文案或 authored line break。中文引号统一使用直角引号「」。
- Overview 只用于扫描节奏，不能替代 Audience 验收。Overview 缩略图、放大预览与 Audience 必须来自同一份 1280×720 渲染；若三者在换行、裁切、媒体焦点、动画静止帧或层级上不一致，应先标记为 preview/render contract 缺陷。最终接受必须以 Audience 全尺寸相邻页检查为准，并对不一致建立回归 case。
- workspace 在运行中的浏览器之外被直接修改时，先 reload 当前页面，确认 Deck 已重新读取，再执行 Audience 截图和相邻页验收。只改变 `#/slide` 不会重新加载文件，旧 DOM 或旧缩略图不得作为通过证据。
- 只有语义节奏确实需要时才 authored line break。若当前安全区足以容纳合并后的短标题，禁止为了套母版强制换行；全尺寸复核时应同时检查孤立末行和“本可单行却被拆开”的不必要换行。
- 作者自己的文章摘录默认只写入 Speaker Notes 的 `## 原文摘录`，供演讲提示与追溯使用。页内不得机械显示“原文”署名；只有外部人物、外部出版物或必须辨认的外部来源才在画面上署名。
- 新增或明显变形的组件组合，在批量生成前先完成至少 2 张代表页：一张高频内容页和一张最复杂页面，
  确认 Cadenza 的字阶、间距、线条、纹理和阅读节奏后再展开。
- Playwright 视觉复核至少覆盖 Studio、Audience 和 Overview；关键表达必须按全尺寸单页检查，
  不能只看缩略图。逐页记录 overflow、bottom whitespace、title gap、最小字号、重复轮廓和主构图占比。
- 全尺寸单页检查之后再生成按演讲顺序排列的 Audience 接触表；先做去文案化审阅，只看构图剪影和明暗节奏，再回到具体页面。若接触表暴露出连续重复轮廓、同尺寸卡片墙或大面积无功能空白，页面必须重新进入 `repairing`，即使 document/browser verifier 已经通过。
- 发布前必须运行 `npm run cadenza -- verify <deck-id> --browser`。静态层的 `layout.content-coverage`
  评估内容语义与占位面积，渲染层的 `browser.content-coverage`、`browser.empty-surface`、
  `browser.text-clipping` 和 `browser.orphan-line` 分别阻止实际内容面积不足、巨型空容器、真实字形裁切与孤立末行；Cover 与 Section
  只豁免内容覆盖率，不豁免裁切与溢出。
- 组合页还必须检查：全页只有一个主张；supporting component 不重复标题 chrome；主组件面积明显大于支持组件；
  composition tree 覆盖全部已提供内容信号；截图看起来是一张完整页面，而不是多个 Gallery 卡片并排。
- 关系与层级需要真实连接线，图表需要轴/网格/标签/图例中的必要标记；缺少这些语义证据时，
  页面即使没有溢出也不算通过。
- 发现问题时依次判断：内容是否空洞、场景是否选错、必需元素是否缺失、可选元素是否滥用、
  renderer/CSS 是否为系统性原因。系统性问题修 registry、fixture 或 renderer，并重新跑全部受影响页面。
- 自动断言无溢出只属于技术复核。若全尺寸截图仍显得空洞、拥挤、层级错误或不符合 Cadenza 调性，
  必须把该页标记为视觉失败并继续返工。

## 原子组件组合闭环

- 不得为新页面写入 `metric.hero`、`process.swimlane` 等已删除的旧宏观表达；当前 schema 直接拒绝未知 component，不提供 migration runtime。
- 先把用户内容声明为稳定 ID 的主张、证据、指标、顺序、媒体、来源和真实关系；未提供的信号不得补造。
- 从同一 production registry 查询 `layout`、`content`、`relationship` 原子组件的 props、slots、axes、容量和 fidelity，再生成有限 composition tree。树内禁止坐标、任意 CSS、颜色、字体、阴影、transform 和执行字段。
- `code` 节点优先使用可见 `caption` 解释命令用途、作用对象和输出/通过标准；命令及展示输出必须能追溯到仓库源码、官方文档或本轮真实运行。若 caption 缺失，`code.explanation` 会要求修复；Speaker Notes 负责保留缩写前的完整命令与证据路径。
- 按 `signals → slots/parent → capacity/intrinsic → profile budget → tokens → fidelity` 做硬过滤；只有全部通过的候选才能参与解释、fingerprint、排序、seed variation 和相邻页重复惩罚。
- 对每个候选调用 `preflightCompositionCandidate`，保留 shared `ruleId`、stable target 与 structured evidence；缺失信号、非法 slot、容量/语义字号超限、intrinsic 不足或内容覆盖不足时，按 `repair | simplify | split` 恢复后重新预检。
- 先判断页面是否需要额外 visual。已有照片、截图、图表、双指标焦点、人物或明确关系图时默认不再加 icon；抽象概念缺少强媒体时，运行 `npm run cadenza -- visuals "<页面语义意图>" --motion=none --limit=5 --avoid=<相邻页 asset ID>` 查询 production catalog。静态结果只使用 `icon:lucide-*`；只有语义确实需要状态动作时才显式改为 `--motion=enter|loop|emphasis`，此时只使用精选 `icon:line-md-*`。
- 为 visual 写一句“删除测试”：删掉它以后，观众会失去哪条可验证信息？答不出时不得写入 visual。状态 icon 必须与可读文字或输出形成冗余编码；不得用箭头、代码、合并、告警等通用图标替代没有被设计清楚的关系。
- 媒体写入前对整个 deck 做 source 去重，并把强证据分配给唯一页面。高信息量媒体不得进入 `overlay.base` 后再由 `overlay.overlay` 放置可读正文；改用 split、外置 caption 或完整媒体页。
- 对观众可能陌生、且主线理解依赖的专有名词执行“辨认测试”。若标题和现有上下文不能让目标观众在五秒内回答“这是什么”，查询官方一手资料并本地化一张可追溯图片，插入一页短科普后回到原叙事。故事起点的配图必须来自当时对象，不得提前使用后续成果。
- 选中 visual 后写入 `visual` 原子节点，并保留 CLI 返回的 `assetId`、family、prominence、behavior 与 matchedTerms 作为 host-native authoring evidence。每页只允许一个 hero/support 主视觉；相邻页避免相同 asset 与 family。查询无合格结果时保留文字/媒体 composition，不创建占位装饰。
- 将最终树写为 `kind: "composition"` 对象，提供稳定 `compositionId`、由 master region 决定的外层 `frame` 和已验证 `tree`。外层 frame 只负责页面区域，组件内部布局只能来自 slots 与受控 axes。
- 每张组合页执行「内容信号 → registry 查询 → 候选组合 → diagnosis → 写入 → Audience 全尺寸截图 → 复核 → 返工」。若无合法候选，使用结构化 repair/simplify/split 建议；不得写入未经验证的树。
