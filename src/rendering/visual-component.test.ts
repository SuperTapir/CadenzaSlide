import { describe, expect, it } from 'vitest'
import { validateCompositionTree, type CompositionNode } from '../authoring/component-library'
import { renderComposition } from './component-renderer'

const visual = (overrides: Partial<CompositionNode> = {}): CompositionNode => ({
  nodeId: 'visual-bell',
  component: 'visual',
  version: 1,
  props: { asset: 'icon:line-md-bell-loop', alt: '通知铃响' },
  axes: { role: 'icon', prominence: 'support', treatment: 'one-bit-pixel', state: 'default', behavior: 'loop' },
  ...overrides,
})

describe('production visual component', () => {
  it('validates registered asset capabilities and rejects unknown or incompatible axes', () => {
    expect(validateCompositionTree(visual())).toEqual([])
    expect(validateCompositionTree(visual({ props: { asset: 'icon:unknown', alt: 'Unknown' } }))).toContainEqual({
      path: 'props.asset', message: 'visual asset is not registered for production',
    })
    expect(validateCompositionTree(visual({ axes: { role: 'companion', prominence: 'support', treatment: 'duotone', state: 'thinking', behavior: 'draw' } }))).toEqual(expect.arrayContaining([
      { path: 'axes.role', message: 'visual role does not match registered asset kind icon' },
      { path: 'axes.treatment', message: 'visual treatment is not supported by icon:line-md-bell-loop' },
      { path: 'axes.state', message: 'visual state is not supported by icon:line-md-bell-loop' },
      { path: 'axes.behavior', message: 'visual behavior is not supported by icon:line-md-bell-loop' },
    ]))
  })

  it('renders trusted catalog geometry with stable capture metadata', () => {
    const html = renderComposition(visual())
    expect(html).toContain('data-cadenza-component="visual"')
    expect(html).toContain('data-visual-asset="icon:line-md-bell-loop"')
    expect(html).toContain('data-visual-family="line-md:animated"')
    expect(html).toContain('data-axis-behavior="loop"')
    expect(html).toContain('data-visual-part="body"')
    expect(html).not.toContain('data-visual-part="accent"')
    expect(html).toContain('<svg viewBox="0 0 24 24"')
    expect(html).toContain('<animateTransform')
    expect(html).toContain('aria-label="通知铃响"')
    expect(html).not.toContain('<script')
  })
})
