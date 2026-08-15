import { describe, expect, it } from 'vitest'
import { productionVisualAssets, visualGeometryById } from './catalog'
import { motionReadyVisuals, qualifyVisualMotionCatalog, resolveVisualMotionFrame, visualMotionPresets } from './motion'
import { validateCompositionTree, type CompositionNode } from '../authoring/component-library'
import { renderComposition } from '../rendering/component-renderer'

describe('Cadenza visual motion vocabulary', () => {
  it('qualifies only the curated animated production set', () => {
    expect(motionReadyVisuals).toHaveLength(48)
    expect(new Set(motionReadyVisuals.map(item => item.asset)).size).toBe(motionReadyVisuals.length)
    expect(motionReadyVisuals.filter(item => item.mode === 'loop').length).toBeGreaterThanOrEqual(10)
    expect(motionReadyVisuals.filter(item => item.mode === 'enter').length).toBeGreaterThanOrEqual(30)
    expect(motionReadyVisuals.filter(item => item.mode === 'morph')).toEqual([])
    for (const intent of ['create', 'search', 'edit', 'sync', 'growth', 'accumulate', 'confirm', 'warning', 'ai-thinking', 'completion']) {
      expect(motionReadyVisuals.some(item => item.intent === intent), intent).toBe(true)
    }
    expect(qualifyVisualMotionCatalog(motionReadyVisuals, productionVisualAssets, visualGeometryById)).toEqual([])
  })

  it('defines restrained timing, easing, loop and poster contracts for every semantic verb', () => {
    for (const preset of Object.values(visualMotionPresets)) {
      expect(preset.durationMs).toBeGreaterThanOrEqual(180)
      expect(preset.durationMs).toBeLessThanOrEqual(1600)
      expect(preset.easing).toMatch(/^cubic-bezier\(/)
      expect(['once', 'idle']).toContain(preset.loop)
      expect(preset.posterProgress).toBeGreaterThanOrEqual(0)
      expect(preset.posterProgress).toBeLessThanOrEqual(1)
    }
  })

  it('returns deterministic, bounded key frames with addressable body and accent parts', () => {
    const first = resolveVisualMotionFrame('focus', .5)
    expect(first).toEqual(resolveVisualMotionFrame('focus', .5))
    expect(first.moving.scale).toBeGreaterThan(1)

    for (const verb of Object.keys(visualMotionPresets) as Array<keyof typeof visualMotionPresets>) {
      for (const progress of [0, .25, .5, .75, 1]) {
        const frame = resolveVisualMotionFrame(verb, progress)
        expect(frame.moving.scale).toBeGreaterThanOrEqual(.72)
        expect(frame.moving.scale).toBeLessThanOrEqual(1.16)
        expect(frame.moving.opacity).toBeGreaterThanOrEqual(0)
        expect(frame.moving.opacity).toBeLessThanOrEqual(1)
      }
    }
  })

  it('renders representative enter and loop icons through vector and one-bit modes without detached decoration', () => {
    const representatives = [
      motionReadyVisuals.find(item => item.asset === 'icon:line-md-bell-loop'),
      motionReadyVisuals.find(item => item.asset === 'icon:line-md-account'),
      motionReadyVisuals.find(item => item.asset === 'icon:line-md-search'),
    ].filter((item): item is (typeof motionReadyVisuals)[number] => Boolean(item))
    for (const motion of representatives) {
      const asset = productionVisualAssets.find(candidate => candidate.id === motion.asset)!
      for (const treatment of [...new Set([asset.treatments[0], 'one-bit-pixel' as const])]) {
      const tree: CompositionNode = {
        nodeId: `motion-${motion.asset.slice(5)}-${treatment}`, component: 'visual', version: 1,
        props: { asset: motion.asset, alt: motion.intent },
        axes: { role: 'icon', prominence: 'support', treatment, state: asset.poster.state, behavior: motion.verb },
      }
      expect(validateCompositionTree(tree), `${motion.asset}/${treatment}`).toEqual([])
      const html = renderComposition(tree)
      expect(html).toContain('<svg')
      expect(html).toMatch(/<path|<circle|<rect/)
      expect(html).not.toContain('data-visual-motion-accent')
      }
    }
  })
})
