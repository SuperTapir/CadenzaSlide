import { describe, expect, it } from 'vitest'
import { renderDeckLibrary } from './deck-library'

describe('renderDeckLibrary', () => {
  it('renders escaped workspace decks with stable Studio links and an explicit Demo preview', () => {
    const html = renderDeckLibrary([
      { id: 'research-story', title: 'Research <Story>', path: '/talks/decks/research-story/deck.cadenza.json' },
      { id: 'product-story', title: 'Product & Story', path: '/talks/decks/product-story/deck.cadenza.json' },
    ])

    expect(html).toContain('data-testid="deck-library"')
    expect(html).toContain('Research &lt;Story&gt;')
    expect(html).toContain('Product &amp; Story')
    expect(html).toContain('?view=studio&amp;deck=research-story')
    expect(html).toContain('?view=studio&amp;deck=product-story')
    expect(html).toContain('data-testid="system-demo-deck"')
    expect(html).toContain('?view=audience&amp;source=demo')
    expect(html).not.toContain('/talks/decks')
  })

  it('keeps the Demo available when the workspace is empty', () => {
    const html = renderDeckLibrary([])

    expect(html).toContain('当前 workspace 还没有 deck')
    expect(html).toContain('data-testid="system-demo-deck"')
  })

  it('renders English library copy and locale-preserving deck links', () => {
    const html = renderDeckLibrary([{ id: 'demo', title: 'Demo', path: '/workspace/demo.json' }], undefined, 'en')

    expect(html).toContain('Your decks')
    expect(html).toContain('Open in Studio')
    expect(html).toContain('?view=studio&amp;deck=demo&amp;lang=en')
    expect(html).toContain('data-ui-locale-switcher')
    expect(html).not.toContain('你的 Deck')
  })
})
