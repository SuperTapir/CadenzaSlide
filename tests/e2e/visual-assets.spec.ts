import { expect, test } from '@playwright/test'

const updateVisualReferences = process.env.CADENZA_UPDATE_VISUAL_REFERENCES === '1'

test('Line MD bell loop remains semantic and animates through the one-bit renderer', async ({ page }) => {
  await page.goto('/?view=library')
  await expect(page.locator('#system-gallery')).toBeVisible()
  await page.locator('[data-gallery-section="components-content"] > summary').click()
  const card = page.locator('[data-gallery-component="visual"]')
  const stage = card.locator('[data-visual-asset="icon:line-md-bell-loop"] .cadenza-visual-stage')
  await expect(stage).toHaveAttribute('data-one-bit-ready', '')
  await expect(stage).toHaveAttribute('data-visual-frame', 'poster')
  await expect(stage.locator('canvas.visual-one-bit-canvas')).toHaveCSS('image-rendering', 'pixelated')

  await card.locator('button[data-design-library-preview]').click()
  const dialog = page.locator('dialog[open]')
  const modalStage = dialog.locator('[data-visual-asset="icon:line-md-bell-loop"] .cadenza-visual-stage')
  await expect(modalStage).toHaveAttribute('data-one-bit-ready', '')
  await expect(modalStage).toHaveAttribute('data-smil-renderer', 'native-svg-image+one-bit')
  await expect(modalStage).toHaveAttribute('data-visual-frame', 'active')
  const canvas = modalStage.locator('canvas.visual-one-bit-canvas')
  const firstFrame = await canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL())
  await page.waitForTimeout(360)
  const secondFrame = await canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL())
  expect(secondFrame).not.toBe(firstFrame)
  if (updateVisualReferences) await dialog.screenshot({ path: 'test-results/visual-references/line-md-bell-one-bit-loop.png' })
  await page.waitForTimeout(1_100)
  await expect(modalStage).toHaveAttribute('data-visual-frame', 'active')
  await dialog.locator('[data-design-library-preview-replay]').click()
  await expect(dialog.locator('[data-visual-asset="icon:line-md-bell-loop"] .cadenza-visual-stage')).toHaveAttribute('data-visual-frame', 'active')
})

