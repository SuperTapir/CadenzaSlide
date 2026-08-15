import { expect, test } from '@playwright/test'
import { inspectRenderedSlide } from '../../src/platform/node/browser-smoke'

const showcaseSlides = [
  'atomic-business-summary',
  'atomic-feature-explanation',
  'atomic-comparison',
  'atomic-steps',
  'atomic-timeline',
  'atomic-people',
  'atomic-system-relationship',
  'atomic-quote',
  'atomic-media-narrative',
] as const

const productionComponents = [
  'stack', 'cluster', 'grid', 'split', 'inset', 'overlay',
  'heading', 'copy', 'metric', 'list', 'card', 'quote', 'media', 'profile', 'logo', 'caption',
  'divider', 'connector', 'progress',
] as const

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('atomic compositions stay editable and inside the 1280×720 Studio canvas', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  const slides = page.getByTestId('deck-frame').locator(showcaseSlides.map(id => `[data-slide-id="${id}"]`).join(','))
  await expect(slides).toHaveCount(showcaseSlides.length)

  const state = await slides.evaluateAll(elements => elements.map(slide => {
    const composition = slide.querySelector<HTMLElement>('[data-component-kind="composition"]')
    const root = composition?.querySelector<HTMLElement>('[data-node-id]')
    const slideBox = slide.getBoundingClientRect()
    const box = composition?.getBoundingClientRect()
    const canvas = slide.closest<HTMLElement>('.studio-canvas-transform')
    return {
      id: slide.getAttribute('data-slide-id'),
      logicalCanvas: Boolean(canvas && Number.parseFloat(getComputedStyle(canvas).width) === 1280 && Number.parseFloat(getComputedStyle(canvas).height) === 720),
      editable: composition?.dataset.rasterized === 'false',
      nativeRenderer: root?.dataset.componentRenderer === 'html-native',
      diagnosed: composition?.dataset.compositionDiagnosis === 'fit',
      inside: Boolean(box && box.left >= slideBox.left - 1 && box.top >= slideBox.top - 1 && box.right <= slideBox.right + 1 && box.bottom <= slideBox.bottom + 1),
      noOverflow: Boolean(composition && composition.scrollWidth <= composition.clientWidth + 1 && composition.scrollHeight <= composition.clientHeight + 1),
      components: [...slide.querySelectorAll<HTMLElement>('[data-cadenza-component]')].map(node => node.dataset.cadenzaComponent),
    }
  }))

  expect(state.map(item => item.id)).toEqual(showcaseSlides)
  expect(state.filter(item => !item.logicalCanvas || !item.editable || !item.nativeRenderer || !item.diagnosed || !item.inside || !item.noOverflow)).toEqual([])
  expect(new Set(state.flatMap(item => item.components))).toEqual(new Set(productionComponents))
  const intrinsicStackChildren = slides.locator('.cadenza-stack > :is(.cadenza-copy, .cadenza-logo, .cadenza-progress)')
  expect(await intrinsicStackChildren.evaluateAll(nodes => nodes.every(node => {
    const expected = node.parentElement?.getAttribute('data-axis-density') === 'open' && node.classList.contains('cadenza-progress') ? '1' : '0'
    return getComputedStyle(node).flexGrow === expected
  }))).toBe(true)
})

test('atomic compositions render in Audience with meaningful component semantics', async ({ page }) => {
  for (const [offset, id] of showcaseSlides.entries()) {
    await page.goto(`/?view=audience&deck=cadenza-demo#/${17 + offset}`)
    const slide = page.locator(`[data-slide-id="${id}"].present`)
    await expect(slide).toBeVisible()
    await expect(slide.locator('[data-component-kind="composition"]')).toHaveCount(1)
    await expect(slide.locator('[data-node-id]')).not.toHaveCount(0)
    expect(await slide.locator('[data-node-id]').evaluateAll(nodes => nodes.every(node => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && Boolean(node.getAttribute('data-cadenza-component'))
    }))).toBe(true)
    const audit = await page.evaluate(inspectRenderedSlide, id)
    expect({ clippedText: audit.clippedText, orphanLines: audit.orphanLines, emptySurfaces: audit.emptySurfaces, misalignedSplits: audit.misalignedSplits, misalignedPeers: audit.misalignedPeers, underfilledRegions: audit.underfilledRegions, unreadableRelationships: audit.unreadableRelationships, unreadableContent: audit.unreadableContent, decorativeCollisions: audit.decorativeCollisions }).toEqual({
      clippedText: [], orphanLines: [], emptySurfaces: [], misalignedSplits: [], misalignedPeers: [], underfilledRegions: [], unreadableRelationships: [], unreadableContent: [], decorativeCollisions: [],
    })
    expect(audit.contentCoverage).toBeGreaterThanOrEqual(35)
    expect(audit.verticalCoverage).toBeGreaterThanOrEqual(60)
  }
})

