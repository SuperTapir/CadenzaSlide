import type { EnvironmentMode, SceneId } from '../engine/environment-presets.ts'
import type { ElementMotionId } from '../motion/element-presets.ts'
import type { MotionPresetId } from '../motion/presets.ts'
import type { FontThemeId } from '../typography/themes.ts'
import type { CompositionNode } from '../authoring/component-library.ts'

export const coreLayoutIds = [
  'title',
  'title-photo',
  'title-photo-alt',
  'title-bullets',
  'title-bullets-photo',
  'section',
  'title-only',
  'agenda',
  'statement',
  'big-fact',
  'quote',
  'gallery',
  'photo',
  'blank',
] as const

export type CoreLayoutId = typeof coreLayoutIds[number]
export const MASTER_SAFE_INSET = 4

export interface Frame {
  x: number
  y: number
  width: number
  height: number
}

export interface SlotStyle {
  tag: string
  frame: Frame
  fontSize?: number
  align?: 'left' | 'center' | 'right'
  fit?: 'cover' | 'contain'
}

export type MediaKind = 'photo' | 'product' | 'illustration' | 'screenshot' | 'diagram'
export type MediaTreatment = 'one-bit' | 'tonal'

export type SlotOverride = Omit<Partial<SlotStyle>, 'frame' | 'tag'> & { frame?: Partial<Frame> }

interface ObjectBase { frame: Frame, zIndex?: number }
export type CompositionSlideObject = ObjectBase & { kind: 'composition', compositionId: string, tree: CompositionNode }
export type SlideObject =
  | (ObjectBase & { kind: 'text', text: string })
  | (ObjectBase & { kind: 'image', src: string, alt: string, fit?: 'cover' | 'contain', focalPoint?: { x: number, y: number }, mediaKind?: MediaKind, treatment?: MediaTreatment })
  | (ObjectBase & { kind: 'shape', shape: 'rectangle' | 'ellipse' | 'line' })
  | (ObjectBase & { kind: 'table', columns: string[], rows: string[][] })
  | (ObjectBase & { kind: 'code', language: string, code: string, highlightLines?: string, caption?: string })
  | (ObjectBase & { kind: 'video', src: string, alt: string, poster?: string, controls?: boolean })
  | (ObjectBase & { kind: 'chart', chart: 'bar' | 'line', values: Array<{ label: string, value: number }> })
  | (ObjectBase & { kind: 'html', src: string, external?: true, title?: string })
  | CompositionSlideObject

export type LayoutObject = Exclude<SlideObject, { kind: 'video' } | { kind: 'html' } | { kind: 'composition' }>

export function isCompositionSlideObject(value: unknown): value is CompositionSlideObject {
  return typeof value === 'object' && value !== null && (value as Record<string, unknown>).kind === 'composition'
}

export interface LayoutMaster {
  background: SceneId
  environmentMode: EnvironmentMode
  elementMotion: ElementMotionId
  backgroundObjects: LayoutObject[]
  visualRegions?: Array<{ tag: string, frame: Frame }>
  slots: Record<string, SlotStyle>
}

export interface DeckMaster {
  typography: FontThemeId
  slideTransition: MotionPresetId
  layouts: Record<CoreLayoutId, LayoutMaster>
}

const frame = (tag: string, x: number, y: number, width: number, height: number, fontSize?: number): SlotStyle => ({
  tag,
  frame: { x, y, width, height },
  ...(fontSize ? { fontSize } : {}),
})