test('all twelve Hero icons keep bounded vector silhouettes and live two-colour one-bit motion', async ({ page }) => {
  const heroIcons = [
    'icon:line-md-account-add', 'icon:line-md-bell-loop', 'icon:line-md-check-list-3',
    'icon:line-md-cog-loop', 'icon:line-md-confirm-circle', 'icon:line-md-download-loop',
    'icon:line-md-edit', 'icon:line-md-image', 'icon:line-md-phone-call-loop',
    'icon:line-md-search', 'icon:line-md-speed-loop', 'icon:line-md-star-pulsating-loop',
  ]
  const captures: Array<{ id: string, dataUrl: string }> = []
  await page.goto('/?view=library')
  const section = page.locator('[data-gallery-section="visuals"]')
  await section.locator(':scope > summary').click()
  await expect(section.locator('[data-gallery-visual]:visible')).toHaveCount(12)

  for (const id of heroIcons) {
    const card = section.locator(`[data-gallery-visual="${id}"]`)
    await card.locator('[data-design-library-preview]').click()
    const dialog = page.locator('dialog[open]')
    const vectorStage = dialog.locator('.cadenza-visual-stage')
    await expect(vectorStage).toHaveAttribute('data-smil-renderer', 'native-svg')
    const vectorBounds = await vectorStage.locator('svg').evaluate(svgNode => {
      const svg = svgNode as SVGSVGElement
      svg.pauseAnimations()
      const times = [0, .24, 1.5]
      return times.map(time => {
        svg.setCurrentTime(time)
        const frame = svg.getBoundingClientRect()
        const shapes = [...svg.querySelectorAll<SVGGraphicsElement>('path,circle,ellipse,rect,line,polyline,polygon')]
          .filter(shape => !shape.closest('defs,mask,clipPath') && !shape.hasAttribute('mask'))
          .map(shape => shape.getBoundingClientRect())
          .filter(rect => rect.width > 0 || rect.height > 0)
        const union = shapes.reduce((result, rect) => ({
          left: Math.min(result.left, rect.left), top: Math.min(result.top, rect.top),
          right: Math.max(result.right, rect.right), bottom: Math.max(result.bottom, rect.bottom),
        }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })
        return {
          count: shapes.length,
          // Chromium's transformed SVG geometry bounds can overshoot the
          // painted stroke by roughly one logical icon unit. Keep a 5%
          // tolerance here; the one-bit pixel audit below remains strict.
          inside: union.left >= frame.left - frame.width * .05
            && union.top >= frame.top - frame.height * .05
            && union.right <= frame.right + frame.width * .05
            && union.bottom <= frame.bottom + frame.height * .05,
          coverage: Math.max(0, union.right - union.left) * Math.max(0, union.bottom - union.top) / Math.max(1, frame.width * frame.height),
        }
      })
    })
    for (const frame of vectorBounds) {
      expect(frame.count, id).toBeGreaterThan(0)
      expect(frame.inside, id).toBe(true)
      expect(frame.coverage, id).toBeGreaterThan(.04)
      expect(frame.coverage, id).toBeLessThan(.94)
    }

    await dialog.locator('[data-design-library-preview-one-bit]').click()
    await dialog.locator('[data-design-library-preview-replay]').click()
    const oneBitStage = dialog.locator('.cadenza-visual-stage')
    await expect(oneBitStage).toHaveAttribute('data-smil-renderer', 'native-svg-image+one-bit')
    const canvas = oneBitStage.locator('canvas.visual-one-bit-canvas')
    const first = await canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL())
    // Cross a semantic part boundary: most enter icons draw their primary
    // shell first, then reveal the confirming part between 0.3s and 0.7s.
    await page.waitForTimeout(720)
    const second = await canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL())
    expect(second, id).not.toBe(first)
    const pixels = await canvas.evaluate(node => {
      const value = node as HTMLCanvasElement
      const data = value.getContext('2d')!.getImageData(0, 0, value.width, value.height).data
      const colours = new Set<string>()
      let ink = 0
      for (let index = 0; index < data.length; index += 4) {
        colours.add(`${data[index]},${data[index + 1]},${data[index + 2]}`)
        if ((data[index] + data[index + 1] + data[index + 2]) / 3 < 90) ink += 1
      }
      return { colours: colours.size, inkRatio: ink / (data.length / 4) }
    })
    expect(pixels.colours, id).toBeLessThanOrEqual(2)
    expect(pixels.inkRatio, id).toBeGreaterThan(.003)
    expect(pixels.inkRatio, id).toBeLessThan(.45)
    captures.push({ id, dataUrl: second })
    await dialog.locator('[data-design-library-preview-close]').click()
  }

  await page.evaluate(items => {
    const sheet = document.createElement('section')
    sheet.id = 'hero-one-bit-contact-sheet'
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:24px;background:#d0cfc3;color:#302f28;font:700 12px monospace'
    for (const item of items) {
      const figure = document.createElement('figure')
      figure.style.cssText = 'display:grid;place-items:center;gap:8px;margin:0;padding:12px;border:2px solid currentColor;background:#d0cfc3'
      const image = document.createElement('img'); image.src = item.dataUrl; image.style.cssText = 'width:160px;height:160px;object-fit:contain;image-rendering:pixelated'
      const caption = document.createElement('figcaption'); caption.textContent = item.id.replace('icon:line-md-', '')
      figure.append(image, caption); sheet.append(figure)
    }
    document.body.append(sheet)
  }, captures)
  if (updateVisualReferences) await page.locator('#hero-one-bit-contact-sheet').screenshot({ path: 'test-results/visual-references/hero-animated-icons-one-bit.png' })
})