test('overlay contrast reaches semantic copy nested inside layout components', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/25')
  const overlay = page.locator('[data-slide-id="atomic-media-narrative"].present [data-node-id="media-overlay"] > [data-slot="overlay"]')
  await overlay.evaluate(slot => {
    const heading = slot.querySelector<HTMLElement>('.cadenza-heading')!
    const card = document.createElement('div')
    card.className = 'cadenza-component cadenza-card'
    card.dataset.cadenzaComponent = 'card'
    card.textContent = 'Card copy remains dark on its paper surface'
    const stack = document.createElement('div')
    stack.className = 'cadenza-component cadenza-stack'
    stack.dataset.cadenzaComponent = 'stack'
    stack.append(heading)
    slot.append(card)
    slot.append(stack)
  })
  const colors = await overlay.evaluate(slot => ({
    slot: getComputedStyle(slot).color,
    card: getComputedStyle(slot.querySelector('.cadenza-card')!).color,
    heading: getComputedStyle(slot.querySelector('.cadenza-heading')!).color,
  }))
  expect(colors.heading).toBe(colors.slot)
  expect(colors.card).not.toBe(colors.slot)
})

test('taxonomy content uses wrapped opaque tags instead of a table-like list', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/6')
  const slide = page.locator('[data-slide-id="title-only"].present')
  const titleSurface = await slide.locator('.title-box').evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, image: style.backgroundImage }
  })
  expect(titleSurface).toEqual({ background: 'rgba(0, 0, 0, 0)', image: 'none' })
  await expect(slide.locator('.cadenza-list')).toHaveCount(0)
  const tags = slide.locator('.cadenza-cluster[data-axis-wrap="wrap"] > .cadenza-caption')
  await expect(tags).toHaveCount(11)
  expect(await tags.evaluateAll(nodes => nodes.every(node => {
    const style = getComputedStyle(node)
    return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.whiteSpace === 'nowrap' && Number.parseFloat(style.fontSize) >= 12
  }))).toBe(true)
  await tags.first().evaluate(element => { (element as HTMLElement).style.fontSize = '11px' })
  expect((await page.evaluate(inspectRenderedSlide, 'title-only')).unreadableContent).not.toEqual([])
  expect((await page.evaluate(inspectRenderedSlide, 'title-only')).decorativeCollisions).toEqual([])
})

test('before-after explains the transformation as a coupled block becoming a reusable pipeline', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/19')
  const slide = page.locator('[data-slide-id="atomic-comparison"].present')
  await expect(slide.locator('.cadenza-list')).toHaveCount(0)
  await expect(slide.locator('[data-node-id="comparison-before"]')).toContainText('内容 × Variant × Renderer')
  const regions = await slide.locator('[data-node-id="comparison-split"] > .cadenza-slot').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()))
  expect(regions).toHaveLength(2)
  expect(Math.abs(regions[0].width - regions[1].width)).toBeLessThanOrEqual(2)
  expect(regions[0].right).toBeLessThan(regions[1].left)
  const pipeline = slide.locator('[data-node-id="comparison-after-pipeline"]')
  await expect(pipeline.locator('.cadenza-card')).toHaveCount(3)
  await expect(pipeline.locator('.cadenza-connector')).toHaveCount(0)
  const positions = await pipeline.locator(':scope > [data-node-id]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().left))
  expect(positions).toEqual([...positions].sort((left, right) => left - right))
  expect(await slide.locator('[data-node-id="comparison-before-coupling"] .cadenza-card, [data-node-id="comparison-after-pipeline"] .cadenza-card').evaluateAll(cards => cards.every(card => {
    const surface = card.getBoundingClientRect()
    const title = card.querySelector('h4')!.getBoundingClientRect()
    return title.left >= surface.left - 1 && title.right <= surface.right + 1 && title.top >= surface.top - 1 && title.bottom <= surface.bottom + 1
  }))).toBe(true)
  const audit = await page.evaluate(inspectRenderedSlide, 'atomic-comparison')
  expect(audit.unreadableContent).toEqual([])
  expect(audit.clippedText).toEqual([])
})

