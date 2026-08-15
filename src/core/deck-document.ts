import { isEnvironmentMode, isEnvironmentPresetId } from '../engine/environment-presets.ts'
import { isElementMotionId } from '../motion/element-presets.ts'
import { isMotionPresetId } from '../motion/presets.ts'
import { isFontThemeId } from '../typography/themes.ts'
import {
  coreLayoutIds,
  type DeckMaster,
  type Frame,
  isCompositionSlideObject,
  type LayoutMaster,
  type LayoutObject,
  type SlotStyle,
} from './deck-master.ts'
import type { RenderableDeckSlide } from '../rendering/core-templates.ts'
import { isCustomLayoutId } from './custom-layouts.ts'
import { validateCompositionTree } from '../authoring/component-library.ts'

export const WORKSPACE_CONFIG_VERSION = 1 as const
export const DECK_DOCUMENT_VERSION = 1 as const

export interface WorkspaceConfigV1 {
  $schema?: string
  version: typeof WORKSPACE_CONFIG_VERSION
  decksDirectory: string
  defaultDeck?: string
}

export interface DeckOutlineSlide { kind: 'slide', slideId: string }
export interface DeckOutlineGroup { kind: 'group', id: string, title: string, slideIds: string[] }
export type DeckOutlineItem = DeckOutlineSlide | DeckOutlineGroup

export interface DeckDocument {
  version: typeof DECK_DOCUMENT_VERSION
  id: string
  title: string
  status: 'outline' | 'complete'
  outlineConfirmedAt?: string
  master: DeckMaster
  slides: Record<string, RenderableDeckSlide>
  outline: DeckOutlineItem[]
}

export interface DocumentIssue { code: string, path: string, message: string }

export class DeckDocumentError extends Error {
  readonly issues: readonly DocumentIssue[]
  constructor(issues: readonly DocumentIssue[]) {
    super(issues.map(issue => `${issue.code} ${issue.path}: ${issue.message}`).join('\n'))
    this.name = 'DeckDocumentError'
    this.issues = issues
  }
}

export function parseWorkspaceConfig(value: unknown): WorkspaceConfigV1 {
  const issues: DocumentIssue[] = []
  if (!isRecord(value)) throw new DeckDocumentError([issue('workspace.object', '$', '必须是对象')])
  if (value.version !== WORKSPACE_CONFIG_VERSION) issues.push(issue('workspace.version', '$.version', `必须为 ${WORKSPACE_CONFIG_VERSION}`))
  const decksDirectory = readString(value.decksDirectory, '$.decksDirectory', 'workspace.decks-directory', issues)
  if (decksDirectory && !isSafeRelativePath(decksDirectory)) issues.push(issue('workspace.path', '$.decksDirectory', '必须是 workspace 内的相对路径'))
  const defaultDeck = value.defaultDeck === undefined ? undefined : readId(value.defaultDeck, '$.defaultDeck', 'workspace.default-deck', issues)
  for (const key of Object.keys(value)) if (!['$schema', 'version', 'decksDirectory', 'defaultDeck'].includes(key)) issues.push(issue('workspace.unknown-field', `$.${key}`, '不支持的字段'))
  throwIssues(issues)
  return { ...(typeof value.$schema === 'string' ? { $schema: value.$schema } : {}), version: 1, decksDirectory, ...(defaultDeck ? { defaultDeck } : {}) }
}

