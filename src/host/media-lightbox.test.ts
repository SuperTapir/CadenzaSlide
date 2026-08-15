import { describe, expect, it } from 'vitest'
import { isPresentationNavigationKey, renderMediaLightbox } from './media-lightbox'

describe('media lightbox contract', () => {
  it('renders one accessible native dialog', () => {
    const html = renderMediaLightbox()
    expect(html).toContain('<dialog')
    expect(html).toContain('aria-label="媒体放大预览"')
    expect(html).toContain('data-media-lightbox-close')
    expect(html).toContain('data-media-lightbox-content')
    expect(html).toContain('data-media-lightbox-zoom-out')
    expect(html).toContain('data-media-lightbox-zoom-value')
    expect(html).toContain('data-media-lightbox-zoom-in')
    expect(html).toContain('data-media-lightbox-reset')
  })

  it.each(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])('blocks Reveal navigation key %s while open', (key) => {
    expect(isPresentationNavigationKey(key)).toBe(true)
  })

  it('leaves focus navigation available', () => {
    expect(isPresentationNavigationKey('Tab')).toBe(false)
    expect(isPresentationNavigationKey('Enter')).toBe(false)
  })
})
