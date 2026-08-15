import { DeckDocumentError, parseDeckDocument, type DeckDocument } from '../core/deck-document.ts'
import { renderDeckSlides } from '../rendering/core-templates.ts'
import { isCompositionSlideObject, mergeSlotStyle, type Frame } from '../core/deck-master.ts'
import { compositionBudgetProfiles, diagnoseComposition } from '../authoring/component-diagnosis.ts'
import { estimateCompositionCoverage } from '../authoring/composition-coverage.ts'
import { productionVisualAssets, validateSvgGeometry, visualAssetById, visualGeometryById, type VisualAssetDefinition } from '../visual-assets/catalog.ts'
import { motionReadyVisuals, qualifyVisualMotionCatalog, type MotionReadyVisual } from '../visual-assets/motion.ts'
import type { CompositionNode } from '../authoring/component-library.ts'

export interface VerificationFinding {
  ruleId: string
  severity: 'error' | 'warning'
  path: string
  message: string
}

export interface VerificationReport {
  ok: boolean
  checkedSlides: number
  findings: VerificationFinding[]
}

export function verifyDeckValue(value: unknown): VerificationReport {
  let deck: DeckDocument
  try { deck = parseDeckDocument(value) } catch (error) {
    if (error instanceof DeckDocumentError) return { ok: false, checkedSlides: 0, findings: error.issues.map(issue => ({ ruleId: `schema.${issue.code}`, severity: 'error', path: issue.path, message: issue.message })) }
    return { ok: false, checkedSlides: 0, findings: [{ ruleId: 'schema.failure', severity: 'error', path: '$', message: error instanceof Error ? error.message : String(error) }] }
  }
  const findings: VerificationFinding[] = []
  const visualUsages: VisualUsage[] = []
  const mediaUsageSlides = new Map<string, string[]>()
  const sourceExcerptSlides = new Map<string, string[]>()
  const compositionSilhouetteSlides = new Map<string, string[]>()
  findings.push(...visualMotionCatalogFindings())
  if (deck.status === 'outline') findings.push({ ruleId: 'deck.status.outline', severity: 'warning', path: '$.status', message: 'Deck 仍处于 outline checkpoint，尚未填充完整内容' })
  if (deck.status === 'complete' && Object.values(deck.master.layouts).every(layout => layout.environmentMode === 'static')) findings.push({
    ruleId: 'motion.environment-all-static', severity: 'warning', path: '$.master.layouts',
    message: '完整 Cadenza deck 不应让全部环境静止；请用 loop 建立低幅背景运动与章节能量节奏，reduced-motion 由运行时自动降级',
  })
  findings.push(...masterVisualBalanceFindings(deck.master))
  for (const [slideId, slide] of Object.entries(deck.slides)) {
    if (slide.layout === 'section' && (!Array.isArray(slide.title) || !slide.title.some(line => line.trim()))) findings.push({
      ruleId: 'layout.section-title', severity: 'error', path: `$.slides.${slideId}.title`,
      message: 'Section 的章节主张必须写入 title；subtitle 只能承担补充语境，不能代替主标题',
    })
    if (slide.notes?.includes('## 证据来源') && !/^## 原文摘录\s*$[\s\S]*^>\s+\S/m.test(slide.notes)) findings.push({
      ruleId: 'notes.source-excerpt', severity: 'warning', path: `$.slides.${slideId}.notes`,
      message: '有来源证据的页面应在 Speaker Notes 中提供“## 原文摘录”和可直接讲出的 Markdown 引言',
    })
    const excerpt = /^## 原文摘录\s*$\r?\n(?:[ \t]*\r?\n)*>\s+(.+)$/m.exec(slide.notes ?? '')?.[1]?.replace(/\s+/g, ' ').trim()
    if (excerpt) sourceExcerptSlides.set(excerpt, [...(sourceExcerptSlides.get(excerpt) ?? []), slideId])
    for (const [path, source] of mediaSources(slide)) {
      if (typeof source !== 'string' || !source.trim()) findings.push({ ruleId: 'media.reference', severity: 'error', path: `$.slides.${slideId}.${path}`, message: '媒体引用必须是非空字符串' })
      else {
        mediaUsageSlides.set(source, [...new Set([...(mediaUsageSlides.get(source) ?? []), slideId])])
        if (/^https?:\/\/.*\.(?:png|jpe?g|gif|webp)(?:[?#].*)?$/i.test(source)) findings.push({
          ruleId: 'media.remote-one-bit-risk', severity: 'warning', path: `$.slides.${slideId}.${path}`,
          message: '远程栅格图无法可靠进入 One Bit canvas 管线；请本地化媒体并保留来源记录，避免跨域失败后只剩灰度滤镜',
        })
      }
    }
    for (const [path, media] of semanticMedia(slide)) {
      const kind = media.kind ?? media.mediaKind
      if (kind === 'screenshot' && media.fit === 'cover') findings.push({
        ruleId: 'media.screenshot-cover', severity: 'error', path: `$.slides.${slideId}.${path}.fit`,
        message: '信息密集截图必须完整可读，不能使用 cover 裁切；请改为 contain 或换用低信息量环境图',
      })
      if (kind === 'screenshot' && media.treatment === 'one-bit') findings.push({
        ruleId: 'media.screenshot-one-bit', severity: 'error', path: `$.slides.${slideId}.${path}.treatment`,
        message: '信息密集截图不能强制 One Bit；请使用 tonal 保留细节并统一色调，颜色本身承载信息时才使用 original',
      })
    }
    if (slide.layout === 'custom:numbered-series' && 'objects' in slide && Array.isArray(slide.objects)) slide.objects.forEach((object, index) => {
      if ('frame' in object && (object.frame.y < 31 || object.frame.y + object.frame.height > 88)) findings.push({
        ruleId: 'layout.numbered-series-safe-area', severity: 'error', path: `$.slides.${slideId}.objects[${index}].frame`,
        message: '连续编号模板的可变内容必须位于 y=31–88 的内容安全区，不能侵入固定页头或底部序列导航',
      })
    })
    if (slide.layout === 'title-photo' && 'image' in slide && slide.image?.caption?.trim()) findings.push({
      ruleId: 'layout.title-photo-caption', severity: 'error', path: `$.slides.${slideId}.image.caption`,
      message: 'title-photo 的图片属于整页视觉环境，不允许图注；请移除 caption 或改用 title-photo-alt / 图文布局',
    })
    findings.push(...terminalPeriodFindings(slide, slideId))
    findings.push(...forbiddenRhetoricalFrameFindings(slide, slideId))
    const compositions = 'objects' in slide && Array.isArray(slide.objects) ? slide.objects.filter(isCompositionSlideObject) : []
    if ('objects' in slide && Array.isArray(slide.objects)) slide.objects.forEach((object, index) => {
      if (!isCompositionSlideObject(object) && object.kind === 'code' && !object.caption?.trim()) findings.push({
        ruleId: 'code.explanation', severity: 'warning', path: `$.slides.${slideId}.objects[${index}]`,
        message: '代码必须解释它执行什么、作用于什么，以及输出含义或通过标准；命令和输出还应由源码、文档或真实运行佐证',
      })
    })
    let pageDensity = 0
    let pageCost = 0
    for (const composition of compositions) {
      walkComposition(composition.tree, node => {
        if (node.component === 'code' && (typeof node.props?.caption !== 'string' || !node.props.caption.trim())) findings.push({
          ruleId: 'code.explanation', severity: 'warning', path: `$.slides.${slideId}.composition:${composition.compositionId}.${node.nodeId}`,
          message: '代码必须解释它执行什么、作用于什么，以及输出含义或通过标准；命令和输出还应由源码、文档或真实运行佐证',
        })
      })
      visualUsages.push(...collectVisualUsages(composition.tree, slideId))
      findings.push(...mediaOverlayFindings(composition.tree, slideId, composition.compositionId))
      if (slide.role === 'content') {
        const silhouette = compositionSilhouette(composition.tree)
        compositionSilhouetteSlides.set(silhouette, [...new Set([...(compositionSilhouetteSlides.get(silhouette) ?? []), slideId])])
        if (isTextListOnlyComposition(composition.tree)) findings.push({
          ruleId: 'composition.text-list-only', severity: 'warning', path: `$.slides.${slideId}`,
          message: 'Blank composition 仍然只有标题和列表；请把真实顺序、对照、状态、证据或关系变成可见结构，避免用自定义外壳重复 Title + List',
        })
      }
      const diagnosis = diagnoseComposition(composition.tree, { profile: 'stage', frame: { width: composition.frame.width, height: composition.frame.height } })
      pageDensity += diagnosis.density
      pageCost += diagnosis.cost
      if (diagnosis.status !== 'fit') findings.push({
        ruleId: `composition.intrinsic.${diagnosis.status}`,
        severity: diagnosis.status === 'compress' ? 'warning' : 'error',
        path: `$.slides.${slideId}.composition:${composition.compositionId}`,
        message: diagnosis.reasons.join('；'),
      })
    }
    if (pageDensity > compositionBudgetProfiles.stage.hardDensity || pageCost > compositionBudgetProfiles.stage.hardCost) findings.push({
      ruleId: 'component.page-budget', severity: 'error', path: `$.slides.${slideId}.objects`,
      message: `页面 composition 超过 stage 硬预算（density ${pageDensity}/${compositionBudgetProfiles.stage.hardDensity}，cost ${pageCost}/${compositionBudgetProfiles.stage.hardCost}）`,
    })
    const coverage = estimateContentCoverage(slide, deck.master)
    if (coverage !== undefined && coverage < 35) findings.push({
      ruleId: 'layout.content-coverage', severity: 'warning', path: `$.slides.${slideId}`,
      message: `有效内容覆盖率约 ${Math.round(coverage)}%，建议放大或重组内容，避免无意义的整块空白（Cover 与 Section 除外）`,
    })
  }
  for (const [source, slideIds] of mediaUsageSlides) if (slideIds.length > 1) findings.push({
    ruleId: 'media.cross-slide-reuse', severity: 'warning', path: '$.slides',
    message: `同一媒体素材被跨页复用（${slideIds.join('、')}）：${source}；除非承担明确的叙事回环，否则请改用新的证据或改变表达方式`,
  })
  for (const [excerpt, slideIds] of sourceExcerptSlides) if (slideIds.length >= 4) findings.push({
    ruleId: 'notes.source-excerpt-reuse', severity: 'warning', path: '$.slides',
    message: `同一句原文摘录被复用在 ${slideIds.length} 页（${slideIds.join('、')}）；请改成与每页主张直接相关的原文，避免章节级占位注释：“${excerpt}”`,
  })
  for (const slideIds of compositionSilhouetteSlides.values()) if (slideIds.length >= 3) findings.push({
    ruleId: 'composition.silhouette-repetition', severity: 'warning', path: '$.slides',
    message: `同一种 composition 轮廓跨 ${slideIds.length} 页重复（${slideIds.join('、')}）；请在全套接触表中检查是否只有文字变化，并改用更贴合内容关系的主构图`,
  })
  const contentSlides = Object.values(deck.slides).filter(slide => slide.role !== 'intro' && slide.role !== 'section' && slide.layout !== 'section')
  const simpleLists = contentSlides.filter(slide => slide.layout === 'title-bullets')
  if (contentSlides.length >= 8 && simpleLists.length / contentSlides.length > .2) findings.push({
    ruleId: 'layout.simple-list-overuse', severity: 'warning', path: '$.slides',
    message: `简单 Title + List 占 ${simpleLists.length}/${contentSlides.length} 页；请把对照、流程、证据、引言或尺度关系改用对应表达结构`,
  })
  findings.push(...visualUsageFindings(visualUsages, Object.keys(deck.slides)))
  try { renderDeckSlides(Object.values(deck.slides), deck.master) } catch (error) {
    findings.push({ ruleId: 'render.contract', severity: 'error', path: '$.slides', message: error instanceof Error ? error.message : String(error) })
  }
  return { ok: findings.every(finding => finding.severity !== 'error'), checkedSlides: Object.keys(deck.slides).length, findings }
}

