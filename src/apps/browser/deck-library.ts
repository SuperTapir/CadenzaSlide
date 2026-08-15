import { escapeHtml } from '../../rendering/core-templates'
import { localizeHref, renderUiLocaleSwitcher, type UiLocale, uiText } from '../../i18n/ui-locale'

export interface DeckLibraryEntry {
  id: string
  title: string
  path: string
}

export function renderDeckLibrary(decks: readonly DeckLibraryEntry[], error?: string, locale: UiLocale = 'zh-CN', currentHref = '?view=decks') {
  const text = uiText(locale).library
  const workspaceDecks = error
    ? `<p class="deck-library-empty" role="alert">${escapeHtml(error)}</p>`
    : decks.length
      ? `<div class="deck-library-grid">${decks.map(deck => renderWorkspaceDeck(deck, locale, text.openStudio)).join('')}</div>`
      : `<p class="deck-library-empty">${text.empty}</p>`

  return `<main class="deck-library-page" data-testid="deck-library">
    <header class="deck-library-header">
      <div><p>CADENZA / WORKSPACE</p><h1>Deck Library</h1></div>
      ${renderUiLocaleSwitcher(locale, currentHref)}
      <p>${text.intro} <code>cadenza --workspace &lt;path&gt; open</code></p>
    </header>
    <section class="deck-library-section" aria-labelledby="workspace-decks-title">
      <div class="deck-library-section-heading"><span>01</span><div><p>WORKSPACE</p><h2 id="workspace-decks-title">${text.yourDecks}</h2></div><strong>${decks.length}</strong></div>
      ${workspaceDecks}
    </section>
    <section class="deck-library-section" aria-labelledby="example-decks-title">
      <div class="deck-library-section-heading"><span>02</span><div><p>BUILT-IN EXAMPLE</p><h2 id="example-decks-title">${text.examples}</h2></div><strong>1</strong></div>
      <div class="deck-library-grid">
        <article class="deck-library-card deck-library-demo" data-testid="system-demo-deck">
          <span class="deck-library-card-kind">READ-ONLY / AUDIENCE</span>
          <h3>Cadenza Demo</h3>
          <p>${text.demoDescription}</p>
          <a href="${escapeHtml(localizeHref('?view=audience&source=demo', locale))}">${text.previewDemo} <span aria-hidden="true">↗</span></a>
        </article>
      </div>
    </section>
  </main>`
}

function renderWorkspaceDeck(deck: DeckLibraryEntry, locale: UiLocale, openLabel: string) {
  const href = escapeHtml(localizeHref(`?view=studio&deck=${encodeURIComponent(deck.id)}`, locale))
  return `<article class="deck-library-card">
    <span class="deck-library-card-kind">WORKSPACE DECK</span>
    <h3>${escapeHtml(deck.title)}</h3>
    <code>${escapeHtml(deck.id)}</code>
    <a href="${href}">${openLabel} <span aria-hidden="true">→</span></a>
  </article>`
}