export function parseDeckDocument(value: unknown): DeckDocument {
  const issues: DocumentIssue[] = []
  if (!isRecord(value)) throw new DeckDocumentError([issue('deck.object', '$', '必须是对象')])
  for (const key of Object.keys(value)) if (!['version', 'id', 'title', 'status', 'outlineConfirmedAt', 'master', 'slides', 'outline'].includes(key)) issues.push(issue('deck.unknown-field', `$.${key}`, '不支持的字段'))
  if (value.version !== DECK_DOCUMENT_VERSION) issues.push(issue('deck.version', '$.version', `必须为 ${DECK_DOCUMENT_VERSION}`))
  const id = readId(value.id, '$.id', 'deck.id', issues)
  const title = readString(value.title, '$.title', 'deck.title', issues)
  const status = value.status === 'outline' || value.status === 'complete' ? value.status : (issues.push(issue('deck.status', '$.status', '必须为 outline 或 complete')), 'complete')
  const outlineConfirmedAt = value.outlineConfirmedAt === undefined ? undefined : typeof value.outlineConfirmedAt === 'string' && !Number.isNaN(Date.parse(value.outlineConfirmedAt)) ? value.outlineConfirmedAt : (issues.push(issue('deck.outline-confirmed-at', '$.outlineConfirmedAt', '必须是 ISO 日期时间')), undefined)
  const master = parseMaster(value.master, issues)
  const slides = parseSlides(value.slides, master, issues)
  validateComponentIds(slides, issues)
  const outline = parseOutline(value.outline, issues)
  validateOutline(slides, outline, issues)
  throwIssues(issues)
  return { version: DECK_DOCUMENT_VERSION, id, title, status, ...(outlineConfirmedAt ? { outlineConfirmedAt } : {}), master, slides, outline }
}

