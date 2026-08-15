import { expect, test } from '@playwright/test'

test('keeps English UI chrome across Decks, Studio, Design Library, Overview, and Audience', async ({ page }) => {
  await page.goto('/?view=decks&lang=en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible()
  expect((await page.locator('[data-ui-locale-switcher]').boundingBox())?.width).toBeLessThan(180)

  await page.goto('/?view=studio&deck=cadenza-demo&lang=en#/1')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('#presentation-end')).toHaveText('End presentation')
  await expect(page.locator('#audience-open')).toHaveText('Open audience view')
  await expect(page.locator('[data-ui-locale-switcher] a[lang="zh-CN"]')).toHaveAttribute('href', /view=studio.*deck=cadenza-demo.*lang=zh-CN/)

  await page.goto('/?view=library&deck=cadenza-demo&lang=en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Layouts and component reference' })).toBeVisible()
  await expect(page.getByLabel('Search Design Library')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible()

  await page.goto('/?view=overview&deck=cadenza-demo&lang=en')
  await expect(page.getByLabel('Search slide title or ID')).toBeVisible()
  await expect(page.getByLabel('Filter by group')).toContainText('All groups')

  await page.goto('/?view=audience&deck=cadenza-demo&lang=en#/1')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('application', { name: 'CadenzaSlide presentation' })).toBeVisible()
})

test('uses browser language when lang is absent and explicit query wins', async ({ browser }) => {
  const english = await browser.newContext({ locale: 'en-US' })
  const page = await english.newPage()
  await page.goto('/?view=decks')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible()
  await page.goto('/?view=decks&lang=zh-CN')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByRole('heading', { name: '你的 Deck' })).toBeVisible()
  await english.close()
})
