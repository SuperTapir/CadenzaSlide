import type { CompositionIssue } from './component-contract.ts'

export interface TextContentSignal { id: string, text: string, source?: string }
export interface MetricContentSignal { id: string, label: string, value: string | number, source?: string }
export interface SequenceContentSignal { id: string, items: string[] }
export interface MediaContentSignal { id: string, src: string, alt: string, caption?: string, source?: string }
export interface RelationshipContentSignal { from: string, to: string, label?: string }
export interface QuoteContentSignal { id: string, text: string, author?: string, source?: string }
export interface ProfileContentSignal { id: string, name: string, role?: string, bio?: string, avatar?: string }
export interface LogoContentSignal { id: string, name: string, src?: string, alt?: string }

export interface SlideContentSignals {
  id: string
  claim?: TextContentSignal
  evidence?: TextContentSignal[]
  metrics?: MetricContentSignal[]
  sequence?: SequenceContentSignal
  media?: MediaContentSignal[]
  quotes?: QuoteContentSignal[]
  profiles?: ProfileContentSignal[]
  logos?: LogoContentSignal[]
  relationships?: RelationshipContentSignal[]
}

export interface DerivedVisualIntent {
  intent: string
  shouldUseVisual: boolean
  hasStrongMedia: boolean
  prominence: 'support'
  behavior: 'none'
}


const stableIdPattern = /^[a-z0-9][a-z0-9-]*$/
const allowedFields = new Set(['id', 'claim', 'evidence', 'metrics', 'sequence', 'media', 'quotes', 'profiles', 'logos', 'relationships'])

export function validateSlideContentSignals(value: unknown): CompositionIssue[] {
  const issues: CompositionIssue[] = []
  if (!isRecord(value)) return [{ path: '$', message: 'slide content signals must be an object' }]
  for (const key of Object.keys(value)) if (!allowedFields.has(key)) issues.push({ path: key, message: 'unknown slide content signal field' })
  if (typeof value.id !== 'string' || !stableIdPattern.test(value.id)) issues.push({ path: 'id', message: 'slide signal ID must be stable kebab-case' })

  const ids = new Set<string>()
  let signalCount = 0
  const register = (signal: unknown, path: string, validate: (signal: Record<string, unknown>, path: string) => void) => {
    if (!isRecord(signal)) { issues.push({ path, message: 'content signal must be an object' }); return }
    signalCount++
    if (typeof signal.id !== 'string' || !stableIdPattern.test(signal.id)) issues.push({ path: `${path}.id`, message: 'content signal ID must be stable kebab-case' })
    else if (ids.has(signal.id)) issues.push({ path: `${path}.id`, message: 'content signal ID must be unique' })
    else ids.add(signal.id)
    validate(signal, path)
  }
  const textSignal = (signal: Record<string, unknown>, path: string) => {
    requireText(signal.text, `${path}.text`, 'content text is required', issues)
    optionalText(signal.source, `${path}.source`, issues)
  }

  if (value.claim !== undefined) register(value.claim, 'claim', textSignal)
  visitArray(value.evidence, 'evidence', issues, (signal, path) => register(signal, path, textSignal))
  visitArray(value.metrics, 'metrics', issues, (signal, path) => register(signal, path, (metric, metricPath) => {
    requireText(metric.label, `${metricPath}.label`, 'metric label is required', issues)
    if (!(typeof metric.value === 'string' && metric.value.trim()) && !(typeof metric.value === 'number' && Number.isFinite(metric.value))) issues.push({ path: `${metricPath}.value`, message: 'metric value is required' })
    optionalText(metric.source, `${metricPath}.source`, issues)
  }))
  if (value.sequence !== undefined) register(value.sequence, 'sequence', (sequence, path) => {
    if (!Array.isArray(sequence.items) || sequence.items.length < 1 || sequence.items.length > 12) issues.push({ path: `${path}.items`, message: 'sequence requires 1–12 items' })
    else if (sequence.items.some(item => typeof item !== 'string' || !item.trim())) issues.push({ path: `${path}.items`, message: 'sequence items must be non-empty strings' })
  })
  visitArray(value.media, 'media', issues, (signal, path) => register(signal, path, (media, mediaPath) => {
    requireText(media.src, `${mediaPath}.src`, 'media source is required', issues)
    requireText(media.alt, `${mediaPath}.alt`, 'media alternative text is required', issues)
    optionalText(media.caption, `${mediaPath}.caption`, issues)
    optionalText(media.source, `${mediaPath}.source`, issues)
  }))
  visitArray(value.quotes, 'quotes', issues, (signal, path) => register(signal, path, (quote, quotePath) => {
    requireText(quote.text, `${quotePath}.text`, 'quote text is required', issues)
    optionalText(quote.author, `${quotePath}.author`, issues)
    optionalText(quote.source, `${quotePath}.source`, issues)
  }))
  visitArray(value.profiles, 'profiles', issues, (signal, path) => register(signal, path, (profile, profilePath) => {
    requireText(profile.name, `${profilePath}.name`, 'profile name is required', issues)
    optionalText(profile.role, `${profilePath}.role`, issues)
    optionalText(profile.bio, `${profilePath}.bio`, issues)
    optionalText(profile.avatar, `${profilePath}.avatar`, issues)
  }))
  visitArray(value.logos, 'logos', issues, (signal, path) => register(signal, path, (logo, logoPath) => {
    requireText(logo.name, `${logoPath}.name`, 'logo name is required', issues)
    optionalText(logo.src, `${logoPath}.src`, issues)
    optionalText(logo.alt, `${logoPath}.alt`, issues)
  }))

  if (signalCount === 0) issues.push({ path: '$', message: 'at least one content signal is required' })
  const edges = new Set<string>()
  visitArray(value.relationships, 'relationships', issues, (relationship, path) => {
    if (!isRecord(relationship)) { issues.push({ path, message: 'relationship signal must be an object' }); return }
    for (const endpoint of ['from', 'to'] as const) if (typeof relationship[endpoint] !== 'string' || !ids.has(relationship[endpoint])) issues.push({ path: `${path}.${endpoint}`, message: 'relationship endpoint is not a provided content signal' })
    if (relationship.from === relationship.to && typeof relationship.from === 'string') issues.push({ path: `${path}.to`, message: 'relationship endpoints must be distinct' })
    optionalText(relationship.label, `${path}.label`, issues)
    if (typeof relationship.from === 'string' && typeof relationship.to === 'string') {
      const edge = `${relationship.from}\u0000${relationship.to}`
      if (edges.has(edge)) issues.push({ path, message: 'duplicate relationship is not allowed' })
      else edges.add(edge)
    }
  })
  return issues
}

