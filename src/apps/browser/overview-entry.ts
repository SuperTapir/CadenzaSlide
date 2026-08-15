import { renderDeckOverview, startDeckOverview } from '../../overview/deck-overview'
import { openBrowserDeck } from './open-browser-deck'
import { resolveUiLocale } from '../../i18n/ui-locale'

document.documentElement.dataset.appMode = 'overview'
const locale = resolveUiLocale(new URL(location.href), navigator.language)
document.documentElement.lang = locale
const repository = await openBrowserDeck(new URL(location.href))
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = renderDeckOverview(repository.document, locale, location.href)
startDeckOverview(app, locale)