test('all forty-eight production animations retain distinct readable one-bit posters at inline size', async ({ page }) => {
  await page.goto('/?view=library')
  const section = page.locator('[data-gallery-section="visuals"]')
  await section.locator(':scope > summary').click()
  await page.locator('[data-visual-quality-filter]').selectOption('animated')
  await expect(section.locator('[data-gallery-visual]:visible')).toHaveCount(48)

  await section.locator('[data-gallery-visual]:visible .cadenza-visual').evaluateAll(visuals => {
    for (const current of visuals) {
      const visual = current.cloneNode(true) as HTMLElement
      visual.dataset.axisTreatment = 'one-bit-pixel'
      const stage = visual.querySelector<HTMLElement>('.cadenza-visual-stage')!
      stage.style.width = '64px'
      current.replaceWith(visual)
    }
  })

  const stages = section.locator('[data-gallery-visual]:visible .cadenza-visual-stage')
  await expect(stages).toHaveCount(48)
  await expect(stages.first()).toHaveAttribute('data-one-bit-ready', '')
  await expect(stages.last()).toHaveAttribute('data-one-bit-ready', '')
  const posters = await section.locator('[data-gallery-visual]:visible').evaluateAll(cards => cards.map(card => {
    const canvas = card.querySelector<HTMLCanvasElement>('canvas.visual-one-bit-canvas')!
    const context = canvas.getContext('2d')!
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const colours = new Set<string>()
    let ink = 0
    let edgeInk = 0
    for (let index = 0; index < pixels.length; index += 4) {
      const pixel = index / 4
      const x = pixel % canvas.width
      const y = Math.floor(pixel / canvas.width)
      const dark = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3 < 90
      colours.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`)
      if (dark) {
        ink += 1
        if (x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) edgeInk += 1
      }
    }
    return {
      id: (card as HTMLElement).dataset.galleryVisual!,
      dataUrl: canvas.toDataURL(),
      colours: colours.size,
      inkRatio: ink / (canvas.width * canvas.height),
      edgeInk,
    }
  }))
  expect(new Set(posters.map(poster => poster.dataUrl)).size).toBe(48)
  for (const poster of posters) {
    expect(poster.colours, poster.id).toBeLessThanOrEqual(2)
    expect(poster.inkRatio, poster.id).toBeGreaterThan(.004)
    expect(poster.inkRatio, poster.id).toBeLessThan(.5)
    // A rounded 2-unit stroke can contribute a handful of dithered boundary
    // pixels at 64px; a run along the edge would indicate real clipping.
    expect(poster.edgeInk, poster.id).toBeLessThan(9)
  }

  await page.evaluate(items => {
    const sheet = document.createElement('section')
    sheet.id = 'production-one-bit-contact-sheet'
    sheet.style.cssText = 'position:absolute;inset:0 auto auto 0;z-index:9999;width:1280px;display:grid;grid-template-columns:repeat(8,1fr);gap:8px;padding:16px;background:#d0cfc3;color:#302f28;font:700 9px monospace'
    for (const item of items) {
      const figure = document.createElement('figure')
      figure.style.cssText = 'display:grid;place-items:center;gap:5px;margin:0;padding:8px;border:2px solid currentColor;background:#d0cfc3'
      const image = document.createElement('img'); image.src = item.dataUrl; image.style.cssText = 'width:96px;height:96px;object-fit:contain;image-rendering:pixelated'
      const caption = document.createElement('figcaption'); caption.textContent = item.id.replace('icon:line-md-', '')
      figure.append(image, caption); sheet.append(figure)
    }
    document.body.append(sheet)
  }, posters)
  if (updateVisualReferences) await page.locator('#production-one-bit-contact-sheet').screenshot({ path: 'test-results/visual-references/production-animated-icons-one-bit.png' })
})

test('Visuals Gallery exposes Line MD enter and loop icons with deterministic native SVG playback', async ({ page }) => {
  await page.goto('/?view=library')
  const section = page.locator('[data-gallery-section="visuals"]')
  await section.scrollIntoViewIfNeeded()
  await section.locator(':scope > summary').click()
  await expect(section.locator('[data-gallery-visual]')).toHaveCount(208)
  expect(await section.locator('[data-gallery-visual]').evaluateAll(cards => ({
    animated: cards.filter(card => card.getAttribute('data-visual-motion') !== 'none').length,
    loops: cards.filter(card => card.getAttribute('data-visual-motion') === 'loop').length,
  }))).toEqual({ animated: 48, loops: 13 })

  const heroIcons = [
    'icon:line-md-account-add', 'icon:line-md-bell-loop', 'icon:line-md-check-list-3',
    'icon:line-md-cog-loop', 'icon:line-md-confirm-circle', 'icon:line-md-download-loop',
    'icon:line-md-edit', 'icon:line-md-image', 'icon:line-md-phone-call-loop',
    'icon:line-md-search', 'icon:line-md-speed-loop', 'icon:line-md-star-pulsating-loop',
  ]
  const heroCards = section.locator('[data-gallery-visual]:visible')
  await expect(heroCards).toHaveCount(heroIcons.length)
  expect((await heroCards.evaluateAll(cards => cards.map(card => card.getAttribute('data-gallery-visual')))).sort()).toEqual(heroIcons.sort())
  expect(await heroCards.evaluateAll(cards => cards.every(card => {
    const svg = card.querySelector('svg')
    return card.getAttribute('data-visual-quality') === 'hero'
      && Boolean(svg?.querySelector('path, circle, rect, line'))
      && !svg?.querySelector('[data-visual-motion-accent]')
  }))).toBe(true)
  for (const card of await heroCards.all()) {
    const png = await card.locator('.visual-gallery-preview').screenshot()
    const inkRatio = await page.evaluate(async (base64) => {
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
      const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let ink = 0
      for (let index = 0; index < pixels.length; index += 4) if ((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3 < 90) ink += 1
      return ink / (pixels.length / 4)
    }, png.toString('base64'))
    expect(inkRatio).toBeGreaterThan(.003)
    expect(inkRatio).toBeLessThan(.45)
  }
  if (updateVisualReferences) await section.locator('[data-visual-gallery-host]').screenshot({ path: 'test-results/visual-references/animated-icon-catalog.png' })

  const bellCard = section.locator('[data-gallery-visual="icon:line-md-bell-loop"]')
  const thumbnailStage = bellCard.locator('.cadenza-visual-stage')
  await expect(thumbnailStage).toHaveAttribute('data-visual-frame', 'poster')
  await expect(thumbnailStage.locator('animateTransform')).toHaveCount(3)
  if (updateVisualReferences) await bellCard.screenshot({ path: 'test-results/visual-references/line-md-bell-poster.png' })

  await bellCard.locator('[data-design-library-preview]').click()
  const dialog = page.locator('dialog[open]')
  const stage = dialog.locator('.cadenza-visual-stage')
  await expect(stage).toHaveAttribute('data-smil-renderer', 'native-svg')
  await expect(stage).toHaveAttribute('data-visual-frame', 'active')
  await dialog.locator('[data-design-library-preview-poster]').click()
  await expect(stage).toHaveAttribute('data-visual-frame', 'poster')
  await dialog.locator('[data-design-library-preview-poster]').click()
  await expect(stage).toHaveAttribute('data-visual-frame', 'active')
  const svg = stage.locator('svg')
  const shell = svg.locator('path').nth(1)
  const at = async (seconds: number, screenshot: string) => {
    await svg.evaluate((node, time) => {
      const value = node as SVGSVGElement
      value.pauseAnimations()
      value.setCurrentTime(time as number)
    }, seconds)
    const matrix = await shell.evaluate(node => {
      const value = (node as SVGPathElement).getCTM()
      return value ? { a: value.a, b: value.b, c: value.c, d: value.d } : null
    })
    if (updateVisualReferences) await dialog.screenshot({ path: `test-results/visual-references/${screenshot}` })
    return matrix
  }
  const right = await at(6.3, 'line-md-bell-keyframe-right.png')
  const left = await at(6.9, 'line-md-bell-keyframe-left.png')
  const rest = await at(7.5, 'line-md-bell-keyframe-rest.png')
  expect(right?.b).toBeGreaterThan(0)
  expect(left?.b).toBeLessThan(0)
  expect(Math.abs(rest?.b ?? 1)).toBeLessThan(.001)
  await dialog.locator('[data-design-library-preview-one-bit]').click()
  const oneBitStage = dialog.locator('[data-visual-asset="icon:line-md-bell-loop"] .cadenza-visual-stage')
  await expect(oneBitStage).toHaveAttribute('data-smil-renderer', 'native-svg-image+one-bit')
  await expect(oneBitStage.locator('canvas.visual-one-bit-canvas')).toBeVisible()
  await dialog.locator('[data-design-library-preview-close]').click()

  await section.locator('[data-visual-quality-filter]').selectOption('')
  await section.locator('[data-visual-status-filter]').selectOption('production')
  await section.locator('[data-visual-kind-filter]').selectOption('icon')
  await section.locator('[data-visual-motion-filter]').selectOption('static')
  await expect(section.locator('[data-gallery-visual]:visible')).toHaveCount(160)
  await section.locator('[data-visual-motion-filter]').selectOption('')
  await section.locator('[data-visual-motion-mode-filter]').selectOption('loop')
  await expect(section.locator('[data-gallery-visual]:visible')).toHaveCount(13)
})

test('all Lucide icons remain recognizable at minimum one-bit size', async ({ page }) => {
  await page.goto('/?view=library')
  const section = page.locator('[data-gallery-section="visuals"]')
  await section.locator(':scope > summary').click()
  await section.locator('[data-visual-quality-filter]').selectOption('')
  await section.locator('[data-visual-status-filter]').selectOption('production')
  await section.locator('[data-visual-motion-filter]').selectOption('static')

  const qualify = async (count: number) => {
    await section.locator('[data-visual-kind-filter]').selectOption('icon')
    const cards = section.locator('[data-gallery-visual]:visible')
    await expect(cards).toHaveCount(count)
    await cards.locator('.cadenza-visual').evaluateAll(visuals => {
      for (const current of visuals) {
        const visual = current.cloneNode(true) as HTMLElement
        visual.dataset.axisTreatment = 'one-bit-pixel'
        const stage = visual.querySelector<HTMLElement>('.cadenza-visual-stage')!
        stage.style.width = '48px'
        stage.style.height = '48px'
        current.replaceWith(visual)
      }
    })
    const stages = cards.locator('.cadenza-visual-stage')
    await expect(stages).toHaveCount(count)
    await expect(stages.last()).toHaveAttribute('data-one-bit-ready', '', { timeout: 15_000 })
    const results = await cards.evaluateAll(items => items.map(card => {
      const canvas = card.querySelector<HTMLCanvasElement>('canvas.visual-one-bit-canvas')!
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
      let ink = 0; let edgeInk = 0
      for (let index = 0; index < pixels.length; index += 4) {
        const pixel = index / 4; const x = pixel % canvas.width; const y = Math.floor(pixel / canvas.width)
        if ((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3 < 90) {
          ink += 1
          if (x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) edgeInk += 1
        }
      }
      return { id: (card as HTMLElement).dataset.galleryVisual!, inkRatio: ink / Math.max(1, canvas.width * canvas.height), edgeInk }
    }))
    for (const result of results) {
      expect(result.inkRatio, result.id).toBeGreaterThan(.003)
      expect(result.inkRatio, result.id).toBeLessThan(.55)
      expect(result.edgeInk, result.id).toBeLessThan(12)
    }
  }

  await qualify(160)
})

test('reduced motion freezes animated one-bit visuals on their poster frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?view=library')
  const section = page.locator('[data-gallery-section="components-content"]')
  await section.locator(':scope > summary').click()
  const card = page.locator('[data-gallery-component="visual"]')
  await expect(card).toBeVisible()
  await expect(card.locator('[data-visual-asset="icon:line-md-bell-loop"] .cadenza-visual-stage')).toHaveAttribute('data-one-bit-ready', '')
  await card.locator('button[data-design-library-preview]').click()
  const stage = page.locator('dialog[open] [data-visual-asset="icon:line-md-bell-loop"] .cadenza-visual-stage')
  await expect(stage).toHaveAttribute('data-visual-frame', 'poster')
  await expect(stage).not.toHaveAttribute('data-smil-renderer', 'native-svg-image+one-bit')
})
