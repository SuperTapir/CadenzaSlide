import { describe, expect, it } from 'vitest'
import { demoDeckDocument } from '../examples/demo-deck'
import { addPageObject, changeSlideLayout, layoutInspectorView, reapplySlideLayout, setPlaceholderVisible } from './studio-layout-inspector'

describe('Studio layout inspector adapter', () => {
  it('lists placeholders but never exposes fixed layout objects as page controls', () => {
    const view = layoutInspectorView(demoDeckDocument, 'intro')
    expect(view.layout).toBe('title')
    expect(view.placeholders.map(item => item.id)).toEqual(['title', 'subtitle', 'meta'])
    expect(view.placeholders.every(item => item.tag.length > 0)).toBe(true)
    expect(JSON.stringify(view)).not.toContain('backgroundObjects')
  })

  it('hides and restores a placeholder without deleting its content', () => {
    const hidden = setPlaceholderVisible(demoDeckDocument, 'intro', 'subtitle', false)
    expect(hidden.slides.intro).toMatchObject({ subtitle: 'CADENZA / COMPOSE WITH INTENT', hiddenPlaceholders: ['subtitle'] })
    const shown = setPlaceholderVisible(hidden, 'intro', 'subtitle', true)
    expect(shown.slides.intro).toMatchObject({ subtitle: 'CADENZA / COMPOSE WITH INTENT' })
    expect(shown.slides.intro).not.toHaveProperty('hiddenPlaceholders')
  })

  it('reapplies layout and adds a free object without changing placeholder content', () => {
    const prepared = setPlaceholderVisible(demoDeckDocument, 'intro', 'subtitle', false)
    const reapplied = reapplySlideLayout(prepared, 'intro')
    expect(reapplied.slides.intro).not.toHaveProperty('hiddenPlaceholders')
    const added = addPageObject(reapplied, 'intro', 'chart')
    expect(added.slides.intro).toMatchObject({ layout: 'title', subtitle: 'CADENZA / COMPOSE WITH INTENT', objects: [expect.objectContaining({ kind: 'chart' })] })
  })

  it('returns diagnostics instead of a lossy layout change', () => {
    const failed = changeSlideLayout(demoDeckDocument, 'big-fact', 'title-only')
    expect(failed.document).toBeUndefined()
    expect(failed.diagnostics.length).toBeGreaterThan(0)
    const changed = changeSlideLayout(demoDeckDocument, 'title-photo', 'title-photo-alt')
    expect(changed.diagnostics).toEqual([])
    expect(changed.document?.slides['title-photo']).toMatchObject({ layout: 'title-photo-alt', image: expect.any(Object) })
  })
})
