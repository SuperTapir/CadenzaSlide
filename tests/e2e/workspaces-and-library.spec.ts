import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { componentCatalog, compositionCatalog } from '../../src/rendering/system-gallery'

function largeStudioDeck() {
  const source = JSON.parse(readFileSync(new URL('../../decks/cadenza-demo/deck.cadenza.json', import.meta.url), 'utf8'))
  const template = source.slides[Object.keys(source.slides)[0]]
  const slides = Object.fromEntries(Array.from({ length: 200 }, (_, index) => {
    const id = `performance-${String(index + 1).padStart(3, '0')}`
    return [id, { ...structuredClone(template), id, label: `Performance slide ${index + 1}` }]
  }))
  return { ...source, id: 'performance-200', title: '200 page performance fixture', slides, outline: Object.keys(slides).map(slideId => ({ kind: 'slide', slideId })) }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  await page.evaluate(() => localStorage.clear())
})

test('Studio renders the canvas-first shell and keeps the master library on demand', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  await expect(page.locator('html')).toHaveAttribute('data-studio-ready', '')
  await expect(page.locator('[data-navigator-slide]')).toHaveCount(26)
  for (const region of ['studio-topbar', 'studio-rail', 'studio-stage', 'studio-drawer', 'studio-view-controls']) {
    await expect(page.getByTestId(region)).toHaveCount(1)
  }
  await expect(page.getByRole('button', { name: '页面导航' })).toBeHidden()
  await expect(page.getByTestId('deck-master')).toBeHidden()
  await expect(page.locator('[data-deck-master-layout]')).toHaveCount(14)
  await expect(page.locator('[data-deck-master-layout] [data-apply]')).toHaveCount(0)
  await expect(page.getByTestId('font-theme')).toBeHidden()
  await expect(page.getByTestId('environment-preset')).toBeHidden()
  const stage = page.getByTestId('studio-stage')
  expect(await stage.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
  const iconTargets = await page.locator('.icon-control:visible').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect()
    return { width: box.width, height: box.height, label: element.getAttribute('aria-label'), title: element.getAttribute('title') }
  }))
  expect(iconTargets.every(target => target.width >= 44 && target.height >= 44 && target.label && target.title)).toBe(true)
})

test('canvas-first Studio desktop composition remains stable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?deck=cadenza-demo')
  await expect(page.locator('html')).toHaveAttribute('data-studio-ready', '')
  await page.addStyleTag({ content: '.environment-layer, .floating-object, canvas { visibility: hidden !important; }' })
  await expect(page.getByRole('main')).toHaveScreenshot('canvas-first-studio-desktop.png', { animations: 'disabled', maxDiffPixels: 800 })
})

test('Cover renders title, subtitle, author and date in the slide and its preview', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  for (const root of [page.locator('.deck-frame [data-slide-id="intro"]'), page.locator('[data-navigator-slide]').first()]) {
    await expect(root.locator('.component-title')).toContainText('不是模板')
    await expect(root.locator('.component-subtitle')).toHaveText('CADENZA / COMPOSE WITH INTENT')
    await expect(root.locator('.component-cover-author')).toHaveText('Cadenza')
    await expect(root.locator('.component-cover-date')).toHaveText('2026')
  }
})

test('every Deck Master preview fills its 16:9 grid cell', async ({ page }) => {
  await page.goto('/?view=library')
  const gaps = await page.locator('.deck-master-preview').evaluateAll(previews => previews.map(preview => {
    const slide = preview.firstElementChild?.getBoundingClientRect()
    return slide ? { width: Math.abs(preview.clientWidth - slide.width), height: Math.abs(preview.clientHeight - slide.height) } : { width: Infinity, height: Infinity }
  }))
  expect(gaps.every(gap => gap.width <= 1 && gap.height <= 1)).toBe(true)
})

test('slide previews render the same master background as the actual slide', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  const currentScene = await page.locator('.deck-frame section.present').getAttribute('data-cadenza-scene')
  const navigatorCanvas = page.locator('[data-navigator-slide]').first().locator('canvas[data-gallery-environment-preview]')
  await expect(navigatorCanvas).toHaveCount(1)
  await expect(navigatorCanvas).toHaveAttribute('data-gallery-environment-preview', currentScene ?? '')
  const pixelColors = await navigatorCanvas.evaluate(canvas => {
    const context = (canvas as HTMLCanvasElement).getContext('2d')
    if (!context) return 0
    const pixels = context.getImageData(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height).data
    return new Set(Array.from({ length: pixels.length / 4 }, (_, index) => `${pixels[index * 4]},${pixels[index * 4 + 1]},${pixels[index * 4 + 2]}`)).size
  })
  expect(pixelColors).toBeGreaterThan(1)

  await page.goto('/?view=overview')
  await expect(page.locator('[data-overview-card] canvas[data-gallery-environment-preview]')).toHaveCount(26)
  expect(await page.locator('[data-overview-card]').evaluateAll(cards => cards.every(card =>
    card.querySelector('canvas')?.getAttribute('data-gallery-environment-preview')
      === card.querySelector('section')?.getAttribute('data-cadenza-scene'),
  ))).toBe(true)

  await page.goto('/?view=library')
  await expect(page.locator('[data-gallery-layout] canvas[data-gallery-environment-preview]')).toHaveCount(14)
  expect(await page.locator('[data-gallery-layout] [data-gallery-slide-preview]').evaluateAll(previews => previews.every(preview =>
    preview.querySelector('canvas')?.getAttribute('data-gallery-environment-preview')
      === preview.querySelector('section')?.getAttribute('data-cadenza-scene'),
  ))).toBe(true)
})

test('Navigator and Overview replace executable media with static previews', async ({ page }) => {
  const deck = JSON.parse(readFileSync(new URL('../../decks/cadenza-demo/deck.cadenza.json', import.meta.url), 'utf8'))
  deck.slides.intro.objects = [{ kind: 'video', frame: { x: 10, y: 20, width: 40, height: 40 }, src: '/cadenza-loop.mp4', alt: '视频回归样例' }]
  await page.route('**/api/decks/video-preview', route => route.fulfill({
    json: { ...deck, id: 'video-preview' },
    headers: { etag: '"video-preview"' },
  }))

  await page.goto('/?deck=video-preview')
  const authored = page.locator('.deck-frame [data-slide-id="intro"] video')
  const navigatorCard = page.locator('[data-navigator-slide="intro"]')
  await expect(authored).toHaveAttribute('controls', '')
  await expect(navigatorCard.locator('video, iframe')).toHaveCount(0)
  await expect(navigatorCard.locator('[data-media-preview="video"]')).toHaveCount(1)

  await page.goto('/?view=overview&deck=video-preview')
  const overviewCard = page.locator('[data-overview-card][data-slide-id="intro"]')
  await expect(overviewCard.locator('video, iframe')).toHaveCount(0)
  await expect(overviewCard.locator('[data-media-preview="video"]')).toHaveCount(1)
})

