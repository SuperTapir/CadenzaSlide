import { describe, expect, it } from 'vitest'
import { createDefaultDeckMaster } from './deck-master'
import { changeLayout, reapplyLayout } from './slide-layout-operations'
import type { CoreSlide } from '../rendering/core-templates'

const master = createDefaultDeckMaster()

describe('slide layout operations', () => {
  it('reapplies only layout-controlled page state', () => {
    const slide: CoreSlide = { id: 'one', role: 'content', layout: 'title-only', label: 'One', title: ['Title'], subtitle: 'Context', notes: 'Keep', hiddenPlaceholders: ['subtitle'], slotOverrides: { title: { frame: { x: 20 } } }, objects: [{ kind: 'text', text: 'Free', frame: { x: 10, y: 60, width: 20, height: 10 } }] }
    expect(reapplyLayout(slide)).toEqual({ id: 'one', role: 'content', layout: 'title-only', label: 'One', title: ['Title'], subtitle: 'Context', notes: 'Keep', objects: slide.objects })
  })

  it('maps placeholder content, visibility and overrides by stable tag', () => {
    const slide: CoreSlide = { id: 'photo', role: 'intro', layout: 'title-photo', label: 'Photo', title: ['Title'], subtitle: 'Context', image: { src: '/photo.png', alt: 'Product' }, hiddenPlaceholders: ['subtitle'], slotOverrides: { media: { fit: 'contain' } }, notes: 'Keep', objects: [{ kind: 'chart', chart: 'bar', values: [{ label: 'A', value: 1 }], frame: { x: 5, y: 5, width: 20, height: 20 } }] }
    const result = changeLayout(slide, 'title-photo-alt', master)
    expect(result.diagnostics).toEqual([])
    expect(result.slide).toMatchObject({ id: 'photo', layout: 'title-photo-alt', title: ['Title'], subtitle: 'Context', image: { alt: 'Product' }, hiddenPlaceholders: ['subtitle'], slotOverrides: { media: { fit: 'contain' } }, notes: 'Keep', objects: slide.objects })
  })

  it('refuses to discard content when the target has no matching tag', () => {
    const slide: CoreSlide = { id: 'fact', role: 'content', layout: 'big-fact', label: 'Fact', value: '42', factLabel: 'Answer' }
    const result = changeLayout(slide, 'title-only', master)
    expect(result.slide).toBeUndefined()
    expect(result.diagnostics.map(item => item.tag)).toEqual(['metric', 'label'])
  })
})
