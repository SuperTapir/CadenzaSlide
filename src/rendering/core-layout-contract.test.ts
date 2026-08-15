import { describe, expect, it } from 'vitest'
import { createDefaultDeckMaster } from '../core/deck-master'
import { renderDeckSlides, type CoreSlide } from './core-templates'

const master = createDefaultDeckMaster()
const base = { id: 'slide', role: 'content' as const, label: 'Slide' }
const image = { src: '/hello-apple.svg', alt: 'Object', aspectRatio: 1.5, focalPoint: { x: 50, y: 40 } }

describe('core layout rendering', () => {
  it('renders the complete cover contract', () => {
    const slide: CoreSlide = {
      ...base,
      role: 'intro',
      layout: 'title',
      title: ['主标题'],
      subtitle: '副标题',
      author: 'Cadenza',
      date: '2025/03/24',
    }
    const html = renderDeckSlides([slide], master)
    expect(html).toContain('component-cover-author')
    expect(html).toContain('Cadenza')
    expect(html).toContain('component-cover-date')
    expect(html).toContain('2025/03/24')
    expect(html).toContain('data-inspect-path="$.slides.slide.author"')
    expect(html).toContain('data-inspect-path="$.slides.slide.date"')
  })

  it('exposes quote text, attribution, and source as separate inspect targets', () => {
    const slide: CoreSlide = { ...base, layout: 'quote', quote: '重要判断', attribution: 'Cadenza', source: 'Field notes' }
    const html = renderDeckSlides([slide], master)

    expect(html).toContain('data-inspect-path="$.slides.slide.quote"')
    expect(html).toContain('data-inspect-path="$.slides.slide.attribution"')
    expect(html).toContain('data-inspect-path="$.slides.slide.source"')
  })

  it('omits absent optional copy and limits title input to three lines', () => {
    const slide: CoreSlide = { ...base, layout: 'title-only', title: ['一', '二', '三'] }
    const html = renderDeckSlides([slide], master)
    expect(html).not.toContain('component-subtitle')
    expect(html.match(/title-line/g)).toHaveLength(3)
    expect(html).toContain('class="title-box"')
    expect(() => renderDeckSlides([{ ...slide, title: ['一', '二', '三', '四'] }], master)).toThrow(/three lines/i)
  })

  it('does not render empty optional surfaces on functional layouts', () => {
    const slides: CoreSlide[] = [
      { ...base, id: 'bullets', layout: 'title-bullets', title: ['结论'], items: ['一', '二'] },
      { ...base, id: 'agenda', layout: 'agenda', title: ['议程'], items: [{ number: '01', title: '一' }, { number: '02', title: '二' }] },
    ]
    const html = renderDeckSlides(slides, master)
    expect(html).not.toContain('component-subtitle')
    expect(html).not.toContain('component-body')
    expect(html.match(/class="component-list/g)).toHaveLength(1)
    expect(html.match(/class="agenda-list/g)).toHaveLength(1)
  })

  it.each([1, 2, 3, 4])('renders a %i-image mosaic without phantom cells', (count) => {
    const slide: CoreSlide = { ...base, layout: 'gallery', images: Array.from({ length: count }, (_, index) => ({ ...image, caption: `Image ${index + 1}` })) }
    const html = renderDeckSlides([slide], master)
    expect(html).toContain(`data-gallery-count="${count}"`)
    expect(html.match(/class="gallery-item/g)).toHaveLength(count)
  })

  it('reserves a readable title band above Gallery media when copy is present', () => {
    const gallery = master.layouts.gallery
    expect(gallery.slots.title.frame).toMatchObject({ x: 4, y: 3, width: 92, height: 12 })
    expect(gallery.slots.media.frame.y).toBe(17)
    expect(gallery.slots.media.frame.y + gallery.slots.media.frame.height).toBeLessThanOrEqual(96)
    expect(Math.abs(gallery.slots.title.frame.y - (100 - gallery.slots.media.frame.y - gallery.slots.media.frame.height))).toBeLessThanOrEqual(1)
  })

  it('omits an empty Gallery media placeholder', () => {
    const slide = { ...base, layout: 'gallery' as const, images: [] }
    expect(renderDeckSlides([slide], master)).not.toContain('gallery-grid')
  })

  it('renders native components and a sandboxed HTML asset', () => {
    const slide: CoreSlide = {
      ...base, layout: 'blank', ariaLabel: 'Components', objects: [
        { kind: 'text', frame: { x: 5, y: 5, width: 40, height: 10 }, text: 'Context' },
        { kind: 'shape', frame: { x: 5, y: 20, width: 10, height: 10 }, shape: 'ellipse' },
        { kind: 'table', frame: { x: 20, y: 20, width: 35, height: 25 }, columns: ['A'], rows: [['B']] },
        { kind: 'code', frame: { x: 5, y: 50, width: 45, height: 30 }, language: 'ts', code: 'const value = 1' },
        { kind: 'video', frame: { x: 55, y: 5, width: 40, height: 30 }, src: '/demo.mp4', alt: 'Demo' },
        { kind: 'chart', frame: { x: 55, y: 40, width: 40, height: 30 }, chart: 'bar', values: [{ label: 'A', value: 3 }] },
        { kind: 'html', frame: { x: 55, y: 75, width: 40, height: 20 }, src: 'assets/special.html' },
      ],
    }
    const html = renderDeckSlides([slide], master)
    for (const kind of ['text', 'shape', 'table', 'code', 'video', 'chart', 'html']) expect(html).toContain(`data-component-kind="${kind}"`)
    expect(html).toContain('sandbox=""')
  })

  it('exposes authoritative inspect targets for placeholders, page objects, and composition nodes', () => {
    const slide: CoreSlide = {
      ...base, layout: 'title-bullets-photo', title: ['可定位标题'], items: ['第一项'], image,
      objects: [
        { kind: 'text', frame: { x: 5, y: 80, width: 30, height: 8 }, text: '自由文本' },
        {
          kind: 'composition', compositionId: 'evidence', frame: { x: 40, y: 70, width: 50, height: 20 },
          tree: { nodeId: 'evidence-heading', component: 'heading', version: 1, props: { text: '组合标题' } },
        },
      ],
    }

    const html = renderDeckSlides([slide], master)
    expect(html).toContain('data-inspect-path="$.slides.slide.title"')
    expect(html).toContain('data-inspect-path="$.slides.slide.items[0]"')
    expect(html).toContain('data-inspect-path="$.slides.slide.image"')
    expect(html).toContain('data-inspect-path="$.slides.slide.objects[0]"')
    expect(html).toContain('data-inspect-path="$.slides.slide.objects[1].tree"')
    expect(html).toContain('data-node-id="evidence-heading"')
    expect(html).toContain('data-inspect-kind="heading"')
    expect(html).toContain('data-inspect-label="Heading"')
  })

  it('renders an explicitly trusted HTTPS embed with playback permissions', () => {
    const slide: CoreSlide = {
      ...base, layout: 'blank', ariaLabel: 'External player', objects: [{
        kind: 'html', frame: { x: 8, y: 12, width: 84, height: 76 },
        src: 'https://player.example.com/embed/42', external: true, title: 'Example video',
      }],
    }
    const html = renderDeckSlides([slide], master)
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"')
    expect(html).toContain('allow="autoplay; encrypted-media; picture-in-picture; fullscreen"')
    expect(html).toContain('allowfullscreen')
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"')
    expect(html).toContain('title="Example video"')
    expect(html).toContain('data-src="https://player.example.com/embed/42"')
    expect(html).not.toContain(' src="https://player.example.com/embed/42"')
  })

  it('keeps video URLs lazy and images on native lazy loading', () => {
    const slide: CoreSlide = {
      ...base, layout: 'blank', objects: [
        { kind: 'video', frame: { x: 5, y: 5, width: 40, height: 40 }, src: '/demo.mp4', alt: 'Demo', poster: '/poster.jpg' },
        { kind: 'image', frame: { x: 55, y: 5, width: 40, height: 40 }, src: '/photo.jpg', alt: 'Photo' },
      ],
    }
    const html = renderDeckSlides([slide], master)
    expect(html).toContain('data-src="/demo.mp4"')
    expect(html).not.toContain(' src="/demo.mp4"')
    expect(html).toContain('src="/photo.jpg" alt="Photo"')
    expect(html).toContain('loading="lazy"')
  })
})
