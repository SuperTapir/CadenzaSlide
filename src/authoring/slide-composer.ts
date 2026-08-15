import {
  productionComponentDefinitions,
  type CompositionNode,
  type CompositionProfile,
} from './component-library.ts'
import { diagnoseComposition, resolveComposition } from './component-diagnosis.ts'
import { estimateCompositionCoverage, type CompositionCoverageEstimate } from './composition-coverage.ts'
import { productionVisualAssets, rankVisualAssets, type VisualBehavior, type VisualTreatment } from '../visual-assets/catalog.ts'
import { collectProvidedContent, deriveVisualIntent, validateSlideContentSignals, type SlideContentSignals } from './slide-content-signals.ts'
import { preflightCompositionCandidate } from './candidate-preflight.ts'
import { compositionFingerprint, describeCompositionRhythm } from './composition-ranking.ts'

export { collectProvidedContent, deriveVisualIntent, validateSlideContentSignals } from './slide-content-signals.ts'
export { preflightCompositionCandidate } from './candidate-preflight.ts'
export { compositionFingerprint, describeCompositionRhythm } from './composition-ranking.ts'
export type { SlideContentSignals } from './slide-content-signals.ts'

export interface SlideCompositionCandidate {
  id: string
  tree: CompositionNode
  usedSignalIds: string[]
  diagnosis: ReturnType<typeof diagnoseComposition>
  fingerprint: string
  rhythm: CompositionRhythm
  score: number
  repetitionPenalty: number
  coverage: CompositionCoverageEstimate
  explanation: { summary: string, reasons: string[] }
  visual?: VisualSelection
}

export interface VisualSelection {
  assetId: string
  family: string
  prominence: 'support'
  treatment: VisualTreatment
  behavior: VisualBehavior
  state: string
  semanticScore: number
  matchedTerms: string[]
}

export interface VisualPolicy {
  mode?: 'auto' | 'off'
  allowMotion?: boolean
  preferredBehavior?: Extract<VisualBehavior, 'enter' | 'loop' | 'emphasis'>
  history?: readonly VisualSelection[]
}

export interface CompositionRhythm {
  fingerprint: string
  primaryAxis: 'vertical' | 'horizontal' | 'grid' | 'layered'
  density: 'compact' | 'normal' | 'open'
  emphasis: 'quiet' | 'normal' | 'strong'
}

export interface SlideCompositionInput {
  profile: CompositionProfile
  frame: { width: number, height: number }
  format: 'html' | 'pptx'
  seed?: string | number
  avoidFingerprints?: readonly string[]
  adjacentRhythms?: readonly CompositionRhythm[]
  authoringPath?: 'composer' | 'custom' | 'template'
  visualPolicy?: VisualPolicy
}

export interface CandidatePreflightFinding {
  ruleId: 'content.signals' | 'composition.slot-contract' | 'composition.capacity' | 'composition.intrinsic.profile-budget' | 'composition.semantic-type-budget' | 'layout.content-coverage' | 'layout.region-balance' | 'content.signal-preservation' | 'visual.asset-contract' | 'visual.focus'
  severity: 'error'
  target: { slideId: string, componentId?: string, jsonPath?: string }
  message: string
  evidence: { kind: 'structured-candidate', paths?: string[], values?: Record<string, number | string> }
}

export interface CandidatePreflightResult {
  schemaVersion: 1
  ok: boolean
  findings: CandidatePreflightFinding[]
  recommendation?: { action: 'repair' | 'simplify' | 'split', reason: string, preserveSignalIds: string[], groups: Array<{ signalIds: string[] }> }
  requiredPostWriteChannels: ['document', 'render', 'geometry']
}

export interface SlideCompositionRejection { id: string, stage: 'slots' | 'capacity' | 'intrinsic' | 'profile-budget' | 'fidelity', reasons: string[], tree?: never }
export interface SlideCompositionRecommendation {
  action: 'repair-signals' | 'simplify' | 'split'
  reason: string
  preserveSignalIds: string[]
  groups: Array<{ signalIds: string[] }>
  tree?: never
}

export const compositionHardFilterOrder = ['signals', 'slots', 'capacity', 'intrinsic', 'profile-budget', 'tokens', 'fidelity'] as const

