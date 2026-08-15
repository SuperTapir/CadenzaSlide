import { coreLayoutIds, type DeckMaster } from '../core/deck-master'
import { designLibraryFixtures } from './design-library-fixtures'
import { renderDeckSlides } from './core-templates'

export function renderDeckMaster(master: Readonly<DeckMaster>) {
  return `<section class="deck-master" data-testid="deck-master" aria-label="Deck Master">
    <header><p>DECK MASTER / 只读</p><h2>当前演示文稿母版</h2><p>修改请直接告诉 AI；更新后会统一应用并复查所有页面。</p></header>
    <div class="deck-master-grid">${coreLayoutIds.map(layout => `<article data-deck-master-layout="${layout}"><h3>${layout}</h3><div class="deck-master-preview gallery-live-preview" data-gallery-slide-preview="${layout}"><div class="gallery-preview-content"></div><template data-gallery-preview-template>${renderDeckSlides([designLibraryFixtures[layout]], master)}</template></div></article>`).join('')}</div>
  </section>`
}
