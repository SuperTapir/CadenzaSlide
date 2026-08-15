import { describe, expect, it } from 'vitest'
import { revealHostOptions } from './reveal-options'

describe('Reveal host options', () => {
  it('runs as an embedded presentation so host UI remains scrollable', () => {
    expect(revealHostOptions.embedded).toBe(true)
    expect(revealHostOptions.hash).toBe(true)
    expect(revealHostOptions.center).toBe(false)
    expect(revealHostOptions.transition).toBe('none')
    expect(revealHostOptions.backgroundTransition).toBe('none')
    expect(revealHostOptions.viewDistance).toBe(1)
    expect(revealHostOptions.mobileViewDistance).toBe(1)
    expect(revealHostOptions.preloadIframes).toBe(false)
  })
})