export function composeSlideCandidates(signals: SlideContentSignals, input: SlideCompositionInput) {
  const inputIssues = validateSlideContentSignals(signals)
  if (inputIssues.length) return {
    candidates: [] as SlideCompositionCandidate[], rejected: [] as SlideCompositionRejection[], inputIssues, filterOrder: [...compositionHardFilterOrder],
    recommendation: { action: 'repair-signals', reason: 'content signals must be valid before composition', preserveSignalIds: [], groups: [] } satisfies SlideCompositionRecommendation,
  }

  const inventory = collectProvidedContent(signals)
  const atoms = makeContentNodes(signals)
  const drafts = makeCandidateDrafts(signals.id, atoms, signals)
  const visual = selectVisual(signals, input.visualPolicy)
  if (visual) drafts.push(...(['right', 'left'] as const).flatMap(side => {
    const draft = makeVisualDraft(signals.id, atoms, signals, visual, side)
    return draft ? [draft] : []
  }))
  const candidates: SlideCompositionCandidate[] = []
  const rejected: SlideCompositionRejection[] = []
  for (const draft of drafts) {
    const preflight = preflightCompositionCandidate(signals, draft.tree, input)
    if (!preflight.ok) {
      rejected.push({
        id: draft.id,
        stage: preflight.findings.some(finding => finding.ruleId === 'composition.capacity' || finding.ruleId === 'layout.content-coverage' || finding.ruleId === 'layout.region-balance')
          ? 'capacity'
          : preflight.findings.some(finding => finding.ruleId === 'composition.intrinsic.profile-budget' || finding.ruleId === 'composition.semantic-type-budget')
            ? 'profile-budget'
            : preflight.findings.some(finding => finding.ruleId === 'content.signal-preservation') ? 'intrinsic' : 'slots',
        reasons: preflight.findings.map(finding => `${finding.ruleId}: ${finding.message}`),
      })
      continue
    }
    const diagnosis = diagnoseComposition(draft.tree, input)
    if (diagnosis.status === 'split' || diagnosis.status === 'fallback' || diagnosis.status === 'reject') {
      rejected.push({ id: draft.id, stage: 'profile-budget', reasons: diagnosis.reasons })
      continue
    }
    const coverage = estimateCompositionCoverage(draft.tree)
    if (isMajorCanvas(input.frame) && coverage.fillRatio < 0.35) {
      rejected.push({
        id: draft.id,
        stage: 'capacity',
        reasons: [`estimated meaningful fill is ${Math.round(coverage.fillRatio * 100)}%; a major content canvas requires at least 35%`],
      })
      continue
    }
    const resolved = resolveComposition(draft.tree, input)
    const unsupported = collectComponentIds(resolved.tree).filter(id => {
      const fidelity = productionComponentDefinitions.find(definition => definition.id === id)?.fidelity
      return input.format === 'html' ? fidelity?.html !== 'native' : fidelity?.pptx === 'unsupported'
    })
    if (unsupported.length) {
      rejected.push({ id: draft.id, stage: 'fidelity', reasons: unsupported.map(id => `${id} is unsupported for ${input.format}`) })
      continue
    }
    const ranking = scoreComposition(resolved.tree, diagnosis, signals, draft.visual)
    const fingerprint = compositionFingerprint(resolved.tree)
    candidates.push({
      id: draft.id,
      tree: resolved.tree,
      usedSignalIds: inventory.ids,
      diagnosis,
      fingerprint,
      rhythm: describeCompositionRhythm(resolved.tree),
      repetitionPenalty: 0,
      coverage,
      ...(draft.visual ? { visual: draft.visual } : {}),
      ...ranking,
    })
  }
  candidates.sort((left, right) => right.score - left.score || left.fingerprint.localeCompare(right.fingerprint) || left.id.localeCompare(right.id))
  applySeedVariation(candidates, input.seed)
  applyRepetitionPenalty(candidates, input.avoidFingerprints ?? [], input.adjacentRhythms ?? [])
  return {
    candidates, rejected, inputIssues, filterOrder: [...compositionHardFilterOrder],
    recommendation: candidates.length ? undefined : recommendRecovery(inventory.ids, input.frame, rejected),
  }
}

