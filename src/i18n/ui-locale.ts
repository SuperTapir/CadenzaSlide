export type UiLocale = 'zh-CN' | 'en'

const copy = {
  'zh-CN': {
    locale: { label: '界面语言', chinese: '中文', english: 'English' },
    common: { presentation: 'CadenzaSlide 演示', notStarted: '未开始' },
    studio: {
      pageNavigation: '页面导航', projectActions: '项目操作', present: 'Present', endPresentation: '结束放映', moreActions: '更多项目操作',
      designLibrary: 'Design Library', openAudience: '打开观众视图', openPresenter: '打开演讲者视图', keyboardHint: '方向键 / SPACE 翻页 · S 演讲者视图 · ESC 总览',
      font: '字体', typographyTheme: '中英文字体主题', background: '背景', backgroundEnvironment: '背景环境', environmentStill: '环境 静止', pauseEnvironment: '暂停环境',
      editSelected: '修改所选元素', editRequest: '元素修改要求', editPlaceholder: '这个元素需要怎么改？', quickEdits: '快捷修改指令', polish: '润色', longer: '更详细', shorter: '更精简', verify: '核实', cancel: '取消', confirm: '确认', cancelEdit: '取消修改', queueEdit: '加入修改队列',
      pageCanvasControls: '页面与画布控制', pageWorkspace: '页面工作区', resizeDrawer: '调整下栏高度', pageLayout: '页面 Layout', masterAndContent: '母板与页面内容', currentLayout: '当前页面 Layout', optionalPositions: '可选内容位置', reapplyLayout: '重新应用 Layout',
      speakerNotes: '演讲者注释', notesPlaceholder: '输入只在演讲者视图中显示的提示……', currentNotes: '当前页面的演讲者注释', waitingDeck: '等待载入 deck 文件',
      agentQueue: 'Agent 修改队列', nothingSelected: '尚未选择元素', queueEmpty: '开启 Inspect 后点击画布元素，在这里记录希望 Agent 完成的调整。', clear: '清空', copyToAgent: '复制给 Agent',
      canvasControls: '画布视图控制', zoom: '画布缩放', fullscreen: '全屏查看画布', deckUpdated: 'Agent 已更新这份 deck', reloadReturns: '重新载入后回到当前页面', reload: '重新载入',
      connected: '已连接 deck 文件', disconnected: '未连接 workspace；更改无法写入项目', persisted: '已保存到 deck 文件', memoryOnly: '开发预览：更改仅保存在内存',
      environmentMoving: '环境 轻动', reducedMotion: '系统已启用“减少动态效果”，背景保持静止', reloadCancelled: '重新载入已取消', updateUnknown: '无法确认 deck 文件更新，请检查 workspace 连接',
      createGroup: '+ 分组', overview: '总览 ↗', rename: '重命名', ungroup: '取消分组', insertHere: '插入到这里', jumpToSlide: '跳转页码', groupName: 'Group 名称', renameGroup: '重命名 Group', savingOrder: '正在保存排序…', selectSlide: (label: string, number: number, total: number) => `选择 ${label}；第 ${number} 页，共 ${total} 页`,
      notesSaved: '已自动保存', notesSaving: '正在自动保存…', notesLoaded: '已从 deck 文件载入', mediaPreview: '媒体放大预览', mediaControls: '媒体缩放控制', zoomMediaOut: '缩小媒体', zoomMediaIn: '放大媒体', resetMediaZoom: '重置媒体缩放', reset: '重置', closeMediaPreview: '关闭媒体预览',
      connectedShort: '已连接', waitingConnection: '等待连接', popupBlocked: '被拦截 · 可单独重试', audiencePopupBlocked: '观众视图被浏览器拦截，请允许弹窗后重试', openingPresenter: '正在打开演讲者视图；若未出现，请允许弹窗后重试', preflightFailed: '放映前检查未通过', ended: '已结束', dotPitch: '点距', playEnvironment: '播放环境', fullscreenRejected: '浏览器拒绝全屏请求，已保留当前视图',
      layoutSwitchFailed: '无法切换', noTargetPosition: '没有目标位置', layoutSwitched: '已切换', contentPreserved: '内容与页面对象已保留', shown: '已显示', hidden: '已隐藏', contentStillPreserved: '内容仍保留', layoutReapplied: '已重新应用 Layout；页面内容与自由对象保持不变', hasContent: '已有内容', emptyHidden: '未填，不会展示', optionalPositionCount: (count: number) => `${count} 个可选位置`,
      inspectEnabled: 'Inspect 已开启 · 点击画布中的元素', editTarget: (label: string) => `修改 ${label}`, update: '更新', updateQueue: '更新修改队列', addQueue: '加入修改队列', inspectSummary: (count: number, ids: string[]) => `${count} 个页面${count ? ` · ${ids.join('、')}` : ''}`, canCopy: '可以复制给 Agent', fillRequest: '请填写修改要求', queueCleared: '修改队列已清空', copiedEdits: (count: number) => `已复制 ${count} 条修改请求。回到 Codex 粘贴，Agent 修改完成后这里会通知你重新载入`, emptyEdits: '请先填写至少一条修改要求', clipboardFailed: '复制失败，请检查浏览器剪贴板权限', editQueueLabel: (summary: string) => `修改队列：${summary}`, removeEdit: (label: string) => `移除 ${label}`, remove: '移除', nonTextElement: '非文本元素', agentInstructionPlaceholder: '告诉 Agent 这个元素需要怎样调整……', agentInstructionLabel: (label: string) => `${label} 的修改要求`, inspectPolish: '润色这个元素，使表达更自然、准确，并保持原有语气。', inspectLonger: '让这个元素更详细，补充必要信息但不要改变核心意思。', inspectShorter: '让这个元素更精简，保留核心信息和原有语气。', inspectVerify: '核实这个元素中的事实、数字和表述，并修正不准确之处。',
    },
    library: {
      intro: '选择一份 deck 进入 Studio。其他 workspace 可通过 CLI 打开。', yourDecks: '你的 Deck', examples: '系统示例', empty: '当前 workspace 还没有 deck。你可以先预览系统 Demo，或使用 CLI 创建一份新 deck。', demoDescription: '了解 Cadenza 的核心 layout、组件、视觉环境与动效语言。', previewDemo: '预览 Demo', openStudio: '在 Studio 中打开',
    },
    overview: { hasNotes: '包含演讲者注释', noNotes: '无演讲者注释', preview: '放大预览', copyId: '复制 ID', copied: '已复制', search: '搜索', searchLabel: '搜索 slide 标题或 ID', searchPlaceholder: '标题或 slide ID', group: 'Group', groupLabel: '按 group 筛选', allGroups: '全部', region: 'Slide Overview', separator: '：', outlineCheckpoint: '大纲确认点', completeDeck: '完整 Deck', outlineSlides: '大纲页面', slides: '页面', closePreview: '关闭放大预览' },
    gallery: { title: '版式与组件参考', intro: '这里用于查看能力，不会把视觉选择写入 deck。', close: '关闭', search: '搜索', searchLabel: '搜索 Design Library', openPreview: (label: string) => `放大预览 ${label}`, copyComposition: '复制 composition tree', copiedComposition: '已复制 composition tree', copyFailed: '复制失败', masterEyebrow: 'DECK MASTER / 只读', masterTitle: '当前演示文稿母版', masterIntro: '修改请直接告诉 Agent；更新后会统一应用并复查所有页面。', masterAria: 'Deck Master', masterStatus: '三层母板', masterPreview: '放大预览 ↗', masterComposition: '同一页面同时展示固定元素、已填占位符与自由对象' },
  },
  en: {
    locale: { label: 'Interface language', chinese: '中文', english: 'English' },
    common: { presentation: 'CadenzaSlide presentation', notStarted: 'Not started' },
    studio: {
      pageNavigation: 'Slide navigation', projectActions: 'Project actions', present: 'Present', endPresentation: 'End presentation', moreActions: 'More project actions',
      designLibrary: 'Design Library', openAudience: 'Open audience view', openPresenter: 'Open presenter view', keyboardHint: 'Arrow keys / SPACE to navigate · S presenter view · ESC overview',
      font: 'Type', typographyTheme: 'Bilingual type theme', background: 'Background', backgroundEnvironment: 'Background environment', environmentStill: 'Environment still', pauseEnvironment: 'Pause environment',
      editSelected: 'Edit selected element', editRequest: 'Element change request', editPlaceholder: 'What should change about this element?', quickEdits: 'Quick edit prompts', polish: 'Polish', longer: 'Add detail', shorter: 'Make concise', verify: 'Verify', cancel: 'Cancel', confirm: 'Confirm', cancelEdit: 'Cancel edit', queueEdit: 'Add to edit queue',
      pageCanvasControls: 'Slide and canvas controls', pageWorkspace: 'Slide workspace', resizeDrawer: 'Resize bottom panel', pageLayout: 'Slide layout', masterAndContent: 'Master and slide content', currentLayout: 'Current slide layout', optionalPositions: 'Optional content positions', reapplyLayout: 'Reapply layout',
      speakerNotes: 'Speaker notes', notesPlaceholder: 'Enter cues shown only in presenter view…', currentNotes: 'Speaker notes for the current slide', waitingDeck: 'Waiting for deck file',
      agentQueue: 'Agent edit queue', nothingSelected: 'No element selected', queueEmpty: 'Enable Inspect and select a canvas element to record changes for the Agent.', clear: 'Clear', copyToAgent: 'Copy for Agent',
      canvasControls: 'Canvas view controls', zoom: 'Canvas zoom', fullscreen: 'View canvas fullscreen', deckUpdated: 'The Agent updated this deck', reloadReturns: 'Reload and return to the current slide', reload: 'Reload',
      connected: 'Connected to deck file', disconnected: 'Workspace disconnected; changes cannot be written', persisted: 'Saved to deck file', memoryOnly: 'Development preview: changes are only in memory',
      environmentMoving: 'Environment moving', reducedMotion: 'Reduced motion is enabled; the background remains still', reloadCancelled: 'Reload cancelled', updateUnknown: 'Could not check for deck updates; verify the workspace connection',
      createGroup: '+ Group', overview: 'Overview ↗', rename: 'Rename', ungroup: 'Ungroup', insertHere: 'Insert here', jumpToSlide: 'Jump to slide', groupName: 'Group name', renameGroup: 'Rename group', savingOrder: 'Saving order…', selectSlide: (label: string, number: number, total: number) => `Select ${label}; slide ${number} of ${total}`,
      notesSaved: 'Autosaved', notesSaving: 'Autosaving…', notesLoaded: 'Loaded from deck file', mediaPreview: 'Enlarged media preview', mediaControls: 'Media zoom controls', zoomMediaOut: 'Zoom media out', zoomMediaIn: 'Zoom media in', resetMediaZoom: 'Reset media zoom', reset: 'Reset', closeMediaPreview: 'Close media preview',
      connectedShort: 'Connected', waitingConnection: 'Waiting to connect', popupBlocked: 'Blocked · retry separately', audiencePopupBlocked: 'The browser blocked the audience view; allow pop-ups and retry', openingPresenter: 'Opening presenter view; allow pop-ups and retry if it does not appear', preflightFailed: 'Preflight failed', ended: 'Ended', dotPitch: 'Dot pitch', playEnvironment: 'Play environment', fullscreenRejected: 'The browser declined fullscreen; the current view was preserved',
      layoutSwitchFailed: 'Cannot switch', noTargetPosition: 'has no target position', layoutSwitched: 'Switched to', contentPreserved: 'content and slide objects were preserved', shown: 'Shown', hidden: 'Hidden', contentStillPreserved: 'content remains preserved', layoutReapplied: 'Layout reapplied; slide content and free objects were preserved', hasContent: 'Has content', emptyHidden: 'Empty and hidden', optionalPositionCount: (count: number) => `${count} optional position${count === 1 ? '' : 's'}`,
      inspectEnabled: 'Inspect enabled · select an element on the canvas', editTarget: (label: string) => `Edit ${label}`, update: 'Update', updateQueue: 'Update edit queue', addQueue: 'Add to edit queue', inspectSummary: (count: number, ids: string[]) => `${count} slide${count === 1 ? '' : 's'}${count ? ` · ${ids.join(', ')}` : ''}`, canCopy: 'Ready to copy for Agent', fillRequest: 'Enter a change request', queueCleared: 'Edit queue cleared', copiedEdits: (count: number) => `Copied ${count} edit request${count === 1 ? '' : 's'}. Paste in Codex; reload notice will appear after the Agent finishes`, emptyEdits: 'Enter at least one change request first', clipboardFailed: 'Copy failed; check browser clipboard permissions', editQueueLabel: (summary: string) => `Edit queue: ${summary}`, removeEdit: (label: string) => `Remove ${label}`, remove: 'Remove', nonTextElement: 'Non-text element', agentInstructionPlaceholder: 'Tell the Agent how this element should change…', agentInstructionLabel: (label: string) => `Change request for ${label}`, inspectPolish: 'Polish this element for clarity and natural phrasing while preserving its tone.', inspectLonger: 'Add useful detail to this element without changing its core meaning.', inspectShorter: 'Make this element more concise while preserving its core meaning and tone.', inspectVerify: 'Verify the facts, numbers, and wording in this element and correct any inaccuracies.',
    },
    library: {
      intro: 'Choose a deck to open in Studio. Open other workspaces through the CLI.', yourDecks: 'Your decks', examples: 'Built-in examples', empty: 'This workspace has no decks yet. Preview the system demo or create a deck with the CLI.', demoDescription: 'Explore Cadenza layouts, components, visual environments, and motion language.', previewDemo: 'Preview demo', openStudio: 'Open in Studio',
    },
    overview: { hasNotes: 'Includes speaker notes', noNotes: 'No speaker notes', preview: 'Open preview', copyId: 'Copy ID', copied: 'Copied', search: 'Search', searchLabel: 'Search slide title or ID', searchPlaceholder: 'Title or slide ID', group: 'Group', groupLabel: 'Filter by group', allGroups: 'All groups', region: 'Slide overview', separator: ': ', outlineCheckpoint: 'OUTLINE CHECKPOINT', completeDeck: 'COMPLETE DECK', outlineSlides: 'OUTLINE SLIDES', slides: 'SLIDES', closePreview: 'Close enlarged preview' },
    gallery: { title: 'Layouts and component reference', intro: 'Browse system capabilities without writing visual choices into the deck.', close: 'Close', search: 'Search', searchLabel: 'Search Design Library', openPreview: (label: string) => `Open preview: ${label}`, copyComposition: 'Copy composition tree', copiedComposition: 'Composition tree copied', copyFailed: 'Copy failed', masterEyebrow: 'DECK MASTER / READ ONLY', masterTitle: 'Current deck master', masterIntro: 'Ask the Agent to change the master; updates apply consistently and every slide is reviewed again.', masterAria: 'Deck Master', masterStatus: 'Three-layer master', masterPreview: 'Open preview ↗', masterComposition: 'One slide showing fixed elements, filled placeholders, and free objects together' },
  },
} as const

