import { describe, expect, it } from 'vitest'
import { motionFrameHasDetachedDecoration, resolveVisualFramePolicy, visualOneBitCacheKey, visualOneBitSelector } from './one-bit-visual'

describe('one-bit visual frame policy', () => {
  it('uses live frames only for visible animated stage visuals', () => {
    expect(resolveVisualFramePolicy({ profile: 'stage', visible: true, reducedMotion: false, animated: true })).toBe('active')
    for (const input of [
      { profile: 'thumbnail' as const, visible: true, reducedMotion: false, animated: true },
      { profile: 'export' as const, visible: true, reducedMotion: false, animated: true },
      { profile: 'stage' as const, visible: false, reducedMotion: false, animated: true },
      { profile: 'stage' as const, visible: true, reducedMotion: true, animated: true },
      { profile: 'stage' as const, visible: true, reducedMotion: false, animated: false },
    ]) expect(resolveVisualFramePolicy(input)).toBe('poster')
  })

  it('builds deterministic token, geometry and poster cache keys', () => {
    expect(visualOneBitCacheKey({ asset: 'icon:brain', state: 'default', timeMs: 0, width: 128, height: 128, paper: '#fff', ink: '#000', gridScale: 3 }))
      .toBe('icon:brain|default@0|128x128|#fff/#000|3')
    expect(visualOneBitSelector).toContain('one-bit-pixel')
  })

  it('rejects the detached rings and fly-out trails used by the old fake animations', () => {
    expect(motionFrameHasDetachedDecoration({ kind: 'ring', opacity: .7 })).toBe(true)
    expect(motionFrameHasDetachedDecoration({ kind: 'trail', opacity: .7 })).toBe(true)
    expect(motionFrameHasDetachedDecoration(null)).toBe(false)
  })
})
