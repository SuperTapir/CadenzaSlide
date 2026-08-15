# Visual review contract

把这份契约用于每一次生成、修改和最终验收。先运行自动规则，再做全尺寸 Audience 人工审查；任何一层失败都让页面回到 `repairing`。Overview 只帮助扫描，不能替代真实放映状态。

## 生成决策

- 先确定每页唯一主张、叙事作用和证据。已有照片、产品截图、真实过程、官方技术图、图表或作品图时，优先使用这些强证据；素材顺序为用户/文章提供 → 官方一手资料 → 可追溯公共素材 → 生成图。外部素材必须本地化，并记录来源、用途和许可证。
- 叙事依赖观众可能不认识的产品、设备、项目或术语时，先检查上下文是否足以辨认；不足时增加一页短支线科普，优先检索官方一手页面和官方产品图，说明“它是什么、为何与主线有关”，随后立即回到主线。不得用后续才出现的自制成果替代当时真正触发故事的对象。
- 抽象原则页只负责提出主张。真实截图、视频、目录、测试报告或运行结果能显著帮助理解时，复制系列标题与编号增加一张「证据展开页」，用新证据解释其中一条；不得机械地让每条原则都扩成两页，也不得只把上一页文字换个版式复述。
- 展示代码前必须从项目源码、官方文档或实际运行确认命令与输出。代码旁必须让观众看见「执行什么、作用于什么、结果代表什么或怎样才算通过」；为适配画面缩短命令时，把完整调用与来源写进 Speaker Notes。禁止虚构终端输出、把不同对象的摘要误说成应该相等，或用无法解释的代码黑框充当技术感。
- 图片、视频或实物证据可以主导页面。强媒体默认占主要安全区的 55% 以上，文字退为外置标题、短 caption 或少量 callout。高信息量截图、图表、流程和作品拼图必须完整可读，不得被正文、Quote、卡片或大标题遮盖；只有低信息量环境图可以承载 overlay。
- 每张栅格媒体必须声明语义 `kind`。主画布、Navigator 与 Overview 只允许 `treatment: tonal` 或 `treatment: one-bit`；未经处理的彩色原图只能在用户主动打开媒体查看器后显示。`screenshot`、`diagram` 默认 `tonal` 与 `fit: contain`，以纯灰阶保留小字和层次；`photo`、`product`、`illustration` 可根据证据测试使用 One Bit。信息密集截图禁止 `cover` 和强制 One Bit；One Bit 无法读出关键文字、控件、轮廓或关系时必须回退到 tonal。
- 横图、竖图和近方图不能机械塞进同一个固定右栏。优先使用可感知 `aspectRatio` 的自适应图文变体或 Gallery；横图允许转为上下结构，竖图收窄并增高，单张竖图在 Gallery 中居中控制宽度。超宽状态条、纵向截图对和宽高比与默认媒体槽明显不匹配的证据应使用紧凑证据框，让画框贴近素材比例；只有焦点明确的环境照片才允许依靠裁切填满固定框。
- Cover 默认先使用 Cadenza 的环境背景、标题层级和少量通过删除测试的语义 icon。只有主视觉本身能通过证据测试、One Bit 短边测试和裁切测试时，才升级为生成图或全幅照片封面；不得为了“像封面”先生成一张复杂图再让 renderer 抹掉细节。
- 同一媒体默认只用一次。跨页复用只允许有明确叙事回环，并记录理由；相邻页面不得机械复用同一图、同一 GIF 或内容相同的 URL 副本。
- icon 必须通过删除测试：移除后，观众会失去哪条状态、动作、对象类别或导航信息？答不出时删除。不得用语义牵强的 icon 填空、配平或制造装饰感。同级集合统一采用同一种视觉语法；局部 icon 仅用于表达该项独有的、附带文字解释的状态。
- One Bit 无法单靠红绿传达通过/失败。用叉号/勾号、形状或纹理提供冗余状态编码，同时保留文字或真实输出。需要进入 One Bit 画布的远程栅格图先本地化并验证处理结果；产品截图中的彩色证据只有在颜色本身是信息时才保留，并需说明例外。
- 大型卡片、边框和表面必须承载足够信息、真实媒体或明确关系。短标题加一句说明不应占据巨型空框；改用开放排版、路径、对照、尺度关系或完整媒体。
- Blank 中的 `heading + list` 仍属于 Title + List。流程要呈现阶段或进度，对照要呈现尺度差、状态差或转化关系，协作要呈现责任流向。结构化短文字优先于大段正文；普通内容页不得连续使用纯文字停顿版式。
- Quote 只放能够脱离上下文独立成立、值得现场停顿的句子。普通判断、条件和说明使用主张加证据、后果或判断标准。展示文案禁用「不是……而是……」式廉价反转，直接表达条件、因果或取舍。
- 只在真实语义节奏需要时 authored line break。安全区容得下的短标题保持单行；删除没有语义作用的 `/`、装饰标点和强制断行。Section 的章节主张必须进入大标题，subtitle 只补充语境。
- 作者文章的原文摘录写进 Speaker Notes 的 `## 原文摘录`，作为演讲提示和追溯证据。画面不机械标注“原文”；外部人物、出版物或必须辨认的来源才在页内署名。每页摘录要直接支持该页主张，不得用同一句章节级占位摘录反复填充。
- Cadenza 环境画布保持低幅生命感。普通内容采用 `loop`，章节切换和叙事峰值提高能量，收束页回到安静；运行时尊重 `prefers-reduced-motion`。不要在每个元素上堆动画。

