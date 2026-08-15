import type { DeckDocument } from '../core/deck-document'
import { flattenOutline } from '../core/deck-outline'

const resumeSlide = 'resume-slide'
const resumeIndex = 'resume-index'
const resumeFragment = 'resume-fragment'

export type StudioReloadPosition = { slideId: string, outlineIndex: number, fragment: number }

export function isCurrentDeckFile(path: string, deckId: string) {
  const normalized = path.replaceAll('\\', '/')
  return normalized.endsWith(`/${deckId}/deck.cadenza.json`) || normalized === `${deckId}/deck.cadenza.json`
}

export function buildStudioReloadUrl(current: URL, position: StudioReloadPosition) {
  const url = new URL(current)
  url.searchParams.set(resumeSlide, position.slideId)
  url.searchParams.set(resumeIndex, String(position.outlineIndex))
  url.searchParams.set(resumeFragment, String(position.fragment))
  return url
}

export function resolveStudioResume(document: Readonly<DeckDocument>, current: URL) {
  const requestedSlide = current.searchParams.get(resumeSlide)
  if (!requestedSlide) return null
  const outline = flattenOutline(document.outline)
  if (!outline.length) return null
  const requestedIndex = Number(current.searchParams.get(resumeIndex) ?? 0)
  const exact = outline.indexOf(requestedSlide)
  const outlineIndex = exact >= 0 ? exact : Math.max(0, Math.min(Number.isFinite(requestedIndex) ? requestedIndex : 0, outline.length - 1))
  const requestedFragment = Number(current.searchParams.get(resumeFragment) ?? -1)
  return { outlineIndex, fragment: exact >= 0 && Number.isInteger(requestedFragment) ? requestedFragment : -1 }
}

export function clearStudioResume(current: URL) {
  const url = new URL(current)
  url.searchParams.delete(resumeSlide)
  url.searchParams.delete(resumeIndex)
  url.searchParams.delete(resumeFragment)
  return url
}