function isMajorCanvas(frame: { width: number, height: number }) {
  return frame.width >= 60 && frame.height >= 35
}

function scoreComposition(tree: CompositionNode, diagnosis: ReturnType<typeof diagnoseComposition>, signals: SlideContentSignals, visual?: VisualSelection) {
  const components = new Set(collectComponentIds(tree))
  const reasons: string[] = ['all provided facts passed hard filters']
  let score = 100 - diagnosis.cost / 10
  if (diagnosis.status === 'fit') { score += 10; reasons.push('fits the target profile without degradation') }
  else reasons.push('uses one finite compact degradation')
  if (signals.claim && signals.metrics?.length && components.has('split')) { score += 12; reasons.push('split preserves claim-to-metric hierarchy') }
  if (signals.claim && signals.media?.length && components.has('overlay')) { score += 14; reasons.push('overlay binds the provided claim to its media') }
  if ((signals.evidence?.length ?? 0) > 1 && components.has('grid')) { score += 9; reasons.push('grid exposes peer evidence consistently') }
  if (signals.sequence && components.has('stack')) { score += 8; reasons.push('stack preserves the provided order') }
  if (signals.relationships?.length && components.has('connector')) { score += 6; reasons.push('connector represents explicit content relationships') }
  if (visual && components.has('visual')) { score += 12; reasons.push('semantic visual supports abstract content without competing media') }
  return {
    score: Math.round(score * 100) / 100,
    explanation: { summary: `${tree.component} composition selected from production primitives`, reasons },
  }
}

function applySeedVariation(candidates: SlideCompositionCandidate[], seed: string | number | undefined) {
  if (seed === undefined || candidates.length < 2) return
  const closeCount = candidates.findIndex(candidate => candidates[0].score - candidate.score > 6)
  const size = closeCount === -1 ? candidates.length : closeCount
  if (size < 2) return
  const offset = seedValue(seed) % size
  candidates.splice(0, size, ...candidates.slice(0, size).map((_, index, close) => close[(index + offset) % size]))
}

function applyRepetitionPenalty(candidates: SlideCompositionCandidate[], avoidFingerprints: readonly string[], adjacentRhythms: readonly CompositionRhythm[]) {
  if ((!avoidFingerprints.length && !adjacentRhythms.length) || candidates.length < 2) return
  const avoided = new Set([...avoidFingerprints, ...adjacentRhythms.map(rhythm => rhythm.fingerprint)])
  const bestScore = Math.max(...candidates.map(candidate => candidate.score))
  const closeCount = candidates.filter(candidate => bestScore - candidate.score <= 6).length
  if (closeCount < 2) return
  const close = candidates.slice(0, closeCount).map((candidate, index) => {
    const repeated: string[] = []
    if (avoided.has(candidate.fingerprint)) repeated.push('fingerprint')
    if (adjacentRhythms.some(rhythm => rhythm.primaryAxis === candidate.rhythm.primaryAxis)) repeated.push('primary-axis')
    if (adjacentRhythms.some(rhythm => rhythm.density === candidate.rhythm.density)) repeated.push('density')
    if (adjacentRhythms.some(rhythm => rhythm.emphasis === candidate.rhythm.emphasis)) repeated.push('emphasis')
    candidate.repetitionPenalty = (repeated.includes('fingerprint') ? 6 : 0)
      + (repeated.includes('primary-axis') ? 3 : 0)
      + (repeated.includes('density') ? 1 : 0)
      + (repeated.includes('emphasis') ? 1 : 0)
    if (candidate.repetitionPenalty) candidate.explanation.reasons.push(`adjacent-page rhythm repetition: ${repeated.join(', ')}`)
    return { candidate, index }
  })
  close.sort((left, right) =>
    (right.candidate.score - right.candidate.repetitionPenalty) - (left.candidate.score - left.candidate.repetitionPenalty)
    || left.candidate.repetitionPenalty - right.candidate.repetitionPenalty
    || left.index - right.index,
  )
  candidates.splice(0, closeCount, ...close.map(item => item.candidate))
}