test('Navigator preview images select slides instead of starting native image drag', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  const image = page.locator('.studio-navigator [data-navigator-select] img').first()
  await expect(image).toHaveAttribute('draggable', 'false')
  const button = image.locator('xpath=ancestor::button[@data-navigator-select]')
  const slideId = await button.getAttribute('data-navigator-select')
  const box = await image.boundingBox()
  expect(slideId).toBeTruthy()
  expect(box).not.toBeNull()

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2 + 4, box!.y + box!.height / 2 + 4)
  await page.mouse.up()

  await expect(page.locator(`.deck-frame > .reveal > .slides > [data-slide-id="${slideId}"]`)).toHaveClass(/present/)
})

test('only the current slide activates external iframe and video sources', async ({ page }) => {
  const deck = JSON.parse(readFileSync(new URL('../../decks/cadenza-demo/deck.cadenza.json', import.meta.url), 'utf8'))
  deck.slides['title-photo'].objects = [{ kind: 'html', frame: { x: 10, y: 20, width: 40, height: 40 }, src: 'https://player.example.com/embed/lazy', external: true, title: 'Lazy player' }]
  deck.slides['title-photo-alt'].objects = [{ kind: 'video', frame: { x: 10, y: 20, width: 40, height: 40 }, src: '/lazy-media.mp4', alt: 'Lazy video' }]
  await page.route('**/api/decks/lazy-media', route => route.fulfill({
    json: { ...deck, id: 'lazy-media' },
    headers: { etag: '"lazy-media"' },
  }))
  let iframeRequests = 0
  let videoRequests = 0
  await page.route('https://player.example.com/**', route => { iframeRequests += 1; return route.fulfill({ body: '<!doctype html><title>Player</title>', contentType: 'text/html' }) })
  await page.route('**/lazy-media.mp4', route => { videoRequests += 1; return route.fulfill({ body: '', contentType: 'video/mp4' }) })

  await page.goto('/?deck=lazy-media')
  await expect(page.locator('.deck-frame [data-slide-id="intro"]')).toHaveClass(/present/)
  expect(iframeRequests).toBe(0)
  expect(videoRequests).toBe(0)
  await expect(page.locator('.studio-navigator iframe, .studio-navigator video')).toHaveCount(0)

  const iframePreview = page.locator('[data-navigator-select="title-photo"]')
  await iframePreview.scrollIntoViewIfNeeded()
  const iframePreviewBox = await iframePreview.boundingBox()
  expect(iframePreviewBox).not.toBeNull()
  await page.mouse.move(iframePreviewBox!.x + iframePreviewBox!.width / 2, iframePreviewBox!.y + iframePreviewBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(iframePreviewBox!.x + iframePreviewBox!.width / 2 + 4, iframePreviewBox!.y + iframePreviewBox!.height / 2 + 4)
  await page.mouse.up()
  await expect(page.locator('.deck-frame > .reveal > .slides > [data-slide-id="title-photo"]')).toHaveClass(/present/)
  await expect.poll(() => iframeRequests).toBe(1)
  await expect(page.locator('.deck-frame .reveal > .slides > [data-slide-id="title-photo"] iframe')).toHaveAttribute('src', /player\.example\.com/)

  await page.locator('[data-navigator-select="title-photo-alt"]').click()
  await expect.poll(() => videoRequests).toBeGreaterThan(0)
  await expect.poll(() => page.locator('.deck-frame [data-slide-id="title-photo"] iframe[src]').count()).toBe(0)
  await expect(page.locator('.deck-frame .reveal > .slides > [data-slide-id="title-photo-alt"] video').first()).toHaveAttribute('src', '/lazy-media.mp4')

  await page.locator('[data-navigator-select="intro"]').click()
  await expect.poll(() => page.locator('.deck-frame [data-slide-id="title-photo-alt"] video[src]').count()).toBe(0)
})

test('Studio reports an external deck update and reloads back to the stable slide', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeEventSource extends EventTarget {
      static latest: FakeEventSource | null = null
      constructor(_url: string) { super(); FakeEventSource.latest = this }
      close() {}
    }
    Object.defineProperty(window, 'EventSource', { configurable: true, value: FakeEventSource })
    Object.defineProperty(window, '__emitWorkspaceChange', {
      configurable: true,
      value: (path: string) => FakeEventSource.latest?.dispatchEvent(new MessageEvent('workspace-change', { data: JSON.stringify({ path }) })),
    })
  })
  const initial = JSON.parse(readFileSync(new URL('../../decks/cadenza-demo/deck.cadenza.json', import.meta.url), 'utf8'))
  const updated = structuredClone(initial)
  updated.slides['title-photo'].title = ['Agent updated title']
  let deckReads = 0
  await page.route('**/api/decks/reload-demo', route => {
    deckReads += 1
    const changed = deckReads > 1
    return route.fulfill({ json: { ...(changed ? updated : initial), id: 'reload-demo' }, headers: { etag: changed ? '"v2"' : '"v1"' } })
  })

  await page.goto('/?deck=reload-demo')
  await page.locator('[data-navigator-select="title-photo"]').click()
  await page.evaluate(() => (window as unknown as { __emitWorkspaceChange(path: string): void }).__emitWorkspaceChange('decks/reload-demo/deck.cadenza.json'))
  await expect(page.locator('#deck-update-notice')).toBeVisible()
  await page.getByRole('button', { name: '重新载入' }).click()

  await expect(page.locator('.deck-frame [data-slide-id="title-photo"]')).toHaveClass(/present/)
  await expect(page.locator('.deck-frame [data-slide-id="title-photo"]')).toContainText('Agent updated title')
  await expect(page).not.toHaveURL(/resume-slide/)
})

