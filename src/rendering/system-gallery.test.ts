import { describe, expect, it } from 'vitest'
import { coreLayoutIds } from '../core/deck-master'
import { componentCatalog, componentPreviewFixtures, compositionCatalog, layoutCatalog, renderSystemGallery } from './system-gallery'
import { validateCompositionTree } from '../authoring/component-library'

describe('read-only Design Library', () => {
  it('lists fourteen layouts and the atomic production component registry', () => {
    expect(layoutCatalog.map(entry => entry.id)).toEqual(coreLayoutIds)
    expect(layoutCatalog[0]).toMatchObject({ label: 'Title / Cover', description: '封面、开场与核心命题。' })
    expect(componentCatalog).toHaveLength(21)
    expect(componentCatalog.map(entry => entry.id)).toEqual(expect.arrayContaining(['stack', 'split', 'metric', 'media', 'code', 'connector']))
    expect(componentCatalog.some(entry => entry.id.includes('.'))).toBe(false)
    expect(componentCatalog.map(entry => entry.category)).toEqual(expect.arrayContaining(['layout', 'content', 'relationship']))
  })
  it('renders previews without apply controls', () => {
    const html = renderSystemGallery()
    expect(html.match(/data-gallery-layout=/g)).toHaveLength(14)
    expect(html.match(/data-gallery-component=/g)).toHaveLength(21)
    expect(html).toContain('data-cadenza-component="metric"')
    expect(html).not.toContain('metric.hero')
    expect(html).toContain('data-gallery-typography=')
    expect(html).toContain('data-gallery-background=')
    expect(html).toContain('data-gallery-slide-transition=')
    expect(html).toContain('data-gallery-element-transition=')
    expect(html.match(/data-gallery-visual=/g)).toHaveLength(208)
    expect(html).toContain('data-visual-gallery-template')
    expect(html).toContain('data-visual-kind-filter')
    expect(html).toContain('data-visual-status-filter')
    expect(html).not.toContain('data-apply')
    expect(html.match(/class="gallery-startup-preview"/g)).toHaveLength(14)
    expect(html).not.toContain('data-gallery-preview-variant="skeleton"')
    expect(html.match(/data-gallery-preview-variant="composed"/g)).toHaveLength(14)
    expect(html).not.toContain('class="gallery-preview-variants"')
  })
  it('localizes Design Library controls without changing catalog fixtures', () => {
    const html = renderSystemGallery('en', '?view=library&lang=en')
    expect(html).toContain('Layouts and component reference')
    expect(html).toContain('Browse system capabilities')
    expect(html).toContain('aria-label="Search Design Library"')
    expect(html).toContain('Copy composition tree')
    expect(html).toContain('Open preview: Title / Cover')
    expect(html).toContain('data-ui-locale-switcher')
    expect(html).not.toContain('>关闭</button>')
  })
  it('marks curated native enter, loop and hero sources without legacy originals', () => {
    const html = renderSystemGallery()
    expect(html).toContain('data-gallery-visual="icon:line-md-bell-loop" data-visual-kind="icon" data-visual-status="production" data-visual-quality="hero" data-visual-motion="loop" data-visual-motion-mode="loop"')
    expect(html).toContain('data-gallery-visual="icon:line-md-account" data-visual-kind="icon" data-visual-status="production" data-visual-quality="production" data-visual-motion="enter" data-visual-motion-mode="enter"')
    expect(html).not.toContain('data-gallery-visual="icon:material-add-event"')
    expect(html).not.toMatch(/data-gallery-visual="(?:annotation|illustration|companion):/)
  })
  it('uses the grid and full-width preview button styles expected by the gallery CSS', () => {
    const html = renderSystemGallery()
    expect(html.match(/class="gallery-grid-list(?: [^"]+)?"/g)).toHaveLength(9)
    expect(html.match(/class="gallery-preview-button/g)).toHaveLength(257)
    expect(html).not.toContain('class="gallery-skeleton-action"')
    expect(html.match(/class="gallery-card-index"/g)).toHaveLength(14)
    expect(html.match(/class="gallery-card-status"/g)).toHaveLength(14)
    expect(html).toContain('class="gallery-header"')
    expect(html).toContain('class="gallery-search"')
  })
  it('renders component previews on a logical 1280×720 canvas before scaling the thumbnail', () => {
    const html = renderSystemGallery()
    expect(html).toContain('data-gallery-slide-preview="component-metric"')
    expect(html).toContain('data-slide-id="gallery-component-metric"')
    expect(html).not.toContain('class="gallery-component-preview"')
  })

  it('uses semantic diagrams instead of one generic Evidence placeholder for layout primitives', () => {
    expect(Object.keys(componentPreviewFixtures)).toEqual(['stack', 'cluster', 'grid', 'split', 'inset', 'overlay', 'media', 'code'])
    for (const [id, tree] of Object.entries(componentPreviewFixtures)) {
      expect(validateCompositionTree(tree), id).toEqual([])
    }
    const html = renderSystemGallery()
    for (const label of ['01 结论', '02 证据', '03 行动', '产品', '服务', '渠道', '主区域', '辅助区域', '局部注释', '图片上的标题']) {
      expect(html).toContain(label)
    }
    expect(html).not.toContain('src="/hero.png"')
    expect(html).not.toContain('src="xxxxxxxx"')
  })

  it('groups atomic components and exposes contracts plus copyable composition trees', () => {
    const html = renderSystemGallery()
    expect(html).toContain('data-gallery-section="components-layout"')
    expect(html).toContain('data-gallery-section="components-content"')
    expect(html).toContain('data-gallery-section="components-relationship"')
    expect(html).toContain('data-gallery-section="components-compositions"')
    expect(html.match(/data-component-contract=/g)).toHaveLength(21)
    expect(html.match(/data-gallery-composition=/g)).toHaveLength(14)
    expect(html.match(/data-copy-composition/g)).toHaveLength(14)
    expect(html).toContain('Props')
    expect(html).toContain('Slots')
    expect(html).toContain('Axes')
  })

  it('publishes composer candidates plus reusable numbered-series scenarios', () => {
    expect(compositionCatalog).toHaveLength(14)
    expect(compositionCatalog.map(entry => entry.id)).toEqual(expect.arrayContaining([
      'series-peer-panels', 'series-ordered-gates', 'series-evidence-split', 'series-asymmetric-evidence', 'series-code-contract',
    ]))
    expect(new Set(compositionCatalog.map(entry => entry.fingerprint)).size).toBeGreaterThan(1)
    for (const entry of compositionCatalog) {
      expect(entry.signalIds.length).toBeGreaterThan(0)
      expect(validateCompositionTree(entry.tree), entry.id).toEqual([])
    }
  })
})