function walkComposition(tree: CompositionNode, visit: (node: CompositionNode) => void) {
  visit(tree)
  tree.children?.forEach(child => walkComposition(child, visit))
  Object.values(tree.slots ?? {}).flat().forEach(child => walkComposition(child, visit))
}

function isTextListOnlyComposition(tree: CompositionNode) {
  const components = new Set<string>()
  walkComposition(tree, node => components.add(node.component))
  return components.has('heading') && components.has('list')
    && !['media', 'visual', 'card', 'metric', 'quote', 'connector', 'progress', 'profile', 'logo'].some(component => components.has(component))
}

function compositionSilhouette(tree: CompositionNode): string {
  const structuralAxes = (node: CompositionNode) => {
    const axes = node.axes ?? {}
    const keys = node.component === 'split' ? ['direction', 'ratio', 'order']
      : node.component === 'grid' ? ['columns']
        : node.component === 'stack' || node.component === 'cluster' ? ['direction', 'density', 'wrap']
          : node.component === 'overlay' || node.component === 'inset' ? ['placement'] : []
    return keys.map(key => `${key}:${String(axes[key] ?? '')}`).join(',')
  }
  const describe = (node: CompositionNode): string => {
    const children = node.children ?? Object.entries(node.slots ?? {}).flatMap(([slot, values]) => values.map(value => ({ slot, value })))
    const inner = node.children
      ? node.children.map(describe).join('|')
      : (children as { slot: string, value: CompositionNode }[]).map(({ slot, value }) => `${slot}:${describe(value)}`).join('|')
    return `${node.component}[${structuralAxes(node)}](${inner})`
  }
  return describe(tree)
}

