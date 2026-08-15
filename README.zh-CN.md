<p align="center">
  <img src="docs/assets/cadenzaslide-logo.png" alt="CadenzaSlide" width="960">
</p>

# CadenzaSlide

[English](README.md) · [简体中文](README.zh-CN.md)

CadenzaSlide 是一套面向 AI Agent 的本地优先演示运行时与创作系统。Agent
负责理解内容、做出判断并修改可迁移的 `deck.cadenza.json`；Cadenza 负责确定性
渲染、预览、播放和验证。Cadenza 本身不会调用 AI 模型，也不需要 API key。

> 当前状态：早期版本，文档格式与 CLI 仍可能调整。

### 提供的能力

- 可迁移的 JSON deck 与 workspace 格式。
- Studio、Overview、Audience 与 Speaker 视图。
- 支持布局、组件、媒体、讲者备注和动画的固定画布 renderer。
- 演示前的静态验证与真实浏览器验证。
- `cadenza-presentations` Skill，为兼容的 Agent 提供完整创作和审阅流程。

### 环境要求

- Node.js 22.18 或更高版本
- npm
- 使用 browser verification 时，需要安装 Playwright 的 Chromium

### 从源码安装

克隆仓库后运行：

```bash
npm ci
npm run build
npm link
```

`npm link` 会在本机提供 `cadenza` 命令。仓库贡献者也可以使用
`npm run cadenza --`。

如需使用 Agent 创作流程，另外安装公开 Skill：

```bash
npx skills@latest add SuperTapir/tapir-skills --skill cadenza-presentations
```

### 快速开始

```bash
cadenza init my-talk
cd my-talk
cadenza new product-launch --title="产品发布"
cadenza open
```

然后让兼容的 Agent 使用 `$cadenza-presentations`，编辑
`decks/product-launch/deck.cadenza.json`。本地媒体统一放进
`decks/product-launch/assets/`，并在 JSON 中写成 `assets/<file>`。

演示前运行：

```bash
cadenza verify product-launch --browser
cadenza overview product-launch
cadenza present product-launch
```

### CLI

| 命令 | 用途 |
| --- | --- |
| `cadenza init [path]` | 创建 Cadenza workspace。 |
| `cadenza new <deck-id>` | 创建带默认母版的 outline deck。 |
| `cadenza list` | 列出当前 workspace 中的 deck。 |
| `cadenza open [path]` | 打开本地 Deck Library 与 Studio。 |
| `cadenza inspect <deck-id>/slide:<slide-id>` | 检查一个已创作页面。 |
| `cadenza visuals "<intent>"` | 查询经过筛选的视觉资产目录。 |
| `cadenza verify <deck-id> [--browser]` | 验证文件与真实渲染结果。 |
| `cadenza overview <deck-id>` | 按顺序复查完整演示。 |
| `cadenza present <deck-id>` | 验证并启动演示。 |
| `cadenza diff <deck-id>` | 汇总 deck 变更。 |

使用 `cadenza --help` 查看当前命令契约。

### Workspace 格式

```text
my-talk/
├── cadenza.config.json
└── decks/
    └── product-launch/
        ├── deck.cadenza.json
        └── assets/
```

Deck JSON 是唯一内容来源。Runtime 与 workspace 相互独立，因此迁移 deck
时不需要复制 Cadenza 源码或构建产物。

### 开发

```bash
npm run dev       # Vite 开发服务器
npm test          # 单元测试与集成测试
npm run test:e2e  # Playwright E2E 测试
npm run build     # 构建浏览器应用与 CLI
```

架构说明见 [`docs/architecture.md`](docs/architecture.md)。

### 隐私与安全

Workspace server 默认只监听 `127.0.0.1`。Cadenza 不会把 deck 内容发送给
模型提供方；Host Agent 及其权限决定如何访问源材料。请勿把私人 deck 放进本仓库。

### 许可证

CadenzaSlide 使用 [MIT License](LICENSE)。内置图标和字体保留各自许可证，详见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
