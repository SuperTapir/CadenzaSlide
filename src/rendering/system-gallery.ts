import { coreLayoutIds, createDefaultDeckMaster, type CoreLayoutId, type DeckMaster } from '../core/deck-master'
import { renderDesignLibraryFixture } from './design-library-fixtures'
import { renderDesignLibraryPreview } from './design-library-preview'
import { environmentPresetIds, environmentPresets } from '../engine/environment-presets'
import { fontThemeIds, fontThemes } from '../typography/themes'
import { motionPresetIds, motionPresets } from '../motion/presets'
import { elementMotionIds, elementMotions } from '../motion/element-presets'
import { productionComponentManifest, productionComponentQualificationFixtures, type CompositionNode, type ProductionComponentCategory, type ProductionComponentManifestEntry } from '../authoring/component-library'
import { renderComposition, renderVisualAssetPreview } from './component-renderer'
import { componentEvaluationCorpus, type ComposerEvaluationCorpusCase } from '../authoring/component-evaluation-corpus'
import { composeSlideCandidates, describeCompositionRhythm, type SlideCompositionCandidate } from '../authoring/slide-composer'
import { numberedSeriesScenarioCatalog } from '../authoring/numbered-series-scenarios'
import { productionVisualAssets, visualAssetCatalog, type VisualAssetDefinition, type VisualBehavior } from '../visual-assets/catalog.ts'
import { motionReadyVisualById, motionReadyVisuals } from '../visual-assets/motion'

export interface CatalogEntry { id: string, label: string, description: string, previewLayout?: CoreLayoutId }
export interface ComponentCatalogEntry extends CatalogEntry { category: ProductionComponentCategory, definition: ProductionComponentManifestEntry }
export interface CompositionCatalogEntry extends CatalogEntry {
  narrative: string
  tree: SlideCompositionCandidate['tree']
  fingerprint: string
  signalIds: string[]
}

const layoutMetadata: Record<CoreLayoutId, Pick<CatalogEntry, 'label' | 'description'>> = {
  title: { label: 'Title / Cover', description: '封面、开场与核心命题。' },
  'title-photo': { label: 'Title & Photo', description: '海报式标题叠加主视觉。' },
  'title-photo-alt': { label: 'Title & Photo Alt', description: '标题与纵向或横向图片分栏。' },
  'title-bullets': { label: 'Title & Bullets', description: '低强度标题与有序短列表。' },
  'title-bullets-photo': { label: 'Title, Bullets & Photo', description: '短列表与证据图片同屏。' },
  section: { label: 'Section', description: '章节切换与叙事分段。' },
  'title-only': { label: 'Title Only', description: '普通内容之间的低强度过渡。' },
  agenda: { label: 'Agenda', description: '目录、进度与章节预告。' },
  statement: { label: 'Statement', description: '突出一个判断及少量语境。' },
  'big-fact': { label: 'Big Fact', description: '大数字与简短解释。' },
  quote: { label: 'Quote', description: '外部原话、作者与可追溯出处。' },
  gallery: { label: 'Gallery', description: '一至四张图片的智能拼贴。' },
  photo: { label: 'Photo', description: '让单张图片成为页面主体。' },
  blank: { label: 'Blank', description: '由现有组件组合的自由画布。' },
}

export const layoutCatalog: CatalogEntry[] = coreLayoutIds.map(id => ({ id, ...layoutMetadata[id], previewLayout: id }))

export const componentCatalog: ComponentCatalogEntry[] = productionComponentManifest.map(definition => ({
  id: definition.id,
  label: definition.label,
  description: definition.purpose.join(' · '),
  category: definition.category,
  definition,
}))

const card = (nodeId: string, meta: string, title: string, body?: string): CompositionNode => ({
  nodeId, component: 'card', version: 1, props: { meta, title, ...(body ? { body } : {}) },
})
const media = (nodeId: string, caption: string): CompositionNode => ({
  nodeId, component: 'media', version: 1, props: { src: '/hello-apple.svg', alt: caption, caption }, axes: { span: 'cover' },
})

