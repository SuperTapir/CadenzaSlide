import { coreLayoutIds, type DeckMaster } from '../core/deck-master'
import { designLibraryFixtures } from './design-library-fixtures'
import { renderDeckSlides } from './core-templates'
import { type UiLocale, uiText } from '../i18n/ui-locale'

export function renderDeckMaster(master: Readonly<DeckMaster>, locale: UiLocale = 'zh-CN') {
  const text = uiText(locale).gallery
  return `<section class="deck-master" data-testid="deck-master" aria-label="${text.masterAria}">
    <header><p>${text.masterEyebrow}</p><h2>${text.masterTitle}</h2><p>${text.masterIntro}</p></header>
    <div class="deck-master-grid">${coreLayoutIds.map(layout => `<article data-deck-master-layout="${layout}"><h3>${layout}</h3><div class="deck-master-preview gallery-live-preview" data-gallery-slide-preview="${layout}"><div class="gallery-preview-content"></div><template data-gallery-preview-template>${renderDeckSlides([designLibraryFixtures[layout]], master)}</template></div></article>`).join('')}</div>
  </section>`
}