function parseMaster(value: unknown, issues: DocumentIssue[]): DeckMaster {
  const fallback = { typography: 'industrial', slideTransition: 'dissolve', layouts: {} } as unknown as DeckMaster
  if (!isRecord(value)) { issues.push(issue('master.object', '$.master', '必须是母版对象')); return fallback }
  const typography = typeof value.typography === 'string' && isFontThemeId(value.typography) ? value.typography : (issues.push(issue('master.typography', '$.master.typography', '不是已注册字体')), 'industrial')
  const slideTransition = typeof value.slideTransition === 'string' && isMotionPresetId(value.slideTransition) ? value.slideTransition : (issues.push(issue('master.transition', '$.master.slideTransition', '不是已注册转场')), 'dissolve')
  const layouts = {} as DeckMaster['layouts']
  if (!isRecord(value.layouts)) issues.push(issue('master.layouts', '$.master.layouts', '必须包含全部核心 layout'))
  else {
    for (const layout of coreLayoutIds) {
      const candidate = value.layouts[layout]
      const path = `$.master.layouts.${layout}`
      if (!isRecord(candidate)) { issues.push(issue('master.layout', path, '缺少 layout master')); continue }
      const background = typeof candidate.background === 'string' && isEnvironmentPresetId(candidate.background) ? candidate.background : (issues.push(issue('master.background', `${path}.background`, '不是已注册背景')), 'white')
      const environmentMode = typeof candidate.environmentMode === 'string' && isEnvironmentMode(candidate.environmentMode) ? candidate.environmentMode : (issues.push(issue('master.environment-mode', `${path}.environmentMode`, '必须为 static 或 loop')), 'static')
      const elementMotion = typeof candidate.elementMotion === 'string' && isElementMotionId(candidate.elementMotion) ? candidate.elementMotion : (issues.push(issue('master.element-motion', `${path}.elementMotion`, '不是已注册元素动画')), 'appear')
      const slots: Record<string, SlotStyle> = {}
      if (!isRecord(candidate.slots)) issues.push(issue('master.slots', `${path}.slots`, '必须是 slot map'))
      else for (const [name, slot] of Object.entries(candidate.slots)) {
        if (!isRecord(slot) || !isRecord(slot.frame)) { issues.push(issue('master.slot', `${path}.slots.${name}`, '必须包含 frame')); continue }
        const tag = typeof slot.tag === 'string' && /^[a-z][a-z0-9-]*$/.test(slot.tag) ? slot.tag : (issues.push(issue('master.slot-tag', `${path}.slots.${name}.tag`, '必须是 kebab-case tag')), '')
        const parsed = parseFrame(slot.frame, `${path}.slots.${name}.frame`, issues)
        const fontSize = slot.fontSize === undefined ? undefined : readPositive(slot.fontSize, `${path}.slots.${name}.fontSize`, issues)
        const align = slot.align === undefined || ['left', 'center', 'right'].includes(String(slot.align)) ? slot.align as SlotStyle['align'] : (issues.push(issue('master.align', `${path}.slots.${name}.align`, '必须为 left、center 或 right')), undefined)
        const fit = slot.fit === undefined || slot.fit === 'cover' || slot.fit === 'contain' ? slot.fit : (issues.push(issue('master.fit', `${path}.slots.${name}.fit`, '必须为 cover 或 contain')), undefined)
        for (const key of Object.keys(slot)) if (!['tag', 'frame', 'fontSize', 'align', 'fit'].includes(key)) issues.push(issue('master.slot-field', `${path}.slots.${name}.${key}`, '不是支持的 placeholder 字段'))
        slots[name] = { tag, frame: parsed, ...(fontSize ? { fontSize } : {}), ...(align ? { align } : {}), ...(fit ? { fit } : {}) }
      }
      const backgroundObjects: LayoutObject[] = []
      if (!Array.isArray(candidate.backgroundObjects)) issues.push(issue('master.backgroundObjects', `${path}.backgroundObjects`, '必须是固定对象数组'))
      else candidate.backgroundObjects.forEach((object, index) => {
        validateObject(object, `${path}.backgroundObjects[${index}]`, issues, true)
        if (isRecord(object) && object.kind !== 'video' && object.kind !== 'html') backgroundObjects.push(structuredClone(object) as unknown as LayoutObject)
      })
      const visualRegions: NonNullable<LayoutMaster['visualRegions']> = []
      if (candidate.visualRegions !== undefined) {
        if (!Array.isArray(candidate.visualRegions)) issues.push(issue('master.visual-regions', `${path}.visualRegions`, '必须是视觉分区数组'))
        else candidate.visualRegions.forEach((region, index) => {
          const regionPath = `${path}.visualRegions[${index}]`
          if (!isRecord(region) || !isRecord(region.frame)) { issues.push(issue('master.visual-region', regionPath, '必须包含 tag 和 frame')); return }
          const tag = typeof region.tag === 'string' && /^[a-z][a-z0-9-]*$/.test(region.tag) ? region.tag : (issues.push(issue('master.visual-region-tag', `${regionPath}.tag`, '必须是 kebab-case tag')), '')
          for (const key of Object.keys(region)) if (!['tag', 'frame'].includes(key)) issues.push(issue('master.visual-region-field', `${regionPath}.${key}`, '不是支持的视觉分区字段'))
          visualRegions.push({ tag, frame: parseFrame(region.frame, `${regionPath}.frame`, issues) })
        })
      }
      for (const key of Object.keys(candidate)) if (!['background', 'environmentMode', 'elementMotion', 'slots', 'backgroundObjects', 'visualRegions'].includes(key)) issues.push(issue('master.layout-field', `${path}.${key}`, '不是支持的 layout master 字段'))
      layouts[layout] = { background, environmentMode, elementMotion, slots, backgroundObjects, ...(visualRegions.length ? { visualRegions } : {}) }
    }
    for (const key of Object.keys(value.layouts)) if (!(coreLayoutIds as readonly string[]).includes(key)) issues.push(issue('master.unknown-layout', `$.master.layouts.${key}`, '不是核心 layout'))
  }
  return { typography, slideTransition, layouts }
}

function parseSlides(value: unknown, master: DeckMaster, issues: DocumentIssue[]) {
  const slides: Record<string, RenderableDeckSlide> = {}
  const declaredIds = new Set<string>()
  if (!isRecord(value)) { issues.push(issue('slides.object', '$.slides', '必须是以 slide id 索引的对象')); return slides }
  for (const [key, candidate] of Object.entries(value)) {
    const path = `$.slides.${key}`
    if (!isRecord(candidate)) { issues.push(issue('slide.object', path, '必须是对象')); continue }
    const slideId = readId(candidate.id, `${path}.id`, 'slide.id', issues)
    if (slideId && declaredIds.has(slideId)) issues.push(issue('slide.duplicate-id', `${path}.id`, `slide id “${slideId}” 重复`))
    if (slideId) declaredIds.add(slideId)
    if (slideId && slideId !== key) issues.push(issue('slide.id-mismatch', `${path}.id`, `必须与 map key “${key}” 一致`))
    validateSlide(candidate, path, master, issues)
    slides[key] = candidate as unknown as RenderableDeckSlide
  }
  return slides
}

