import { BrowserDeckRepository } from '../../platform/browser/browser-deck-repository'

export async function openBrowserDeck(currentUrl: URL, allowDevelopmentFallback = import.meta.env.DEV) {
  if (currentUrl.searchParams.get('source') === 'demo') return openDemoDeck()
  try {
    return await BrowserDeckRepository.open(currentUrl)
  } catch (error) {
    if (!allowDevelopmentFallback) throw error
    return openDemoDeck()
  }
}

async function openDemoDeck() {
  const { demoDeckDocument } = await import('../../examples/demo-deck')
  return BrowserDeckRepository.memory(demoDeckDocument)
}
