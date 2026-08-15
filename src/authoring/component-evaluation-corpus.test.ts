import { describe, expect, it } from 'vitest'
import { componentEvaluationCorpus } from './component-evaluation-corpus'
import { collectProvidedContent, composeSlideCandidates, validateSlideContentSignals } from './slide-composer'
import { validateCompositionTree } from './component-library'

describe('real composition evaluation corpus', () => {
  it('covers nine narrative families with explicit facts and no authored geometry', () => {
    expect(componentEvaluationCorpus.map(item => item.narrative)).toEqual([
      'business-summary', 'feature-explanation', 'comparison', 'steps', 'timeline', 'people', 'system-relationship', 'quote', 'media-narrative',
    ])
    expect(componentEvaluationCorpus.every(item => validateSlideContentSignals(item.signals).length === 0 && item.forbiddenInferences.length > 0)).toBe(true)
    expect(JSON.stringify(componentEvaluationCorpus)).not.toMatch(/"(?:x|y|width|height|frame|style|color|transform)"/)
  })

  it('generates multiple deterministic, legal and fact-complete candidates for every case', () => {
    const input = { profile: 'stage' as const, frame: { width: 84, height: 58 }, format: 'html' as const }
    for (const item of componentEvaluationCorpus) {
      const result = composeSlideCandidates(item.signals, input)
      expect(result, item.id).toEqual(composeSlideCandidates(item.signals, input))
      expect(result.candidates.length, item.id).toBeGreaterThanOrEqual(2)
      expect(new Set(result.candidates.map(candidate => candidate.fingerprint)).size, item.id).toBeGreaterThanOrEqual(2)
      const facts = collectProvidedContent(item.signals)
      for (const candidate of result.candidates) {
        expect(validateCompositionTree(candidate.tree), `${item.id}/${candidate.id}`).toEqual([])
        const serialized = JSON.stringify(candidate.tree)
        expect([...facts.texts, ...facts.sources].every(fact => serialized.includes(fact)), `${item.id}/${candidate.id}`).toBe(true)
        expect(item.requiredComponents.every(component => serialized.includes(`"component":"${component}"`)), `${item.id}/${candidate.id}`).toBe(true)
        expect(item.forbiddenInferences.some(inference => serialized.includes(inference)), `${item.id}/${candidate.id}`).toBe(false)
      }
    }
  })

  it('varies close legal structures across seeds and avoids adjacent repetition corpus-wide', () => {
    const input = { profile: 'stage' as const, frame: { width: 84, height: 58 }, format: 'html' as const }
    for (const item of componentEvaluationCorpus) {
      const seeded = [0, 1, 2].map(seed => composeSlideCandidates(item.signals, { ...input, seed }).candidates[0])
      expect(seeded.every(Boolean), item.id).toBe(true)
      expect(new Set(seeded.map(candidate => candidate.fingerprint)).size, item.id).toBeGreaterThanOrEqual(2)
      expect(seeded.every(candidate => candidate.usedSignalIds.join('|') === seeded[0].usedSignalIds.join('|')), item.id).toBe(true)

      const adjacent = composeSlideCandidates(item.signals, { ...input, adjacentRhythms: [seeded[0].rhythm] }).candidates[0]
      expect(adjacent.fingerprint, item.id).not.toBe(seeded[0].fingerprint)
    }
  })
})