export const componentPreviewFixtures: Readonly<Record<string, CompositionNode>> = Object.freeze({
  stack: {
    nodeId: 'preview-stack', component: 'stack', version: 1, axes: { gap: 'compact' }, children: [
      card('preview-stack-1', 'STEP', '01 结论'),
      card('preview-stack-2', 'STEP', '02 证据'),
      card('preview-stack-3', 'STEP', '03 行动'),
    ],
  },
  cluster: {
    nodeId: 'preview-cluster', component: 'cluster', version: 1, axes: { distribution: 'between', gap: 'compact' }, children: [
      card('preview-cluster-1', '同级项', '产品'),
      card('preview-cluster-2', '同级项', '服务'),
      card('preview-cluster-3', '同级项', '渠道'),
    ],
  },
  grid: {
    nodeId: 'preview-grid', component: 'grid', version: 1, axes: { columns: '2', gap: 'compact' }, children: [
      card('preview-grid-1', '01', '市场'), card('preview-grid-2', '02', '产品'),
      card('preview-grid-3', '03', '团队'), card('preview-grid-4', '04', '增长'),
    ],
  },
  split: {
    nodeId: 'preview-split', component: 'split', version: 1, axes: { ratio: '2:1', gap: 'compact' }, slots: {
      primary: [media('preview-split-primary', '主区域')],
      secondary: [card('preview-split-secondary', '1 / 3', '辅助区域', '用较小区域补充解释。')],
    },
  },
  inset: {
    nodeId: 'preview-inset', component: 'inset', version: 1, axes: { position: 'bottom-right', span: 'medium' }, slots: {
      base: [media('preview-inset-base', '背景主图')],
      inset: [card('preview-inset-note', 'INSET', '局部注释', '嵌在主内容里的补充证据。')],
    },
  },
  overlay: {
    nodeId: 'preview-overlay', component: 'overlay', version: 1, axes: { position: 'bottom' }, slots: {
      base: [media('preview-overlay-base', '背景图片')],
      overlay: [{ nodeId: 'preview-overlay-title', component: 'heading', version: 1, props: { eyebrow: 'OVERLAY', text: '图片上的标题' }, axes: { span: 'section' } }],
    },
  },
  media: {
    nodeId: 'preview-media', component: 'media', version: 1,
    props: { src: '/cadenza-hero-one-bit-source.png', alt: 'Cadenza 视觉素材', caption: '稳定的 Gallery 预览素材' },
    axes: { span: 'contain', kind: 'illustration', treatment: 'one-bit' },
  },
  code: {
    nodeId: 'preview-code', component: 'code', version: 1,
    props: { language: 'bash', code: '$ cadenza verify deck\n$ cadenza smoke deck --browser' },
  },
})

const compositionMetadata: Record<ComposerEvaluationCorpusCase['narrative'], Pick<CatalogEntry, 'label' | 'description'>> = {
  'business-summary': { label: '经营摘要组合', description: '主张、指标与证据重新分配于合法 layout。' },
  'feature-explanation': { label: '功能说明组合', description: '媒体与功能证据共享一条清晰阅读路径。' },
  comparison: { label: '方案对比组合', description: '只根据已提供的差异与关系组织对比。' },
  steps: { label: '步骤组合', description: '保留输入顺序，并允许沿 stack 轴改变节奏。' },
  timeline: { label: '时间叙事组合', description: '阶段、媒体与来源由原子内容构件共同表达。' },
  people: { label: '人物组合', description: '人物资料在 grid、cluster 或 stack 间受控重排。' },
  'system-relationship': { label: '系统关系组合', description: 'connector 只连接输入中真实存在的节点。' },
  quote: { label: '引语组合', description: '引语、署名和上下文保持绑定。' },
  'media-narrative': { label: '媒体叙事组合', description: '主张、视觉证据与说明形成完整页面。' },
}

const composerCompositionCatalog: CompositionCatalogEntry[] = componentEvaluationCorpus.map((item, index) => {
  const result = composeSlideCandidates(item.signals, {
    profile: 'stage', frame: { width: 84, height: 58 }, format: 'html', seed: index,
  })
  const candidate = result.candidates[0]
  if (!candidate) throw new Error(`No production composition candidate for ${item.id}`)
  return {
    id: item.id,
    ...compositionMetadata[item.narrative],
    narrative: item.narrative,
    tree: candidate.tree,
    fingerprint: candidate.fingerprint,
    signalIds: candidate.usedSignalIds,
  }
})