test('region balance treats a production visual as meaningful split content', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/19')
  const slide = page.locator('[data-slide-id="atomic-comparison"].present')
  const secondary = slide.locator('[data-node-id="comparison-split"] > [data-slot="secondary"]')
  await secondary.evaluate(slot => {
    const visual = document.createElement('figure')
    visual.className = 'cadenza-component cadenza-visual'
    visual.dataset.cadenzaComponent = 'visual'
    visual.dataset.nodeId = 'region-balance-visual'
    const stage = document.createElement('span')
    stage.className = 'cadenza-visual-stage'
    stage.innerHTML = '<svg viewBox="0 0 100 100" role="img" aria-label="Direction"><path d="M10 50h70M60 30l20 20-20 20" fill="none" stroke="currentColor" stroke-width="8"/></svg>'
    visual.append(stage)
    slot.replaceChildren(visual)
  })
  const audit = await page.evaluate(inspectRenderedSlide, 'atomic-comparison')
  expect(audit.underfilledRegions).not.toContain('secondary（无有效内容）')
})

test('system overview removes redundant eyebrow and gives connectors readable bridge columns', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/16')
  const slide = page.locator('[data-slide-id="blank"].present')
  await expect(slide.locator('.cadenza-heading .cadenza-eyebrow')).toHaveCount(0)
  const connectors = slide.locator('.cadenza-connector')
  await expect(connectors).toHaveCount(2)
  const geometry = await connectors.evaluateAll(nodes => nodes.map(node => {
    const connector = node as HTMLElement
    const label = connector.querySelector<HTMLElement>('small')!
    const stroke = connector.querySelector<HTMLElement>('.cadenza-connector-stroke')!
    const connectorBox = connector.getBoundingClientRect()
    const labelBox = label.getBoundingClientRect()
    const strokeBox = stroke.getBoundingClientRect()
    return {
      connectorWidth: connectorBox.width,
      strokeWidth: strokeBox.width,
      labelInside: labelBox.left >= connectorBox.left - 1 && labelBox.right <= connectorBox.right + 1,
      labelUnclipped: label.scrollWidth <= label.clientWidth + 1,
      labelFontSize: Number.parseFloat(getComputedStyle(label).fontSize),
      hasArrow: getComputedStyle(stroke, '::after').content !== 'none',
    }
  }))
  expect(geometry.every(item => item.connectorWidth >= 96 && item.strokeWidth >= 72)).toBe(true)
  expect(geometry.every(item => item.labelInside && item.labelUnclipped && item.labelFontSize >= 14 && item.hasArrow)).toBe(true)
})

test('browser audit rejects same-row peers with independent vertical centering', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/22')
  await page.locator('[data-slide-id="atomic-people"].present .cadenza-profile').evaluateAll(profiles => profiles.forEach(profile => {
    const element = profile as HTMLElement
    element.style.alignSelf = 'center'
    element.style.height = 'auto'
  }))
  await page.locator('[data-slide-id="atomic-people"].present .cadenza-profile').first().evaluate(profile => {
    (profile as HTMLElement).style.transform = 'translateY(16px)'
  })
  const audit = await page.evaluate(inspectRenderedSlide, 'atomic-people')
  expect(audit.misalignedPeers).not.toEqual([])
})

test('feature explanation does not leave a dead cavity between copy and evidence cards', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo&session=smoke#/18')
  const secondary = page.locator('[data-slide-id="atomic-feature-explanation"].present [data-node-id="feature-split"] > [data-slot="secondary"]')
  await expect(secondary.locator('.cadenza-card')).toHaveCount(3)
  await expect(secondary).toContainText('01 SIGNAL')
  await expect(secondary).toContainText('02 COMPOSE')
  await expect(secondary).toContainText('03 VERIFY')
  const geometry = await secondary.evaluate(slot => {
    const slotBox = slot.getBoundingClientRect()
    const surfaces = [...slot.querySelectorAll<HTMLElement>(':scope .cadenza-copy, :scope .cadenza-card')]
      .map(surface => surface.getBoundingClientRect())
      .sort((left, right) => left.top - right.top)
    const intervals: Array<{ top: number, bottom: number }> = []
    for (const surface of surfaces) {
      const last = intervals.at(-1)
      if (last && surface.top <= last.bottom) last.bottom = Math.max(last.bottom, surface.bottom)
      else intervals.push({ top: surface.top, bottom: surface.bottom })
    }
    const occupied = intervals.reduce((sum, interval) => sum + interval.bottom - interval.top, 0)
    return {
      gapRatio: Math.max(0, ...intervals.slice(1).map((interval, index) => interval.top - intervals[index].bottom)) / slotBox.height,
      occupiedRatio: occupied / slotBox.height,
    }
  })
  expect(geometry.gapRatio).toBeLessThanOrEqual(.12)
  expect(geometry.occupiedRatio).toBeGreaterThanOrEqual(.7)
})

