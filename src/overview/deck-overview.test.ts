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
})
