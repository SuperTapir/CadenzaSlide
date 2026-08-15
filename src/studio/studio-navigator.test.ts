import { describe, expect, it } from 'vitest'
import { demoDeckDocument } from '../examples/demo-deck'
import { moveSlideToDropTarget, renderStudioNavigator } from './studio-navigator'

describe('Studio Navigator renderer', () => {
  it('moves slides before or after an explicit insertion boundary', () => {
    const outline = [
      { kind: 'slide' as const, slideId: 'a' },
      { kind: 'slide' as const, slideId: 'b' },
      { kind: 'slide' as const, slideId: 'c' },
    ]

    expect(moveSlideToDropTarget(outline, 'a', 'c', 'before')).toEqual([
      { kind: 'slide', slideId: 'b' },
      { kind: 'slide', slideId: 'a' },
      { kind: 'slide', slideId: 'c' },
    ])
    expect(moveSlideToDropTarget(outline, 'a', 'c', 'after')).toEqual([
      { kind: 'slide', slideId: 'b' },
      { kind: 'slide', slideId: 'c' },
      { kind: 'slide', slideId: 'a' },
    ])
    expect(moveSlideToDropTarget(outline, 'c', 'a', 'before')).toEqual([
      { kind: 'slide', slideId: 'c' },
      { kind: 'slide', slideId: 'a' },
      { kind: 'slide', slideId: 'b' },
    ])
    expect(moveSlideToDropTarget(outline, 'c', 'a', 'after')).toEqual([
      { kind: 'slide', slideId: 'a' },
      { kind: 'slide', slideId: 'c' },
      { kind: 'slide', slideId: 'b' },
    ])
  })

  it('renders one dense playable card per slide and one-level collapsible groups', () => {
    const html = renderStudioNavigator(demoDeckDocument)
    expect(html.match(/data-navigator-slide=/g)).toHaveLength(Object.keys(demoDeckDocument.slides).length)
    expect(html.match(/data-navigator-group=/g) ?? []).toHaveLength(1)
    expect(html).toContain('系统证明 / SYSTEM PROOF')
    expect(html).toContain('aria-label="页面导航"')
    expect(html).toContain('data-navigator-drop-indicator')
    expect(html).toContain(`data-playback-index="${Object.keys(demoDeckDocument.slides).length - 1}"`)
    expect(html).toContain('title="包含演讲者注释"')
    expect(html.match(/draggable="true"/g)).toHaveLength(Object.keys(demoDeckDocument.slides).length + 1)
    expect(html).not.toContain('data-navigator-copy')
  })

  it('renders navigator controls in English when requested', () => {
    const html = renderStudioNavigator(demoDeckDocument, 'en')
    expect(html).toContain('+ Group')
    expect(html).toContain('Overview ↗')
    expect(html).toContain('aria-label="Slide navigation"')
    expect(html).toContain('Select')
    expect(html).not.toContain('重命名')
  })

  it('keeps a 200-slide rail within the 40-row DOM budget', () => {
    const slides = Object.fromEntries(Array.from({ length: 200 }, (_, index) => {
      const id = `slide-${String(index + 1).padStart(3, '0')}`
      return [id, { ...demoDeckDocument.slides.intro, id, label: `Slide ${index + 1}` }]
    }))
    const deck = {
      ...demoDeckDocument,
      slides,
      outline: Object.keys(slides).map(slideId => ({ kind: 'slide' as const, slideId })),
    }
    const html = renderStudioNavigator(deck)

    expect(html.match(/data-navigator-slide=/g) ?? []).toHaveLength(40)
    expect(html).toContain('aria-setsize="200"')
    expect(html).toContain('data-navigator-total="200"')
  })
})