function mediaOverlayFindings(tree: CompositionNode, slideId: string, compositionId: string): VerificationFinding[] {
  const findings: VerificationFinding[] = []
  const contains = (node: CompositionNode, component: string): boolean => node.component === component
    || Boolean(node.children?.some(child => contains(child, component)))
    || Object.values(node.slots ?? {}).flat().some(child => contains(child, component))
  const containsReadableCopy = (node: CompositionNode): boolean => ['heading', 'copy', 'quote', 'list', 'card', 'caption'].includes(node.component)
    || Boolean(node.children?.some(containsReadableCopy))
    || Object.values(node.slots ?? {}).flat().some(containsReadableCopy)
  const walk = (node: CompositionNode) => {
    if (node.component === 'overlay') {
      const base = node.slots?.base ?? []
      const overlay = node.slots?.overlay ?? []
      const evidenceMedia = base.some(child => {
        const alts: string[] = []
        const collect = (candidate: CompositionNode) => {
          if (candidate.component === 'media' && typeof candidate.props?.alt === 'string') alts.push(candidate.props.alt)
          candidate.children?.forEach(collect)
          Object.values(candidate.slots ?? {}).flat().forEach(collect)
        }
        collect(child)
        return alts.some(alt => /截图|图表|流程|作品|拼图|证据|界面|对比|曲线/.test(alt))
      })
      if (evidenceMedia && overlay.some(containsReadableCopy)) findings.push({
        ruleId: 'media.text-overlay-review', severity: 'warning',
        path: `$.slides.${slideId}.composition:${compositionId}.${node.nodeId}`,
        message: '可读文字覆盖在证据图片上；复杂截图、图表和作品图应完整展示，并把说明移到独立区域。仅低信息量环境图允许文字 overlay',
      })
    }
    node.children?.forEach(walk)
    Object.values(node.slots ?? {}).flat().forEach(walk)
  }
  walk(tree)
  return findings
}

