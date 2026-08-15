import { coreLayoutIds, type CoreLayoutId, type SlideObject } from '../core/deck-master.ts'
import type { DeckDocument } from '../core/deck-document.ts'
import { changeLayout, reapplyLayout, type LayoutChangeDiagnostic } from '../core/slide-layout-operations.ts'
import type { CoreSlide } from '../rendering/core-templates.ts'

export const addableObjectKinds = ['text', 'image', 'shape', 'table', 'code', 'video', 'chart'] as const
export type AddableObjectKind = typeof addableObjectKinds[number]

export function layoutInspectorView(document: Readonly<DeckDocument>, slideId: string) {
  const slide = coreSlide(document, slideId)
  const layout = document.master.layouts[slide.layout]
  return {
    slideId,
    layout: slide.layout,
    layouts: coreLayoutIds,
    placeholders: Object.entries(layout.slots).map(([id, slot]) => ({ id, tag: slot.tag, visible: !slide.hiddenPlaceholders?.includes(id), hasContent: placeholderHasContent(slide, id) })),
  }
}

export function setPlaceholderVisible(document: Readonly<DeckDocument>, slideId: string, placeholderId: string, visible: boolean): DeckDocument {
  const slide = coreSlide(document, slideId)
  if (!document.master.layouts[slide.layout].slots[placeholderId]) throw new Error(`当前 layout 没有 placeholder “${placeholderId}”`)
  const hidden = new Set(slide.hiddenPlaceholders ?? [])
  if (visible) hidden.delete(placeholderId)
  else hidden.add(placeholderId)
  return replaceSlide(document, slideId, { ...slide, ...(hidden.size ? { hiddenPlaceholders: [...hidden] } : {}) }, hidden.size === 0 ? ['hiddenPlaceholders'] : [])
}

export function reapplySlideLayout(document: Readonly<DeckDocument>, slideId: string): DeckDocument {
  return replaceSlide(document, slideId, reapplyLayout(coreSlide(document, slideId)))
}

export function changeSlideLayout(document: Readonly<DeckDocument>, slideId: string, targetLayout: CoreLayoutId): { document?: DeckDocument, diagnostics: LayoutChangeDiagnostic[] } {
  const result = changeLayout(coreSlide(document, slideId), targetLayout, document.master)
  return result.slide ? { document: replaceSlide(document, slideId, result.slide), diagnostics: [] } : { diagnostics: result.diagnostics }
}

export function addPageObject(document: Readonly<DeckDocument>, slideId: string, kind: AddableObjectKind): DeckDocument {
  const slide = coreSlide(document, slideId)
  const object = defaultObject(kind, slide.objects?.length ?? 0)
  return replaceSlide(document, slideId, { ...slide, objects: [...(slide.objects ?? []), object] })
}

function coreSlide(document: Readonly<DeckDocument>, slideId: string): CoreSlide {
  const slide = document.slides[slideId]
  if (!slide || 'draft' in slide || !(coreLayoutIds as readonly string[]).includes(slide.layout)) throw new Error(`Slide “${slideId}” 不是可编辑 core slide`)
  return slide as CoreSlide
}

function replaceSlide(document: Readonly<DeckDocument>, slideId: string, slide: CoreSlide, deleteKeys: string[] = []): DeckDocument {
  const next = structuredClone(slide) as unknown as Record<string, unknown>
  deleteKeys.forEach(key => delete next[key])
  return { ...document, slides: { ...document.slides, [slideId]: next as unknown as CoreSlide } }
}

function defaultObject(kind: AddableObjectKind, index: number): SlideObject {
  const offset = Math.min(index * 2, 12)
  const frame = { x: 12 + offset, y: 50 + offset, width: 36, height: 24 }
  switch (kind) {
    case 'text': return { kind, frame, text: '新文本' }
    case 'image': return { kind, frame, src: '/hello-apple.svg', alt: '新图片' }
    case 'shape': return { kind, frame, shape: 'rectangle' }
    case 'table': return { kind, frame, columns: ['项目', '内容'], rows: [['示例', '待编辑']] }
    case 'code': return { kind, frame, language: 'text', code: '编辑代码' }
    case 'video': return { kind, frame, src: '/cadenza-loop.mp4', alt: '新视频' }
    case 'chart': return { kind, frame, chart: 'bar', values: [{ label: '示例', value: 1 }] }
  }
}

function placeholderHasContent(slide: CoreSlide, id: string) {
  const value = slide as unknown as Record<string, unknown>
  if (id === 'media') return hasContent(slide.layout === 'gallery' ? value.images : value.image)
  if (id === 'meta') return hasContent(value.author) || hasContent(value.date)
  if (id === 'number') return hasContent(value.sectionNumber)
  if (id === 'label') return hasContent(value.factLabel)
  if (id === 'attribution') return hasContent(value.attribution) || hasContent(value.source)
  return hasContent(value[id])
}

function hasContent(value: unknown) {
  return value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)
}
