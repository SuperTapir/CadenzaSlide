import { describe, expect, it } from 'vitest'
import { shouldRenderContinuously } from './render-policy'

describe('render motion policy', () => {
  it('only keeps a frame chain for a playing loop or active scene transition', () => {
    expect(shouldRenderContinuously({ mode: 'static', playing: true })).toBe(false)
    expect(shouldRenderContinuously({ mode: 'loop', playing: false })).toBe(false)
    expect(shouldRenderContinuously({ mode: 'loop', playing: true })).toBe(true)
  })
})
