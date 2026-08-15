import { renderDeckLibrary, type DeckLibraryEntry } from './deck-library'

document.documentElement.dataset.appMode = 'decks'
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = renderDeckLibrary([])

try {
  const response = await fetch('/api/decks')
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) throw new Error(`Deck API unavailable (HTTP ${response.status})`)
  app.innerHTML = renderDeckLibrary(await response.json() as DeckLibraryEntry[])
} catch (error) {
  app.innerHTML = renderDeckLibrary([], error instanceof Error ? error.message : String(error))
}
