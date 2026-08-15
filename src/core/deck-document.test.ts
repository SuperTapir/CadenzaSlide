import { describe, expect, it } from 'vitest'
import { createDefaultDeckMaster } from './deck-master'
import { DeckDocumentError, parseDeckDocument, parseWorkspaceConfig } from './deck-document'
import { renderDeckSlides } from '../rendering/core-templates'

function validDeck() {
  return { version: 1, id: 'demo', title: 'Demo', status: 'complete', master: createDefaultDeckMaster(), slides: {
    intro: { id: 'intro', role: 'intro', layout: 'title', label: 'Intro', title: ['中文标题'], subtitle: '副标题', author: 'Cadenza', date: '2025/03/24', notes: '# Opening' },
    end: { id: 'end', role: 'thanks', layout: 'statement', label: 'End', title: ['谢谢'] },
  }, outline: [{ kind: 'slide', slideId: 'intro' }, { kind: 'group', id: 'closing', title: 'Closing', slideIds: ['end'] }] }
}

describe('workspace config parser', () => {
  it('accepts a safe deck directory', () => expect(parseWorkspaceConfig({ version: 1, decksDirectory: 'decks', defaultDeck: 'demo' })).toEqual({ version: 1, decksDirectory: 'decks', defaultDeck: 'demo' }))
  it.each(['../decks', '/tmp/decks'])('rejects escaping path %s', decksDirectory => expect(() => parseWorkspaceConfig({ version: 1, decksDirectory })).toThrow(DeckDocumentError))
})

