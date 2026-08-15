import { describe, expect, it } from 'vitest'
import { estimateCompositionCoverage } from './composition-coverage'

describe('composition coverage', () => {
  it('counts executable code as a substantial visual unit', () => {
    const coverage = estimateCompositionCoverage({
      nodeId: 'code-example', component: 'code', version: 1,
      props: { language: 'bash', code: '$ project verify --browser' },
    })
    expect(coverage.visualUnits).toBeGreaterThanOrEqual(8)
    expect(coverage.fillRatio).toBeGreaterThanOrEqual(0.4)
  })
})
