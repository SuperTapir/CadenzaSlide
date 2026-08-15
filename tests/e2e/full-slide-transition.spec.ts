import { expect, test, type Page } from '@playwright/test'

async function openDeck(page: Page, hash = '', renderer?: 'canvas2d') {
  await page.goto(`/?view=present&deck=cadenza-demo${renderer ? `&renderer=${renderer}` : ''}${hash}`)
  await expect(page.locator('html')).toHaveAttribute('data-studio-ready', '', { timeout: 15_000 })
}

test('keeps the complete outgoing page in the pixel transition overlay', async ({ page }) => {
  await openDeck(page)
  const stage = page.getByTestId('deck-frame')
  await expect(stage.locator('[data-slide-id="intro"].present')).toBeVisible()

  const overlayAppeared = page.waitForSelector('.slide-transition-overlay', { state: 'attached' })
  await page.keyboard.press('ArrowRight')
  const overlay = await overlayAppeared
  await page.waitForFunction(element => (element as HTMLElement).dataset.transitionReady === '', overlay)

  expect(await overlay.textContent()).toContain('不是模板')
  expect(await overlay.$('.slide-transition-background')).not.toBeNull()
  expect(await overlay.$eval('.slide-transition-background', element => {
    const canvas = element as HTMLCanvasElement
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    return pixels.some((value, index) => index % 4 === 3 && value > 0)
  })).toBe(true)
  expect(await overlay.evaluate(element => getComputedStyle(element).maskImage)).not.toBe('none')
  const maskContract = await overlay.evaluate(async element => {
    const mode = getComputedStyle(element).getPropertyValue('mask-mode')
    const match = element.style.maskImage.match(/url\(["']?(data:[^"')]+)["']?\)/)
    if (!match) throw new Error('Transition mask is not an embedded bitmap')
    const image = new Image()
    image.src = match[1]
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const visibleColours = new Set<string>()
    const alphaValues = new Set<number>()
    for (let index = 0; index < pixels.length; index += 4) {
      alphaValues.add(pixels[index + 3])
      if (pixels[index + 3]) visibleColours.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`)
    }
    return {
      mode,
      visibleColours: [...visibleColours],
      alphaValues: [...alphaValues],
    }
  })
  // Chromium can parse mask-mode while omitting it from computed-style
  // serialization. The bitmap assertions below are the observable contract.
  expect(['', 'alpha']).toContain(maskContract.mode)
  expect(maskContract.visibleColours.every(colour => colour === '255,255,255')).toBe(true)
  expect(maskContract.alphaValues.length).toBeGreaterThan(0)
  expect(maskContract.alphaValues.every(alpha => alpha === 0 || alpha === 255)).toBe(true)
  expect(await overlay.evaluate(element => element.style.maskSize)).toBe('12px')
  await expect(stage.locator('[data-slide-id="title-photo"].present')).toBeVisible()
  await expect(page.locator('.slide-transition-overlay')).toHaveCount(0)
})

test('aligns the pixel transition with the authored 5px one-bit grid', async ({ page }) => {
  await openDeck(page)
  await page.locator('#scale').evaluate(button => {
    button.hidden = false
    button.disabled = false
    button.click()
  })
  await expect(page.locator('#scale')).toContainText('5 PX')

  const overlayAppeared = page.waitForSelector('.slide-transition-overlay', { state: 'attached' })
  await page.keyboard.press('ArrowRight')
  const overlay = await overlayAppeared
  await page.waitForFunction(element => (element as HTMLElement).dataset.transitionReady === '', overlay)

  expect(await overlay.evaluate(element => element.style.maskSize)).toBe('20px')
})

test('uses the actual outgoing page when navigating backwards', async ({ page }) => {
  await openDeck(page)
  const stage = page.getByTestId('deck-frame')
  const forwardOverlay = page.waitForSelector('.slide-transition-overlay', { state: 'attached' })
  await page.keyboard.press('ArrowRight')
  await forwardOverlay
  await expect(page.locator('.slide-transition-overlay')).toHaveCount(0)

  const backwardOverlay = page.waitForSelector('.slide-transition-overlay', { state: 'attached' })
  await page.keyboard.press('ArrowLeft')
  const overlay = await backwardOverlay

  expect(await overlay.textContent()).toContain('模板保证一致')
  await expect(stage.locator('.reveal:not(.slide-transition-reveal) > .slides > [data-slide-id="intro"].present')).toBeVisible()
  await expect(page.locator('.slide-transition-overlay')).toHaveCount(0)
})

test('transitions only changed one-bit background pixels across slides 9, 10, and 11', async ({ page }) => {
  await openDeck(page, '#/8')
  const stage = page.getByTestId('deck-frame')
  await expect(stage.locator('.reveal:not(.slide-transition-reveal) > .slides > [data-slide-id="statement"].present')).toBeVisible()

  for (const [target, index] of [['big-fact', 9], ['quote', 10]] as const) {
    const overlayAppeared = page.waitForSelector('.slide-transition-overlay', { state: 'attached' })
    await page.evaluate(targetIndex => { location.hash = `#/${targetIndex}` }, index)
    const overlay = await overlayAppeared
    await page.waitForFunction(element => (element as HTMLElement).dataset.transitionReady === '', overlay)

    const delta = await overlay.$eval('.slide-transition-background', (snapshotElement, overlayElement) => {
      const snapshot = snapshotElement as HTMLCanvasElement
      const outgoing = snapshot.getContext('2d')!.getImageData(0, 0, snapshot.width, snapshot.height).data
      let transparent = 0
      let opaque = 0
      for (let index = 0; index < outgoing.length; index += 4) {
        if (outgoing[index + 3]) opaque += 1
        else transparent += 1
      }
      const transition = overlayElement as HTMLElement
      return {
        unchanged: Number(transition.dataset.backgroundUnchangedPixels),
        changed: Number(transition.dataset.backgroundChangedPixels),
        transparent,
        opaque,
      }
    }, overlay)

    expect(delta.unchanged).toBeGreaterThan(0)
    expect(delta.changed).toBeGreaterThan(0)
    expect(delta.transparent).toBe(delta.unchanged)
    expect(delta.opaque).toBe(delta.changed)
    await expect(stage.locator(`.reveal:not(.slide-transition-reveal) > .slides > [data-slide-id="${target}"].present`)).toBeVisible()
    await expect(page.locator('.slide-transition-overlay')).toHaveCount(0)
  }
})

test('computes changed background pixels with the Canvas2D fallback', async ({ page }) => {
  await openDeck(page, '#/8', 'canvas2d')
  await expect(page.locator('#environment canvas')).toHaveAttribute('data-renderer', 'canvas2d')

  const overlayAppeared = page.waitForSelector('.slide-transition-overlay', { state: 'attached' })
  await page.evaluate(() => { location.hash = '#/9' })
  const overlay = await overlayAppeared
  await page.waitForFunction(element => (element as HTMLElement).dataset.transitionReady === '', overlay)

  expect(Number(await overlay.getAttribute('data-background-unchanged-pixels'))).toBeGreaterThan(0)
  expect(Number(await overlay.getAttribute('data-background-changed-pixels'))).toBeGreaterThan(0)
})

test('replaces an interrupted overlay instead of leaving transition debris', async ({ page }) => {
  await openDeck(page)
  const stage = page.getByTestId('deck-frame')
  await expect(stage.locator('[data-slide-id="intro"].present')).toBeVisible()

  const firstOverlay = page.waitForSelector('.slide-transition-overlay', { state: 'attached' })
  await page.keyboard.press('ArrowRight')
  await firstOverlay
  await page.keyboard.press('ArrowRight')

  await expect(page.locator('.slide-transition-overlay')).toHaveCount(1)
  await expect(stage.locator('[data-slide-id="title-photo-alt"].present')).toBeVisible()
  await expect(page.locator('.slide-transition-overlay')).toHaveCount(0)
})

test('applies every authored motion preset to the complete outgoing page', async ({ page }) => {
  await openDeck(page)
  const stage = page.getByTestId('deck-frame')
  const presets = ['pass-left', 'pass-up', 'unfold', 'focus', 'land', 'accumulate', 'lock', 'replace']

  for (const [index, preset] of presets.entries()) {
    await stage.locator('.slides > section').nth(index + 1).evaluate((slide, motion) => { (slide as HTMLElement).dataset.cadenzaMotion = motion }, preset)
    const overlayAppeared = page.waitForSelector('.slide-transition-overlay', { state: 'attached' })
    await page.keyboard.press('ArrowRight')
    const overlay = await overlayAppeared
    expect(await overlay.getAttribute('data-motion')).toBe(preset)
    await expect(page.locator('.slide-transition-overlay')).toHaveCount(0)
  }

  await stage.locator('.slides > section').nth(9).evaluate(slide => { (slide as HTMLElement).dataset.cadenzaMotion = 'cut' })
  await page.keyboard.press('ArrowRight')
  await expect(stage.locator('.reveal:not(.slide-transition-reveal) > .slides > section').nth(9)).toHaveClass(/present/)
  await page.waitForTimeout(280)
  await expect(page.locator('.slide-transition-overlay')).toHaveCount(0)
})

test.describe('reduced motion', () => {
  test('switches slides without creating a transition overlay', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openDeck(page)
    const stage = page.getByTestId('deck-frame')
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    await expect(stage).toHaveAttribute('data-reduced-motion', '')

    await page.keyboard.press('ArrowRight')

    await expect(stage.locator('.reveal:not(.slide-transition-reveal) > .slides > [data-slide-id="title-photo"].present')).toBeVisible()
    await page.waitForTimeout(280)
    await expect(page.locator('.slide-transition-overlay')).toHaveCount(0)
    await expect(stage).toHaveAttribute('data-environment-mode', 'static')
  })
})

for (const background of ['black', 'white']) {
  test(`keeps a shared ${background} background out of the transition layer`, async ({ page }) => {
    await openDeck(page)
    const stage = page.getByTestId('deck-frame')
    await stage.locator('[data-slide-id="title-photo"], [data-slide-id="title-photo-alt"]').evaluateAll((slides, scene) => {
      slides.forEach(slide => {
        const element = slide as HTMLElement
        element.dataset.cadenzaScene = scene
        element.dataset.environmentMode = 'static'
        element.className = element.className.split(/\s+/).filter(name => !name.startsWith('template-')).join(' ')
        element.replaceChildren()
      })
    }, background)

    const next = stage.getByRole('button', { name: 'next slide' })
    const firstOverlay = page.waitForSelector('.slide-transition-overlay', { state: 'attached' })
    await next.click()
    await firstOverlay
    await expect(page.locator('.slide-transition-overlay')).toHaveCount(0)
    const overlayAppeared = page.waitForSelector('.slide-transition-overlay', { state: 'attached' })
    await next.click()
    const overlay = await overlayAppeared

    const transitionState = {
      outgoing: await overlay.$eval('section', slide => ({ id: (slide as HTMLElement).dataset.slideId, scene: (slide as HTMLElement).dataset.cadenzaScene })),
      incoming: await stage.locator('.reveal:not(.slide-transition-reveal) > .slides > section.present').evaluate(slide => ({ id: (slide as HTMLElement).dataset.slideId, scene: (slide as HTMLElement).dataset.cadenzaScene })),
      hasBackground: await overlay.$('.slide-transition-background') !== null,
    }
    expect(transitionState).toEqual({
      outgoing: { id: 'title-photo', scene: background },
      incoming: { id: 'title-photo-alt', scene: background },
      hasBackground: false,
    })
    await expect(stage.locator('.reveal:not(.slide-transition-reveal) > .slides > [data-slide-id="title-photo-alt"].present')).toBeVisible()
  })
}
