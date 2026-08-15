import { describe, expect, it } from 'vitest'
import { createDefaultDeckMaster } from '../core/deck-master'
import { designLibraryFixtures } from './design-library-fixtures'
import { renderDeckSlides } from './core-templates'

describe('core templates', () => {
  it('renders all fourteen layouts from one master', () => {
    const master = createDefaultDeckMaster()
    const html = renderDeckSlides(Object.values(designLibraryFixtures), master)
    expect(html.match(/data-testid="slide-/g)).toHaveLength(14)
    expect(html.match(/data-cadenza-motion="dissolve"/g)).toHaveLength(14)
    expect(html).not.toContain('eyebrow')
  })

  it('renders master slot overrides without mutating the master', () => {
    const master = createDefaultDeckMaster()
    const slide = { ...designLibraryFixtures['title-only'], slotOverrides: { title: { frame: { x: 20 } } } }
    expect(renderDeckSlides([slide], master)).toContain('left:20%')
    expect(master.layouts['title-only'].slots.title.frame.x).toBe(6)
  })

  it('distinguishes empty and explicitly hidden placeholders without losing content', () => {
    const master = createDefaultDeckMaster()
    const slide = { ...designLibraryFixtures['title-bullets'], hiddenPlaceholders: ['subtitle', 'items'], slotOverrides: { subtitle: { frame: { x: 20 } } } }
    const html = renderDeckSlides([slide], master)
    expect(html).not.toContain('component-subtitle')
    expect(html).not.toContain('component-list')
    expect(slide.subtitle).toBeTruthy()
    expect(slide.items).toHaveLength(3)
    expect(slide.slotOverrides.subtitle.frame.x).toBe(20)
    expect(renderDeckSlides([{ ...slide, hiddenPlaceholders: [] }], master)).toContain('component-subtitle')
  })

  it('renders every non-empty Section placeholder', () => {
    const html = renderDeckSlides([designLibraryFixtures.section], createDefaultDeckMaster())
    expect(html).toContain('class="section-number master-slot"')
    expect(html).toContain('component-subtitle')
  })

  it('never renders an image caption in the full-bleed title-photo layout', () => {
    const slide = {
      ...designLibraryFixtures['title-photo'],
      image: { ...designLibraryFixtures['title-photo'].image!, caption: '不允许进入整页海报' },
    }
    const html = renderDeckSlides([slide], createDefaultDeckMaster())
    expect(html).not.toContain('<figcaption>')
    expect(html).not.toContain('不允许进入整页海报')
  })

  it('keeps information-dense screenshots legible with tonal harmonization and exposes an adaptive media variant', () => {
    const slide = {
      ...designLibraryFixtures['title-photo-alt'],
      image: {
        src: '/dense-ui.png', alt: '信息密集的产品界面', kind: 'screenshot' as const,
        fit: 'contain' as const, aspectRatio: .68,
      },
    }
    const html = renderDeckSlides([slide], createDefaultDeckMaster())
    expect(html).toContain('data-media-kind="screenshot"')
    expect(html).toContain('data-media-treatment="tonal"')
    expect(html).toContain('data-media-variant="portrait"')
  })

  it('adapts gallery geometry to a single portrait without overriding contain', () => {
    const slide = {
      ...designLibraryFixtures.gallery,
      images: [{ src: '/portrait.png', alt: '纵向证据', kind: 'screenshot' as const, fit: 'contain' as const, aspectRatio: .56 }],
    }
    const html = renderDeckSlides([slide], createDefaultDeckMaster())
    expect(html).toContain('data-gallery-pattern="single-portrait"')
    expect(html).toContain('data-image-fit="contain"')
    expect(html).toContain('data-media-treatment="tonal"')
  })

  it('uses snug patterns for ultra-wide evidence and portrait pairs', () => {
    const ultraWide = renderDeckSlides([{ ...designLibraryFixtures.gallery, images: [{ src: '/wide.png', alt: '细长订单状态', kind: 'screenshot' as const, aspectRatio: 6.4 }] }], createDefaultDeckMaster())
    const portraitPair = renderDeckSlides([{ ...designLibraryFixtures.gallery, images: [
      { src: '/a.png', alt: '纵向证据 A', kind: 'screenshot' as const, aspectRatio: .46 },
      { src: '/b.png', alt: '纵向证据 B', kind: 'screenshot' as const, aspectRatio: .46 },
    ] }], createDefaultDeckMaster())
    expect(ultraWide).toContain('data-gallery-pattern="single-ultrawide"')
    expect(portraitPair).toContain('data-gallery-pattern="pair-portraits"')
  })

  it('marks compact evidence frames so adaptive title-photo layouts can shrink-wrap media', () => {
    const html = renderDeckSlides([{ ...designLibraryFixtures['title-photo-alt'], image: { src: '/evidence.png', alt: '紧凑证据', kind: 'diagram' as const, aspectRatio: 1.36, frameMode: 'compact' as const } }], createDefaultDeckMaster())
    expect(html).toContain('data-image-frame="compact"')
  })

  it('keeps a generic agenda neutral unless the author explicitly provides a current state', () => {
    const neutral = renderDeckSlides([designLibraryFixtures.agenda], createDefaultDeckMaster())
    expect(neutral).not.toContain('data-agenda-state="active"')

    const contextual = renderDeckSlides([{
      ...designLibraryFixtures.agenda,
      items: designLibraryFixtures.agenda.items.map((item, index) => index === 1 ? { ...item, state: 'active' as const } : item),
    }], createDefaultDeckMaster())
    expect(contextual.match(/data-agenda-state="active"/g)).toHaveLength(1)
  })

  it('focuses Big Fact with a quiet halo field', () => {
    const html = renderDeckSlides([designLibraryFixtures['big-fact']], createDefaultDeckMaster())
    expect(html).toContain('data-cadenza-scene="halo"')
  })

  it('renders Quote as a sourced external voice without title chrome', () => {
    const master = createDefaultDeckMaster()
    const html = renderDeckSlides([designLibraryFixtures.quote], master)
    expect(master.layouts.quote.slots.quote.fontSize).toBeGreaterThanOrEqual(70)
    expect(html).toContain('class="quote-attribution master-slot"')
    expect(html).toContain('class="quote-source"')
    expect(html).not.toContain('quote-kicker')
    expect(html).not.toContain('component-title')
  })

})