function seedValue(seed: string | number) {
  if (typeof seed === 'number') return Math.abs(Math.floor(seed))
  let value = 0
  for (const character of seed) value = (value * 31 + character.charCodeAt(0)) >>> 0
  return value
}

function recommendRecovery(signalIds: string[], frame: { width: number, height: number }, rejected: SlideCompositionRejection[]): SlideCompositionRecommendation {
  if (frame.width < 7.2 || frame.height < 4.8) return {
    action: 'simplify',
    reason: 'target frame is below the minimum intrinsic size; increase the frame or reduce content before composing',
    preserveSignalIds: [...signalIds],
    groups: signalIds.length ? [{ signalIds: [...signalIds] }] : [],
  }
  if (signalIds.length > 6 || rejected.some(candidate => candidate.stage === 'slots')) return {
    action: 'split',
    reason: 'no legal component tree can preserve all signals within current capacity',
    preserveSignalIds: [...signalIds],
    groups: chunk(signalIds, 6).map(group => ({ signalIds: group })),
  }
  return {
    action: 'simplify',
    reason: rejected.some(candidate => candidate.stage === 'capacity')
      ? 'provided content cannot meaningfully fill a major canvas; use a statement/section master, add real evidence, or reduce the composition frame'
      : 'no candidate passed intrinsic, budget, token, and fidelity filters',
    preserveSignalIds: [...signalIds],
    groups: signalIds.length ? [{ signalIds: [...signalIds] }] : [],
  }
}

function chunk<T>(values: readonly T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size))
}

function makeContentNodes(signals: SlideContentSignals): CompositionNode[] {
  const nodes: CompositionNode[] = []
  const occupied = new Set<string>()
  const add = (node: CompositionNode) => { occupied.add(node.nodeId); nodes.push(node) }
  if (signals.claim) add({ nodeId: signals.claim.id, component: 'heading', version: 1, props: { text: signals.claim.text, ...(signals.claim.source ? { eyebrow: signals.claim.source } : {}) } })
  for (const item of signals.evidence ?? []) add({ nodeId: item.id, component: 'card', version: 1, props: { title: item.text, ...(item.source ? { meta: item.source } : {}) } })
  for (const item of signals.metrics ?? []) add({ nodeId: item.id, component: 'metric', version: 1, props: { label: item.label, value: item.value, ...(item.source ? { source: item.source } : {}) } })
  if (signals.sequence) add({ nodeId: signals.sequence.id, component: 'list', version: 1, props: { items: [...signals.sequence.items], ordered: true } })
  for (const item of signals.media ?? []) {
    add({ nodeId: item.id, component: 'media', version: 1, props: { src: item.src, alt: item.alt, ...(item.caption ? { caption: item.caption } : {}) } })
    if (item.source) add({ nodeId: freshNodeId(occupied, `${item.id}-source-caption`), component: 'caption', version: 1, props: { text: item.caption ?? item.alt, source: item.source } })
  }
  for (const item of signals.quotes ?? []) add({ nodeId: item.id, component: 'quote', version: 1, props: { text: item.text, ...(item.author ? { author: item.author } : {}), ...(item.source ? { source: item.source } : {}) } })
  for (const item of signals.profiles ?? []) add({ nodeId: item.id, component: 'profile', version: 1, props: { name: item.name, ...(item.role ? { role: item.role } : {}), ...(item.bio ? { bio: item.bio } : {}), ...(item.avatar ? { avatar: item.avatar } : {}) } })
  for (const item of signals.logos ?? []) add({ nodeId: item.id, component: 'logo', version: 1, props: { name: item.name, ...(item.src ? { src: item.src } : {}), ...(item.alt ? { alt: item.alt } : {}) } })
  for (const [index, item] of (signals.relationships ?? []).entries()) add({
    nodeId: freshNodeId(occupied, `relation-${item.from}-${item.to}-${index}`), component: 'connector', version: 1,
    props: { from: item.from, to: item.to, ...(item.label ? { label: item.label } : {}) },
  })
  return nodes
}