function validateSlide(slide: Record<string, unknown>, path: string, master: DeckMaster, issues: DocumentIssue[]) {
  const layout = typeof slide.layout === 'string' ? slide.layout : undefined
  if (!layout || (!(coreLayoutIds as readonly string[]).includes(layout) && !isCustomLayoutId(layout))) issues.push(issue('slide.layout', `${path}.layout`, '不是已注册 layout'))
  const roles = ['intro', 'agenda', 'section', 'content', 'recap', 'summary', 'qa', 'thanks']
  if (typeof slide.role !== 'string' || !roles.includes(slide.role)) issues.push(issue('slide.role', `${path}.role`, '不是支持的 slide role'))
  readString(slide.label, `${path}.label`, 'slide.label', issues)
  for (const field of ['scene', 'motion', 'environmentMode', 'eyebrow']) if (field in slide) issues.push(issue('slide.legacy-field', `${path}.${field}`, '视觉属性必须来自 master'))
  if ('backgroundObjects' in slide) issues.push(issue('slide.background-objects', `${path}.backgroundObjects`, '固定对象只能由 layout master 声明'))
  if (slide.title !== undefined) {
    if (!Array.isArray(slide.title) || !slide.title.every(line => typeof line === 'string' && line.trim())) issues.push(issue('slide.title', `${path}.title`, '必须是非空字符串数组'))
    else if (slide.title.length > 3) issues.push(issue('slide.title-lines', `${path}.title`, '标题最多三行'))
  }
  if (layout === 'gallery' && slide.images !== undefined && (!Array.isArray(slide.images) || slide.images.length > 4)) issues.push(issue('slide.gallery-count', `${path}.images`, 'Gallery 最多包含 4 张图片'))
  if (slide.image !== undefined) validateSlideImage(slide.image, `${path}.image`, issues)
  if (Array.isArray(slide.images)) slide.images.forEach((image, index) => validateSlideImage(image, `${path}.images[${index}]`, issues))
  if (layout === 'custom:numbered-series') {
    readString(slide.seriesNumber, `${path}.seriesNumber`, 'slide.series-number', issues)
    readString(slide.seriesLabel, `${path}.seriesLabel`, 'slide.series-label', issues)
    if (!Array.isArray(slide.title) || !slide.title.length) issues.push(issue('slide.series-title', `${path}.title`, '连续编号模板必须包含主标题'))
  }
  if (layout === 'quote') {
    if (slide.quote !== undefined && (typeof slide.quote !== 'string' || !slide.quote.trim())) issues.push(issue('slide.quote', `${path}.quote`, '引用必须是非空字符串'))
    if (slide.attribution !== undefined && (typeof slide.attribution !== 'string' || !slide.attribution.trim())) issues.push(issue('slide.quote-attribution', `${path}.attribution`, '署名必须是非空字符串'))
    if (slide.source !== undefined && (typeof slide.source !== 'string' || !slide.source.trim())) issues.push(issue('slide.quote-source', `${path}.source`, '引用出处必须是非空字符串'))
  }
  if (slide.objects !== undefined) {
    if (!Array.isArray(slide.objects)) issues.push(issue('slide.objects', `${path}.objects`, '必须是组件数组'))
    else slide.objects.forEach((object, index) => validateObject(object, `${path}.objects[${index}]`, issues))
  }
  const slots = layout && (coreLayoutIds as readonly string[]).includes(layout)
    ? master.layouts[layout as keyof DeckMaster['layouts']]?.slots ?? {}
    : master.layouts.blank?.slots ?? {}
  if (slide.hiddenPlaceholders !== undefined) {
    if (!Array.isArray(slide.hiddenPlaceholders) || !slide.hiddenPlaceholders.every(name => typeof name === 'string')) issues.push(issue('slide.hiddenPlaceholders', `${path}.hiddenPlaceholders`, '必须是 placeholder ID 数组'))
    else {
      const seen = new Set<string>()
      slide.hiddenPlaceholders.forEach((name, index) => {
        if (seen.has(name)) issues.push(issue('slide.hidden-placeholder-duplicate', `${path}.hiddenPlaceholders[${index}]`, `placeholder “${name}” 重复`))
        else if (!slots[name]) issues.push(issue('slide.hidden-placeholder', `${path}.hiddenPlaceholders[${index}]`, `当前 layout 没有 placeholder “${name}”`))
        seen.add(name)
      })
    }
  }
  if (slide.slotOverrides !== undefined) validateSlotOverrides(slide.slotOverrides, slots, `${path}.slotOverrides`, issues)
  if (slide.notes !== undefined && typeof slide.notes !== 'string') issues.push(issue('slide.notes', `${path}.notes`, '必须是 Markdown 字符串'))
  validateNoExecutablePayload(slide, path, issues)
}