interface VisualUsage {
  slideId: string
  nodeId: string
  assetId: string
  alt: string
  family: string
  prominence: string
  treatment: string
  state: string
  behavior: string
}

function collectVisualUsages(tree: CompositionNode, slideId: string) {
  const usages: VisualUsage[] = []
  const walk = (node: CompositionNode) => {
    if (node.component === 'visual') {
      const assetId = typeof node.props?.asset === 'string' ? node.props.asset : ''
      const asset = visualAssetById[assetId]
      usages.push({
        slideId, nodeId: node.nodeId, assetId, alt: typeof node.props?.alt === 'string' ? node.props.alt.trim() : '',
        family: asset?.family ?? '', prominence: String(node.axes?.prominence ?? 'support'), treatment: String(node.axes?.treatment ?? ''),
        state: String(node.axes?.state ?? ''), behavior: String(node.axes?.behavior ?? 'none'),
      })
    }
    node.children?.forEach(walk)
    Object.values(node.slots ?? {}).flat().forEach(walk)
  }
  walk(tree)
  return usages
}

function visualUsageFindings(usages: readonly VisualUsage[], slideOrder: readonly string[]): VerificationFinding[] {
  const findings: VerificationFinding[] = []
  for (const usage of usages) {
    const asset = visualAssetById[usage.assetId]
    const path = `$.slides.${usage.slideId}.visual:${usage.nodeId}`
    if (!asset) { findings.push({ ruleId: 'visual.registry', severity: 'error', path, message: `视觉资产 ${usage.assetId || '(empty)'} 未注册为 production` }); continue }
    if (!usage.alt) findings.push({ ruleId: 'visual.alt', severity: 'error', path, message: 'visual 必须提供可理解的 alt' })
    if (!asset.provenance.origin || !asset.provenance.sourceUrl || !asset.provenance.version || !asset.provenance.license) findings.push({ ruleId: 'visual.provenance', severity: 'error', path, message: `${asset.id} 缺少完整来源、版本或许可证` })
    const geometry = visualGeometryById[asset.id]
    if (!geometry || validateSvgGeometry(`<svg>${geometry.body}</svg>`).length) findings.push({ ruleId: 'visual.svg-safety', severity: 'error', path, message: `${asset.id} 的 SVG geometry 缺失或不安全` })
    if (!asset.treatments.includes(usage.treatment as never) || !asset.states.includes(usage.state) || !asset.behaviors.includes(usage.behavior as never)) findings.push({ ruleId: 'visual.axes', severity: 'error', path, message: `${asset.id} 不支持请求的 treatment/state/behavior` })
  }
  const bySlide = groupVisualUsages(usages, usage => usage.slideId)
  for (const [slideId, slideUsages] of bySlide) {
    const focal = slideUsages.filter(usage => usage.prominence === 'hero' || usage.prominence === 'support')
    if (focal.length > 1) findings.push({ ruleId: 'visual.focus-budget', severity: 'error', path: `$.slides.${slideId}`, message: `同页存在 ${focal.length} 个 hero/support visual，只允许一个明确主视觉焦点` })
    const loops = focal.filter(usage => usage.behavior === 'loop')
    if (loops.length > 1) findings.push({ ruleId: 'visual.animation-budget', severity: 'error', path: `$.slides.${slideId}`, message: '同页存在多个持续主动画；保留一个主动作并将其他 visual 降级为 poster' })
  }
  const byAsset = groupVisualUsages(usages, usage => usage.assetId)
  for (const [assetId, assetUsages] of byAsset) {
    if (assetUsages.length > 1 && new Set(assetUsages.map(usage => usage.alt.toLocaleLowerCase())).size > 1) findings.push({
      ruleId: 'visual.semantic-reuse', severity: 'warning', path: '$.slides', message: `${assetId} 被映射到多个不同 alt 语义，需确认不是机械复用`,
    })
  }
  const orderedFamilies = slideOrder.flatMap(slideId => bySlide.get(slideId)?.filter(usage => usage.prominence !== 'inline').map(usage => usage.family) ?? [])
  for (let index = 2; index < orderedFamilies.length; index++) if (orderedFamilies[index] && orderedFamilies[index] === orderedFamilies[index - 1] && orderedFamilies[index] === orderedFamilies[index - 2]) {
    findings.push({ ruleId: 'visual.family-repetition', severity: 'warning', path: '$.slides', message: `连续页面重复 visual family ${orderedFamilies[index]}` })
    break
  }
  const continuous = usages.filter(usage => usage.behavior === 'loop').length
  if (usages.length >= 4 && continuous / usages.length > .35) findings.push({ ruleId: 'visual.deck-animation-budget', severity: 'warning', path: '$.slides', message: '持续动画占 deck visual 比例过高，应改用 poster 或静态 Lucide icon' })
  return findings
}

