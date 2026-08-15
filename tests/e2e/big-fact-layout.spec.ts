import { expect, test } from '@playwright/test'

test('Big Fact remains dominant while its label forms a grounded panoramic baseline', async ({ page }) => {
  await page.goto('/?view=present&deck=cadenza-demo#/9')
  const slide = page.getByTestId('deck-frame').locator('[data-slide-id="big-fact"]')
  const value = slide.locator('.big-fact-value')
  const label = slide.locator('.component-body')

  await expect(value).toBeVisible()
  const metrics = await value.evaluate(element => {
    const style = getComputedStyle(element)
    const inkProbe = document.createElement('span')
    inkProbe.style.color = 'var(--ink)'
    document.body.append(inkProbe)
    const ink = getComputedStyle(inkProbe).color
    inkProbe.remove()
    return {
      color: style.color,
      ink,
      fontSize: Number.parseFloat(style.fontSize),
      fontFamily: style.fontFamily,
    }
  })
  expect(metrics.color).not.toBe(metrics.ink)
  expect(metrics.fontSize).toBeGreaterThanOrEqual(210)
  expect(metrics.fontFamily).toMatch(/IBM Plex Sans|Noto Sans|PingFang/)

  const [slideBox, valueBox, labelBox] = await Promise.all([slide.boundingBox(), value.boundingBox(), label.boundingBox()])
  expect(valueBox?.height).toBeGreaterThan((labelBox?.height ?? Infinity) * 3)
  const slideCenter = (slideBox?.x ?? 0) + (slideBox?.width ?? 0) / 2
  const valueCenter = (valueBox?.x ?? 0) + (valueBox?.width ?? 0) / 2
  expect(Math.abs(valueCenter - slideCenter)).toBeLessThanOrEqual((slideBox?.width ?? 0) * .02)
  expect(labelBox?.width ?? 0).toBeGreaterThanOrEqual((slideBox?.width ?? Infinity) * .8)
  expect(labelBox?.y ?? 0).toBeGreaterThan((valueBox?.y ?? Infinity) + (valueBox?.height ?? 0))
  const labelStyle = await label.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, borderTop: Number.parseFloat(getComputedStyle(element).borderTopWidth) }))
  expect(labelStyle).toEqual({ background: 'rgba(0, 0, 0, 0)', borderTop: 3 })
  expect(await label.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(26)
})

test('Quote spreads its statement and attribution across one stable panoramic field', async ({ page }) => {
  await page.goto('/?view=present&deck=cadenza-demo#/10')
  const slide = page.getByTestId('deck-frame').locator('[data-slide-id="quote"]')
  const quote = slide.locator('.component-quote')
  const attribution = slide.locator('.quote-attribution')
  const [slideBox, quoteBox, attributionBox] = await Promise.all([slide.boundingBox(), quote.boundingBox(), attribution.boundingBox()])
  expect(quoteBox?.width ?? 0).toBeGreaterThanOrEqual((slideBox?.width ?? Infinity) * .8)
  expect(attributionBox?.width ?? 0).toBeGreaterThanOrEqual((slideBox?.width ?? Infinity) * .8)
  expect(Math.abs((quoteBox?.x ?? 0) - (attributionBox?.x ?? Infinity))).toBeLessThanOrEqual(2)
  expect(attributionBox?.y ?? 0).toBeGreaterThan(quoteBox?.y ?? Infinity)
  const text = quote.locator('p')
  const textRows = await text.evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size
  })
  expect(textRows).toBeLessThanOrEqual(2)
  expect(await quote.evaluate(element => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1)).toBe(true)
  const [sourceBox, authorBox] = await Promise.all([
    attribution.locator('.quote-source').boundingBox(),
    attribution.locator('cite').boundingBox(),
  ])
  expect(sourceBox?.y ?? 0).toBeGreaterThan(authorBox?.y ?? Infinity)
  expect((authorBox?.x ?? 0) + (authorBox?.width ?? 0)).toBeGreaterThan((attributionBox?.x ?? 0) + (attributionBox?.width ?? 0) * .85)
  expect((sourceBox?.x ?? 0) + (sourceBox?.width ?? 0)).toBeGreaterThan((attributionBox?.x ?? 0) + (attributionBox?.width ?? 0) * .85)
})
