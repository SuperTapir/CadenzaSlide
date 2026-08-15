import { describe, expect, it } from 'vitest'
import { elementMotionIds, elementMotions, isElementMotionId } from './element-presets'

describe('element motion presets', () => {
  it('ships a stable, restrained vocabulary', () => {
    expect(elementMotionIds).toEqual(['appear', 'rise', 'unfold', 'accumulate', 'focus', 'draw', 'count', 'replace'])
    expect(Object.keys(elementMotions)).toEqual(elementMotionIds)
    expect(Math.max(...Object.values(elementMotions).map((preset) => preset.durationMs))).toBeLessThanOrEqual(280)
  })

  it('validates authored ids without accepting arbitrary strings', () => {
    expect(isElementMotionId('draw')).toBe(true)
    expect(isElementMotionId('bounce')).toBe(false)
    expect(isElementMotionId(undefined)).toBe(false)
  })
})
