import { describe, expect, it } from 'vitest'
import { motionPresetIds, motionPresets } from './presets'

describe('Cadenza motion presets', () => {
  it('ships ten distinct, inspectable motion verbs', () => {
    expect(motionPresetIds).toEqual([
      'cut',
      'dissolve',
      'pass-left',
      'pass-up',
      'unfold',
      'focus',
      'land',
      'accumulate',
      'lock',
      'replace',
    ])
    expect(new Set(motionPresetIds).size).toBe(10)
    for (const id of motionPresetIds) {
      expect(motionPresets[id].label).not.toBe('')
      expect(motionPresets[id].description).not.toBe('')
      expect(motionPresets[id].durationMs).toBeGreaterThanOrEqual(0)
      expect(motionPresets[id].durationMs).toBeLessThanOrEqual(280)
    }
  })
})
