import deckSource from '../../decks/cadenza-demo/deck.cadenza.json' with { type: 'json' }
import type { RenderableDeckSlide } from '../rendering/core-templates'
import { parseDeckDocument, type DeckDocument } from '../core/deck-document'

const resolvedSource = resolveBundledAssets(deckSource)

export const demoDeckDocument: DeckDocument = parseDeckDocument(resolvedSource)

export const demoDeck: readonly RenderableDeckSlide[] = demoDeckDocument.outline.flatMap(item => (
  item.kind === 'slide'
    ? [demoDeckDocument.slides[item.slideId]]
    : item.slideIds.map(slideId => demoDeckDocument.slides[slideId])
))

function resolveBundledAssets(value: unknown): unknown {
  if (value === 'assets/cadenza-hero-one-bit-source.png') return '/cadenza-hero-one-bit-source.png'
  if (Array.isArray(value)) return value.map(resolveBundledAssets)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveBundledAssets(entry)]))
}
