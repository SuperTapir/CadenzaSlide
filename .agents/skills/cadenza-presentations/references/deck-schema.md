# Deck schema

权威文件是 `decks/<deck-id>/deck.cadenza.json`，当前格式为 `DeckDocument`，初始 schema version 为 `1`。根字段必须包含 `version`、`id`、`title`、`status`、`master`、`slides` 和 `outline`。

- `master` 是创建 deck 时复制的本地快照，控制字体、全 deck 转场以及 14 个核心 layout 的背景、元素动效和 slot frame。每个 layout 的 `authoring` 同时声明 `completion`、tagged `anchors`、可扩展 `regions` 与 `density`；Agent 必须读取这些数据，不能按 layout ID 维护另一张隐藏分类表。
- slide 只保存内容、layout、可选 slot override 与组件对象，不保存 `scene`、`motion`、`environmentMode` 或 `eyebrow`。
- 标题最多三条 authored line。Gallery 必须包含 1–4 张图。
- `slides` 由稳定 kebab-case ID 索引；每页恰好在 `outline` 出现一次。
- Speaker notes 是 `slides.<id>.notes` 中的 Markdown。
- 本地媒体必须位于当前 deck 的 `assets/`，并写为 `assets/<path>`；禁止绝对 filesystem path、`..` 逃逸与 `/decks/<id>/...` 安装侧副本。
- 高频内容关系优先使用 `kind: "composition"` 对象。对象必须包含稳定 `compositionId`、外层 `frame` 和声明式 `tree`；tree node 必须包含稳定 `nodeId`、已注册 `component`、`version: 1`，并只使用该 definition 声明的 `props`、`slots`、`children` 与受控 `axes`。
- production registry 当前包含 6 个 layout、10 个 content 和 3 个 relationship 原子组件。每个组件都必须具备 minimal、boundary、fallback 和至少三种结构不同的 composition fixture；没有这些证据的扩展不能注册。
- tree 首期最多 5 层、32 个 node；内部禁止坐标、任意 CSS、颜色、字体、阴影、transform 和执行字段。外层 `frame` 只负责把整棵 composition 放入 master region，不允许反向变成内部手绘坐标。
- `metric.hero`、`collection.cards`、`process.swimlane` 等旧宏表达已经删除；当前 schema 直接拒绝未知 component，不提供 runtime migration 或 read compatibility。
- 原生 `table/chart` 是 primitive/专用渲染能力，不是 Layout 场景，也不进入组件候选；需要数据图时交给独立 chart adapter，不用固定 bar/line/stacked variant 教 Agent 构图。
- `text`、`image`、`shape`、`code`、`video`、旧 `table/chart` 与 sandboxed `html` 仍是 primitive/兼容对象。只有 registry 没有合法候选时才组合 primitive；特殊页面从 `blank` 组合。deck-local HTML asset 必须是安全相对路径并通过严格 sandbox iframe 渲染；受信任的第三方播放器可显式声明 `external: true`，但只能使用无凭据 HTTPS URL、必须提供 `title`，并只获得脚本、同源、演示与媒体播放权限。
- 生成前读取 component manifest 的用途、props、slots、容量、axes、tokens 和 fidelity，响应 `fit/compress/split/fallback/reject` diagnosis；不得通过极小字号或任意 CSS 绕过预算。
- composition DOM 暴露 `compositionId`、diagnosis、density/cost、node ID、component/version、slot、axes 和实际 renderer，供 Verify 定位。HTML 必须是 native renderer；PPTX 只能声明 native 或 editable shapes，能力不足时阻止导出，不能静默展平为位图。

Authoring 后运行 `npm run cadenza -- verify <deck-id>`。
