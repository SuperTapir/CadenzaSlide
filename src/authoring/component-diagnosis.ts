import { productionComponentDefinitions, validateCompositionTree } from './component-library.ts'
import type { CompositionDiagnosis, CompositionNode, CompositionProfile } from './component-contract.ts'

export const compositionBudgetProfiles = {
  stage: { version: 1, softDensity: 140, hardDensity: 220, softCost: 120, hardCost: 180 },
  thumbnail: { version: 1, softDensity: 55, hardDensity: 90, softCost: 45, hardCost: 70 },
  export: { version: 1, softDensity: 120, hardDensity: 180, softCost: 100, hardCost: 150 },
} as const satisfies Record<CompositionProfile, Record<string, number>>

export function estimateComposition(tree: CompositionNode, frame: { width: number, height: number }) {
  let nodeCount = 0
  let textLength = 0
  let relationshipCount = 0
  let mediaCount = 0
  let compactCount = 0
  walkComposition(tree, node => {
    nodeCount++
    textLength += textContent(node.props).length
    const definition = productionComponentDefinitions.find(item => item.id === node.component)
    if (definition?.category === 'relationship') relationshipCount++
    if (node.component === 'media' || node.component === 'visual') mediaCount++
    if (node.axes?.density === 'compact') compactCount++
  })
  const area = Math.max(1, frame.width * frame.height)
  const compactFactor = compactCount ? Math.max(0.72, 1 - compactCount / Math.max(1, nodeCount) * 0.2) : 1
  return {
    nodeCount,
    textLength,
    density: Math.round((textLength * 120 / area + nodeCount * 6) * compactFactor),
    cost: nodeCount * 4 + Math.ceil(textLength / 40) + relationshipCount * 4 + mediaCount * 15,
  }
}

export function diagnoseComposition(tree: CompositionNode, input: { profile: CompositionProfile, frame: { width: number, height: number } }): CompositionDiagnosis {
  const issues = validateCompositionTree(tree)
  if (issues.length) return { status: 'reject', reasons: issues.map(issue => `${issue.path}: ${issue.message}`), profile: input.profile, density: 0, cost: 0, rendered: false }
  const estimate = estimateComposition(tree, input.frame)
  const budget = compositionBudgetProfiles[input.profile]
  const root = productionComponentDefinitions.find(item => item.id === tree.component)!
  const widthRatio = input.frame.width / root.constraints.minWidth
  const heightRatio = input.frame.height / root.constraints.minHeight
  if (widthRatio < 0.6 || heightRatio < 0.6 || estimate.density > budget.hardDensity || estimate.cost > budget.hardCost) {
    return { status: 'split', reasons: ['composition exceeds hard frame, density, or cost limits'], profile: input.profile, ...estimate, rendered: false }
  }
  if (widthRatio < 1 || heightRatio < 1 || estimate.density > budget.softDensity || estimate.cost > budget.softCost) {
    return { status: 'compress', reasons: ['apply one compact token-safe degradation before rendering'], profile: input.profile, ...estimate, rendered: false }
  }
  return { status: 'fit', reasons: [], profile: input.profile, ...estimate, rendered: false }
}

export function resolveComposition(tree: CompositionNode, input: { profile: CompositionProfile, frame: { width: number, height: number } }) {
  const diagnosis = diagnoseComposition(tree, input)
  if (diagnosis.status !== 'compress') return { tree: structuredClone(tree), diagnosis, steps: [] }
  const resolved = structuredClone(tree)
  walkComposition(resolved, node => {
    const definition = productionComponentDefinitions.find(item => item.id === node.component)
    for (const axis of ['gap', 'density'] as const) if (definition?.axes[axis]?.includes('compact')) node.axes = { ...(node.axes ?? {}), [axis]: 'compact' }
  })
  return {
    tree: resolved,
    diagnosis: diagnoseComposition(resolved, input),
    steps: [{ reason: 'applied compact Cadenza axes', informationLoss: 'visual' as const }],
  }
}


export function assessCompositionFidelity(tree: CompositionNode) {
  const issues = validateCompositionTree(tree)
  if (issues.length) throw new Error(`Invalid Cadenza composition fidelity request: ${issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`)
  const unsupportedComponents = new Set<string>()
  let pptxRank = 0
  walkComposition(tree, node => {
    const fidelity = productionComponentDefinitions.find(definition => definition.id === node.component)!.fidelity
    if (fidelity.pptx === 'unsupported') { pptxRank = 2; unsupportedComponents.add(node.component) }
    else if (fidelity.pptx === 'shapes') pptxRank = Math.max(pptxRank, 1)
  })
  const pptx: 'native' | 'shapes' | 'unsupported' = (['native', 'shapes', 'unsupported'] as const)[pptxRank] ?? 'unsupported'
  return { html: 'native' as const, pptx, editable: pptx !== 'unsupported', rasterized: false as const, unsupportedComponents: [...unsupportedComponents].sort() }
}

export function prepareCompositionExport(tree: CompositionNode, format: 'html' | 'pptx') {
  const fidelity = assessCompositionFidelity(tree)
  const status = format === 'html' ? fidelity.html : fidelity.pptx
  if (status === 'unsupported') throw new Error(`Composition export blocked for ${format}: ${fidelity.unsupportedComponents.join(', ')}`)
  return {
    tree: structuredClone(tree),
    renderer: format === 'html' ? 'native-dom' as const : status === 'native' ? 'native-pptx' as const : 'editable-shapes' as const,
    editable: true as const,
    rasterized: false as const,
  }
}


function walkComposition(node: CompositionNode, visit: (node: CompositionNode) => void) {
  visit(node)
  node.children?.forEach(child => walkComposition(child, visit))
  Object.values(node.slots ?? {}).flat().forEach(child => walkComposition(child, visit))
}

function textContent(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(textContent).join(' ')
  if (isRecord(value)) return Object.values(value).map(textContent).join(' ')
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
