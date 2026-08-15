import { chromium } from 'playwright'

export interface BrowserSmokeFinding { ruleId: string, slideId?: string, message: string }

export function isIgnorableBrowserConsoleError(message: string) {
  return message.trim() === '@bilibili/bili-user-fingerprint(report): report is not found'
}

export interface RenderedSlideAudit {
  frameWidth: number
  frameHeight: number
  horizontalOverflow: boolean
  mediaFailures: number
  underfilledMedia: string[]
  slideOverflow: boolean
  clippedText: string[]
  orphanLines: string[]
  wrappedHorizontalItems: string[]
  emptySurfaces: string[]
  misalignedSplits: string[]
  misalignedPeers: string[]
  underfilledRegions: string[]
  unreadableRelationships: string[]
  unreadableContent: string[]
  overlappingContent: string[]
  decorativeCollisions: string[]
  contentCoverage: number
  verticalCoverage: number
}

export async function runBrowserSmoke(origin: string, deckId: string, slideIds: readonly string[]) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const findings: BrowserSmokeFinding[] = []
  page.on('pageerror', error => findings.push({ ruleId: 'browser.page-error', message: error.message }))
  page.on('console', message => {
    const text = message.text()
    if (message.type() === 'error' && !isIgnorableBrowserConsoleError(text)) {
      findings.push({ ruleId: 'browser.console-error', message: text })
    }
  })
  try {
    await page.goto(`${origin}/?view=audience&deck=${encodeURIComponent(deckId)}&session=smoke`, { waitUntil: 'networkidle' })
    for (const slideId of slideIds) {
      const slideIndex = await page.locator('[data-slide-id]').evaluateAll((slides, targetId) =>
        slides.findIndex(slide => slide.getAttribute('data-slide-id') === targetId), slideId)
      if (slideIndex < 0) {
        findings.push({ ruleId: 'browser.slide-missing', slideId, message: 'Slide is missing from the rendered deck' })
        continue
      }
      await page.evaluate((target) => { location.hash = `#/${target}` }, slideIndex)
      const slide = page.locator(`[data-slide-id="${slideId}"]`)
      await slide.waitFor({ state: 'visible' })
      await page.waitForFunction(id => [...(document.querySelector(`[data-slide-id="${id}"]`)?.querySelectorAll('img') ?? [])]
        .every(image => (image as HTMLImageElement).complete && ((image as HTMLElement).dataset.mediaTreatment !== 'one-bit' || (image as HTMLElement).hasAttribute('data-one-bit-ready') || (image as HTMLElement).hasAttribute('data-one-bit-error'))), slideId)
      const result = await page.evaluate(inspectRenderedSlide, slideId)
      if (result.frameWidth <= 0 || result.frameHeight <= 0) findings.push({ ruleId: 'browser.zero-size', slideId, message: 'Presentation frame has zero size' })
      if (result.horizontalOverflow) findings.push({ ruleId: 'browser.horizontal-overflow', slideId, message: 'Document has obvious horizontal overflow' })
      if (result.slideOverflow) findings.push({ ruleId: 'browser.slide-overflow', slideId, message: 'Slide content exceeds its template safe area' })
      if (result.mediaFailures) findings.push({ ruleId: 'browser.media-load', slideId, message: `${result.mediaFailures} media element(s) failed to load` })
      if (result.underfilledMedia.length) findings.push({ ruleId: 'browser.media-aspect-underfill', slideId, message: `媒体比例与容器严重不匹配，真实内容缩成小块：${result.underfilledMedia.join(' / ')}` })
      if (result.clippedText.length) findings.push({ ruleId: 'browser.text-clipping', slideId, message: `文字被裁切：${result.clippedText.join(' / ')}` })
      if (result.orphanLines.length) findings.push({ ruleId: 'browser.orphan-line', slideId, message: `文字出现孤立末行：${result.orphanLines.join(' / ')}` })
      if (result.wrappedHorizontalItems.length) findings.push({ ruleId: 'browser.horizontal-item-wrap', slideId, message: `横排短项被挤成多行，应改用网格或缩短文案：${result.wrappedHorizontalItems.join(' / ')}` })
      if (result.emptySurfaces.length) findings.push({ ruleId: 'browser.empty-surface', slideId, message: `大型容器内部内容过少：${result.emptySurfaces.join(' / ')}` })
      if (result.misalignedSplits.length) findings.push({ ruleId: 'browser.split-alignment', slideId, message: `并列分区的同类内容未对齐：${result.misalignedSplits.join(' / ')}` })
      if (result.misalignedPeers.length) findings.push({ ruleId: 'browser.peer-alignment', slideId, message: `同组同类组件未共享行基线：${result.misalignedPeers.join(' / ')}` })
      if (result.underfilledRegions.length) findings.push({ ruleId: 'browser.region-balance', slideId, message: `主要分区内容过少且重心偏移：${result.underfilledRegions.join(' / ')}` })
      if (result.unreadableRelationships.length) findings.push({ ruleId: 'browser.relationship-readability', slideId, message: `关系标签低于演示可读门槛：${result.unreadableRelationships.join(' / ')}` })
      if (result.unreadableContent.length) findings.push({ ruleId: 'browser.semantic-type-size', slideId, message: `关键内容使用了装饰性小字号：${result.unreadableContent.join(' / ')}` })
      if (result.overlappingContent.length) findings.push({ ruleId: 'browser.content-overlap', slideId, message: `可读文字发生重叠：${result.overlappingContent.join(' / ')}` })
      if (result.decorativeCollisions.length) findings.push({ ruleId: 'browser.layer-collision', slideId, message: `固定装饰层遮挡可读内容：${result.decorativeCollisions.join(' / ')}` })
      if (result.contentCoverage < 35 || result.verticalCoverage < 60) findings.push({
        ruleId: 'browser.content-coverage', slideId,
        message: `真实内容覆盖率约 ${Math.round(result.contentCoverage)}%，有效纵向跨度约 ${Math.round(result.verticalCoverage)}%，页面仍有过量空白`,
      })
    }
  } finally { await browser.close() }
  return { ok: findings.length === 0, checkedSlides: slideIds.length, findings }
}

