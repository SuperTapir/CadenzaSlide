import { escapeHtml } from '../../rendering/core-templates'

export interface DeckLibraryEntry {
  id: string
  title: string
  path: string
}

export function renderDeckLibrary(decks: readonly DeckLibraryEntry[], error?: string) {
  const workspaceDecks = error
    ? `<p class="deck-library-empty" role="alert">${escapeHtml(error)}</p>`
    : decks.length
      ? `<div class="deck-library-grid">${decks.map(renderWorkspaceDeck).join('')}</div>`
      : '<p class="deck-library-empty">当前 workspace 还没有 deck。你可以先预览系统 Demo，或使用 CLI 创建一份新 deck。</p>'

  return `<main class="deck-library-page" data-testid="deck-library">
    <header class="deck-library-header">
      <div><p>CADENZA / WORKSPACE</p><h1>Deck Library</h1></div>
      <p>选择一份 deck 进入 Studio。其他 workspace 可通过 <code>cadenza --workspace &lt;path&gt; open</code> 打开。</p>
    </header>
    <section class="deck-library-section" aria-labelledby="workspace-decks-title">
      <div class="deck-library-section-heading"><span>01</span><div><p>WORKSPACE</p><h2 id="workspace-decks-title">你的 Deck</h2></div><strong>${decks.length}</strong></div>
      ${workspaceDecks}
    </section>
    <section class="deck-library-section" aria-labelledby="example-decks-title">
      <div class="deck-library-section-heading"><span>02</span><div><p>BUILT-IN EXAMPLE</p><h2 id="example-decks-title">系统示例</h2></div><strong>1</strong></div>
      <div class="deck-library-grid">
        <article class="deck-library-card deck-library-demo" data-testid="system-demo-deck">
          <span class="deck-library-card-kind">READ-ONLY / AUDIENCE</span>
          <h3>Cadenza Demo</h3>
          <p>了解 Cadenza 的核心 layout、组件、视觉环境与动效语言。</p>
          <a href="?view=audience&amp;source=demo">预览 Demo <span aria-hidden="true">↗</span></a>
        </article>
      </div>
    </section>
  </main>`
}

function renderWorkspaceDeck(deck: DeckLibraryEntry) {
  const href = `?view=studio&amp;deck=${encodeURIComponent(deck.id)}`
  return `<article class="deck-library-card">
    <span class="deck-library-card-kind">WORKSPACE DECK</span>
    <h3>${escapeHtml(deck.title)}</h3>
    <code>${escapeHtml(deck.id)}</code>
    <a href="${href}">在 Studio 中打开 <span aria-hidden="true">→</span></a>
  </article>`
}
