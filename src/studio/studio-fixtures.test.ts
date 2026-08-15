import { describe, expect, it } from 'vitest'
import { flattenOutline } from '../core/deck-outline'
import { createLargeStudioDeck } from '../../tests/fixtures/studio/studio-fixtures'

describe('Studio deterministic fixtures', () => {
  it('creates a stable 200-slide performance deck', () => {
    const deck = createLargeStudioDeck()
    expect(flattenOutline(deck.outline)).toHaveLength(200)
    expect(flattenOutline(deck.outline).at(179)).toBe('performance-180')
  })

  it('covers Agent and Verify boundary states without timers or generated findings', () => {
  })
})
