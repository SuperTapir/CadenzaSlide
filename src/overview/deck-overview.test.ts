import { describe, expect, it } from 'vitest'
import { demoDeckDocument } from '../examples/demo-deck'
import { renderDeckOverview } from './deck-overview'

describe('deck Overview renderer', () => {
  it('renders every slide once with stable id, preview and copy control, but no editors', () => {
    const html = renderDeckOverview(demoDeckDocument)
    const count = Object.keys(demoDeckDocument.slides).length
    expect(html.match(/data-overview-card/g)).toHaveLength(count)
    expect(html.match(/data-copy-slide-id=/g)).toHaveLength(count)
    expect(html.match(/data-design-library-preview="slide:/g)).toHaveLength(count)
    expect(html).toContain('data-overview-search')
    expect(html).toContain('data-overview-group')
    expect(html).not.toContain('data-creation-form')
    expect(html).not.toContain('notes-textarea')
    expect(html).not.toContain('draggable="true"')
  })

  it('renders English overview controls without changing deck content', () => {
    const html = renderDeckOverview(demoDeckDocument, 'en')

    expect(html).toContain('Search')
    expect(html).toContain('All groups')
    expect(html).toContain('Copy ID')
    expect(html).toContain('aria-label="Open preview: ')
    expect(html).toContain('aria-label="Copy ID: ')
    expect(html).toContain('aria-label="Close enlarged preview"')
    expect(html).toContain(demoDeckDocument.title)
    expect(html).toContain('data-ui-locale-switcher')
    expect(html).not.toContain('复制 ID')
    expect(html).not.toContain('Open preview：')
  })
})
