import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rules = JSON.parse(readFileSync(new URL('../../design-system/visual-assets/illustration-rules.json', import.meta.url), 'utf8')) as {
  version: string
  defaultScope: string
  useWhen: string[]
  avoidWhen: string[]
  requiredContractFields: string[]
  compositionRoles: Record<string, { max: number }>
  palette: { roles: string[], maxAccentCoverage: number }
  oneBitQualification: { minimumShortEdgePx: number, gridScales: number[], rejectionChecks: string[] }
  forbiddenStyles: string[]
  validationBriefs: Array<{ id: string, domain: string, contract: Record<string, unknown> }>
}

describe('Cadenza illustration authoring rules', () => {
  it('keeps generated illustrations deck-local and requires a concrete composition contract', () => {
    expect(rules.version).toMatch(/^1\./)
    expect(rules.defaultScope).toBe('deck-local')
    expect(rules.useWhen.length).toBeGreaterThanOrEqual(3)
    expect(rules.avoidWhen.length).toBeGreaterThanOrEqual(3)
    expect(rules.requiredContractFields).toEqual(expect.arrayContaining([
      'purpose', 'subject', 'figure', 'object', 'machine', 'annotation', 'focalPoint',
      'negativeSpace', 'palette', 'source', 'oneBitCase', 'rejectionReasons',
    ]))
  })

  it('limits visual roles and reserves accent for one semantic signal', () => {
    expect(Object.keys(rules.compositionRoles).sort()).toEqual(['annotation', 'figure', 'machine', 'object'])
    expect(rules.compositionRoles.figure.max).toBeLessThanOrEqual(3)
    expect(rules.compositionRoles.machine.max).toBe(1)
    expect(rules.palette.roles).toEqual(['paper', 'ink', 'accent'])
    expect(rules.palette.maxAccentCoverage).toBeLessThanOrEqual(.12)
  })

  it('defines executable one-bit rejection checks at presentation sizes', () => {
    expect(rules.oneBitQualification.minimumShortEdgePx).toBeGreaterThanOrEqual(320)
    expect(rules.oneBitQualification.gridScales).toEqual(expect.arrayContaining([1, 2, 3]))
    expect(rules.oneBitQualification.rejectionChecks).toEqual(expect.arrayContaining([
      'subject-silhouette-lost', 'semantic-object-merged', 'relationship-unreadable', 'accent-only-information',
    ]))
  })

  it('rejects generic SaaS illustration habits and validates three materially different briefs', () => {
    expect(rules.forbiddenStyles).toEqual(expect.arrayContaining([
      'generic-saas-blob-people', 'gradient-decoration', 'floating-ui-card-cloud', 'mascot-without-narrative-role',
    ]))
    expect(new Set(rules.validationBriefs.map(brief => brief.domain))).toEqual(new Set([
      'enterprise-strategy', 'technical-architecture', 'people-culture',
    ]))
    for (const brief of rules.validationBriefs) {
      expect(Object.keys(brief.contract)).toEqual(expect.arrayContaining(rules.requiredContractFields))
    }
  })
})
