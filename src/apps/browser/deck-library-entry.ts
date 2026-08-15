import { renderDeckLibrary, type DeckLibraryEntry } from './deck-library'
import { resolveUiLocale } from '../../i18n/ui-locale'

document.documentElement.dataset.appMode = 'decks'
const locale = resolveUiLocale(new URL(location.href), navigator.language)
document.documentElement.lang = locale
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = renderDeckLibrary([], undefined, locale, location.href)

try {
  const response = await fetch('/api/decks')
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) throw new Error(`Deck API unavailable (HTTP ${response.status})`)
  app.innerHTML = renderDeckLibrary(await response.json() as DeckLibraryEntry[], undefined, locale, location.href)
} catch (error) {
  app.innerHTML = renderDeckLibrary([], error instanceof Error ? error.message : String(error), locale, location.href)
}
