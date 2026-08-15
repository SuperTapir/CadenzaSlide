import type { CompositionNode } from './component-library.ts'

export interface CompositionCoverageEstimate {
  visualUnits: number
  fillRatio: number
}

/**
 * A semantic lower-bound estimate for how much of a composition frame can be
 * meaningfully occupied. Containers do not count: only visible content does.
 * The browser verifier remains the source of truth after rendering.
 */
export function estimateCompositionCoverage(tree: CompositionNode): CompositionCoverageEstimate {
  let visualUnits = 0
  walk(tree, node => {
    const props = node.props ?? {}
    switch (node.component) {
      case 'media': visualUnits += 12; break
      case 'metric': case 'quote': case 'code': visualUnits += 8; break
      case 'progress': visualUnits += 6; break
      case 'profile': visualUnits += 5; break
      case 'visual': visualUnits += node.axes?.prominence === 'hero' ? 10 : node.axes?.prominence === 'inline' ? 2 : 6; break
      case 'heading': visualUnits += 4; break
      case 'logo': visualUnits += 3; break
      case 'list': visualUnits += 2 + (Array.isArray(props.items) ? Math.min(6, props.items.length * 2) : 0); break
      case 'card': visualUnits += 1 + (typeof props.body === 'string' && props.body.trim() ? 2 : 0) + (typeof props.meta === 'string' && props.meta.trim() ? 0.5 : 0); break
      case 'copy': case 'caption': visualUnits += 2; break
      case 'divider': case 'connector': visualUnits += 1; break
    }
  })
  return { visualUnits, fillRatio: Math.min(1, Math.max(0.16, visualUnits / 18)) }
}

function walk(node: CompositionNode, visit: (node: CompositionNode) => void) {
  visit(node)
  node.children?.forEach(child => walk(child, visit))
  Object.values(node.slots ?? {}).flat().forEach(child => walk(child, visit))
}