test('Studio keeps one 1280×720 authoring canvas while fit and manual zoom change only the preview scale', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?deck=cadenza-demo')
  const transform = page.locator('.studio-canvas-transform')
  await expect(transform).toBeVisible()
  const before = await transform.evaluate(element => ({
    logicalWidth: Number.parseFloat(getComputedStyle(element).width),
    logicalHeight: Number.parseFloat(getComputedStyle(element).height),
    scale: Number((element as HTMLElement).dataset.previewScale),
  }))
  expect(before.logicalWidth).toBe(1280)
  expect(before.logicalHeight).toBe(720)
  expect(before.scale).toBeGreaterThan(0)

  const slider = page.getByRole('slider', { name: '画布缩放' })
  await slider.fill('110')
  await slider.dispatchEvent('input')
  await expect(page.locator('#zoom-value')).toHaveText('110%')
  const after = await transform.evaluate(element => ({
    logicalWidth: Number.parseFloat(getComputedStyle(element).width),
    logicalHeight: Number.parseFloat(getComputedStyle(element).height),
    scale: Number((element as HTMLElement).dataset.previewScale),
  }))
  expect(after).toEqual({ logicalWidth: 1280, logicalHeight: 720, scale: 1.1 })
  await page.getByRole('button', { name: 'Notes' }).click()
  expect(await transform.evaluate(element => ({ width: Number.parseFloat(getComputedStyle(element).width), height: Number.parseFloat(getComputedStyle(element).height) }))).toEqual({ width: 1280, height: 720 })
})

test('Studio drawer switches panels without losing the current note draft', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo&lang=zh-CN')
  const drawer = page.getByTestId('studio-drawer')
  const controls = page.getByTestId('studio-view-controls')
  const notes = controls.getByRole('button', { name: 'Notes' })
  await expect(drawer).toBeHidden()
  await notes.click()
  await expect(drawer).toBeVisible()
  await expect(controls).toBeVisible()
  const editor = page.getByLabel('当前页面的演讲者注释')
  await editor.fill('drawer keeps this draft')
  expect(await editor.evaluate(element => getComputedStyle(element).outlineColor)).not.toBe('rgb(240, 91, 54)')
  const drawerBox = await drawer.boundingBox()
  const editorBox = await editor.boundingBox()
  expect(editorBox!.height / drawerBox!.height).toBeGreaterThan(0.75)
  await expect(page.locator('#notes-status')).toHaveText('已自动保存')
  await page.locator('#edit-queue-toggle').click()
  await expect(editor).toBeHidden()
  await expect(page.getByLabel('Agent 修改队列')).toBeVisible()
  await expect(drawer.locator('[data-panel]:visible')).toHaveCount(1)
  await notes.click()
  await expect(editor).toBeVisible()
  await expect(page.getByLabel('Agent 修改队列')).toBeHidden()
  await notes.click()
  await expect(drawer).toBeHidden()
  await notes.click()
  await expect(page.getByLabel('当前页面的演讲者注释')).toHaveValue('drawer keeps this draft')
})

test('Studio Inspect queues deduplicated cross-slide edits and copies one AI prompt', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => { (window as typeof window & { __copiedPrompt?: string }).__copiedPrompt = text; return Promise.resolve() } },
    })
  })

  const inspect = page.getByRole('button', { name: 'Inspect' })
  await inspect.click()
  await expect(inspect).toHaveAttribute('aria-pressed', 'true')
  const introTitle = page.locator('.deck-frame section.present [data-inspect-path="$.slides.intro.title"]')
  await introTitle.click()
  const anchoredEditor = page.locator('#studio-inspect-editor')
  const draft = page.getByLabel('元素修改要求')
  await expect(page.getByTestId('studio-drawer')).toBeHidden()
  await expect(anchoredEditor).toBeVisible()
  await expect(draft).toBeFocused()
  await expect(page.locator('#studio-edit-count')).toHaveText('0')
  const [targetBox, editorBox] = await Promise.all([introTitle.boundingBox(), anchoredEditor.boundingBox()])
  expect(targetBox).not.toBeNull()
  expect(editorBox).not.toBeNull()
  expect(Math.abs(editorBox!.x - targetBox!.x)).toBeLessThan(40)
  expect(Math.min(Math.abs(editorBox!.y - targetBox!.y - targetBox!.height), Math.abs(targetBox!.y - editorBox!.y - editorBox!.height))).toBeLessThan(24)

  await page.getByRole('button', { name: '更精简' }).click()
  await expect(draft).toHaveValue('让这个元素更精简，保留核心信息和原有语气。')
  await page.getByRole('button', { name: '取消修改' }).click()
  await expect(anchoredEditor).toBeHidden()
  await expect(page.locator('#studio-edit-count')).toHaveText('0')

  await introTitle.click()
  await draft.fill('标题改得更短、更克制')
  await page.getByRole('button', { name: '加入修改队列' }).click()
  await expect(page.locator('#studio-edit-count')).toHaveText('1')
  await introTitle.click()
  await expect(draft).toHaveValue('标题改得更短、更克制')
  await draft.fill('标题更短，同时保持两行节奏')
  await page.getByRole('button', { name: '更新修改队列' }).click()
  await expect(page.locator('#studio-edit-count')).toHaveText('1')

  await page.locator('[data-navigator-select="title-only"]').click()
  const compositionTarget = page.locator('.deck-frame section.present [data-node-id="language-layout"]')
  await compositionTarget.focus()
  await compositionTarget.press('Enter')
  await expect(anchoredEditor).toBeVisible()
  await expect(page.locator('#studio-edit-count')).toHaveText('1')
  await draft.fill('把这张卡片的标题改为「结构语言」')
  await page.getByRole('button', { name: '加入修改队列' }).click()
  await page.getByRole('button', { name: '修改队列：2 个页面 · intro、title-only' }).click()
  const compositionInstruction = page.getByLabel('Card 的修改要求')
  await expect(compositionInstruction).toHaveValue('把这张卡片的标题改为「结构语言」')
  await page.getByRole('button', { name: '移除 Card' }).click()
  await expect(page.locator('#studio-edit-count')).toHaveText('1')
  await page.getByRole('button', { name: '修改队列：1 个页面 · intro' }).click()
  await compositionTarget.click()
  await draft.fill('把这张卡片的标题改为「结构语言」')
  await page.getByRole('button', { name: '加入修改队列' }).click()
  await page.getByRole('button', { name: '修改队列：2 个页面 · intro、title-only' }).click()

  await expect(page.getByRole('button', { name: '修改队列：2 个页面 · intro、title-only' })).toBeVisible()
  await page.getByRole('button', { name: '复制给 Agent' }).click()
  await expect(page.locator('#studio-edit-status')).toHaveText('已复制 2 条修改请求。回到 Codex 粘贴，Agent 修改完成后这里会通知你重新载入')
  const prompt = await page.evaluate(() => (window as typeof window & { __copiedPrompt?: string }).__copiedPrompt)
  expect(prompt).toContain('Slide: intro')
  expect(prompt).toContain('Path: $.slides.title-only.objects[0].tree')
  expect(prompt).toContain('Node ID: language-layout')
  expect(prompt).toContain('标题更短，同时保持两行节奏')
  expect(prompt).toContain('把这张卡片的标题改为「结构语言」')
})

