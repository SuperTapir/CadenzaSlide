import { renderDeckOverview, startDeckOverview } from '../../overview/deck-overview'
import { openBrowserDeck } from './open-browser-deck'

document.documentElement.dataset.appMode = 'overview'
const repository = await openBrowserDeck(new URL(location.href))
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = renderDeckOverview(repository.document)
startDeckOverview(app)