function validateObject(value: unknown, path: string, issues: DocumentIssue[], fixed = false) {
  if (!isRecord(value)) { issues.push(issue('component.object', path, '必须是对象')); return }
  if (isCompositionSlideObject(value)) {
    if (fixed) issues.push(issue('master.backgroundObjects', `${path}.kind`, '固定对象不支持 composition'))
    readId(value.compositionId, `${path}.compositionId`, 'component.composition-id', issues)
    if (!isRecord(value.frame)) issues.push(issue('component.frame', `${path}.frame`, '必须包含 frame'))
    else parseFrame(value.frame, `${path}.frame`, issues)
    for (const compositionIssue of validateCompositionTree(value.tree)) issues.push(issue('component.composition', compositionIssue.path === '$' ? `${path}.tree` : `${path}.tree.${compositionIssue.path}`, compositionIssue.message))
    for (const key of Object.keys(value)) if (!['kind', 'compositionId', 'frame', 'tree', 'zIndex'].includes(key)) issues.push(issue('component.composition-field', `${path}.${key}`, '不是支持的 composition 字段'))
    return
  }
  const kinds = ['text', 'image', 'shape', 'table', 'code', 'video', 'chart', 'html']
  if (typeof value.kind !== 'string' || !kinds.includes(value.kind)) issues.push(issue('component.kind', `${path}.kind`, '不是支持的组件'))
  if (fixed && (value.kind === 'video' || value.kind === 'html')) issues.push(issue('master.backgroundObjects', `${path}.kind`, '固定对象不支持 video 或 HTML'))
  if (!isRecord(value.frame)) issues.push(issue('component.frame', `${path}.frame`, '必须包含 frame'))
  else parseFrame(value.frame, `${path}.frame`, issues)
  if (value.kind === 'html') {
    if (value.external !== undefined && value.external !== true) issues.push(issue('component.html-external', `${path}.external`, '必须为 true 或省略'))
    if (value.external === true) {
      if (typeof value.src !== 'string' || !isSafeHttpsUrl(value.src)) issues.push(issue('component.html-src', `${path}.src`, '远程 HTML 必须使用无凭据的 HTTPS URL'))
      if (typeof value.title !== 'string' || !value.title.trim()) issues.push(issue('component.html-title', `${path}.title`, '远程 HTML 必须提供可访问性标题'))
    } else if (typeof value.src !== 'string' || !isSafeRelativePath(value.src) || !value.src.toLowerCase().endsWith('.html')) {
      issues.push(issue('component.html-src', `${path}.src`, '必须是 workspace 内相对 HTML 路径'))
    }
  }
  if (value.kind === 'image') validateMediaSemantics(value, path, issues, 'mediaKind')
  if (value.kind === 'table' && Array.isArray(value.columns) && Array.isArray(value.rows)) {
    const columnCount = value.columns.length
    value.rows.forEach((row, index) => { if (!Array.isArray(row) || row.length !== columnCount) issues.push(issue('component.table-row', `${path}.rows[${index}]`, '列数必须与表头一致')) })
  }
}

