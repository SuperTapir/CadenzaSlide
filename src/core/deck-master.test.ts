import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { coreLayoutIds, renderDeckSlides, type CoreSlide } from '../rendering/core-templates'
import { createDefaultDeckMaster, routeMasterAnchorContent } from './deck-master'
import { parseDeckDocument } from './deck-document'

describe('deck master contract', () => {
  it('snapshots exactly fourteen core layouts with one transition', () => {
    const master = createDefaultDeckMaster()
    expect(coreLayoutIds).toEqual([
      'title', 'title-photo', 'title-photo-alt', 'title-bullets', 'title-bullets-photo',
      'section', 'title-only', 'agenda', 'statement', 'big-fact', 'quote', 'gallery', 'photo', 'blank',
    ])
    expect(Object.keys(master.layouts)).toEqual(coreLayoutIds)
    expect(master.slideTransition).toBeTruthy()
  })

  it('defines tagged optional placeholders and a fixed-object layer for every core layout', () => {
    const master = createDefaultDeckMaster()
    for (const layout of coreLayoutIds) {
      const definition = master.layouts[layout]
      expect(definition.backgroundObjects).toEqual(expect.any(Array))
      for (const slot of Object.values(definition.slots)) expect(slot.tag).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(definition).not.toHaveProperty('authoring')
    }
  })

  it('routes content by anchor tag and preserves unmapped values for diagnosis', () => {
    const master = createDefaultDeckMaster()
    const source = master.layouts['title-photo']
    const target = master.layouts['title-photo-alt']
    const media = { src: '/photo.png', alt: '产品正面图' }
    expect(routeMasterAnchorContent(source, target, { media })).toEqual({ mapped: { media }, unmapped: [] })

    target.slots.media.tag = 'portrait-media'
    expect(routeMasterAnchorContent(source, target, { media })).toEqual({
      mapped: {},
      unmapped: [{ sourceSlot: 'media', tag: 'media', value: media, reason: 'missing-target-tag' }],
    })
  })

  it('renders fixed layout objects before placeholders and free page objects', () => {
    const master = createDefaultDeckMaster()
    master.layouts['title-only'].backgroundObjects.push({ kind: 'shape', shape: 'rectangle', frame: { x: 2, y: 2, width: 10, height: 10 } })
    const html = renderDeckSlides([{ id: 'layered', role: 'content', layout: 'title-only', label: 'Layered', title: ['Title'], objects: [{ kind: 'text', text: 'Free', frame: { x: 10, y: 70, width: 20, height: 10 } }] }], master)
    expect(html.indexOf('data-layout-object')).toBeLessThan(html.indexOf('component-title'))
    expect(html.indexOf('component-title')).toBeLessThan(html.indexOf('data-page-object'))
    expect(html).toContain('aria-hidden="true"')
  })

  it('renders scene and transition from the master, not the slide', () => {
    const master = createDefaultDeckMaster()
    master.layouts.section.background = 'target'
    master.slideTransition = 'dissolve'
    const slide: CoreSlide = { id: 'chapter', role: 'section', layout: 'section', label: 'Chapter', title: ['第一章'] }
    const html = renderDeckSlides([slide], master)
    expect(html).toContain('data-cadenza-scene="target"')
    expect(html).toContain('data-cadenza-motion="dissolve"')
    expect(html).not.toContain('eyebrow')
  })

  it('aligns poster title and subtitle slots to one left edge', () => {
    const master = createDefaultDeckMaster()
    for (const layout of ['title', 'title-photo', 'title-photo-alt', 'section'] as const) {
      expect(master.layouts[layout].slots.subtitle.frame.x).toBe(master.layouts[layout].slots.title.frame.x)
    }
  })

  it('gives functional layouts distinct, content-driven spatial roles', () => {
    const master = createDefaultDeckMaster()
    for (const layout of ['title-bullets', 'title-only'] as const) {
      expect(master.layouts[layout].slots.title.frame.x).toBe(6)
    }
    expect(master.layouts['title-bullets'].background).toBe('orbit')
    expect(master.layouts['title-bullets'].environmentMode).toBe('loop')
    expect(master.layouts['title-only'].background).toBe('white')
    expect(master.layouts['title-only'].environmentMode).toBe('loop')
    expect(master.layouts['title-bullets'].slots.items.frame.width).toBeLessThanOrEqual(44)
    expect(master.layouts['title-bullets'].slots.items.frame.y).toBeLessThanOrEqual(43)
    expect(master.layouts['title-bullets'].visualRegions).toEqual([
      { tag: 'orbit-scene', frame: { x: 0, y: 0, width: 100, height: 100 } },
    ])
    expect(master.layouts['title-only'].backgroundObjects).toEqual([])
    expect(master.layouts['title-only'].slots.title.frame.height).toBeLessThanOrEqual(17)
    expect(master.layouts['title-only'].slots.title.frame.y).toBeGreaterThanOrEqual(7)
    expect(master.layouts['title-only'].slots.subtitle.frame.y + master.layouts['title-only'].slots.subtitle.frame.height).toBeLessThanOrEqual(33)
    expect(master.layouts.agenda.background).toBe('orbit')
    expect(master.layouts.agenda.environmentMode).toBe('loop')
    expect(master.layouts.agenda.slots.title.frame.x).toBe(6)
    expect(master.layouts.agenda.slots.items.frame.width).toBeLessThanOrEqual(44)
    expect(master.layouts.agenda.visualRegions).toEqual([
      { tag: 'orbit-scene', frame: { x: 0, y: 0, width: 100, height: 100 } },
    ])
    expect(master.layouts.statement.background).toBe('black')
    expect(master.layouts.statement.environmentMode).toBe('loop')
    expect(master.layouts.statement.backgroundObjects).toEqual([])
    expect(master.layouts.statement.visualRegions).toBeUndefined()
    expect(master.layouts.statement.slots.title.frame.x).toBeLessThan(master.layouts.statement.slots.subtitle.frame.x + 1)
    expect(master.layouts.statement.slots.title.frame.width).toBeGreaterThanOrEqual(76)
    expect(master.layouts.statement.slots.title.frame.y + master.layouts.statement.slots.title.frame.height).toBeLessThan(master.layouts.statement.slots.subtitle.frame.y)
    expect(master.layouts.statement.slots.subtitle.frame.y + master.layouts.statement.slots.subtitle.frame.height).toBeLessThanOrEqual(82)
    expect(master.layouts['big-fact'].backgroundObjects).toEqual([])
    expect(master.layouts['big-fact'].slots.label.frame.width).toBeGreaterThanOrEqual(80)
    expect(master.layouts['big-fact'].slots.value.fontSize).toBeGreaterThanOrEqual(210)
    expect(master.layouts['big-fact'].slots.label.fontSize).toBeGreaterThanOrEqual(26)
    expect(master.layouts['big-fact'].slots.value.frame.x + master.layouts['big-fact'].slots.value.frame.width / 2).toBe(50)
    expect(master.layouts['big-fact'].slots.label.frame.y).toBeGreaterThan(master.layouts['big-fact'].slots.value.frame.y + master.layouts['big-fact'].slots.value.frame.height)
    expect(master.layouts.quote.backgroundObjects).toEqual([])
    expect(master.layouts.quote.slots.quote.frame.width).toBeGreaterThanOrEqual(80)
    expect(master.layouts.quote.slots.quote.frame.x).toBeLessThanOrEqual(10)
    expect(master.layouts.quote.slots.attribution.frame.x).toBe(master.layouts.quote.slots.quote.frame.x)
    expect(master.layouts.quote.slots.attribution.frame.width).toBe(master.layouts.quote.slots.quote.frame.width)
    expect(master.layouts.quote.slots.attribution.frame.y).toBeGreaterThan(master.layouts.quote.slots.quote.frame.y)
  })

  it('keeps the demo snapshot identical to the default grammar for refined layouts', () => {
    const defaults = createDefaultDeckMaster()
    const document = JSON.parse(readFileSync(resolve('decks/cadenza-demo/deck.cadenza.json'), 'utf8'))
    const demo = document.master
    for (const layout of ['title-bullets', 'title-only', 'agenda', 'statement', 'big-fact', 'quote'] as const) {
      expect(demo.layouts[layout]).toEqual(defaults.layouts[layout])
    }
    expect(document.slides.agenda.items.filter((item: { state?: string }) => item.state === 'active')).toHaveLength(0)
  })

  it('parses the initial document without legacy design, scene, motion or eyebrow fields', () => {
    const value = {
      version: 1, id: 'demo', title: 'Demo', status: 'complete', master: createDefaultDeckMaster(),
      slides: { only: { id: 'only', role: 'content', layout: 'title-only', label: 'Only', title: ['清晰标题'] } },
      outline: [{ kind: 'slide', slideId: 'only' }],
    }
    expect(parseDeckDocument(value).master.layouts['title-only']).toBeTruthy()
    expect(() => parseDeckDocument({ ...value, design: {}, master: undefined })).toThrow(/master/i)
  })
})
