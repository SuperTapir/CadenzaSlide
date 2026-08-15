import registrySource from '../../design-system/custom/registry.json' with { type: 'json' }
import type { SlideObject } from './deck-master.ts'

export const customLayoutIds = ['custom:architecture-map', 'custom:numbered-series'] as const
export type CustomLayoutId = typeof customLayoutIds[number]

export interface CustomArchitectureMapSlide {
  id: string
  layout: 'custom:architecture-map'
  role: 'content'
  label: string
  title: string[]
  body: string
  notes?: string
  nodes: Array<{ label: string, detail: string }>
}

export interface CustomNumberedSeriesSlide {
  id: string
  layout: 'custom:numbered-series'
  role: 'content' | 'recap' | 'summary'
  label: string
  title: string[]
  subtitle?: string
  seriesNumber: string
  seriesLabel: string
  notes?: string
  objects?: SlideObject[]
}

export type CustomSlide = CustomArchitectureMapSlide | CustomNumberedSeriesSlide

export interface CustomRegistryEntry {
  id: CustomLayoutId
  kind: 'layout'
  label: string
  description: string
  renderer: string
  fixture: Record<string, unknown>
}

export const customRegistry = parseCustomRegistry(registrySource)

export function isCustomLayoutId(value: string | undefined): value is CustomLayoutId {
  return value !== undefined && (customLayoutIds as readonly string[]).includes(value)
}

export function isCustomSlide(slide: { layout: string }): slide is CustomSlide {
  return isCustomLayoutId(slide.layout)
}

export function renderCustomSlide(slide: CustomSlide) {
  if (slide.layout === 'custom:numbered-series') return renderNumberedSeries(slide)
  const nodes = slide.nodes.map((node, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(node.label)}</strong><p>${escapeHtml(node.detail)}</p></li>`).join('')
  return `<div class="slide-chrome custom-architecture-map"><h2>${slide.title.map(escapeHtml).join('<br>')}</h2><p class="component-body">${escapeHtml(slide.body)}</p><ol>${nodes}</ol></div>`
}

function renderNumberedSeries(slide: CustomNumberedSeriesSlide) {
  const navigation = Array.from({ length: 8 }, (_, index) => String(index + 1).padStart(2, '0')).map(step => `<span data-series-step="${step}" data-state="${step === slide.seriesNumber ? 'active' : 'idle'}">${step}</span>`).join('')
  return `<div class="slide-chrome custom-numbered-series" data-series-number="${escapeHtml(slide.seriesNumber)}"><header class="numbered-series-header"><p>${escapeHtml(slide.seriesLabel)}</p><strong>${escapeHtml(slide.seriesNumber)}</strong><h2>${slide.title.map(line => `<span>${escapeHtml(line)}</span>`).join('')}</h2>${slide.subtitle ? `<div>${escapeHtml(slide.subtitle)}</div>` : ''}</header><span class="numbered-series-content-region" aria-hidden="true"></span><nav class="numbered-series-nav" aria-label="系列进度">${navigation}</nav></div>`
}

function parseCustomRegistry(value: unknown): readonly CustomRegistryEntry[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries)) throw new Error('custom.registry: expected version 1 entries')
  const entries = value.entries.map((entry, index) => {
    if (!isRecord(entry) || !isCustomLayoutId(typeof entry.id === 'string' ? entry.id : undefined) || entry.kind !== 'layout' || typeof entry.label !== 'string' || typeof entry.description !== 'string' || typeof entry.renderer !== 'string' || !isRecord(entry.fixture)) {
      throw new Error(`custom.registry: invalid entry at $.entries[${index}]`)
    }
    return entry as unknown as CustomRegistryEntry
  })
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('custom.registry: duplicate id')
  return entries
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;') }
