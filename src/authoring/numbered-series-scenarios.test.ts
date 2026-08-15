import { describe, expect, it } from 'vitest'
import { validateCompositionTree } from './component-library'
import { numberedSeriesComposition, numberedSeriesScenarioCatalog } from './numbered-series-scenarios'

describe('numbered-series scenario library', () => {
  it('qualifies every promoted scenario with two materially different fixtures', () => {
    expect(numberedSeriesScenarioCatalog.map(entry => entry.id)).toEqual([
      'series-peer-panels',
      'series-ordered-gates',
      'series-evidence-split',
      'series-asymmetric-evidence',
      'series-code-contract',
    ])
    for (const entry of numberedSeriesScenarioCatalog) {
      expect(entry.fixtures.length, entry.id).toBeGreaterThanOrEqual(2)
      expect(new Set(entry.fixtures.map(fixture => fixture.topic)).size, entry.id).toBeGreaterThanOrEqual(2)
      for (const fixture of entry.fixtures) expect(validateCompositionTree(fixture.tree), `${entry.id}/${fixture.id}`).toEqual([])
    }
  })

  it('uses one master-owned content frame for every copied scenario', () => {
    const result = numberedSeriesComposition('responsibility-panels', numberedSeriesScenarioCatalog[0].fixtures[0].tree)
    expect(result.frame).toEqual({ x: 6, y: 35, width: 88, height: 49 })
    expect(() => numberedSeriesComposition('Not Stable', numberedSeriesScenarioCatalog[0].fixtures[0].tree)).toThrow(/kebab-case/)
  })

  it('keeps geometry, colours and executable fields out of scenario inputs', () => {
    expect(JSON.stringify(numberedSeriesScenarioCatalog)).not.toMatch(/"(?:x|y|width|height|style|color|script|renderer)"/)
  })

  it('treats evidence split as a follow-up proof page instead of a repeated point page', () => {
    const evidence = numberedSeriesScenarioCatalog.find(entry => entry.id === 'series-evidence-split')!
    expect(`${evidence.description} ${evidence.applicableWhen}`).toMatch(/展开|后续|上一页/)
    expect(evidence.failureConditions.join(' ')).toMatch(/重复|复述/)
  })

  it('requires every promoted code sample to explain its action and observable result', () => {
    const code = numberedSeriesScenarioCatalog.find(entry => entry.id === 'series-code-contract')!
    expect(code.failureConditions.join(' ')).toMatch(/虚构|来源|结果|通过/)
    for (const fixture of code.fixtures) {
      const nodes: any[] = []
      const visit = (node: any) => {
        nodes.push(node)
        node.children?.forEach(visit)
        Object.values(node.slots ?? {}).flat().forEach(visit)
      }
      visit(fixture.tree)
      expect(nodes.filter(node => node.component === 'code').every(node => node.props?.caption?.trim())).toBe(true)
      expect(JSON.stringify(fixture.tree)).not.toMatch(/\$ (?:project|pipeline) /)
    }
  })
})