function validateSlideImage(value: unknown, path: string, issues: DocumentIssue[]) {
  if (!isRecord(value)) { issues.push(issue('slide.image', path, '必须是图片对象')); return }
  validateMediaSemantics(value, path, issues, 'kind')
}

function validateMediaSemantics(value: Record<string, unknown>, path: string, issues: DocumentIssue[], kindKey: 'kind' | 'mediaKind') {
  const kinds = ['photo', 'product', 'illustration', 'screenshot', 'diagram']
  if (value[kindKey] !== undefined && (typeof value[kindKey] !== 'string' || !kinds.includes(value[kindKey] as string))) issues.push(issue('media.kind', `${path}.${kindKey}`, `必须为 ${kinds.join('、')}`))
  if (value.treatment !== undefined && value.treatment !== 'one-bit' && value.treatment !== 'tonal') issues.push(issue('media.treatment', `${path}.treatment`, '主画布媒体必须为 one-bit 或 tonal；原图只允许在媒体查看器中显示'))
}

function validateComponentIds(slides: Record<string, RenderableDeckSlide>, issues: DocumentIssue[]) {
  const ids = new Map<string, string>()
  for (const [slideId, slide] of Object.entries(slides)) {
    const objects = 'objects' in slide && Array.isArray(slide.objects) ? slide.objects : []
    for (const [index, object] of objects.entries()) {
      const stableId = isCompositionSlideObject(object) ? object.compositionId : undefined
      if (!stableId) continue
      const field = 'compositionId'
      const path = `$.slides.${slideId}.objects[${index}].${field}`
      const first = ids.get(stableId)
      if (first) issues.push(issue('component.duplicate-id', path, `${field} “${stableId}” 重复，首次位于 ${first}`))
      else ids.set(stableId, path)
    }
  }
}

function validateSlotOverrides(value: unknown, slots: Record<string, SlotStyle>, path: string, issues: DocumentIssue[]) {
  if (!isRecord(value)) { issues.push(issue('slide.slot-overrides', path, '必须是 slot map')); return }
  for (const [name, candidate] of Object.entries(value)) {
    if (!slots[name]) issues.push(issue('slide.slot-override-name', `${path}.${name}`, `当前 layout 没有 placeholder “${name}”`))
    if (!isRecord(candidate)) issues.push(issue('slide.slot-override', `${path}.${name}`, '必须是对象'))
    else {
      if ('tag' in candidate) issues.push(issue('slide.slot-override-tag', `${path}.${name}.tag`, '页面不能覆盖 placeholder tag'))
      if (candidate.frame !== undefined) {
        if (!isRecord(candidate.frame)) issues.push(issue('slide.slot-frame', `${path}.${name}.frame`, '必须是 frame'))
        else parsePartialFrame(candidate.frame, `${path}.${name}.frame`, issues)
      }
    }
  }
}

function parseFrame(value: Record<string, unknown>, path: string, issues: DocumentIssue[]): Frame {
  const frame = { x: number(value.x, `${path}.x`, issues), y: number(value.y, `${path}.y`, issues), width: number(value.width, `${path}.width`, issues), height: number(value.height, `${path}.height`, issues) }
  if (frame.x < 0 || frame.y < 0 || frame.width <= 0 || frame.height <= 0 || frame.x + frame.width > 100 || frame.y + frame.height > 100) issues.push(issue('frame.bounds', path, '必须位于 0–100 的画布范围内'))
  return frame
}

function parsePartialFrame(value: Record<string, unknown>, path: string, issues: DocumentIssue[]) {
  for (const key of ['x', 'y', 'width', 'height']) if (value[key] !== undefined) number(value[key], `${path}.${key}`, issues)
}