export function inspectRenderedSlide(id: string): RenderedSlideAudit {
  const frame = document.querySelector<HTMLElement>('.deck-frame')?.getBoundingClientRect()
  const current = document.querySelector<HTMLElement>(`[data-slide-id="${id}"]`)
  const content = current?.querySelector<HTMLElement>('.slide-chrome')
  const mediaFailures = [...(current?.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img,video') ?? [])]
    .filter(element => element instanceof HTMLImageElement ? !element.complete || element.naturalWidth === 0 : element.error !== null).length
  const visible = (element: Element) => {
    const box = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }
  const textCandidates = [...(current?.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li,blockquote,strong,cite,figcaption') ?? [])].filter(visible)
  const clippedText = textCandidates.flatMap(element => {
    const box = element.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(element)
    const ink = range.getBoundingClientRect()
    const clipped = element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2 || ink.left < box.left - 2 || ink.right > box.right + 2 || ink.top < box.top - 2 || ink.bottom > box.bottom + 2
    return clipped ? [element.textContent?.trim().slice(0, 40) || element.tagName] : []
  })
  const orphanLines = [...(current?.querySelectorAll<HTMLElement>('h1,h2,h3,h4,.component-title,.component-list li > p,.cadenza-card p,.cadenza-copy,.cadenza-profile p,.cadenza-list li') ?? [])].filter(visible).flatMap(element => {
    const textNode = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      ?? [...element.querySelectorAll('*')].flatMap(child => [...child.childNodes]).find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
    const text = textNode?.textContent?.trim() ?? ''
    if (text.length < 4 || !textNode) return []
    const lines = new Map<number, { left: number, right: number, count: number }>()
    for (let index = 0; index < textNode.textContent!.length; index++) {
      const range = document.createRange()
      range.setStart(textNode, index)
      range.setEnd(textNode, index + 1)
      const rect = range.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      const key = Math.round(rect.top / 3) * 3
      const line = lines.get(key) ?? { left: rect.left, right: rect.right, count: 0 }
      line.left = Math.min(line.left, rect.left)
      line.right = Math.max(line.right, rect.right)
      line.count++
      lines.set(key, line)
    }
    const rows = [...lines.entries()].sort(([left], [right]) => left - right).map(([, line]) => line)
    if (rows.length < 2) return []
    const previousWidth = Math.max(...rows.slice(0, -1).map(line => line.right - line.left))
    const last = rows.at(-1)!
    return last.count <= 2 || last.right - last.left < previousWidth * 0.28 ? [text.slice(0, 40)] : []
  })
  const wrappedHorizontalItems = [...(current?.querySelectorAll<HTMLElement>('.cadenza-list[data-axis-direction="horizontal"]') ?? [])].filter(visible).flatMap(list => {
    const items = [...list.querySelectorAll<HTMLElement>(':scope > li')].filter(visible)
    if (items.length < 3) return []
    return items.flatMap(item => {
      const style = getComputedStyle(item)
      const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.25
      const range = document.createRange()
      range.selectNodeContents(item)
      return range.getBoundingClientRect().height > lineHeight * 1.55 ? [item.textContent?.trim().slice(0, 40) || 'item'] : []
    })
  })
  const slideBox = current?.getBoundingClientRect()
  const underfilledMedia = !slideBox ? [] : [...(current?.querySelectorAll<HTMLImageElement>('img') ?? [])].filter(visible).flatMap(image => {
    const box = image.getBoundingClientRect()
    if (!image.naturalWidth || !image.naturalHeight || getComputedStyle(image).objectFit !== 'contain') return []
    if (box.width * box.height / Math.max(1, slideBox.width * slideBox.height) < 0.08) return []
    const imageRatio = image.naturalWidth / image.naturalHeight
    const boxRatio = box.width / box.height
    const usedAreaRatio = imageRatio > boxRatio ? boxRatio / imageRatio : imageRatio / boxRatio
    return usedAreaRatio < 0.25 ? [image.alt || image.src.split('/').at(-1) || 'image'] : []
  })
  const emptySurfaces = !slideBox ? [] : [...(current?.querySelectorAll<HTMLElement>('.cadenza-card,.cadenza-metric,.cadenza-profile') ?? [])].filter(visible).flatMap(element => {
    const box = element.getBoundingClientRect()
    const surfaceRatio = box.width * box.height / Math.max(1, slideBox.width * slideBox.height)
    if (surfaceRatio < 0.09 || element.querySelector('img,video,svg,canvas')) return []
    const inkBoxes = [...element.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li,strong,small,cite')].filter(visible).map(child => child.getBoundingClientRect())
    const inkArea = inkBoxes.reduce((sum, ink) => sum + ink.width * ink.height, 0)
    if (!inkBoxes.length) return [element.className]
    const inkTop = Math.min(...inkBoxes.map(ink => ink.top))
    const inkBottom = Math.max(...inkBoxes.map(ink => ink.bottom))
    const inkCenter = ((inkTop + inkBottom) / 2 - box.top) / box.height
    return inkArea / Math.max(1, box.width * box.height) < 0.18 && inkCenter < 0.4
      ? [element.textContent?.trim().slice(0, 40) || element.className]
      : []
  })
  const misalignedSplits = [...(current?.querySelectorAll<HTMLElement>('.cadenza-split:not([data-axis-direction="vertical"])') ?? [])].filter(visible).flatMap(split => {
    const primarySlot = split.querySelector<HTMLElement>(':scope > [data-slot="primary"]')
    const secondarySlot = split.querySelector<HTMLElement>(':scope > [data-slot="secondary"]')
    const comparableSelector = ['.cadenza-card', '.cadenza-metric', '.cadenza-list', '.cadenza-media', '.cadenza-quote', '.cadenza-profile', '.cadenza-heading', '.cadenza-copy', '.cadenza-logo']
      .find(selector => primarySlot?.querySelector(selector) && secondarySlot?.querySelector(selector))
    if (!comparableSelector) return []
    const primary = primarySlot?.querySelector<HTMLElement>(comparableSelector)
    const secondary = secondarySlot?.querySelector<HTMLElement>(comparableSelector)
    if (!primary || !secondary || !visible(primary) || !visible(secondary)) return []
    const delta = Math.abs(primary.getBoundingClientRect().top - secondary.getBoundingClientRect().top)
    return delta > 12 ? [`${split.dataset.nodeId ?? 'split'}（相差 ${Math.round(delta)}px）`] : []
  })
  const peerSelectors = ['.cadenza-card', '.cadenza-metric', '.cadenza-profile', '.cadenza-quote', '.cadenza-list']
  const misalignedPeers = [...(current?.querySelectorAll<HTMLElement>('.cadenza-grid') ?? [])].filter(visible).flatMap(grid => {
    const children = [...grid.children].filter((child): child is HTMLElement => child instanceof HTMLElement && visible(child))
    return peerSelectors.flatMap(selector => {
      const peers = children.filter(child => child.matches(selector))
      return peers.flatMap((left, index) => peers.slice(index + 1).flatMap(right => {
        const a = left.getBoundingClientRect()
        const b = right.getBoundingClientRect()
        const sameRow = !(a.left < b.right && a.right > b.left)
          && Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < Math.max(a.height, b.height) * 0.5
        if (!sameRow) return []
        const topDelta = Math.abs(a.top - b.top)
        const bottomDelta = Math.abs(a.bottom - b.bottom)
        return topDelta > 6 || bottomDelta > 6
          ? [`${grid.dataset.nodeId ?? 'grid'} ${selector.slice(1)}（上 ${Math.round(topDelta)}px／下 ${Math.round(bottomDelta)}px）`]
          : []
      }))
    })
  })
  const regionSurfaceSelector = '.cadenza-card,.cadenza-metric,.cadenza-list,.cadenza-media,.cadenza-code,.cadenza-visual,.cadenza-quote,.cadenza-profile,.cadenza-heading,.cadenza-copy,.cadenza-logo,.cadenza-caption,.cadenza-progress,.cadenza-divider,.cadenza-connector'
  const underfilledRegions = [...(current?.querySelectorAll<HTMLElement>('.cadenza-split > .cadenza-slot') ?? [])].filter(visible).flatMap(slot => {
    if (!slideBox) return []
    const box = slot.getBoundingClientRect()
    if (box.width * box.height / Math.max(1, slideBox.width * slideBox.height) < 0.2) return []
    const surfaces = [...slot.querySelectorAll<HTMLElement>(regionSurfaceSelector)].filter(visible)
    const leafSurfaces = surfaces.filter(surface => !surfaces.some(other => other !== surface && surface.contains(other)))
    if (!leafSurfaces.length) return [`${slot.dataset.slot ?? 'slot'}（无有效内容）`]
    const intervals: Array<{ top: number, bottom: number }> = []
    for (const surface of leafSurfaces.map(surface => surface.getBoundingClientRect()).sort((left, right) => left.top - right.top)) {
      const top = Math.max(box.top, surface.top)
      const bottom = Math.min(box.bottom, surface.bottom)
      const previous = intervals.at(-1)
      if (previous && top <= previous.bottom + 2) previous.bottom = Math.max(previous.bottom, bottom)
      else intervals.push({ top, bottom })
    }
    const largestGap = Math.max(0, ...intervals.slice(1).map((interval, index) => interval.top - intervals[index].bottom)) / box.height
    if (largestGap > 0.28) return [`${slot.dataset.slot ?? 'slot'}（内部断层 ${Math.round(largestGap * 100)}%）`]
    if (slot.querySelector(':scope > .cadenza-stack[data-axis-density="compact"]')) return []
    const top = Math.min(...leafSurfaces.map(surface => surface.getBoundingClientRect().top))
    const bottom = Math.max(...leafSurfaces.map(surface => surface.getBoundingClientRect().bottom))
    const span = (bottom - top) / box.height
    const center = ((top + bottom) / 2 - box.top) / box.height
    return span < 0.6 && (center < 0.4 || center > 0.6)
      ? [`${slot.dataset.slot ?? 'slot'}（覆盖 ${Math.round(span * 100)}%，重心 ${Math.round(center * 100)}%）`]
      : []
  })
  const unreadableRelationships = [...(current?.querySelectorAll<HTMLElement>('.cadenza-connector small') ?? [])].filter(visible).flatMap(label => {
    const size = Number.parseFloat(getComputedStyle(label).fontSize)
    return size < 16 ? [`${label.textContent?.trim() || 'connector'}（${size}px，最低 16px）`] : []
  })
  const semanticTypeMinimums = [
    ['.cadenza-progress > span', 16],
    ['.cadenza-card p', 14],
    ['.cadenza-card small', 16],
    ['.cadenza-copy', 16],
    ['.cadenza-list li', 18],
    ['.cadenza-profile p', 14],
  ] as const
  const unreadableContent = semanticTypeMinimums.flatMap(([selector, minimum]) => [...(current?.querySelectorAll<HTMLElement>(selector) ?? [])].filter(visible).flatMap(element => {
    const size = Number.parseFloat(getComputedStyle(element).fontSize)
    return size < minimum ? [`${element.textContent?.trim().slice(0, 30) || selector}（${size}px，最低 ${minimum}px）`] : []
  })).concat([...(current?.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li,blockquote,strong,small,cite,figcaption,.cadenza-caption') ?? [])]
    .filter(element => visible(element) && Boolean(element.textContent?.trim()) && !element.closest('[aria-hidden="true"]'))
    .flatMap(element => {
      const size = Number.parseFloat(getComputedStyle(element).fontSize)
      return size < 12 ? [`${element.textContent?.trim().slice(0, 30) || element.tagName}（${size}px，信息文字最低 12px）`] : []
    }))
  const semanticInk = [...(current?.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li,strong,small,cite,figcaption,.cadenza-caption') ?? [])]
    .filter(element => visible(element) && Boolean(element.textContent?.trim()) && !element.closest('[aria-hidden="true"]'))
    .map(element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return { element, box: range.getBoundingClientRect() }
    }).filter(item => item.box.width > 0 && item.box.height > 0)
  const overlappingContent: string[] = []
  for (let leftIndex = 0; leftIndex < semanticInk.length; leftIndex++) for (let rightIndex = leftIndex + 1; rightIndex < semanticInk.length; rightIndex++) {
    const left = semanticInk[leftIndex]
    const right = semanticInk[rightIndex]
    if (left.element.contains(right.element) || right.element.contains(left.element)) continue
    const leftLayer = left.element.closest('.cadenza-overlay,.cadenza-inset')
    if (leftLayer && leftLayer === right.element.closest('.cadenza-overlay,.cadenza-inset')) continue
    const width = Math.min(left.box.right, right.box.right) - Math.max(left.box.left, right.box.left)
    const height = Math.min(left.box.bottom, right.box.bottom) - Math.max(left.box.top, right.box.top)
    if (width > 2 && height > 2) overlappingContent.push(`${left.element.textContent?.trim().slice(0, 22)} ↔ ${right.element.textContent?.trim().slice(0, 22)}`)
  }
  const decorativeCollisions: string[] = []
  const chrome = current?.querySelector<HTMLElement>('.slide-chrome')
  if (chrome) {
    const host = chrome.getBoundingClientRect()
    const length = (value: string, axis: number) => value.endsWith('%') ? Number.parseFloat(value) / 100 * axis : Number.parseFloat(value)
    for (const pseudo of ['::before', '::after'] as const) {
      const style = getComputedStyle(chrome, pseudo)
      if (style.content === 'none' || style.content === 'normal' || style.position !== 'absolute' || Number.parseInt(style.zIndex, 10) < 0) continue
      const width = length(style.width, host.width)
      const height = length(style.height, host.height)
      const left = style.left !== 'auto' ? host.left + length(style.left, host.width) : host.right - length(style.right, host.width) - width
      const top = style.top !== 'auto' ? host.top + length(style.top, host.height) : host.bottom - length(style.bottom, host.height) - height
      if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) continue
      const right = left + width
      const bottom = top + height
      for (const element of textCandidates) {
        const range = document.createRange()
        range.selectNodeContents(element)
        const ink = range.getBoundingClientRect()
        if (ink.left < right && ink.right > left && ink.top < bottom && ink.bottom > top) {
          decorativeCollisions.push(`${pseudo} ↔ ${element.textContent?.trim().slice(0, 30) || element.tagName}`)
        }
      }
    }
  }
  let contentCoverage = 100
  let verticalCoverage = 100
  const composition = current?.querySelector('[data-component-kind="composition"]')
  if (composition && slideBox && current?.dataset.slideRole !== 'intro' && current?.dataset.slideRole !== 'section') {
    const columns = 80
    const rows = 45
    const occupied = new Uint8Array(columns * rows)
    const candidates = [...current!.querySelectorAll<HTMLElement>('.cadenza-media,.cadenza-code,.cadenza-card,.cadenza-metric,.cadenza-profile,.cadenza-logo,.cadenza-quote,.cadenza-progress,.cadenza-list,.cadenza-heading,.cadenza-copy,.cadenza-caption,.cadenza-connector,.cadenza-divider,.component-title,.component-subtitle,.component-body,.component-list,.agenda-list,.big-fact-value,.component-quote,.component-image-area,.component-object-image,.numbered-series-header > h2,.numbered-series-header > div')].filter(visible)
    for (const candidate of candidates) {
      const box = candidate.getBoundingClientRect()
      const x0 = Math.max(0, Math.floor((box.left - slideBox.left) / slideBox.width * columns))
      const y0 = Math.max(0, Math.floor((box.top - slideBox.top) / slideBox.height * rows))
      const x1 = Math.min(columns, Math.ceil((box.right - slideBox.left) / slideBox.width * columns))
      const y1 = Math.min(rows, Math.ceil((box.bottom - slideBox.top) / slideBox.height * rows))
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) occupied[y * columns + x] = 1
    }
    const semanticCoverage = occupied.reduce((sum, value) => sum + value, 0) / occupied.length * 100
    if (semanticCoverage >= 20) for (const candidate of [...current!.querySelectorAll<HTMLElement>('[data-layout-visual-region]')].filter(visible)) {
      const box = candidate.getBoundingClientRect()
      const x0 = Math.max(0, Math.floor((box.left - slideBox.left) / slideBox.width * columns))
      const y0 = Math.max(0, Math.floor((box.top - slideBox.top) / slideBox.height * rows))
      const x1 = Math.min(columns, Math.ceil((box.right - slideBox.left) / slideBox.width * columns))
      const y1 = Math.min(rows, Math.ceil((box.bottom - slideBox.top) / slideBox.height * rows))
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) occupied[y * columns + x] = 1
    }
    contentCoverage = occupied.reduce((sum, value) => sum + value, 0) / occupied.length * 100
    const activeRows = Array.from({ length: rows }, (_, y) => occupied.slice(y * columns, (y + 1) * columns).reduce((sum, value) => sum + value, 0) / columns >= 0.15)
    verticalCoverage = activeRows.filter(Boolean).length / rows * 100
  }
  return {
    frameWidth: frame?.width ?? 0,
    frameHeight: frame?.height ?? 0,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    mediaFailures,
    underfilledMedia: [...new Set(underfilledMedia)],
    slideOverflow: content ? content.scrollWidth > content.clientWidth + 8 || content.scrollHeight > content.clientHeight + 8 : false,
    clippedText: [...new Set(clippedText)],
    orphanLines: [...new Set(orphanLines)],
    wrappedHorizontalItems: [...new Set(wrappedHorizontalItems)],
    emptySurfaces: [...new Set(emptySurfaces)],
    misalignedSplits: [...new Set(misalignedSplits)],
    misalignedPeers: [...new Set(misalignedPeers)],
    underfilledRegions: [...new Set(underfilledRegions)],
    unreadableRelationships: [...new Set(unreadableRelationships)],
    unreadableContent: [...new Set(unreadableContent)],
    overlappingContent: [...new Set(overlappingContent)],
    decorativeCollisions: [...new Set(decorativeCollisions)],
    contentCoverage,
    verticalCoverage,
  }
}