test('Notes drawer height can be resized and is persisted per deck', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  await page.getByRole('button', { name: 'Notes' }).click()
  const drawer = page.getByTestId('studio-drawer')
  const handle = page.getByRole('separator', { name: '调整下栏高度' })
  const before = await drawer.boundingBox()
  const handleBox = await handle.boundingBox()
  expect(before).not.toBeNull()
  expect(handleBox).not.toBeNull()
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y - 80)
  await page.mouse.up()
  const after = await drawer.boundingBox()
  expect(after!.height).toBeGreaterThan(before!.height + 60)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cadenza:studio-ui:v1:cadenza-demo') ?? '{}').drawerExtent)).toBeGreaterThan(280)
})

test('narrow Studio uses a dismissible rail overlay and restores trigger focus', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 })
  await page.goto('/?deck=cadenza-demo')
  const shell = page.locator('main[data-app-mode="studio"]')
  await expect(shell).toHaveAttribute('data-rail-mode', 'collapsed')
  await page.getByRole('button', { name: '页面导航' }).click()
  await expect(shell).toHaveAttribute('data-rail-mode', 'overlay')
  await expect(page.getByTestId('studio-rail')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(shell).toHaveAttribute('data-rail-mode', 'collapsed')
  await expect(page.getByRole('button', { name: '页面导航' })).toBeFocused()
  await page.getByRole('button', { name: 'Notes' }).click()
  await expect(page.getByLabel('当前页面的演讲者注释')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Notes' })).toBeFocused()
  const slide = page.locator('.studio-canvas-transform')
  const ratio = await slide.evaluate(element => Number.parseFloat(getComputedStyle(element).width) / Number.parseFloat(getComputedStyle(element).height))
  expect(ratio).toBeCloseTo(16 / 9, 4)
})

test('Studio Escape closes its surface without opening Reveal overview', async ({ page }) => {
  await page.goto('/?view=studio&deck=cadenza-demo&lang=zh-CN#/10')
  await page.getByRole('button', { name: 'Notes' }).click()
  await expect(page.getByTestId('studio-drawer')).toHaveAttribute('data-open', 'true')

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('studio-drawer')).toHaveAttribute('data-open', 'false')
  await page.keyboard.press('Escape')

  await expect(page.locator('.deck-frame .reveal')).not.toHaveClass(/overview/)
  await expect(page.locator('.deck-frame section.present')).toHaveCount(1)
})

test('rail keyboard navigation moves focus and selects by stable slide order', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  const first = page.locator('[data-navigator-select]').first()
  const second = page.locator('[data-navigator-select]').nth(1)
  await first.focus()
  await page.keyboard.press('ArrowDown')
  await expect(second).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-navigator-slide]').nth(1)).toHaveAttribute('aria-current', 'true')
})

test('rail drag shows an exact insertion boundary and keeps its scroll position after drop', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  const rail = page.locator('.studio-navigator')
  const source = page.locator('[data-navigator-slide="gallery3"]')
  const target = page.locator('[data-navigator-slide="gallery4"]')
  await target.evaluate(element => element.scrollIntoView({ block: 'center' }))
  const scrollTop = await rail.evaluate(element => element.scrollTop)

  await source.evaluate(element => element.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() })))
  await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.bottom - 2 }))
  })
  const indicator = page.locator('[data-navigator-drop-indicator]')
  await expect(indicator).toBeVisible()
  await expect(indicator).toHaveAttribute('data-drop-target-slide', 'gallery4')
  await expect(indicator).toHaveAttribute('data-drop-edge', 'after')
  await expect(indicator).toContainText('插入到这里')

  await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: rect.bottom - 2 }))
  })
  await expect.poll(() => rail.evaluate(element => element.scrollTop)).toBe(scrollTop)
  const slideOrder = await page.locator('[data-navigator-slide]').evaluateAll(cards =>
    cards.map(card => card.getAttribute('data-navigator-slide')),
  )
  expect(slideOrder.indexOf('gallery4')).toBeLessThan(slideOrder.indexOf('gallery3'))
})

test('rail badges update locally without remounting the current Reveal tree', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  await expect(page.locator('html')).toHaveAttribute('data-studio-ready', '')
  const currentReveal = page.locator('[data-testid="studio-stage"] .reveal')
  await currentReveal.evaluate(element => { (element as HTMLElement).dataset.mountSentinel = 'same-tree' })
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('cadenza-slide-status', { detail: { slideId: 'intro', generation: 'running', verification: 'warning' } })))
  await expect(page.locator('[data-navigator-slide="intro"] [data-generation-status="running"]')).toHaveCount(1)
  await expect(page.locator('[data-navigator-slide="intro"] [data-verification-status="warning"]')).toHaveCount(1)
  await expect(currentReveal).toHaveAttribute('data-mount-sentinel', 'same-tree')
})

test('reduced-motion removes Studio surface movement while keeping controls operable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 760, height: 900 })
  await page.goto('/?deck=cadenza-demo')
  await page.getByRole('button', { name: '页面导航' }).click()
  const transition = await page.getByTestId('studio-rail').evaluate(element => getComputedStyle(element).transitionDuration)
  expect(transition.split(',').every(value => value.trim() === '0s')).toBe(true)
  await expect(page.getByTestId('studio-rail')).toBeVisible()
})

test('a 200-slide Studio jumps to slide 180 while mounting at most 40 rail rows', async ({ page }) => {
  const deck = largeStudioDeck()
  await page.route('**/api/decks/performance-200', route => route.fulfill({ json: deck, headers: { etag: '"performance"' } }))
  await page.goto('/?deck=performance-200')
  await expect(page.locator('html')).toHaveAttribute('data-studio-ready', '')
  await expect(page.locator('[data-navigator-slide]')).toHaveCount(40)
  const jump = page.locator('[data-navigator-jump]')
  await jump.fill('180')
  await jump.evaluate(element => element.dispatchEvent(new Event('change', { bubbles: true })))
  await expect(page.locator('[data-navigator-slide]')).toHaveCount(40)
  await expect(page.locator('[data-navigator-slide="performance-180"]')).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('[data-navigator-slide="performance-180"]')).toHaveAttribute('aria-posinset', '180')
  await expect(page.locator('[data-navigator-slide="performance-180"]')).toHaveAttribute('aria-setsize', '200')
})

test('fullscreen rejection preserves Studio state and reports an accessible error', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  await page.locator('[data-testid="studio-stage"]').evaluate(element => { Object.defineProperty(element, 'requestFullscreen', { configurable: true, value: () => Promise.reject(new Error('blocked')) }) })
  await page.getByRole('button', { name: '全屏查看画布' }).click()
  await expect(page.locator('#fullscreen-status')).toHaveText('浏览器拒绝全屏请求，已保留当前视图')
  await expect(page.getByTestId('studio-stage')).not.toHaveAttribute('data-fullscreen', 'true')
})