function makeCandidateDrafts(slideId: string, atoms: CompositionNode[], signals: SlideContentSignals) {
  const drafts: Array<{ id: string, tree: CompositionNode, visual?: VisualSelection }> = []
  const occupied = new Set(atoms.map(node => node.nodeId))
  const copy = () => structuredClone(atoms)
  const rootId = (kind: string) => freshNodeId(occupied, `${slideId}-${kind}-root`)
  drafts.push({ id: `${slideId}-stack`, tree: { nodeId: rootId('stack'), component: 'stack', version: 1, axes: { gap: 'normal' }, children: copy() } })
  if (atoms.length > 1) drafts.push({ id: `${slideId}-stack-open`, tree: { nodeId: rootId('stack-open'), component: 'stack', version: 1, axes: { gap: 'open', density: 'open' }, children: copy() } })
  if (atoms.length > 1) {
    const preferredColumns = atoms.length > 6 ? '4' : atoms.length > 3 ? '3' : '2'
    const alternateColumns = preferredColumns === '2' ? '3' : '2'
    drafts.push({ id: `${slideId}-grid-${preferredColumns}`, tree: { nodeId: rootId(`grid-${preferredColumns}`), component: 'grid', version: 1, axes: { columns: preferredColumns, gap: 'normal', density: 'open' }, children: copy() } })
    drafts.push({ id: `${slideId}-grid-${alternateColumns}`, tree: { nodeId: rootId(`grid-${alternateColumns}`), component: 'grid', version: 1, axes: { columns: alternateColumns, gap: 'normal', density: 'open' }, children: copy() } })
  }
  if (atoms.length > 1) {
    const split = (suffix: string, axes: Record<string, unknown>, sharedClaim = false) => {
      const splitAtoms = copy()
      const heading = sharedClaim && signals.claim && splitAtoms.length > 2
        ? splitAtoms.splice(splitAtoms.findIndex(node => node.nodeId === signals.claim!.id), 1)[0]
        : undefined
      const primaryAtoms: CompositionNode[] = []
      const secondaryAtoms: CompositionNode[] = []
      let primaryUnits = 0
      let secondaryUnits = 0
      if (!heading) {
        const claim = signals.claim ? splitAtoms.splice(splitAtoms.findIndex(node => node.nodeId === signals.claim!.id), 1)[0] : splitAtoms.shift()!
        primaryAtoms.push(claim)
        primaryUnits = estimateCompositionCoverage(claim).visualUnits
      }
      for (const atom of splitAtoms) {
        const units = estimateCompositionCoverage(atom).visualUnits
        if (primaryUnits <= secondaryUnits) { primaryAtoms.push(atom); primaryUnits += units }
        else { secondaryAtoms.push(atom); secondaryUnits += units }
      }
      const slotTree = (side: 'primary' | 'secondary', values: CompositionNode[]) => {
        if (values.length === 1) {
          const value = values[0]
          return value.component === 'list'
            ? { ...value, axes: { ...value.axes, density: 'open' } }
            : value
        }
        return {
          nodeId: rootId(`split-${side}-${suffix}`), component: 'stack', version: 1 as const,
          axes: { gap: 'compact', density: 'open' }, children: values,
        }
      }
      const primary = slotTree('primary', primaryAtoms)
      const secondary = slotTree('secondary', secondaryAtoms)
      const splitTree: CompositionNode = { nodeId: rootId(`split-${suffix}`), component: 'split', version: 1, axes, slots: { primary: [primary], secondary: [secondary] } }
      drafts.push({
        id: `${slideId}-split-${suffix}`,
        tree: heading
          ? { nodeId: rootId(`split-${suffix}-with-claim`), component: 'stack', version: 1, axes: { gap: 'normal' }, children: [heading, splitTree] }
          : splitTree,
      })
    }
    split('wide', { ratio: '2:1', gap: 'normal', alignment: 'start' }, true)
    split('vertical', { direction: 'vertical', ratio: '1:2', gap: 'normal', alignment: 'start' })
  }
  if (signals.claim && signals.media?.length) {
    for (const position of ['bottom', 'top'] as const) {
      const overlayAtoms = copy()
      const heading = overlayAtoms.splice(overlayAtoms.findIndex(node => node.nodeId === signals.claim!.id), 1)[0]
      const media = overlayAtoms.splice(overlayAtoms.findIndex(node => node.nodeId === signals.media![0].id), 1)[0]
      const overlay: CompositionNode = { nodeId: rootId(`overlay-${position}`), component: 'overlay', version: 1, axes: { position, emphasis: 'strong' }, slots: { base: [media], overlay: [heading] } }
      drafts.push({ id: `${slideId}-overlay-${position}`, tree: overlayAtoms.length ? { nodeId: rootId(`overlay-stack-${position}`), component: 'stack', version: 1, children: [overlay, ...overlayAtoms] } : overlay })
    }
  }
  return drafts
}

