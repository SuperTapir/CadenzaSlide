import { describe, expect, it } from 'vitest'
import { composeSlideCandidates, type VisualSelection } from '../authoring/slide-composer'
import { validateCompositionTree } from '../authoring/component-library'
import { diagnoseComposition } from '../authoring/component-diagnosis'
import { renderComposition } from '../rendering/component-renderer'
import { visualRegressionCorpus } from '../../tests/fixtures/visual-assets/visual-regression-corpus'

describe('multi-domain visual authoring regression corpus', () => {
  it('selects one semantic Lucide focus with varied families across five presentation domains', () => {
    const history: VisualSelection[] = []
    for (const fixture of visualRegressionCorpus) {
      const result = composeSlideCandidates(fixture.signals, {
        profile: 'stage', frame: { width: 84, height: 58 }, format: 'html', visualPolicy: { mode: 'auto', history },
      })
      const candidate = result.candidates[0]
      expect(candidate, fixture.domain).toBeDefined()
      expect(candidate.visual, fixture.domain).toMatchObject({ assetId: expect.stringMatching(/^icon:lucide-/), behavior: 'none', prominence: 'support' })
      expect(fixture.expectedFamilies, fixture.domain).toContain(candidate.visual!.family)
      expect(JSON.stringify(candidate.tree).match(/"component":"visual"/g), fixture.domain).toHaveLength(1)
      expect(validateCompositionTree(candidate.tree), fixture.domain).toEqual([])
      expect(renderComposition(candidate.tree), fixture.domain).toContain(`data-visual-asset="${candidate.visual!.assetId}"`)
      expect(diagnoseComposition(candidate.tree, { profile: 'thumbnail', frame: { width: 84, height: 58 } }).status, fixture.domain).not.toBe('reject')
      history.push(candidate.visual!)
    }
    expect(new Set(history.map(selection => selection.assetId)).size).toBe(history.length)
    expect(new Set(history.map(selection => selection.family)).size).toBeGreaterThanOrEqual(4)
  })
})