describe('DeckDocument parser', () => {
  it('uses the initial version and rejects the discarded prototype version', () => {
    expect(parseDeckDocument(validDeck()).version).toBe(1)
    expect(() => parseDeckDocument({ ...validDeck(), version: 2 })).toThrow(/必须为 1/)
  })
  it('preserves master snapshot, notes and outline', () => {
    const deck = parseDeckDocument(validDeck())
    expect(deck.master.layouts.title.background).toBe('field')
    expect(deck.slides.intro.notes).toBe('# Opening')
  })
  it('requires slot tags and rejects the retired authoring profile', () => {
    const missingTag = structuredClone(validDeck()) as any
    delete missingTag.master.layouts['title-only'].slots.title.tag
    expect(() => parseDeckDocument(missingTag)).toThrow(/tag/i)

    const retired = structuredClone(validDeck()) as any
    retired.master.layouts['title-only'].authoring = { completion: 'startup', anchors: {}, regions: {}, density: 'balanced' }
    expect(() => parseDeckDocument(retired)).toThrow(/authoring/i)
  })
  it('accepts safe fixed objects and rejects interactive layout objects', () => {
    const valid = structuredClone(validDeck()) as any
    valid.master.layouts['title-only'].backgroundObjects.push({ kind: 'text', text: 'Brand', frame: { x: 1, y: 1, width: 10, height: 5 } })
    expect(parseDeckDocument(valid).master.layouts['title-only'].backgroundObjects).toHaveLength(1)
    for (const kind of ['video', 'html']) {
      const invalid = structuredClone(validDeck()) as any
      invalid.master.layouts['title-only'].backgroundObjects.push(kind === 'video'
        ? { kind, src: '/demo.mp4', alt: 'Demo', frame: { x: 1, y: 1, width: 10, height: 5 } }
        : { kind, src: 'asset.html', frame: { x: 1, y: 1, width: 10, height: 5 } })
      expect(() => parseDeckDocument(invalid)).toThrow(/backgroundObjects|固定对象/)
    }
  })
  it('accepts explicit HTTPS embeds and rejects unsafe remote HTML sources', () => {
    const valid = structuredClone(validDeck()) as any
    valid.slides.intro.objects = [{
      kind: 'html', frame: { x: 8, y: 12, width: 84, height: 76 },
      src: 'https://player.example.com/embed/42', external: true, title: 'Example video',
    }]
    const parsed = parseDeckDocument(valid).slides.intro
    expect('objects' in parsed && parsed.objects?.[0]).toMatchObject({ external: true })
    for (const src of ['http://player.example.com/embed/42', '//player.example.com/embed/42', 'javascript:alert(1)']) {
      const invalid = structuredClone(valid)
      invalid.slides.intro.objects[0].src = src
      expect(() => parseDeckDocument(invalid), src).toThrow(/HTTPS|远程/i)
    }
    const missingTitle = structuredClone(valid)
    delete missingTitle.slides.intro.objects[0].title
    expect(() => parseDeckDocument(missingTitle)).toThrow(/title|标题/i)
  })
  it('rejects untreated original-color raster media', () => {
    const input = validDeck() as any
    input.slides.intro.image = { src: '/color-photo.png', alt: '彩色照片', kind: 'photo', treatment: 'original' }
    expect(() => parseDeckDocument(input)).toThrow(/treatment|one-bit|tonal/i)
  })
  it('validates hidden placeholder state against the selected layout', () => {
    const valid = structuredClone(validDeck()) as any
    valid.slides.intro.hiddenPlaceholders = ['subtitle']
    expect(parseDeckDocument(valid).slides.intro).toMatchObject({ hiddenPlaceholders: ['subtitle'], subtitle: '副标题' })
    for (const hiddenPlaceholders of ['subtitle', ['subtitle', 'subtitle'], ['missing']]) {
      const invalid = structuredClone(validDeck()) as any
      invalid.slides.intro.hiddenPlaceholders = hiddenPlaceholders
      expect(() => parseDeckDocument(invalid), JSON.stringify(hiddenPlaceholders)).toThrow(/hiddenPlaceholders|placeholder/i)
    }
  })
  it('rejects old per-page visual fields and titles over three lines', () => {
    const input = validDeck()
    Object.assign(input.slides.intro, { scene: 'field', eyebrow: 'OLD', title: ['1', '2', '3', '4'] })
    expect(() => parseDeckDocument(input)).toThrow(/旧的逐页视觉字段|最多三行/)
  })
  it('allows cover placeholders to be empty', () => {
    const input = structuredClone(validDeck()) as any
    delete input.slides.intro.title
    delete input.slides.intro.subtitle
    delete input.slides.intro.author
    delete input.slides.intro.date
    expect(parseDeckDocument(input).slides.intro).not.toHaveProperty('title')
  })
  it('allows Quote placeholders to be empty and accepts an optional source', () => {
    const input = validDeck() as any
    input.slides.quote = { id: 'quote', role: 'content', layout: 'quote', label: 'Quote', quote: 'Good design is as little design as possible.' }
    input.outline.push({ kind: 'slide', slideId: 'quote' })
    expect(parseDeckDocument(input).slides.quote).not.toHaveProperty('attribution')
    input.slides.quote.attribution = 'Dieter Rams'
    input.slides.quote.source = 'Ten Principles for Good Design'
    expect(parseDeckDocument(input).slides.quote).toMatchObject({ attribution: 'Dieter Rams', source: 'Ten Principles for Good Design' })
  })
  it('reports duplicate and missing outline references', () => {
    const input = validDeck()
    input.outline.push({ kind: 'slide', slideId: 'intro' }, { kind: 'slide', slideId: 'missing' })
    try { parseDeckDocument(input) } catch (error) {
      expect((error as DeckDocumentError).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'outline.duplicate-slide' }), expect.objectContaining({ code: 'outline.unknown-slide' })]))
    }
  })
  it('rejects unknown components without a compatibility migration path', () => {
    const input = structuredClone(validDeck()) as any
    input.slides.intro.objects = [{ componentId: 'legacy-metric', kind: 'metric', version: 1, variant: 'hero', frame: { x: 8, y: 18, width: 84, height: 66 }, data: { metrics: [{ label: 'ARR', value: '¥8.2M' }] } }]
    expect(() => parseDeckDocument(input)).toThrow(/不是支持的组件/i)
  })
  it('accepts validated atomic compositions and rejects unsafe trees or duplicate composition IDs', () => {
    const input = structuredClone(validDeck()) as any
    input.slides.intro.objects = [{
      kind: 'composition', compositionId: 'growth-proof', frame: { x: 6, y: 40, width: 88, height: 50 },
      tree: { nodeId: 'growth-split', component: 'split', version: 1, slots: {
        primary: [{ nodeId: 'growth-heading', component: 'heading', version: 1, props: { text: '增长来自高价值客户' } }],
        secondary: [{ nodeId: 'growth-metric', component: 'metric', version: 1, props: { label: 'ARR', value: '¥8.2M' } }],
      } },
    }]
    const deck = parseDeckDocument(input)
    const html = renderDeckSlides(Object.values(deck.slides), deck.master)
    expect(html).toContain('data-composition-id="growth-proof"')
    expect(html).toContain('data-composition-diagnosis="fit"')
    expect(html).toContain('data-node-id="growth-metric"')
    expect(html).toContain('data-component-renderer="html-native"')
    expect(html).toContain('data-slot="secondary"')

    const unsafe = structuredClone(input)
    unsafe.slides.intro.objects[0].tree.slots.secondary[0].props.style = 'color:red'
    expect(() => parseDeckDocument(unsafe)).toThrow(/visual or executable fields/i)

    input.slides.end.objects = [structuredClone(input.slides.intro.objects[0])]
    expect(() => parseDeckDocument(input)).toThrow(/compositionId.*重复/i)
  })
})
