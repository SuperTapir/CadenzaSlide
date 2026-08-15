import { describe, expect, it } from 'vitest'
import { resolveSmilPlaybackPolicy } from './smil-visual'

describe('Line MD native SVG playback policy', () => {
  it('plays only a visible stage and freezes thumbnails, exports and reduced motion', () => {
    expect(resolveSmilPlaybackPolicy({ profile: 'stage', visible: true, reducedMotion: false, behavior: 'loop' })).toBe('active')
    for (const profile of ['thumbnail', 'export'] as const) {
      expect(resolveSmilPlaybackPolicy({ profile, visible: true, reducedMotion: false, behavior: 'loop' })).toBe('poster')
    }
    expect(resolveSmilPlaybackPolicy({ profile: 'stage', visible: false, reducedMotion: false, behavior: 'enter' })).toBe('poster')
    expect(resolveSmilPlaybackPolicy({ profile: 'stage', visible: true, reducedMotion: true, behavior: 'loop' })).toBe('poster')
  })
})
