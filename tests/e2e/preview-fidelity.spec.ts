import { expect, test } from '@playwright/test'

async function normalizedGeometry(page: import('@playwright/test').Page, slideId: string, selector: string) {
  return page.evaluate(({ slideId, selector }) => {
    const stage = document.querySelector<HTMLElement>(`.deck-frame [data-slide-id="${CSS.escape(slideId)}"]`)!
    const preview = document.querySelector<HTMLElement>(`[data-navigator-slide="${CSS.escape(slideId)}"] [data-gallery-slide-preview] section`)!
    const geometry = (root: HTMLElement) => {
      const rootBox = root.getBoundingClientRect()
      const element = root.querySelector<HTMLElement>(selector)!
      const box = element.getBoundingClientRect()
      return {
        x: (box.x - rootBox.x) / rootBox.width,
        y: (box.y - rootBox.y) / rootBox.height,
        width: box.width / rootBox.width,
        height: box.height / rootBox.height,
        display: getComputedStyle(element).display,
        alignItems: getComputedStyle(element).alignItems,
        justifyContent: getComputedStyle(element).justifyContent,
        paddingTop: getComputedStyle(element).paddingTop,
        gridColumn: getComputedStyle(element).gridColumn,
        gap: getComputedStyle(element).gap,
      }
    }
    return { stage: geometry(stage), preview: geometry(preview) }
  }, { slideId, selector })
}

test('Navigator clones the live authored slide and preserves normalized geometry', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  await expect(page.locator('html')).toHaveAttribute('data-studio-ready', '')
  await expect(page.locator('.deck-frame section.present')).toHaveCount(1)
  const result = await page.evaluate(async () => {
    const stage = document.querySelector<HTMLElement>('.deck-frame section.present')!
    const slideId = stage.dataset.slideId!
    const host = document.querySelector<HTMLElement>(`[data-navigator-slide="${slideId}"] [data-gallery-slide-preview]`)!
    const title = stage.querySelector<HTMLElement>('.component-title')!
    const subtitle = stage.querySelector<HTMLElement>('.component-subtitle')!
    title.style.cssText += 'left:13%;top:21%;width:72%;height:31%;text-align:right;'
    subtitle.style.cssText += 'left:64%;top:73%;width:28%;height:9%;text-align:right;'

    const { renderGallerySlidePreview } = await import('/src/rendering/gallery-previews.ts')
    renderGallerySlidePreview(host, stage)
    const preview = host.querySelector<HTMLElement>('section')!
    const geometry = (root: HTMLElement, selector: string) => {
      const rootBox = root.getBoundingClientRect()
      const element = root.querySelector<HTMLElement>(selector)!
      const box = element.getBoundingClientRect()
      return {
        x: (box.x - rootBox.x) / rootBox.width,
        y: (box.y - rootBox.y) / rootBox.height,
        width: box.width / rootBox.width,
        height: box.height / rootBox.height,
        textAlign: getComputedStyle(element).textAlign,
      }
    }
    return ['.component-title', '.component-subtitle'].map(selector => ({
      stage: geometry(stage, selector),
      preview: geometry(preview, selector),
    }))
  })

  for (const pair of result) {
    expect(pair.preview.textAlign).toBe(pair.stage.textAlign)
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(pair.preview[key] - pair.stage[key])).toBeLessThan(.001)
    }
  }
})

test('Navigator preserves quote and attribution slot geometry from the public demo', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  await expect(page.locator('html')).toHaveAttribute('data-studio-ready', '')
  const slideId = 'quote'
  await page.locator(`[data-navigator-select="${slideId}"]`).click()
  await expect(page.locator(`.deck-frame [data-slide-id="${slideId}"]`)).toHaveClass(/present/)

  for (const selector of ['.component-quote', '.quote-attribution']) {
    const pair = await normalizedGeometry(page, slideId, selector)
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(pair.preview[key] - pair.stage[key]), `${selector} ${key}`).toBeLessThan(.001)
    }
    for (const key of ['display', 'alignItems', 'justifyContent', 'paddingTop', 'gridColumn', 'gap'] as const) {
      expect(pair.preview[key], `${selector} ${key}`).toBe(pair.stage[key])
    }
  }
})