export function collectProvidedContent(value: SlideContentSignals) {
  const ids: string[] = []
  const texts: string[] = []
  const sources: string[] = []
  const sourceSet = new Set<string>()
  const source = (item: { source?: string }) => {
    if (item.source && !sourceSet.has(item.source)) { sourceSet.add(item.source); sources.push(item.source) }
  }
  if (value.claim) { ids.push(value.claim.id); texts.push(value.claim.text); source(value.claim) }
  for (const item of value.evidence ?? []) { ids.push(item.id); texts.push(item.text); source(item) }
  for (const item of value.metrics ?? []) { ids.push(item.id); texts.push(item.label, String(item.value)); source(item) }
  if (value.sequence) { ids.push(value.sequence.id); texts.push(...value.sequence.items) }
  for (const item of value.media ?? []) { ids.push(item.id); texts.push(item.alt); if (item.caption) texts.push(item.caption); source(item) }
  for (const item of value.quotes ?? []) { ids.push(item.id); texts.push(item.text); if (item.author) texts.push(item.author); source(item) }
  for (const item of value.profiles ?? []) { ids.push(item.id); texts.push(item.name); if (item.role) texts.push(item.role); if (item.bio) texts.push(item.bio) }
  for (const item of value.logos ?? []) { ids.push(item.id); texts.push(item.name); if (item.alt) texts.push(item.alt) }
  for (const item of value.relationships ?? []) if (item.label) texts.push(item.label)
  return { ids, texts, sources }
}

export function deriveVisualIntent(signals: SlideContentSignals): DerivedVisualIntent {
  const inventory = collectProvidedContent(signals)
  const hasStrongMedia = Boolean(signals.media?.length || signals.profiles?.length || signals.logos?.length || (signals.metrics?.length ?? 0) >= 2 || signals.relationships?.length)
  return {
    intent: inventory.texts.join(' '),
    shouldUseVisual: !hasStrongMedia && inventory.ids.length >= 2,
    hasStrongMedia,
    prominence: 'support',
    behavior: 'none',
  }
}


function visitArray(value: unknown, path: string, issues: CompositionIssue[], visit: (item: unknown, path: string) => void) {
  if (value === undefined) return
  if (!Array.isArray(value)) { issues.push({ path, message: 'must be an array' }); return }
  value.forEach((item, index) => visit(item, `${path}[${index}]`))
}

function requireText(value: unknown, path: string, message: string, issues: CompositionIssue[]) {
  if (typeof value !== 'string' || !value.trim()) issues.push({ path, message })
}

function optionalText(value: unknown, path: string, issues: CompositionIssue[]) {
  if (value !== undefined && (typeof value !== 'string' || !value.trim())) issues.push({ path, message: 'must be a non-empty string when provided' })
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
