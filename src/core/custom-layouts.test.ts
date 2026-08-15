import { describe, expect, it } from 'vitest'
import { createDefaultDeckMaster } from './deck-master'
import { parseDeckDocument } from './deck-document'
import { renderDeckSlides } from '../rendering/core-templates'
import { customRegistry } from './custom-layouts'

function customDeck(layout = 'custom:architecture-map', extra: Record<string, unknown> = {}) {
  return { version: 1, id: 'custom-demo', title: 'Custom', status: 'complete', master: createDefaultDeckMaster(), slides: { map: { id: 'map', role: 'content', layout, label: 'Map', title: ['Cross boundary'], body: 'Relations', nodes: [{ label: 'A', detail: 'B' }], ...extra } }, outline: [{ kind: 'slide', slideId: 'map' }] }
}

describe('custom layout registry', () => {
  it('uses Blank master for registered one-off layouts', () => {
    expect(customRegistry[0].id).toBe('custom:architecture-map')
    const deck = parseDeckDocument(customDeck())
    expect(renderDeckSlides([deck.slides.map], deck.master)).toContain('custom-architecture-map')
  })
  it('rejects unknown custom ids and executable JSON payloads', () => {
    expect(() => parseDeckDocument(customDeck('custom:unknown'))).toThrow(/注册/)
    expect(() => parseDeckDocument(customDeck(undefined, { html: '<script>alert(1)</script>' }))).toThrow(/执行/)
  })

  it('renders a numbered series with a stable header and variable object canvas', () => {
    const value = customDeck('custom:numbered-series', {
      title: ['先研究'], subtitle: '让 AI 站在经过验证的起点上', seriesNumber: '02', seriesLabel: 'AI 协作方法',
      objects: [{ kind: 'text', frame: { x: 7, y: 34, width: 86, height: 52 }, text: '页面内部内容可以变化' }],
    })
    const deck = parseDeckDocument(value)
    const html = renderDeckSlides([deck.slides.map], deck.master)
    expect(customRegistry.map(entry => entry.id)).toContain('custom:numbered-series')
    expect(html).toContain('custom-numbered-series')
    expect(html).toContain('data-series-number="02"')
    expect(html).toContain('页面内部内容可以变化')
    expect(html).toContain('class="numbered-series-nav"')
    expect(html).toContain('data-series-step="02" data-state="active"')
  })
})