function groupVisualUsages(usages: readonly VisualUsage[], key: (usage: VisualUsage) => string) {
  const groups = new Map<string, VisualUsage[]>()
  for (const usage of usages) groups.set(key(usage), [...(groups.get(key(usage)) ?? []), usage])
  return groups
}

export function visualMotionCatalogFindings(
  motions: readonly MotionReadyVisual[] = motionReadyVisuals,
  assets: readonly Pick<VisualAssetDefinition, 'id' | 'kind'>[] = productionVisualAssets,
  geometries: Readonly<Record<string, { body: string }>> = visualGeometryById,
): VerificationFinding[] {
  return qualifyVisualMotionCatalog(motions, assets, geometries).map(issue => ({
    ruleId: issue.code,
    severity: 'error',
    path: `$.visualAssets.${issue.asset}`,
    message: issue.message,
  }))
}

function masterVisualBalanceFindings(master: DeckDocument['master']): VerificationFinding[] {
  const findings: VerificationFinding[] = []
  const centerX = (frame: Frame) => frame.x + frame.width / 2
  const statement = master.layouts.statement
  const statementTitle = statement.slots.title.frame
  const statementSubtitle = statement.slots.subtitle.frame
  const statementCollides = (statement.visualRegions ?? []).some(region => framesOverlap(region.frame, statementTitle) || framesOverlap(region.frame, statementSubtitle))
  if (statement.background === 'track' && statementCollides) findings.push({
    ruleId: 'master.visual-balance', severity: 'error', path: '$.master.layouts.statement.slots',
    message: 'TRACK 背景的可读内容必须留在左上安全区，不能让上升轨道穿过标题或语境',
  })
  const factValue = master.layouts['big-fact'].slots.value.frame
  const factLabel = master.layouts['big-fact'].slots.label.frame
  if (Math.abs(centerX(factValue) - 50) > 5 || factLabel.x > 10 || factLabel.width < 80 || factLabel.y <= factValue.y + factValue.height) findings.push({
    ruleId: 'master.visual-balance', severity: 'error', path: '$.master.layouts.big-fact.slots',
    message: 'big-fact 的数字必须成为稳定的居中主体，说明栏横向铺开并在下方形成承托基线，不能悬挂或斜向错位',
  })

  const quote = master.layouts.quote.slots.quote.frame
  const attribution = master.layouts.quote.slots.attribution.frame
  if (quote.x > 10 || quote.width < 80 || Math.abs(attribution.x - quote.x) > 2 || Math.abs(attribution.width - quote.width) > 4 || attribution.y <= quote.y) findings.push({
    ruleId: 'master.visual-balance', severity: 'error', path: '$.master.layouts.quote.slots',
    message: 'quote 的引言主体与署名栏必须横向铺开并共享稳定边界，不能用无语义的斜向错位制造张力',
  })
  return findings
}