export const compositionCatalog: CompositionCatalogEntry[] = [
  ...composerCompositionCatalog,
  ...numberedSeriesScenarioCatalog.map(entry => {
    const fixture = entry.fixtures[0]
    return {
      id: entry.id,
      label: entry.label,
      description: entry.description,
      narrative: 'numbered-series',
      tree: fixture.tree,
      fingerprint: describeCompositionRhythm(fixture.tree).fingerprint,
      signalIds: [fixture.id],
    }
  }),
]

export function renderSystemGallery() {
  const master = createDefaultDeckMaster()
  const layouts = layoutCatalog.map((entry, index) => renderLayoutCard(entry, index, master)).join('')
  const typographies = fontThemeIds.map(id => `<article class="gallery-card" data-gallery-typography="${id}"><div class="gallery-typography-preview" data-font-theme="${id}"><span>中英文 TYPOGRAPHY</span><strong>${fontThemes[id].sample}</strong><p>清晰的正文支持中文叙述与 English context。</p></div><div class="gallery-card-copy"><strong>${fontThemes[id].label}</strong><span>${fontThemes[id].description}</span></div></article>`).join('')
  const backgrounds = environmentPresetIds.map(id => `<article class="gallery-card" data-gallery-background="${id}"><div class="gallery-live-preview gallery-environment-only"><canvas data-gallery-environment-preview="${id}" width="320" height="180"></canvas></div><div class="gallery-card-copy"><strong>${environmentPresets[id].label}</strong><span>${environmentPresets[id].description}</span></div></article>`).join('')
  const slideTransitions = motionPresetIds.map(id => `<article class="gallery-card" data-gallery-slide-transition="${id}"><div class="gallery-live-preview gallery-slide-transition-preview" data-motion-preview="${id}"><span class="motion-preview-outgoing">A</span><span class="motion-preview-incoming">B</span></div><div class="gallery-card-copy"><strong>${motionPresets[id].label}</strong><span>${motionPresets[id].description}</span></div></article>`).join('')
  const elementTransitions = elementMotionIds.map(id => `<article class="gallery-card" data-gallery-element-transition="${id}"><div class="gallery-live-preview gallery-element-transition-preview" data-element-motion-preview="${id}"><strong>元素</strong></div><div class="gallery-card-copy"><strong>${elementMotions[id].label}</strong><span>${elementMotions[id].description}</span></div></article>`).join('')
  const components = Object.fromEntries((['layout', 'content', 'relationship'] as const).map(category => [category, componentCatalog.filter(entry => entry.category === category).map(renderComponentCard).join('')])) as Record<ProductionComponentCategory, string>
  const compositions = compositionCatalog.map(renderCompositionCard).join('')
  const visuals = visualAssetCatalog.map(renderVisualCard).join('')

  return `<section class="system-gallery" id="system-gallery" data-testid="system-gallery" aria-label="Cadenza Design Library" hidden>
    <header class="gallery-header"><div><p>DESIGN LIBRARY / READ ONLY</p><h2>版式与组件参考</h2></div><p>这里用于查看能力，不会把视觉选择写入 deck。</p><button type="button" data-gallery-close>关闭</button></header>
    <label class="gallery-search">搜索<input type="search" data-gallery-search aria-label="搜索 Gallery"></label>
    <details class="gallery-section" data-gallery-section="visuals"><summary>Visual assets / ${visualAssetCatalog.length}</summary><div class="visual-gallery-tools"><label>Status<select data-visual-status-filter><option value="">All</option><option value="production">Production</option></select></label><label>Kind<select data-visual-kind-filter><option value="">All</option><option value="icon">Icon</option><option value="logo">Logo</option></select></label><label>Quality<select data-visual-quality-filter><option value="hero" selected>Hero 12</option><option value="animated">Animated 48</option><option value="">All</option></select></label><label>Motion<select data-visual-motion-filter><option value="">All</option><option value="animated">Animated</option><option value="static">Static</option></select></label><label>Mode<select data-visual-motion-mode-filter><option value="">All</option><option value="enter">Enter</option><option value="loop">Loop</option></select></label><span>${productionVisualAssets.filter(asset => asset.kind === 'icon').length} production icons · 12 hero · ${motionReadyVisuals.length} animated</span></div><div class="gallery-grid-list gallery-visuals" data-visual-gallery-host></div><template data-visual-gallery-template>${visuals}</template></details>
    <details class="gallery-section" data-gallery-section="templates" open><summary>Layouts / 14</summary><div class="gallery-grid-list">${layouts}</div></details>
    ${renderComponentSection('layout', 'Layout primitives', components.layout)}
    ${renderComponentSection('content', 'Content primitives', components.content)}
    ${renderComponentSection('relationship', 'Relationship primitives', components.relationship)}
    <details class="gallery-section" data-gallery-section="components-compositions"><summary>Composition examples / ${compositionCatalog.length}</summary><div class="gallery-grid-list">${compositions}</div></details>
    <details class="gallery-section" data-gallery-section="typography"><summary>Typography / ${fontThemeIds.length}</summary><div class="gallery-grid-list gallery-typographies">${typographies}</div></details>
    <details class="gallery-section" data-gallery-section="backgrounds"><summary>Backgrounds / ${environmentPresetIds.length}</summary><div class="gallery-grid-list gallery-backgrounds">${backgrounds}</div></details>
    <details class="gallery-section" data-gallery-section="motion"><summary>Motion / ${motionPresetIds.length + elementMotionIds.length}</summary><div class="gallery-grid-list">${slideTransitions}${elementTransitions}</div></details>
    ${renderDesignLibraryPreview()}
  </section>`
}

