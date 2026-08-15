import { routeMasterAnchorContent, type CoreLayoutId, type DeckMaster, type SlotOverride } from './deck-master.ts'
import type { CoreSlide } from '../rendering/core-templates.ts'

export interface LayoutChangeDiagnostic {
  sourceSlot: string
  tag: string
  reason: 'missing-source-anchor' | 'missing-target-tag' | 'target-occupied'
}

export function reapplyLayout<T extends CoreSlide>(slide: T): T {
  const { hiddenPlaceholders: _hidden, slotOverrides: _overrides, ...rest } = slide
  return rest as T
}

export function changeLayout(slide: CoreSlide, targetLayout: CoreLayoutId, master: Readonly<DeckMaster>): { slide?: CoreSlide, diagnostics: LayoutChangeDiagnostic[] } {
  if (slide.layout === targetLayout) return { slide: reapplyLayout(slide), diagnostics: [] }
  const sourceMaster = master.layouts[slide.layout]
  const targetMaster = master.layouts[targetLayout]
  const content = Object.fromEntries(Object.keys(sourceMaster.slots).flatMap(slot => {
    const value = readPlaceholder(slide, slot)
    return hasContent(value) ? [[slot, value]] : []
  }))
  const routed = routeMasterAnchorContent(sourceMaster, targetMaster, content)
  const diagnostics = routed.unmapped.map(({ sourceSlot, tag, reason }) => ({ sourceSlot, tag, reason }))
  if (diagnostics.length) return { diagnostics }

  const next: Record<string, unknown> = {
    id: slide.id,
    role: slide.role,
    layout: targetLayout,
    label: slide.label,
    ...('notes' in slide && slide.notes !== undefined ? { notes: slide.notes } : {}),
    ...('objects' in slide && slide.objects !== undefined ? { objects: structuredClone(slide.objects) } : {}),
  }
  for (const [slot, value] of Object.entries(routed.mapped)) writePlaceholder(next, slot, value)

  const hiddenPlaceholders = routeSlotNames(slide.hiddenPlaceholders ?? [], sourceMaster, targetMaster)
  if (hiddenPlaceholders.length) next.hiddenPlaceholders = hiddenPlaceholders
  const slotOverrides = routeOverrides(slide.slotOverrides ?? {}, sourceMaster, targetMaster)
  if (Object.keys(slotOverrides).length) next.slotOverrides = slotOverrides
  return { slide: next as unknown as CoreSlide, diagnostics: [] }
}

function routeSlotNames(names: readonly string[], source: DeckMaster['layouts'][CoreLayoutId], target: DeckMaster['layouts'][CoreLayoutId]) {
  return names.flatMap(name => {
    const tag = source.slots[name]?.tag
    const targetName = tag && Object.entries(target.slots).find(([, slot]) => slot.tag === tag)?.[0]
    return targetName ? [targetName] : []
  })
}

function routeOverrides(overrides: Readonly<Record<string, SlotOverride>>, source: DeckMaster['layouts'][CoreLayoutId], target: DeckMaster['layouts'][CoreLayoutId]) {
  return Object.fromEntries(Object.entries(overrides).flatMap(([name, value]) => {
    const tag = source.slots[name]?.tag
    const targetName = tag && Object.entries(target.slots).find(([, slot]) => slot.tag === tag)?.[0]
    return targetName ? [[targetName, structuredClone(value)]] : []
  }))
}

function readPlaceholder(slide: CoreSlide, slot: string): unknown {
  const value = slide as unknown as Record<string, unknown>
  if (slot === 'media') return slide.layout === 'gallery' ? value.images : value.image
  if (slot === 'meta') return value.author || value.date ? { author: value.author, date: value.date } : undefined
  if (slot === 'number') return value.sectionNumber
  if (slot === 'label') return value.factLabel
  if (slot === 'attribution') return value.attribution || value.source ? { attribution: value.attribution, source: value.source } : undefined
  return value[slot]
}

function writePlaceholder(slide: Record<string, unknown>, slot: string, value: unknown) {
  if (slot === 'media') {
    if (slide.layout === 'gallery') slide.images = value
    else slide.image = value
  } else if (slot === 'meta' && isRecord(value)) {
    if (value.author !== undefined) slide.author = value.author
    if (value.date !== undefined) slide.date = value.date
  } else if (slot === 'number') slide.sectionNumber = value
  else if (slot === 'label') slide.factLabel = value
  else if (slot === 'attribution' && isRecord(value)) {
    if (value.attribution !== undefined) slide.attribution = value.attribution
    if (value.source !== undefined) slide.source = value.source
  } else slide[slot] = value
}

function hasContent(value: unknown) {
  return value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
