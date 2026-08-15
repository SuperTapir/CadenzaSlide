import { expect, test } from '@playwright/test'
import { inspectRenderedSlide } from '../../src/platform/node/browser-smoke'

test('Statement keeps readable copy inside its authored master slots', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/8')
  const slide = page.locator('[data-slide-id="statement"].present')
  const title = slide.locator('.component-title')
  const context = slide.locator('.component-subtitle')
  const [slideBox, titleBox, contextBox] = await Promise.all([slide.boundingBox(), title.boundingBox(), context.boundingBox()])

  expect((titleBox?.y ?? Infinity) + (titleBox?.height ?? 0)).toBeLessThanOrEqual((slideBox?.y ?? 0) + (slideBox?.height ?? 0) * .55 + 2)
  expect((contextBox?.y ?? Infinity) + (contextBox?.height ?? 0)).toBeLessThanOrEqual((slideBox?.y ?? 0) + (slideBox?.height ?? 0) * .8 + 2)
  expect(await title.locator('.title-box').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)')

  const audit = await page.evaluate(inspectRenderedSlide, 'statement')
  expect({ clippedText: audit.clippedText, orphanLines: audit.orphanLines, overlappingContent: audit.overlappingContent }).toEqual({ clippedText: [], orphanLines: [], overlappingContent: [] })
})