test('short profile bios remain on one line without forcing long bios to overflow', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/22')
  const bios = page.locator('[data-slide-id="atomic-people"].present .cadenza-profile p')
  await expect(bios).toHaveCount(2)
  const measurements = await bios.evaluateAll(elements => elements.map(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const rows = new Set([...range.getClientRects()].map(rect => Math.round(rect.top)))
    return { rows: rows.size, overflow: element.scrollWidth > element.clientWidth + 1, textWrap: getComputedStyle(element).textWrap }
  }))
  expect(measurements).toEqual([
    { rows: 1, overflow: false, textWrap: 'wrap' },
    { rows: 1, overflow: false, textWrap: 'wrap' },
  ])
})

test('system relationship keeps semantic labels readable instead of decorative', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/23')
  const slide = page.locator('[data-slide-id="atomic-system-relationship"].present')
  const labels = slide.locator('.cadenza-card small, .cadenza-connector small')
  await expect(labels).toHaveCount(5)
  expect(await labels.evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element)
    return { text: element.textContent?.trim(), fontSize: Number.parseFloat(style.fontSize), background: style.backgroundColor }
  }))).toEqual([
    expect.objectContaining({ text: '驱动', fontSize: expect.any(Number) }),
    expect.objectContaining({ text: '校验', fontSize: expect.any(Number) }),
    expect.objectContaining({ text: '输入 INPUT', fontSize: expect.any(Number) }),
    expect.objectContaining({ text: '输出 OUTPUT', fontSize: expect.any(Number) }),
    expect.objectContaining({ text: '失败 FAILURE', fontSize: expect.any(Number) }),
  ])
  expect(await labels.evaluateAll(elements => elements.every(element => {
    const style = getComputedStyle(element)
    return Number.parseFloat(style.fontSize) >= 16 && !style.backgroundColor.endsWith(', 0)')
  }))).toBe(true)

  await slide.locator('.cadenza-card small').first().evaluate(element => { (element as HTMLElement).style.fontSize = '11px' })
  await slide.locator('.cadenza-connector small').first().evaluate(element => { (element as HTMLElement).style.fontSize = '12px' })
  const audit = await page.evaluate(inspectRenderedSlide, 'atomic-system-relationship')
  expect(audit.unreadableRelationships).not.toEqual([])
  expect(audit.unreadableContent).not.toEqual([])
})

test('browser audit rejects intersecting readable text ink', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/17')
  const slide = page.locator('[data-slide-id="atomic-business-summary"].present')
  await expect(slide).toBeVisible()
  const labels = slide.locator('h3,h4,strong')
  expect(await labels.count()).toBeGreaterThan(1)
  const first = await labels.first().boundingBox()
  expect(first).not.toBeNull()
  await labels.nth(1).evaluate((element, box) => {
    const target = element as HTMLElement
    target.style.position = 'fixed'
    target.style.left = `${box!.x}px`
    target.style.top = `${box!.y}px`
    target.style.zIndex = '10'
  }, first)
  expect((await page.evaluate(inspectRenderedSlide, 'atomic-business-summary')).overlappingContent).not.toEqual([])
})

test('Overview exposes the nine atomic pages as one inspectable group', async ({ page }) => {
  await page.goto('/?view=overview&deck=cadenza-demo')
  await page.getByRole('combobox', { name: '按 group 筛选' }).selectOption({ label: '系统证明 / SYSTEM PROOF' })
  const cards = page.locator('[data-overview-card]:visible')
  await expect(cards).toHaveCount(showcaseSlides.length)
  expect(await cards.evaluateAll(elements => elements.map(element => element.getAttribute('data-slide-id')))).toEqual(showcaseSlides)
  await expect(page.getByRole('button', { name: '放大预览：Atomic · System' })).toHaveAccessibleName('放大预览：Atomic · System')
})
