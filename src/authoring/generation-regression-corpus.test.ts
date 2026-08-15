import { describe, expect, it } from 'vitest'
import { collectProvidedContent, composeSlideCandidates, preflightCompositionCandidate } from './slide-composer'
import { generationRegressionCorpus } from '../../tests/fixtures/deck/generation-regression-corpus'

const input = { profile: 'stage' as const, frame: { width: 84, height: 68 }, format: 'html' as const }

describe('from-scratch cross-content generation corpus', () => {
  it.each(generationRegressionCorpus)('generates $kind candidates without deck-specific overrides', item => {
    const result = composeSlideCandidates(item.signals, { ...input, seed: item.id })
    expect(result.inputIssues).toEqual([])
    expect(result.candidates.length).toBeGreaterThanOrEqual(item.acceptance.minCandidates)
    expect(new Set(result.candidates.map(candidate => candidate.fingerprint)).size).toBeGreaterThanOrEqual(item.acceptance.minDistinctFingerprints)
    const candidate = result.candidates[0]
    expect(preflightCompositionCandidate(item.signals, candidate.tree, input)).toMatchObject({ ok: true, findings: [] })
    const serialized = JSON.stringify(candidate.tree)
    expect(item.acceptance.requiredComponents.every(component => serialized.includes(`"component":"${component}"`))).toBe(true)
    expect([...collectProvidedContent(item.signals).texts, ...collectProvidedContent(item.signals).sources].every(value => serialized.includes(value))).toBe(true)
    expect(serialized).not.toMatch(/"(?:x|y|width|height|style|color|opacity|transform)"/)
  })
})
