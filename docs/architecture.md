# CadenzaSlide Architecture

## 产品边界：runtime 与 workspace

Cadenza 安装目录和用户 workspace 是两个独立根目录。安装目录只拥有 CLI、renderer、Web bundle、Design Library 与 verifier；workspace 只拥有 `cadenza.config.json`、`decks/<deck-id>/deck.cadenza.json`、deck-local `assets/` 与可再生成的 `.cadenza/` 证据。CLI 从 `import.meta.url` 确定 runtime root，从 `cwd` 向上发现或由 `--workspace` 显式选择 workspace root。

`cadenza init <path>` 只初始化内容目录；`cadenza new <deck-id>` 只生成公开的 outline deck、默认母版快照和本地 assets 目录。两者都不复制源码、`dist`、`node_modules` 或 Demo。`open`、`present`、`overview` 与 `verify --browser` 从安装侧 `dist` 提供应用，从 workspace API 提供 deck JSON，并通过 `/api/decks/<id>/assets/<path>` 安全服务本地媒体。所有本地媒体必须写为 `assets/<path>`；绝对路径、旧 `/decks/<id>/...` URL、缺失文件、父目录与软链接逃逸都会阻塞 deterministic verification。

本轮删除了只生成 brief 的 Create UI、旧 semantic component migration 和不产生 portable artifact 的假 `build` 命令。Host Agent 通过 Skill 直接写权威 workspace 文件；当前交付路径是安装侧 server-backed renderer，static export 不是隐式承诺。

## 权威状态

`decks/<deck-id>/deck.cadenza.json` 是唯一 deck 权威来源。`DeckDocument` 拥有 deck-local `master` 快照、slides、outline/group 与 speaker notes；播放位置、窗口连接和本地面板状态不进入文件。

新 deck 自动复制默认母版，之后默认值更新不会影响已有 deck。母版统一控制字体、全 deck 转场，以及每个核心 layout 的背景、元素动效和 slot frame。页面保存内容、组件与必要的局部 override；母版改变后 Agent 必须 review 全 deck。

## Authoring surfaces

- Studio：Keynote 式 Navigator、Deck Master 只读预览、notes 与只读 Design Library。视觉修改只由 AI 写母版。
- Overview：多列全 deck 复查，无编辑能力。
- Audience / Speaker：只负责播放与讲者工作流。

## Core layouts 与 components

核心 layout 固定为 14 个：`title`、`title-photo`、`title-photo-alt`、`title-bullets`、`title-bullets-photo`、`section`、`title-only`、`agenda`、`statement`、`big-fact`、`quote`、`gallery`、`photo`、`blank`。

Hero 标题只用于 Title、Title & Photo、Title & Photo Alt、Section。其余标题降低视觉强度。文字 slot 按需出现，标题最多三行，中文与英文共享略宽松行高。

Gallery 接收 1–4 张图片，根据数量和 authored aspect ratio 选择确定性 mosaic；优先保留构图，必要时使用 `object-fit: cover` 和 focal point。Table、Code、Video、Chart 与 HTML/CSS 都是可组合组件，不是额外模板。HTML asset 仅允许 workspace 相对路径并由 sandbox iframe 加载。

## Rendering 与 verification

Renderer 从 `master.layouts[slide.layout]` 解析背景、slot 与元素动效，并把唯一 `master.slideTransition` 写入所有页面。Reveal.js 只拥有导航、fragments、speaker notes 与媒体生命周期；Cadenza runtime 根据 renderer 产生的 scene 属性切换环境。

`cadenza verify` 做 schema、media、custom、component 与 render-contract 检查。母版、outline 或 custom system 改变触发全 deck scope；普通内容/notes 修改可以增量检查。Production build 再运行固定 1280×720 browser smoke，Overview 与 Audience 负责最终视觉判断。

公开验证路径只有 `cadenza verify <deck-id> [--browser]`。静态 verifier 检查 document、media、custom、component 与 render contract；`--browser` 在真实 1280×720 页面上补充 geometry 和 smoke 检查。它们提供可重复的确定性证据，但不能证明页面“好看”；Host Agent 仍需在 Audience 全尺寸画布与 Overview 顺序视图中完成视觉和叙事判断。

项目不维护第二套 versioned run、Agent packet、repair queue 或 Studio Verify 状态机。需要留存截图、审阅判断或修复说明时，使用正常的 workspace 文件、测试产物与 Git 历史，不再创建隐藏的验证数据模型。

## 源码边界

- `src/apps/browser/` 与 `src/apps/cli/` 是两个 composition root；feature module 不得反向 import app。
- `src/platform/browser/` 只负责浏览器侧 deck I/O 与保存队列；`src/platform/node/` 独占文件系统、workspace server、CLI verifier adapter 与 Playwright smoke。
- `src/core/` 保存 deck document/master/outline contract，`src/authoring/` 保存 component registry、preflight 与 Composer，`src/rendering/` 保存 HTML renderer 与 Gallery；这些模块和 `src/studio/`、`src/overview/`、`src/presentation/`、runtime、纯 `src/verification/deck-verifier.ts` 均不得 import Node platform。
- 正式 Studio、Overview 和 workspace Audience 必须从 workspace API 取得 deck。内置 Demo 仅允许通过 Deck Library 的显式 `source=demo` Audience 入口按需加载，或在开发模式作为调试 fallback；生产 workspace deck 加载失败不得回退到 Demo，Demo 也不得复制或写入用户 workspace。
- `tests/fixtures/` 只供测试消费；production source 不得 import 测试语料。

这些规则由 `src/architecture/import-boundaries.test.ts` 固化。新增目录或迁移 owner 时先修改可测试的边界契约，不增加 barrel facade、DI container 或通用 event bus。

## Presentation runtime 组合与生命周期

`src/apps/browser/presentation-entry.ts` 是浏览器 presentation 的 composition root：只解析 mode、加载并渲染 deck、创建具体 feature owner、按依赖顺序启动并在 unload 时逆序释放。它不拥有保存队列、跨窗口协议或 Studio 交互状态机。

- `DeckDocumentStore` 是运行期 deck snapshot 和串行保存的唯一 owner。Studio notes 与 outline 只提交不可变 update；`BrowserDeckRepository` 仍是 I/O adapter。失败只影响当前 snapshot，后续保存继续执行。
- `PresentationSessionController` 是 BroadcastChannel、同步 sequence 和 Reveal session listener 的唯一 owner。Studio 发送 state，Audience 只应用当前 session 的新 sequence，receiver 只声明 Presenter ready；session state 永不写入 deck。
- `StudioWorkspaceController` 只在 Studio mode 创建，拥有 controls、Navigator、notes、本机 pane preference、窗口启停和 presentation lock。Audience/receiver 不创建任何 Studio 写路径。
- `RevealHostController`、`ElementMotionController`、`MediaLightbox` 与 `CadenzaRuntime` 各自管理自身 listener/资源，并提供幂等 dispose。composition root 先释放依赖方，最后销毁 Reveal。

模块之间使用具体、小型接口，不使用全局状态库、DI container、通用 event bus 或 controller 基类。新增有状态 feature 时必须明确唯一 owner、`start()`/`dispose()` 契约和无需加载完整 entry 的验证 case。