## 自动拦截

以下 finding 出现后必须修复或记录有证据的例外，不能只凭肉眼宣告通过：

| 失败模式 | Verifier contract |
| --- | --- |
| 全部背景静止 | `motion.environment-all-static` |
| 同一媒体跨页复用 | `media.cross-slide-reuse` |
| 远程栅格图存在 One Bit 风险 | `media.remote-one-bit-risk` |
| 信息密集截图被裁切或强制 One Bit | `media.screenshot-cover`、`media.screenshot-one-bit` |
| 证据图上覆盖可读正文 | `media.text-overlay-review` |
| 强媒体被缩成容器中的小块 | `browser.media-aspect-underfill` |
| 大型空框、区域失衡或内容覆盖不足 | `browser.empty-surface`、`browser.region-balance`、`browser.content-coverage` |
| Blank 仍是标题加列表 | `composition.text-list-only` |
| 同一 composition 剪影反复出现 | `composition.silhouette-repetition` |
| 简单 Title + List 占比过高 | `layout.simple-list-overuse` |
| 横排短项被无意义挤成多行 | `browser.horizontal-item-wrap` |
| 孤立末行、裁切、重叠和装饰遮挡 | `browser.orphan-line`、`browser.text-clipping`、`browser.content-overlap`、`browser.layer-collision` |
| Section 缺少章节大标题 | `layout.section-title` |
| 连续编号系列内容侵入固定页头 | `layout.numbered-series-safe-area` |
| 代码缺少用途与结果解释 | `code.explanation` |
| 原文摘录缺失或跨页占位复用 | `notes.source-excerpt`、`notes.source-excerpt-reuse` |
| 廉价反转句式 | `copy.forbidden-rhetorical-frame` |

自动检查只能覆盖可稳定测量的失败。规则通过说明对应契约成立，不代表页面已经有内容、有惊喜或符合 Cadenza 调性。

## Audience 人工审查

1. 在 1280×720 Audience 全尺寸逐页检查。外部编辑 `deck.cadenza.json` 后必须真正 reload 页面再截图；只切换 hash、Overview 缩略图或内存中的旧预览不算读取了新 Deck。确认标题换行、图片裁切和 focal point、One Bit 结果、层级、边距、留白、真实媒体可读性与首个阅读入口。Overview、放大预览与 Audience 有差异时，先记录 preview/render contract 缺陷，并以 Audience 为本次验收依据。
2. 对每个 icon 执行删除测试，并检查同级项是否统一。语义错误、意义不明、悬浮无锚点、遮挡内容或只给部分卡片装饰 icon，都判为失败。
3. 对每张媒体执行证据测试：观众能否看清它证明什么？若图本身无法解释页面主张，替换素材或改变构图。信息量大的图保持完整；强媒体不能退化成角落配图。
4. 生成按演讲顺序排列的 Audience 接触表。先忽略文案，只观察页面剪影、明暗块、媒体位置、重心和入口。同一普通内容轮廓跨 3 页重复，或相邻两页只有文字变化，判为节奏风险；稳定章节母版可以复用。
5. 检查视觉平衡：四周 padding 是否服务同一重心，顶部是否留下无功能的大空带，左右区域的信息量和尺度是否匹配。空框、细小截图、漂浮标记和过度居中都需重新构图。
6. 检查演讲性：页面应帮助观众看，Speaker Notes 帮助演讲者讲。大段正文、重复原文标签和需要现场逐字阅读的内容判为失败。

## 责任边界

- Composer 与 master 负责默认走向：动态环境、合理媒体面积、Section 大标题、可用的 Gallery 几何与受控组合。
- Document verifier 负责内容和结构契约；browser verifier 负责真实几何、裁切、覆盖、留白和换行信号。
- Host Agent 负责目前无法稳定量化的判断：素材是否真正解释内容、icon 语义是否成立、节奏是否有惊喜、构图是否平衡、Overview 与 Audience 是否感知一致。
- 任何反复出现的人工失败都要评估为新的自动规则、组件能力、Composer 选择逻辑或回归 fixture。无法自动化时保留明确的 Audience checklist，不得退回“凭感觉看看”。