function renderVisualCard(asset: VisualAssetDefinition) {
  const behavior: VisualBehavior = motionReadyVisualById[asset.id]?.verb ?? 'none'
  const motionMode = motionReadyVisualById[asset.id]?.mode ?? 'none'
  const state = asset.poster.state
  const treatment = asset.treatments.includes('outline') ? 'outline' : 'solid'
  const tree: CompositionNode = {
    nodeId: `gallery-${asset.id.replace(':', '-')}`, component: 'visual', version: 1,
    props: { asset: asset.id, alt: asset.label },
    axes: { role: asset.kind, prominence: 'support', treatment, state, behavior },
  }
  const quality = asset.qualityTier ?? (behavior === 'none' ? 'core' : 'production')
  const rendered = asset.status === 'production' ? renderComposition(tree) : renderVisualAssetPreview(asset, tree)
  const search = [asset.id, asset.label, ...asset.purposes, ...asset.aliases, asset.family ?? '', asset.status, asset.kind].join(' ')
  return `<article class="gallery-card gallery-visual-card" data-gallery-visual="${escapeHtml(asset.id)}" data-visual-kind="${asset.kind}" data-visual-status="${asset.status}" data-visual-quality="${quality}" data-visual-motion="${behavior}" data-visual-motion-mode="${motionMode}" data-visual-search="${escapeHtml(search)}"><button class="gallery-preview-button" type="button" data-design-library-preview="visual:${escapeHtml(asset.id)}" data-design-library-preview-label="${escapeHtml(asset.label)}" data-design-library-preview-description="${escapeHtml(`${asset.status} · ${asset.purposes.join(' · ')} · ${asset.provenance.origin} ${asset.provenance.version} · ${asset.provenance.license}`)}" aria-label="放大预览 ${escapeHtml(asset.label)}"><div class="gallery-live-preview visual-gallery-preview">${rendered}</div></button><div class="gallery-card-copy"><strong>${escapeHtml(asset.label)}</strong><span>${escapeHtml(asset.id)} · ${asset.status} · ${quality}${motionMode === 'none' ? '' : ` · ${motionMode}`}</span></div></article>`
}