function framesOverlap(a: Frame, b: Frame) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function terminalPeriodFindings(slide: DeckDocument['slides'][string], slideId: string): VerificationFinding[] {
  const findings: VerificationFinding[] = []
  const report = (value: unknown, path: string) => {
    const values = Array.isArray(value) ? value : [value]
    values.forEach((item, index) => {
      if (typeof item === 'string' && /[。.]\s*$/.test(item)) findings.push({
        ruleId: 'copy.terminal-period',
        severity: 'warning',
        path: `$.slides.${slideId}.${path}${Array.isArray(value) ? `[${index}]` : ''}`,
        message: 'Cadenza 展示文案默认不以句号收尾；只有明确的引言正文可保留句号',
      })
    })
  }
  const record = slide as unknown as Record<string, unknown>
  for (const key of ['title', 'subtitle', 'body', 'factLabel', 'items'] as const) report(record[key], key)
  if (isRecord(record.image)) report(record.image.caption, 'image.caption')
  if (Array.isArray(record.images)) record.images.forEach((image, index) => { if (isRecord(image)) report(image.caption, `images[${index}].caption`) })
  if (Array.isArray(record.objects)) record.objects.forEach((object, objectIndex) => {
    if (!isRecord(object)) return
    if (object.kind === 'text') report(object.text, `objects[${objectIndex}].text`)
    if (isCompositionSlideObject(object)) walkCopy(object.tree, `objects[${objectIndex}].tree`, report)
  })
  return findings
}