test('Present opens only the audience view while speaker view remains optional', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  await page.evaluate(() => {
    ;(window as unknown as { __openedWindows: string[] }).__openedWindows = []
    window.open = ((_url?: string | URL, target?: string) => {
      ;(window as unknown as { __openedWindows: string[] }).__openedWindows.push(target ?? '')
      return { close() {} } as Window
    }) as typeof window.open
  })

  await page.getByRole('button', { name: 'Present' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __openedWindows: string[] }).__openedWindows)).toEqual(['cadenza-audience'])
  await expect(page.locator('[data-presenter-status]')).toHaveText('未开始')
  await expect(page.getByRole('button', { name: 'Present' })).toBeHidden()
  await expect(page.getByRole('button', { name: '结束放映' })).toBeVisible()
  await expect(page.getByRole('button', { name: '结束放映' })).toBeFocused()

  await page.getByRole('button', { name: '结束放映' }).click()
  await expect(page.getByRole('button', { name: '结束放映' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Present' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Present' })).toBeFocused()
})

test('Audience offers a locale-aware return to Studio on the current slide', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo&lang=zh-CN#/10')

  const back = page.getByRole('link', { name: '返回 Studio' })
  await expect(back).toHaveAttribute('href', /view=studio/)
  await expect(back).toHaveAttribute('href', /deck=cadenza-demo/)
  await expect(back).toHaveAttribute('href', /lang=zh-CN/)
  await expect(back).toHaveAttribute('href', /#\/10$/)
})

test('Audience Escape returns a directly opened presentation to Studio', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo&lang=zh-CN#/10')
  await expect(page.locator('.deck-frame section.present')).toHaveCount(1)

  await page.keyboard.press('Escape')

  await expect(page).toHaveURL(/view=studio/)
  await expect(page).toHaveURL(/deck=cadenza-demo/)
  await expect(page).toHaveURL(/#\/10$/)
  await expect(page.locator('.deck-frame .reveal')).not.toHaveClass(/overview/)
})

test('all masters expose one composed read-only example', async ({ page }) => {
  await page.goto('/?view=library')
  for (const layout of ['title', 'title-bullets', 'title-bullets-photo', 'title-only', 'blank']) {
    const card = page.locator(`[data-gallery-layout="${layout}"]`)
    await expect(card).not.toHaveAttribute('data-master-completion')
    await expect(card.locator('[data-gallery-preview-variant="composed"]')).toHaveCount(1)
    await expect(card.locator('[data-gallery-preview-variant="skeleton"]')).toHaveCount(0)
  }
  await expect(page.locator('[data-gallery-layout="title-only"]')).toHaveScreenshot('startup-master-title-only.png', { maxDiffPixels: 300 })
})

test('Studio Layout inspector hides, restores and reapplies content without loss', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  const stage = page.getByTestId('studio-stage')
  await page.getByRole('button', { name: 'Layout' }).click()
  await expect(page.getByLabel('当前页面 Layout')).toHaveValue('title')
  const subtitle = page.locator('[data-placeholder-visibility="subtitle"]')
  await expect(subtitle).toBeChecked()
  await subtitle.uncheck()
  await expect(stage.locator('[data-slide-id="intro"] .component-subtitle')).toHaveCount(0)
  await expect(page.locator('[data-navigator-select="intro"] .component-subtitle')).toHaveCount(0)
  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByLabel('当前页面的演讲者注释').fill('reapply keeps this note')
  await expect(page.locator('#notes-status')).toHaveText('已自动保存')
  await page.getByRole('button', { name: 'Layout' }).click()
  await page.getByRole('button', { name: '重新应用 Layout' }).click()
  await expect(stage.locator('[data-slide-id="intro"] .component-subtitle')).toContainText('CADENZA / COMPOSE WITH INTENT')
  await expect(page.locator('[data-navigator-select="intro"] .component-subtitle')).toContainText('CADENZA / COMPOSE WITH INTENT')
  await page.getByRole('button', { name: 'Notes' }).click()
  await expect(page.getByLabel('当前页面的演讲者注释')).toHaveValue('reapply keeps this note')

  await page.locator('[data-navigator-select="title-photo"]').click()
  await page.getByRole('button', { name: 'Layout' }).click()
  await page.getByLabel('当前页面 Layout').selectOption('title-photo-alt')
  await expect(stage.locator('[data-slide-id="title-photo"]')).toHaveAttribute('data-layout', 'title-photo-alt')
  await expect(stage.locator('[data-slide-id="title-photo"] .component-image-area')).toHaveCount(1)
  await expect(stage.locator('[data-slide-id="title-photo"] .component-title')).toContainText('模板保证一致')
})

