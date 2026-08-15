import type { CompositionNode } from './component-contract.ts'
import type { CompositionRhythm } from './slide-composer.ts'

export function compositionFingerprint(tree: CompositionNode): string {
  const axes = Object.entries(tree.axes ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join(',')
  const own = axes ? `${tree.component}(${axes})` : tree.component
  if (tree.children) return `${own}[${tree.children.map(compositionFingerprint).join('|')}]`
  const slots = Object.entries(tree.slots ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([slot, children]) => `${slot}:${children.map(compositionFingerprint).join('|')}`).join(';')
  return slots ? `${own}{${slots}}` : own
}

export function describeCompositionRhythm(tree: CompositionNode): CompositionRhythm {
  const dominantTree = tree.component === 'stack'
    && tree.children?.length === 2
    && tree.children[0].component === 'heading'
    && tree.children[1].component === 'split'
    ? tree.children[1]
    : tree
  const direction = dominantTree.axes?.direction
  const primaryAxis = direction === 'vertical' || direction === 'horizontal'
    ? direction
    : dominantTree.component === 'grid'
      ? 'grid'
      : dominantTree.component === 'overlay' || dominantTree.component === 'inset'
        ? 'layered'
        : dominantTree.component === 'cluster' || dominantTree.component === 'split'
          ? 'horizontal'
          : 'vertical'
  const axes = collectCompositionAxes(tree)
  const explicitDensity = axes.density.find(value => value === 'compact' || value === 'normal' || value === 'open')
  const gapDensity = axes.gap.find(value => value === 'compact' || value === 'normal' || value === 'open')
  const emphasis = axes.emphasis.find(value => value === 'quiet' || value === 'normal' || value === 'strong')
  return {
    fingerprint: compositionFingerprint(tree),
    primaryAxis,
    density: (explicitDensity ?? gapDensity ?? 'normal') as CompositionRhythm['density'],
    emphasis: (emphasis ?? 'normal') as CompositionRhythm['emphasis'],
  }
}


function collectCompositionAxes(tree: CompositionNode) {
  const values: Record<'density' | 'gap' | 'emphasis', string[]> = { density: [], gap: [], emphasis: [] }
  const walk = (node: CompositionNode) => {
    for (const axis of Object.keys(values) as Array<keyof typeof values>) {
      const value = node.axes?.[axis]
      if (typeof value === 'string') values[axis].push(value)
    }
    node.children?.forEach(walk)
    Object.values(node.slots ?? {}).flat().forEach(walk)
  }
  walk(tree)
  return values
}