function forbiddenRhetoricalFrameFindings(slide: DeckDocument['slides'][string], slideId: string): VerificationFinding[] {
  const findings: VerificationFinding[] = []
  const readableKeys = new Set(['title', 'subtitle', 'body', 'items', 'quote', 'attribution', 'text', 'caption', 'meta', 'bio'])
  const walk = (value: unknown, path: string, key?: string) => {
    if (typeof value === 'string') {
      if (key && readableKeys.has(key) && /不是[^\n。！？]{0,48}[，,；;]?\s*而是/.test(value)) findings.push({
        ruleId: 'copy.forbidden-rhetorical-frame', severity: 'warning', path: `$.slides.${slideId}.${path}`,
        message: '展示文案禁用「不是……而是……」反转句式；请直接陈述主张、条件或因果，避免同质化 AI 腔',
      })
      return
    }
    if (Array.isArray(value)) return value.forEach((entry, index) => walk(entry, `${path}[${index}]`, key))
    if (!isRecord(value)) return
    for (const [childKey, child] of Object.entries(value)) {
      if (childKey === 'notes') continue
      walk(child, path ? `${path}.${childKey}` : childKey, childKey)
    }
  }
  walk(slide, '')
  return findings
}

function walkCopy(node: Parameters<typeof diagnoseComposition>[0], path: string, report: (value: unknown, path: string) => void) {
  if (node.component !== 'quote') {
    for (const key of ['text', 'title', 'body', 'items', 'caption', 'bio'] as const) report(node.props?.[key], `${path}.props.${key}`)
  }
  node.children?.forEach((child, index) => walkCopy(child, `${path}.children[${index}]`, report))
  Object.entries(node.slots ?? {}).forEach(([slot, children]) => children.forEach((child, index) => walkCopy(child, `${path}.slots.${slot}[${index}]`, report)))
}