function parseOutline(value: unknown, issues: DocumentIssue[]) {
  const outline: DeckOutlineItem[] = []
  if (!Array.isArray(value)) { issues.push(issue('outline.array', '$.outline', '必须是数组')); return outline }
  value.forEach((candidate, index) => {
    const path = `$.outline[${index}]`
    if (!isRecord(candidate)) { issues.push(issue('outline.item', path, '必须是 slide 或 group')); return }
    if (candidate.kind === 'slide') {
      const slideId = readId(candidate.slideId, `${path}.slideId`, 'outline.slide-id', issues)
      if (slideId) outline.push({ kind: 'slide', slideId })
    } else if (candidate.kind === 'group') {
      const id = readId(candidate.id, `${path}.id`, 'group.id', issues)
      const title = readString(candidate.title, `${path}.title`, 'group.title', issues)
      const slideIds = Array.isArray(candidate.slideIds) ? candidate.slideIds.map((value, i) => readId(value, `${path}.slideIds[${i}]`, 'group.slide-id', issues)).filter(Boolean) : (issues.push(issue('group.slide-ids', `${path}.slideIds`, '必须是数组')), [])
      if (id && title) outline.push({ kind: 'group', id, title, slideIds })
    } else issues.push(issue('outline.kind', `${path}.kind`, '必须为 slide 或 group'))
  })
  return outline
}

function validateOutline(slides: Record<string, RenderableDeckSlide>, outline: readonly DeckOutlineItem[], issues: DocumentIssue[]) {
  const ordered = outline.flatMap(item => item.kind === 'slide' ? [item.slideId] : item.slideIds)
  const seen = new Set<string>()
  ordered.forEach((slideId, index) => {
    if (!(slideId in slides)) issues.push(issue('outline.unknown-slide', `$.outline[${index}]`, `找不到 slide “${slideId}”`))
    if (seen.has(slideId)) issues.push(issue('outline.duplicate-slide', `$.outline[${index}]`, `slide “${slideId}” 重复`))
    seen.add(slideId)
  })
  for (const slideId of Object.keys(slides)) if (!seen.has(slideId)) issues.push(issue('outline.missing-slide', '$.outline', `缺少 slide “${slideId}”`))
}

function validateNoExecutablePayload(value: unknown, path: string, issues: DocumentIssue[], parentKey = '') {
  if (Array.isArray(value)) { value.forEach((entry, index) => validateNoExecutablePayload(entry, `${path}[${index}]`, issues, parentKey)); return }
  if (!isRecord(value)) {
    if (typeof value === 'string' && parentKey !== 'code' && /<\s*script\b|javascript\s*:/i.test(value)) issues.push(issue('slide.executable-content', path, '不得嵌入可执行 JavaScript'))
    return
  }
  for (const [key, entry] of Object.entries(value)) {
    if (/^(?:script|javascript|innerHTML|on[A-Z])/i.test(key)) issues.push(issue('slide.executable-field', `${path}.${key}`, '不得嵌入可执行字段'))
    else validateNoExecutablePayload(entry, `${path}.${key}`, issues, key)
  }
}

function readString(value: unknown, path: string, code: string, issues: DocumentIssue[]) { if (typeof value === 'string' && value.trim()) return value; issues.push(issue(code, path, '必须是非空字符串')); return '' }
function readId(value: unknown, path: string, code: string, issues: DocumentIssue[]) { const result = readString(value, path, code, issues); if (result && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) issues.push(issue(code, path, '必须是 kebab-case id')); return result }
function number(value: unknown, path: string, issues: DocumentIssue[]) { if (typeof value === 'number' && Number.isFinite(value)) return value; issues.push(issue('number', path, '必须是有限数字')); return 0 }
function readPositive(value: unknown, path: string, issues: DocumentIssue[]) { const parsed = number(value, path, issues); if (parsed <= 0) issues.push(issue('positive', path, '必须大于 0')); return parsed }
function isSafeRelativePath(value: string) { return value.length > 0 && !value.startsWith('/') && !value.includes('\\') && value.split('/').every(part => part !== '..' && part !== '.') }
function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function issue(code: string, path: string, message: string): DocumentIssue { return { code, path, message } }
function throwIssues(issues: readonly DocumentIssue[]) { if (issues.length) throw new DeckDocumentError(issues) }