export const defaultDeckMaster: DeckMaster = {
  typography: 'industrial',
  slideTransition: 'dissolve',
  layouts: {
    title: { background: 'field', environmentMode: 'loop', elementMotion: 'appear', backgroundObjects: [], slots: { title: frame('title', 6, 43, 60, 38, 68), subtitle: frame('subtitle', 6, 83, 48, 7, 18), meta: frame('metadata', 6, 92, 32, 5, 14) } },
    'title-photo': { background: 'black', environmentMode: 'loop', elementMotion: 'appear', backgroundObjects: [], slots: { media: frame('media', 0, 0, 100, 100), title: frame('title', 6, 55, 66, 32, 68), subtitle: frame('subtitle', 6, 88, 50, 7, 18) } },
    'title-photo-alt': { background: 'shutter', environmentMode: 'loop', elementMotion: 'appear', backgroundObjects: [], slots: { title: frame('title', 6, 24, 40, 44, 66), subtitle: frame('subtitle', 6, 72, 38, 12, 18), media: frame('media', 53, 11, 41, 78) } },
    'title-bullets': { background: 'orbit', environmentMode: 'loop', elementMotion: 'accumulate', backgroundObjects: [], visualRegions: [{ tag: 'orbit-scene', frame: { x: 0, y: 0, width: 100, height: 100 } }], slots: { title: frame('title', 6, 7, 58, 22, 46), subtitle: frame('subtitle', 6, 30, 58, 7, 16), body: frame('body', 6, 37, 44, 6, 14), items: frame('list', 6, 43, 44, 48) } },
    'title-bullets-photo': { background: 'contour', environmentMode: 'loop', elementMotion: 'accumulate', backgroundObjects: [], slots: { title: frame('title', 6, 9, 41, 24, 48), subtitle: frame('subtitle', 6, 34, 40, 10, 16), items: frame('list', 6, 48, 41, 43), media: frame('media', 53, 13, 41, 66) } },
    section: { background: 'beam', environmentMode: 'loop', elementMotion: 'appear', backgroundObjects: [], slots: { title: frame('title', 6, 48, 68, 34, 72), subtitle: frame('subtitle', 6, 84, 28, 9, 18), number: frame('section-number', 78, 7, 16, 24, 150) } },
    'title-only': { background: 'white', environmentMode: 'loop', elementMotion: 'appear', backgroundObjects: [], slots: { title: frame('title', 6, 7, 58, 16, 44), subtitle: frame('subtitle', 6, 25, 54, 6, 15) } },
    agenda: { background: 'orbit', environmentMode: 'loop', elementMotion: 'accumulate', backgroundObjects: [], visualRegions: [{ tag: 'orbit-scene', frame: { x: 0, y: 0, width: 100, height: 100 } }], slots: { title: frame('title', 6, 8, 56, 20, 44), subtitle: frame('subtitle', 6, 29, 44, 8, 16), body: frame('body', 71, 84, 23, 7, 14), items: frame('agenda', 6, 43, 44, 48) } },
    statement: { background: 'black', environmentMode: 'loop', elementMotion: 'focus', backgroundObjects: [], slots: { title: frame('statement', 8, 14, 84, 40, 68), subtitle: frame('context', 8, 67, 60, 12, 17) } },
    'big-fact': { background: 'halo', environmentMode: 'loop', elementMotion: 'count', backgroundObjects: [], slots: { value: frame('metric', 18, 8, 64, 62, 220), label: frame('label', 8, 74, 84, 13, 28) } },
    quote: { background: 'black', environmentMode: 'loop', elementMotion: 'appear', backgroundObjects: [], slots: { quote: frame('quote', 8, 15, 84, 48, 72), attribution: frame('attribution', 8, 72, 84, 14, 16) } },
    gallery: { background: 'white', environmentMode: 'loop', elementMotion: 'appear', backgroundObjects: [], slots: {
      title: frame('title', 4, 3, 92, 12),
      media: frame('media', 4, 17, 92, 79),
    } },
    photo: { background: 'black', environmentMode: 'loop', elementMotion: 'appear', backgroundObjects: [], slots: { media: frame('media', 0, 0, 100, 100) } },
    blank: { background: 'white', environmentMode: 'loop', elementMotion: 'appear', backgroundObjects: [], slots: { canvas: frame('canvas', 0, 0, 100, 100) } },
  },
}

export function createDefaultDeckMaster(): DeckMaster {
  return structuredClone(defaultDeckMaster)
}

export function mergeSlotStyle(base: SlotStyle | undefined, override: SlotOverride | undefined): SlotStyle | undefined {
  if (!base) return undefined
  if (!override) return base
  return { ...base, ...override, frame: { ...base.frame, ...override.frame } }
}

export function routeMasterAnchorContent<T>(source: LayoutMaster, target: LayoutMaster, content: Readonly<Record<string, T>>) {
  const mapped: Record<string, T> = {}
  const unmapped: Array<{ sourceSlot: string, tag: string, value: T, reason: 'missing-source-anchor' | 'missing-target-tag' | 'target-occupied' }> = []
  for (const [sourceSlot, value] of Object.entries(content)) {
    const tag = source.slots[sourceSlot]?.tag
    if (!tag) { unmapped.push({ sourceSlot, tag: '', value, reason: 'missing-source-anchor' }); continue }
    const targetSlot = Object.entries(target.slots).find(([, slot]) => slot.tag === tag)?.[0]
    if (!targetSlot) unmapped.push({ sourceSlot, tag, value, reason: 'missing-target-tag' })
    else if (targetSlot in mapped) unmapped.push({ sourceSlot, tag, value, reason: 'target-occupied' })
    else mapped[targetSlot] = value
  }
  return { mapped, unmapped }
}
