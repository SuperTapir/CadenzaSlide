import { expect, test } from '@playwright/test'

test('title-only reserves most of the page for readable authored content', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/6')
  const slide = page.locator('[data-slide-id="title-only"].present')
  const composition = slide.locator('[data-component-kind="composition"]')
  const geometry = await Promise.all([slide.boundingBox(), composition.boundingBox()])
  const [slideBox, compositionBox] = geometry
  expect(slideBox).not.toBeNull()
  expect(compositionBox).not.toBeNull()
  expect((compositionBox!.y - slideBox!.y) / slideBox!.height).toBeLessThanOrEqual(.4)
  expect(compositionBox!.height / slideBox!.height).toBeGreaterThanOrEqual(.53)

  const tags = slide.locator('.cadenza-cluster[data-axis-wrap="wrap"] > .cadenza-caption')
  await expect(tags).toHaveCount(11)
  expect(await tags.evaluateAll(items => items.every(item => {
    const element = item as HTMLElement
    const style = getComputedStyle(element)
    return style.whiteSpace === 'nowrap' && Number.parseFloat(style.fontSize) >= 12 && element.scrollWidth <= element.clientWidth + 1
  }))).toBe(true)
  expect(await tags.evaluateAll(items => items.every(item => {
    const box = item.getBoundingClientRect()
    const host = item.closest<HTMLElement>('[data-component-kind="composition"]')!.getBoundingClientRect()
    return box.left >= host.left - 1 && box.right <= host.right + 1 && box.top >= host.top - 1 && box.bottom <= host.bottom + 1
  }))).toBe(true)

  const panels = await slide.locator('[data-node-id$="-stack"]').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect()
    return { top: box.top, height: box.height }
  }))
  expect(Math.max(...panels.map(panel => panel.top)) - Math.min(...panels.map(panel => panel.top))).toBeLessThanOrEqual(1)
  expect(panels.every(panel => panel.height > 0)).toBe(true)

  const categorySurfaces = slide.locator('[data-node-id="language-layout"], [data-node-id="language-content"], [data-node-id="language-relation"]')
  expect(await categorySurfaces.evaluateAll(nodes => new Set(nodes.map(node => getComputedStyle(node).backgroundColor)).size)).toBe(1)
})
