import { describe, expect, it } from 'vitest'
import { createDefaultDeckMaster } from '../core/deck-master'
import type { DeckDocument } from '../core/deck-document'
import { buildStudioReloadUrl, isCurrentDeckFile, resolveStudioResume } from './studio-deck-updates'

const document: DeckDocument = {
  version: 1 as const,
  id: 'demo',
  title: 'Demo',
  status: 'complete' as const,
  master: createDefaultDeckMaster(),
  slides: {
    intro: { id: 'intro', role: 'content' as const, layout: 'blank', label: 'Intro', ariaLabel: 'Intro' },
    reference: { id: 'reference', role: 'content' as const, layout: 'blank', label: 'Reference', ariaLabel: 'Reference' },
  },
  outline: [{ kind: 'slide' as const, slideId: 'intro' }, { kind: 'slide' as const, slideId: 'reference' }],
}

describe('Studio deck updates', () => {
  it('matches only the current deck authority file', () => {
    expect(isCurrentDeckFile('decks/demo/deck.cadenza.json', 'demo')).toBe(true)
    expect(isCurrentDeckFile('decks/other/deck.cadenza.json', 'demo')).toBe(false)
    expect(isCurrentDeckFile('decks/demo/assets/poster.png', 'demo')).toBe(false)
  })

  it('round-trips stable slide, outline index, and fragment through reload URL', () => {
    const url = buildStudioReloadUrl(new URL('http://local/?view=studio&deck=demo'), { slideId: 'reference', outlineIndex: 1, fragment: 2 })
    expect(resolveStudioResume(document, url)).toEqual({ outlineIndex: 1, fragment: 2 })
  })

  it('falls back to the nearest valid outline index when the slide was deleted', () => {
    const url = buildStudioReloadUrl(new URL('http://local/?view=studio&deck=demo'), { slideId: 'removed', outlineIndex: 8, fragment: 3 })
    expect(resolveStudioResume(document, url)).toEqual({ outlineIndex: 1, fragment: -1 })
  })
})