export function normalizeUiLocale(value?: string | null): UiLocale | undefined {
  if (!value) return undefined
  const locale = value.toLowerCase()
  if (locale === 'en' || locale.startsWith('en-')) return 'en'
  if (locale === 'zh' || locale.startsWith('zh-')) return 'zh-CN'
  return undefined
}

export function resolveUiLocale(url: Pick<URL, 'search'>, browserLanguage?: string): UiLocale {
  return normalizeUiLocale(new URLSearchParams(url.search).get('lang'))
    ?? normalizeUiLocale(browserLanguage)
    ?? 'zh-CN'
}

export function uiText(locale: UiLocale = 'zh-CN') { return copy[locale] }

export function localizeHref(href: string, locale: UiLocale): string {
  const absolute = /^[a-z]+:/i.test(href)
  const url = new URL(href, 'https://cadenza.local/')
  url.searchParams.set('lang', locale)
  if (absolute) return url.href
  return `${url.pathname === '/' && href.startsWith('?') ? '' : url.pathname}${url.search}${url.hash}`
}

export function renderUiLocaleSwitcher(locale: UiLocale, currentHref: string) {
  const text = uiText(locale).locale
  return `<span class="ui-locale-switcher" data-ui-locale-switcher role="group" aria-label="${text.label}"><a href="${escapeHtml(localizeHref(currentHref, 'zh-CN'))}" lang="zh-CN"${locale === 'zh-CN' ? ' aria-current="true"' : ''}>${text.chinese}</a><a href="${escapeHtml(localizeHref(currentHref, 'en'))}" lang="en"${locale === 'en' ? ' aria-current="true"' : ''}>${text.english}</a></span>`
}

function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;') }