function estimateContentCoverage(slide: DeckDocument['slides'][string], master: DeckDocument['master']) {
  if (slide.role === 'intro' || slide.role === 'section' || slide.layout === 'section') return undefined
  const cells = new Float32Array(100 * 100)
  const record = slide as unknown as Record<string, unknown>
  const hidden = new Set(Array.isArray(record.hiddenPlaceholders) ? record.hiddenPlaceholders.filter(value => typeof value === 'string') as string[] : [])
  const layoutMaster = slide.layout in master.layouts
    ? master.layouts[slide.layout as keyof typeof master.layouts]
    : master.layouts.blank
  if (slide.layout === 'custom:numbered-series') paint(cells, { x: 5, y: 5, width: 90, height: 24 }, 0.7)
  for (const [name, base] of Object.entries(layoutMaster.slots)) {
    if (hidden.has(name) || base.tag === 'canvas') continue
    const value = slotContent(base.tag, record)
    if (!hasContent(value)) continue
    const overrides = isRecord(record.slotOverrides) && isRecord(record.slotOverrides[name]) ? record.slotOverrides[name] : undefined
    const resolved = mergeSlotStyle(base, overrides as Parameters<typeof mergeSlotStyle>[1])
    if (resolved) paint(cells, resolved.frame, slotWeight(base.tag))
  }
  const objects = Array.isArray(record.objects) ? record.objects : []
  for (const candidate of objects) {
    if (!isRecord(candidate) || !isFrame(candidate.frame) || candidate.kind === 'shape') continue
    let weight = 0.8
    if (isCompositionSlideObject(candidate)) weight = estimateCompositionCoverage(candidate.tree).fillRatio
    else if (candidate.kind === 'image' || candidate.kind === 'video' || candidate.kind === 'chart' || candidate.kind === 'table' || candidate.kind === 'html') weight = 1
    else if (candidate.kind === 'text') weight = 0.55
    paint(cells, candidate.frame, weight)
  }
  const semanticCoverage = cells.reduce((sum, value) => sum + value, 0) / 100
  if (semanticCoverage >= 20 && layoutMaster.background !== 'white') {
    for (const region of layoutMaster.visualRegions ?? []) paint(cells, region.frame, 0.65)
  }
  return cells.reduce((sum, value) => sum + value, 0) / 100
}

function slotContent(tag: string, slide: Record<string, unknown>) {
  switch (tag) {
    case 'title': case 'statement': return slide.title
    case 'subtitle': case 'context': return slide.subtitle
    case 'metadata': return [slide.author, slide.date]
    case 'body': return slide.body
    case 'list': case 'agenda': return slide.items
    case 'media': return slide.image ?? slide.images
    case 'metric': return slide.value
    case 'label': return slide.factLabel
    case 'quote': return slide.quote
    case 'attribution': return slide.attribution ?? slide.source
    case 'section-number': return slide.sectionNumber
    default: return undefined
  }
}

function slotWeight(tag: string) {
  if (tag === 'media') return 1
  if (tag === 'statement') return 1
  if (tag === 'metric') return 0.95
  if (tag === 'quote' || tag === 'list' || tag === 'agenda') return 0.85
  if (tag === 'title' || tag === 'label') return 0.72
  return 0.62
}

function paint(cells: Float32Array, frame: Frame, weight: number) {
  const x0 = Math.max(0, Math.floor(frame.x))
  const y0 = Math.max(0, Math.floor(frame.y))
  const x1 = Math.min(100, Math.ceil(frame.x + frame.width))
  const y1 = Math.min(100, Math.ceil(frame.y + frame.height))
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const index = y * 100 + x
    cells[index] = Math.max(cells[index], weight)
  }
}

function hasContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasContent)
  if (typeof value === 'string') return Boolean(value.trim())
  return value !== undefined && value !== null
}

function isFrame(value: unknown): value is Frame {
  return isRecord(value) && ['x', 'y', 'width', 'height'].every(key => typeof value[key] === 'number')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mediaSources(value: unknown, path = ''): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.flatMap((entry, index) => mediaSources(entry, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => key === 'src'
    ? [[path ? `${path}.src` : 'src', entry] as [string, unknown]]
    : mediaSources(entry, path ? `${path}.${key}` : key))
}

function semanticMedia(slide: DeckDocument['slides'][string]): Array<[string, Record<string, unknown>]> {
  const value = slide as unknown as Record<string, unknown>
  const result: Array<[string, Record<string, unknown>]> = []
  if (isRecord(value.image)) result.push(['image', value.image])
  if (Array.isArray(value.images)) value.images.forEach((image, index) => { if (isRecord(image)) result.push([`images[${index}]`, image]) })
  if (Array.isArray(value.objects)) value.objects.forEach((object, index) => { if (isRecord(object) && object.kind === 'image') result.push([`objects[${index}]`, object]) })
  return result
}
