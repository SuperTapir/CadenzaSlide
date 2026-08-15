import { BrowserDeckRepository } from '../../platform/browser/browser-deck-repository'
import { normalizeUiLocale, resolveUiLocale } from '../../i18n/ui-locale'

export async function openBrowserDeck(currentUrl: URL, allowDevelopmentFallback = import.meta.env.DEV) {
  if (currentUrl.searchParams.get('source') === 'demo') return openDemoDeck(normalizeUiLocale(currentUrl.searchParams.get('demo')) ?? resolveUiLocale(currentUrl))
  try {
    return await BrowserDeckRepository.open(currentUrl)
  } catch (error) {
    if (!allowDevelopmentFallback) throw error
    return openDemoDeck()
  }
}

async function openDemoDeck(locale: ReturnType<typeof resolveUiLocale> = 'zh-CN') {
  const { demoDeckDocument, englishDemoDeckDocument } = await import('../../examples/demo-deck')
  return BrowserDeckRepository.memory(locale === 'en' ? englishDemoDeckDocument : demoDeckDocument)
}