test('fixed authoring geometry only scales across three viewport shapes', async ({ page }) => {
  const measurements: Array<{ ratio: number, titleX: number, titleY: number, titleWidth: number }> = []
  for (const viewport of [{ width: 1440, height: 900 }, { width: 900, height: 1440 }, { width: 2560, height: 1080 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/?view=audience')
    const slide = page.locator('[data-slide-id="intro"]')
    await expect(slide).toBeVisible()
    const frameRatio = await page.getByTestId('deck-frame').evaluate(element => element.getBoundingClientRect().width / element.getBoundingClientRect().height)
    expect(frameRatio).toBeCloseTo(16 / 9, 3)
    measurements.push(await slide.evaluate((element) => {
      const slideBox = element.getBoundingClientRect()
      const titleBox = element.querySelector('.component-title')!.getBoundingClientRect()
      return {
        ratio: slideBox.width / slideBox.height,
        titleX: (titleBox.left - slideBox.left) / slideBox.width,
        titleY: (titleBox.top - slideBox.top) / slideBox.height,
        titleWidth: titleBox.width / slideBox.width,
      }
    }))
  }
  for (const measurement of measurements) {
    expect(measurement.ratio).toBeCloseTo(16 / 9, 3)
    expect(measurement.titleX).toBeCloseTo(measurements[0].titleX, 3)
    expect(measurement.titleY).toBeCloseTo(measurements[0].titleY, 3)
    expect(measurement.titleWidth).toBeCloseTo(measurements[0].titleWidth, 3)
  }
})

test('all slides share one transition and legacy eyebrow is absent', async ({ page }) => {
  await page.goto('/?view=audience')
  await expect(page.locator('.deck-frame')).toBeVisible()
  await expect(page.locator('[data-slide-id]')).toHaveCount(26)
  await expect(page.locator('[data-slide-id]:not([data-cadenza-motion="dissolve"])')).toHaveCount(0)
  await expect(page.locator('.eyebrow, .component-eyebrow')).toHaveCount(0)
})

test('Audience does not initialize Studio write surfaces', async ({ page }) => {
  await page.goto('/?view=audience')
  await expect(page.locator('html')).not.toHaveAttribute('data-studio-ready', '')
  await expect(page.locator('.studio-navigator, .notes-workspace, #save-notes')).toHaveCount(0)
  await expect(page.locator('.deck-frame')).toBeVisible()
})

test('Audience view accepts local presentation navigation', async ({ page }) => {
  await page.goto('/?view=audience')
  await expect(page.locator('[data-slide-id="intro"]')).toBeVisible()
  await page.getByRole('button', { name: 'next slide' }).click()
  await expect(page.locator('[data-slide-id="title-photo"]')).toBeVisible()
})

test('Gallery lays out one to four images with no phantom cells', async ({ page }) => {
  await page.goto('/?view=overview')
  for (const count of [1, 2, 3, 4]) {
    const card = page.locator(`[data-overview-card][data-slide-id="gallery${count}"]`)
    await expect(card.locator(`[data-gallery-count="${count}"] .gallery-item`)).toHaveCount(count)
    await expect(card.locator('.gallery-item figcaption')).toHaveCount(count)
    await expect(card.locator('.gallery-item img[data-one-bit-ready]')).toHaveCount(count)
    expect(await card.locator('.gallery-item img').evaluateAll(images => images.every(image => getComputedStyle(image).filter === 'none'))).toBe(true)
  }
  await expect(page.locator('[data-overview-card][data-slide-id="gallery2"] [data-aspect-ratio="0.7"]')).toHaveCount(1)
  const photo = page.locator('[data-overview-card][data-slide-id="photo"] .component-image-area')
  await expect(photo.locator('figcaption')).toHaveCount(1)
  await expect(photo.locator('img[data-one-bit-ready]')).toHaveCount(1)
  expect(await photo.locator('img').evaluate(image => getComputedStyle(image).filter === 'none')).toBe(true)
  expect(await photo.locator('img').evaluate((image: HTMLImageElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const colours = new Set<string>()
    for (let index = 0; index < pixels.length; index += 4) colours.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`)
    return [...colours].sort()
  })).toEqual(['198,197,182', '37,37,31'])
})

test('opening an image preview keeps the source image on the slide and shows the full-width original', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  await page.getByRole('button', { name: '选择 视觉停顿' }).click()
  const source = page.locator('.deck-frame [data-slide-id="photo"] .component-image-area img')
  await expect(source).toHaveAttribute('data-one-bit-ready', '')
  const sourceState = await source.evaluate((image: HTMLImageElement) => ({
    rendered: image.src,
    original: image.dataset.oneBitSource,
  }))
  expect(sourceState.original).toBeTruthy()
  expect(sourceState.rendered).not.toBe(sourceState.original)

  await source.click()

  const lightbox = page.getByTestId('media-lightbox')
  await expect(lightbox).toBeVisible()
  expect(await lightbox.evaluate(dialog => {
    const toolbar = dialog.querySelector('.media-lightbox-toolbar')!.getBoundingClientRect()
    const dialogBox = dialog.getBoundingClientRect()
    const controls = [...dialog.querySelectorAll<HTMLElement>('.media-lightbox-toolbar > *')].map(control => control.getBoundingClientRect())
    return {
      centered: Math.abs(toolbar.left + toolbar.width / 2 - (dialogBox.left + dialogBox.width / 2)) <= 1,
      aligned: controls.every(control => Math.abs(control.top - controls[0].top) <= 1 && Math.abs(control.height - controls[0].height) <= 1),
      targetSize: controls.every(control => control.height >= 44),
    }
  })).toEqual({ centered: true, aligned: true, targetSize: true })
  await expect(source).toHaveCount(1)
  const preview = lightbox.locator('img')
  await expect(preview).toHaveCount(1)
  await expect(preview).toHaveAttribute('src', sourceState.original!)
  await expect(preview).not.toHaveAttribute('data-one-bit-ready')
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  expect(await lightbox.locator('[data-media-lightbox-content]').evaluate((content, original) => {
    const image = content.querySelector('img')!
    const contentStyle = getComputedStyle(content)
    const imageStyle = getComputedStyle(image)
    const innerWidth = content.clientWidth - Number.parseFloat(contentStyle.paddingLeft) - Number.parseFloat(contentStyle.paddingRight)
    return {
      fillsWidth: Math.abs(image.getBoundingClientRect().width - innerWidth) <= 1,
      proportional: imageStyle.height === 'auto' || Math.abs(image.getBoundingClientRect().width / image.getBoundingClientRect().height - image.naturalWidth / image.naturalHeight) < .01,
      originalSource: image.currentSrc === original,
    }
  }, sourceState.original)).toEqual({ fillsWidth: true, proportional: true, originalSource: true })

  const beforeZoom = await preview.evaluate(image => image.getBoundingClientRect().width)
  await preview.hover({ position: { x: 200, y: 120 } })
  await page.mouse.wheel(0, -240)
  await expect(lightbox.locator('[data-media-lightbox-zoom-value]')).not.toHaveText('100%')
  await expect.poll(() => preview.evaluate(image => image.getBoundingClientRect().width)).toBeGreaterThan(beforeZoom)
  await lightbox.getByRole('button', { name: '重置媒体缩放' }).click()
  await expect(lightbox.locator('[data-media-lightbox-zoom-value]')).toHaveText('100%')

  await lightbox.getByRole('button', { name: '关闭媒体预览' }).click()
  await expect(lightbox).toBeHidden()
  await expect(source).toHaveAttribute('src', sourceState.rendered)
  await expect(source).toHaveAttribute('data-one-bit-ready', '')
})

test('composition media opens the original image through the same lightbox contract', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/18')
  const source = page.locator('[data-slide-id="atomic-feature-explanation"].present .cadenza-media img')
  await expect(source).toHaveAttribute('data-one-bit-ready', '')
  const original = await source.getAttribute('data-one-bit-source')
  expect(original).toBeTruthy()

  await source.click()

  const preview = page.getByTestId('media-lightbox').locator('img')
  await expect(page.getByTestId('media-lightbox')).toBeVisible()
  await expect(preview).toHaveAttribute('src', original!)
  await expect(preview).toHaveCSS('width', await page.getByTestId('media-lightbox').locator('[data-media-lightbox-content]').evaluate(content => `${content.clientWidth}px`))
})

test('Chinese title supports three authored lines without overlap', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  const title = page.locator('.deck-frame [data-slide-id="intro"] .component-title')
  await expect(title.locator('.title-line')).toHaveCount(2)
  const boxes = await title.locator('.title-line').evaluateAll(lines => lines.map(line => line.getBoundingClientRect().toJSON()))
  expect(boxes[0].bottom).toBeLessThanOrEqual(boxes[1].top + 1)
  expect(await title.evaluate(element => Number.parseFloat(getComputedStyle(element).lineHeight) / Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(1.04)
})

test('poster titles and subtitles share one left edge', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  const alignment = await page.locator('.deck-frame [data-slide-id="intro"]').evaluate(slide => {
    const title = slide.querySelector('.component-title')?.getBoundingClientRect()
    const subtitle = slide.querySelector('.component-subtitle')?.getBoundingClientRect()
    const lines = Array.from(slide.querySelectorAll('.title-line'), line => line.getBoundingClientRect().left)
    return { title: title?.left, subtitle: subtitle?.left, lines }
  })
  expect(alignment.subtitle).toBeCloseTo(alignment.title ?? 0, 0)
  expect(alignment.lines.every(left => Math.abs(left - (alignment.lines[0] ?? left)) <= 1)).toBe(true)
})

test('title wrappers stay transparent where paper layers are forbidden and remaining surfaces hug their copy', async ({ page }) => {
  await page.goto('/?view=library')
  const titleLocator = page.locator('[data-gallery-layout] .component-title')
  await expect(titleLocator).not.toHaveCount(0)
  const measurements = await titleLocator.evaluateAll(titles => titles.map(title => {
    const slot = title.getBoundingClientRect()
    const boxElement = title.querySelector<HTMLElement>('.title-box')
    const box = boxElement?.getBoundingClientRect()
    const subtitle = title.parentElement?.querySelector('.component-subtitle')?.getBoundingClientRect()
    return box ? {
      layout: title.closest<HTMLElement>('[data-gallery-layout]')?.dataset.galleryLayout,
      fill: box.height / slot.height,
      bottomInset: slot.bottom - box.bottom,
      transparent: getComputedStyle(boxElement!).backgroundColor === 'rgba(0, 0, 0, 0)',
      shadow: getComputedStyle(boxElement!).boxShadow,
      collision: subtitle
        ? Math.max(0, Math.min(box.right, subtitle.right) - Math.max(box.left, subtitle.left))
          * Math.max(0, Math.min(box.bottom, subtitle.bottom) - Math.max(box.top, subtitle.top))
        : 0,
    } : null
  }))
  expect(measurements).not.toContain(null)
  expect(measurements.every(item => item && item.fill < .88)).toBe(true)
  expect(measurements.filter(item => item && ['title-photo', 'title-bullets', 'title-only', 'agenda', 'statement'].includes(item.layout ?? '')).every(item => item?.transparent && item.shadow === 'none')).toBe(true)
  expect(measurements.every(item => item && (item.transparent || Math.abs(item.bottomInset) <= 1))).toBe(true)
  expect(measurements.every(item => item && item.collision <= 1)).toBe(true)
})

test('refined functional masters keep distinct hierarchy and purposeful negative space', async ({ page }) => {
  await page.goto('/?view=library')

  const titleBullets = page.locator('[data-slide-id="fixture-title-bullets"]')
  await expect(titleBullets).toHaveAttribute('data-cadenza-scene', 'orbit')
  await expect(titleBullets.locator('[data-layout-visual-region="orbit-scene"]')).toHaveCount(1)
  const titleOnly = page.locator('[data-slide-id="fixture-title-only"]')
  await expect(titleOnly).toHaveAttribute('data-cadenza-scene', 'white')
  await expect(titleBullets).toHaveAttribute('data-environment-mode', 'loop')
  await expect(titleOnly).toHaveAttribute('data-environment-mode', 'loop')
  const agenda = page.locator('[data-slide-id="fixture-agenda"]')
  await expect(agenda).toHaveAttribute('data-cadenza-scene', 'orbit')
  await expect(agenda).toHaveAttribute('data-environment-mode', 'loop')
  await expect(agenda.locator('[data-layout-visual-region="orbit-scene"]')).toHaveCount(1)

  const contentTitleBox = page.locator('[data-slide-id="fixture-title-bullets"] .title-box')
  await expect(contentTitleBox).toHaveCSS('box-shadow', 'none')
  await expect(contentTitleBox).toHaveCSS('border-top-width', '0px')
  await expect(agenda.locator('.agenda-list li').first()).toHaveCSS('box-shadow', 'none')
  await expect(titleBullets.locator('.component-list li').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(agenda.locator('.agenda-list li:not([data-agenda-state="active"])').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

  for (const layout of ['title-bullets', 'agenda']) {
    const proportions = await page.locator(`[data-slide-id="fixture-${layout}"]`).evaluate(slide => {
      const slideBox = slide.getBoundingClientRect()
      const listBox = slide.querySelector('ol')!.getBoundingClientRect()
      return { listWidth: listBox.width / slideBox.width, rightSpace: (slideBox.right - listBox.right) / slideBox.width }
    })
    expect(proportions.listWidth).toBeLessThanOrEqual(.6)
    expect(proportions.rightSpace).toBeGreaterThanOrEqual(.3)
  }

  const titleOnlyProportion = await titleOnly.locator('[data-page-object]').evaluateAll(objects => {
    const slide = objects[0].closest('section')!.getBoundingClientRect()
    const bounds = objects.map(object => object.getBoundingClientRect())
    return (Math.max(...bounds.map(box => box.right)) - Math.min(...bounds.map(box => box.left))) / slide.width
  })
  expect(titleOnlyProportion).toBeGreaterThanOrEqual(.85)

  const statementTitleBox = page.locator('[data-slide-id="fixture-statement"] .title-box')
  await expect(statementTitleBox).toHaveCSS('box-shadow', 'none')
  await expect(statementTitleBox).toHaveCSS('border-top-width', '0px')
  await expect(statementTitleBox).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const statementSubtitle = page.locator('[data-slide-id="fixture-statement"] .component-subtitle > span')
  await expect(statementSubtitle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(statementSubtitle).toHaveCSS('color', 'rgb(232, 230, 210)')
  const statementAlignment = await statementTitleBox.evaluate(title => {
    const slide = title.closest('section')!.getBoundingClientRect()
    const box = title.getBoundingClientRect()
    return { left: (box.left - slide.left) / slide.width, right: (box.right - slide.left) / slide.width }
  })
  expect(statementAlignment.left).toBeLessThan(.2)
  expect(statementAlignment.right).toBeLessThan(.75)

  for (const layout of ['statement', 'big-fact', 'quote']) {
    const slide = page.locator(`[data-slide-id="fixture-${layout}"]`)
    await expect(slide.locator('[data-layout-object]')).toHaveCount(0)
    const decoration = await slide.locator('.slide-chrome').evaluate(element => getComputedStyle(element, '::after').content)
    expect(decoration).toBe('none')
  }
  await expect(agenda.locator('[data-agenda-state="active"]')).toHaveCount(0)
})

test('title-photo never paints a media caption while caption-capable layouts remain unchanged', async ({ page }) => {
  await page.goto('/?view=library')

  const fullBleed = page.locator('[data-slide-id="fixture-title-photo"]')
  await expect(fullBleed.locator('figcaption')).toHaveCount(0)
  await expect(fullBleed).not.toContainText('渲染兜底必须隐藏的反例图注')

  await expect(page.locator('[data-slide-id="fixture-photo"] figcaption')).toContainText('全图说明文字')
  await expect(page.locator('[data-slide-id="fixture-gallery"] figcaption')).toHaveCount(3)
})

test('ORBIT functional background advances when the master requests loop mode', async ({ page }) => {
  await page.goto('/?view=audience&deck=cadenza-demo#/3')
  const slide = page.locator('[data-slide-id="title-bullets"].present')
  await expect(slide).toHaveAttribute('data-environment-mode', 'loop')
  const canvas = page.locator('.environment-canvas')
  const before = await canvas.screenshot()
  await page.waitForTimeout(450)
  const after = await canvas.screenshot()
  expect(before.equals(after)).toBe(false)
})

test('functional lists keep five short items inside their master slots', async ({ page }) => {
  await page.goto('/?view=library')

  for (const layout of ['title-bullets', 'agenda']) {
    const geometry = await page.locator(`[data-gallery-layout="${layout}"]`).evaluate((card) => {
      const list = card.querySelector<HTMLOListElement>('ol')!
      const slide = list.closest<HTMLElement>('section')!
      const title = slide.querySelector<HTMLElement>('.component-title')!
      while (list.children.length < 5) list.append(list.lastElementChild!.cloneNode(true))
      const items = [...list.children].map(item => item.getBoundingClientRect())
      const slideBox = slide.getBoundingClientRect()
      const titleBox = title.getBoundingClientRect()
      const listBox = list.getBoundingClientRect()
      return {
        count: items.length,
        allVisible: items.every(item => item.width > 0 && item.height > 0),
        titleBeforeList: titleBox.bottom <= listBox.top + 1,
        lastInsideSlot: items.at(-1)!.bottom <= listBox.bottom + 1,
        lastInsideSlide: items.at(-1)!.bottom <= slideBox.bottom + 1,
      }
    })

    expect(geometry).toEqual({ count: 5, allVisible: true, titleBeforeList: true, lastInsideSlot: true, lastInsideSlide: true })
  }

  const describedAgenda = await page.locator('[data-gallery-layout="agenda"]').evaluate((card) => {
    const list = card.querySelector<HTMLOListElement>('ol')!
    const slide = list.closest<HTMLElement>('section')!
    while (list.children.length > 3) list.lastElementChild!.remove()
    for (const [index, item] of [...list.children].entries()) {
      const copy = item.querySelector<HTMLElement>('div')!
      const description = document.createElement('p')
      description.textContent = `第 ${index + 1} 项的简短说明`
      copy.append(description)
    }
    const lastItem = list.lastElementChild!.getBoundingClientRect()
    const listBox = list.getBoundingClientRect()
    const slideBox = slide.getBoundingClientRect()
    return {
      count: list.children.length,
      lastInsideSlot: lastItem.bottom <= listBox.bottom + 1,
      lastInsideSlide: lastItem.bottom <= slideBox.bottom + 1,
    }
  })
  expect(describedAgenda).toEqual({ count: 3, lastInsideSlot: true, lastInsideSlide: true })
})

test('Design Library is reference-only and does not change playback', async ({ page }) => {
  await page.goto('/?deck=cadenza-demo')
  const before = await page.evaluate(() => location.hash)
  const popupPromise = page.waitForEvent('popup')
  await page.locator('.project-overflow > summary').click()
  await page.getByRole('button', { name: 'Design Library' }).click()
  const library = await popupPromise
  await library.waitForLoadState()
  await expect(library).toHaveURL(/view=library/)
  await expect(library.locator('#system-gallery')).toBeVisible()
  await expect(library.locator('[data-gallery-layout]')).toHaveCount(14)
  await expect(library.locator('[data-gallery-component]')).toHaveCount(componentCatalog.length)
  await expect(library.locator('[data-gallery-composition]')).toHaveCount(compositionCatalog.length)
  await expect(library.locator('#system-gallery input[type="checkbox"], #system-gallery [data-apply]')).toHaveCount(0)
  const firstCard = library.locator('[data-gallery-layout]').first()
  const secondCard = library.locator('[data-gallery-layout]').nth(1)
  const [firstBox, secondBox, previewBox] = await Promise.all([
    firstCard.boundingBox(),
    secondCard.boundingBox(),
    firstCard.locator('.gallery-live-preview').first().boundingBox(),
  ])
  expect(firstBox?.y).toBe(secondBox?.y)
  expect(previewBox?.width).toBeGreaterThan(180)
  expect(previewBox?.height).toBeGreaterThan(100)
  await expect(firstCard.locator('.gallery-card-index')).toHaveText('01')
  await expect(firstCard.locator('.gallery-card-copy strong')).toHaveText('Title / Cover')
  await expect(firstCard.locator('.gallery-card-status')).toContainText('三层母板')
  await expect(library.locator('[data-gallery-layout] [data-design-library-preview]')).toHaveCount(14)
  await firstCard.locator('[data-design-library-preview]').first().click()
  await expect(library.getByTestId('design-library-preview')).toBeVisible()
  await library.getByRole('button', { name: '关闭放大预览' }).click()

  const compositionSection = library.locator('[data-gallery-section="components-compositions"]')
  await compositionSection.locator(':scope > summary').click()
  const compositionCard = compositionSection.locator('[data-gallery-composition]').first()
  await expect(compositionCard.locator('[data-cadenza-component]').first()).toBeVisible()
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await compositionCard.locator('[data-copy-composition]').click()
  await expect(compositionCard.locator('[data-copy-composition]')).toHaveText('已复制 composition tree')
  const copiedComposition = JSON.parse(await library.evaluate(() => navigator.clipboard.readText()))
  expect(copiedComposition).toMatchObject({ nodeId: expect.any(String), component: expect.any(String), version: 1 })
  expect(await page.evaluate(() => location.hash)).toBe(before)
})