function renderCompositionCard(entry: CompositionCatalogEntry) {
  const slide = `<section data-slide-id="gallery-composition-${entry.id}" data-layout="blank" data-slide-role="content" data-cadenza-scene="white" data-environment-mode="static" aria-label="${escapeHtml(entry.label)}"><div class="slide-chrome template-blank cadenza-gallery-canvas">${renderComposition(entry.tree)}</div></section>`
  const preview = previewHost(`composition-${entry.id}`, slide)
  const composition = escapeHtml(JSON.stringify(entry.tree, null, 2))
  return `<article class="gallery-card gallery-component-card gallery-composition-card" data-gallery-composition="${entry.id}" data-composition-narrative="${entry.narrative}"><button class="gallery-preview-button" type="button" data-design-library-preview="composition:${entry.id}" data-design-library-preview-label="${escapeHtml(entry.label)}" data-design-library-preview-description="${escapeHtml(entry.description)}" aria-label="放大预览 ${escapeHtml(entry.label)}">${preview}</button><div class="gallery-card-copy"><strong>${escapeHtml(entry.label)}</strong><span>${escapeHtml(entry.description)}</span></div><details class="gallery-component-contract"><summary>Composition</summary><dl><div><dt>Signals</dt><dd>${entry.signalIds.length}</dd></div><div><dt>Root</dt><dd>${escapeHtml(entry.tree.component)}</dd></div><div><dt>Fingerprint</dt><dd>${escapeHtml(entry.fingerprint)}</dd></div></dl></details><template data-component-composition-json>${composition}</template><button class="gallery-copy-composition" type="button" data-copy-composition>复制 composition tree</button></article>`
}

function renderComponentSection(category: ProductionComponentCategory, label: string, cards: string) {
  const count = componentCatalog.filter(entry => entry.category === category).length
  return `<details class="gallery-section" data-gallery-section="components-${category}"><summary>${label} / ${count}</summary><div class="gallery-grid-list">${cards}</div></details>`
}

function renderComponentCard(entry: ComponentCatalogEntry) {
  const fixture = componentPreviewFixtures[entry.id] ?? productionComponentQualificationFixtures[entry.id].compositions[0].tree
  const slide = `<section data-slide-id="gallery-component-${entry.id}" data-layout="blank" data-slide-role="content" data-cadenza-scene="white" data-environment-mode="static" aria-label="${escapeHtml(entry.label)}"><div class="slide-chrome template-blank cadenza-gallery-canvas">${renderComposition(fixture)}</div></section>`
  const preview = previewHost(`component-${entry.id}`, slide)
  return `<article class="gallery-card gallery-component-card" data-gallery-component="${entry.id}" data-component-category="${entry.category}"><button class="gallery-preview-button" type="button" data-design-library-preview="component:${entry.id}" data-design-library-preview-label="${escapeHtml(entry.label)}" data-design-library-preview-description="${escapeHtml(entry.description)}" aria-label="放大预览 ${escapeHtml(entry.label)}">${preview}</button><div class="gallery-card-copy"><strong>${escapeHtml(entry.label)}</strong><span>${escapeHtml(entry.description)}</span></div>${renderComponentContract(entry)}</article>`
}

function renderComponentContract(entry: ComponentCatalogEntry) {
  const keys = (values: Record<string, unknown>) => Object.keys(values).join(', ') || '—'
  return `<details class="gallery-component-contract" data-component-contract="${entry.id}"><summary>Contract</summary><dl><div><dt>Props</dt><dd>${escapeHtml(keys(entry.definition.props))}</dd></div><div><dt>Slots</dt><dd>${escapeHtml(keys(entry.definition.slots))}</dd></div><div><dt>Axes</dt><dd>${escapeHtml(keys(entry.definition.axes))}</dd></div></dl></details>`
}

function renderLayoutCard(entry: CatalogEntry, index: number, master: Readonly<DeckMaster>) {
  const layout = entry.id as CoreLayoutId
  const copy = `<div class="gallery-card-copy"><span class="gallery-card-index">${String(index + 1).padStart(2, '0')}</span><strong>${entry.label}</strong><span>${entry.description}</span></div><footer class="gallery-card-status"><span>三层母板</span><span>放大预览 ↗</span></footer>`
  return `<article class="gallery-card gallery-layout-card gallery-startup-card" data-gallery-layout="${layout}"><div class="gallery-startup-preview"><button class="gallery-preview-button" type="button" data-design-library-preview="layout:${layout}:composed" data-design-library-preview-label="${entry.label}" data-design-library-preview-description="同一页面同时展示固定元素、已填占位符与自由对象" data-gallery-preview-variant="composed" aria-label="放大预览 ${entry.label}">${previewHost(layout, renderDesignLibraryFixture(layout, master))}</button></div>${copy}</article>`
}

function previewHost(id: string, content: string) {
  return `<div class="gallery-live-preview" data-gallery-slide-preview="${id}"><div class="gallery-preview-content"></div><template data-gallery-preview-template>${content}</template></div>`
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!) }