function selectVisual(signals: SlideContentSignals, policy: VisualPolicy = {}): VisualSelection | undefined {
  const intent = deriveVisualIntent(signals)
  if (policy.mode === 'off' || !intent.shouldUseVisual) return undefined
  const behavior: VisualBehavior = policy.allowMotion && policy.preferredBehavior ? policy.preferredBehavior : 'none'
  const history = policy.history ?? []
  const sourceAssets = behavior === 'none'
    ? productionVisualAssets.filter(asset => asset.family?.startsWith('lucide:'))
    : productionVisualAssets.filter(asset => asset.family === 'line-md:animated')
  const match = rankVisualAssets(sourceAssets, {
    intent: intent.intent,
    kind: 'icon',
    behavior,
    avoidIds: history.map(item => item.assetId),
    avoidFamilies: history.slice(-2).map(item => item.family),
  })[0]
  if (!match) return undefined
  return {
    assetId: match.asset.id,
    family: match.asset.family ?? match.asset.id,
    prominence: 'support',
    treatment: match.asset.treatments.includes('outline') ? 'outline' : match.asset.treatments[0],
    behavior,
    state: match.asset.poster.state,
    semanticScore: match.score,
    matchedTerms: match.matchedTerms,
  }
}

function makeVisualDraft(slideId: string, atoms: CompositionNode[], signals: SlideContentSignals, visual: VisualSelection, side: 'left' | 'right') {
  const content = structuredClone(atoms)
  const headingIndex = signals.claim ? content.findIndex(node => node.nodeId === signals.claim!.id) : -1
  const heading = headingIndex >= 0 ? content.splice(headingIndex, 1)[0] : undefined
  if (!content.length) return undefined
  if (heading) content.unshift(heading)
  const occupied = new Set(atoms.map(node => node.nodeId))
  const nodeId = (suffix: string) => freshNodeId(occupied, `${slideId}-${side}-${suffix}`)
  const primary = content.length === 1 ? content[0] : {
    nodeId: nodeId('visual-content'), component: 'stack', version: 1 as const, axes: { gap: 'normal' }, children: content,
  }
  const visualNode: CompositionNode = {
    nodeId: nodeId('visual'), component: 'visual', version: 1,
    props: { asset: visual.assetId, alt: visualAssetAlt(visual.assetId) },
    axes: { role: 'icon', prominence: visual.prominence, treatment: visual.treatment, state: visual.state, behavior: visual.behavior },
  }
  const split: CompositionNode = {
    nodeId: nodeId('visual-split'), component: 'split', version: 1,
    axes: { direction: 'horizontal', ratio: side === 'right' ? '2:1' : '1:2', order: 'primary-first', alignment: 'start', gap: 'open', emphasis: 'normal' },
    slots: side === 'right' ? { primary: [primary], secondary: [visualNode] } : { primary: [visualNode], secondary: [primary] },
  }
  return { id: `${slideId}-semantic-visual-${side}`, tree: split, visual }
}

function visualAssetAlt(assetId: string) {
  return productionVisualAssets.find(asset => asset.id === assetId)?.label ?? assetId
}

function collectComponentIds(tree: CompositionNode) {
  const ids: string[] = []
  const walk = (node: CompositionNode) => {
    ids.push(node.component)
    node.children?.forEach(walk)
    Object.values(node.slots ?? {}).flat().forEach(walk)
  }
  walk(tree)
  return ids
}

function freshNodeId(occupied: Set<string>, base: string) {
  let candidate = base
  let suffix = 2
  while (occupied.has(candidate)) candidate = `${base}-${suffix++}`
  occupied.add(candidate)
  return candidate
}
