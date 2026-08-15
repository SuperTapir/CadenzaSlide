import { flattenOutline } from '../../../src/core/deck-outline'
import type { DeckDocument } from '../../../src/core/deck-document'
import { demoDeckDocument } from '../../../src/examples/demo-deck'

export function createLargeStudioDeck(size = 200): DeckDocument {
  const sourceId = flattenOutline(demoDeckDocument.outline)[0]
  const source = demoDeckDocument.slides[sourceId]
  const slides = Object.fromEntries(Array.from({ length: size }, (_, index) => {
    const id = `performance-${String(index + 1).padStart(3, '0')}`
    return [id, { ...structuredClone(source), id, label: `Performance slide ${index + 1}` }]
  }))
  return {
    ...structuredClone(demoDeckDocument),
    id: 'performance-200',
    title: '200 page performance fixture',
    slides,
    outline: Object.keys(slides).map(slideId => ({ kind: 'slide' as const, slideId })),
  }
}
