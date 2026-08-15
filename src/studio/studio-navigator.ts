import { renderDeckSlides } from '../rendering/core-templates'
import type { DeckDocument, DeckOutlineItem } from '../core/deck-document'
import { flattenOutline } from '../core/deck-outline'
import { insertGroup, moveGroup, moveSlide, renameGroup, ungroup } from '../core/deck-outline'
import { hydrateGalleryPreviews } from '../rendering/gallery-previews'
import { localizeHref, type UiLocale, uiText } from '../i18n/ui-locale'

export const NAVIGATOR_WINDOW_SIZE = 40
export const NAVIGATOR_WINDOW_THRESHOLD = 80
export type NavigatorDropEdge = 'before' | 'after'

export function moveSlideToDropTarget(outline: readonly DeckOutlineItem[], slideId: string, targetSlideId: string, edge: NavigatorDropEdge = 'after', groupId?: string) {
  if (groupId) {
    const group = outline.find(item => item.kind === 'group' && item.id === groupId)
    let index = group?.kind === 'group' ? group.slideIds.indexOf(targetSlideId) : -1
    const sourceIndex = group?.kind === 'group' ? group.slideIds.indexOf(slideId) : -1
    if (sourceIndex >= 0 && sourceIndex < index) index -= 1
    if (index >= 0 && edge === 'after') index += 1
    return moveSlide(outline, slideId, { groupId, index })
  }
  let index = outline.findIndex(item => item.kind === 'slide' && item.slideId === targetSlideId)
  const sourceIndex = outline.findIndex(item => item.kind === 'slide' && item.slideId === slideId)
  if (sourceIndex >= 0 && sourceIndex < index) index -= 1
  if (index >= 0 && edge === 'after') index += 1
  return moveSlide(outline, slideId, { index })
}

export function renderStudioNavigator(deck: Readonly<DeckDocument>, locale: UiLocale = 'zh-CN') {
  const text = uiText(locale).studio
  const numbers = new Map(flattenOutline(deck.outline).map((id, index) => [id, index + 1]))
  const item = (outline: DeckOutlineItem) => outline.kind === 'slide'
    ? navigatorCard(deck, outline.slideId, numbers.get(outline.slideId) ?? 0, '', locale)
    : `<details class="navigator-group" data-navigator-group="${outline.id}" draggable="true" open><summary><span>${escapeHtml(outline.title)}</span><b>${outline.slideIds.length}</b></summary><div class="navigator-group-actions"><button type="button" data-group-rename="${outline.id}">${text.rename}</button><button type="button" data-group-ungroup="${outline.id}">${text.ungroup}</button></div><div>${outline.slideIds.map(id => navigatorCard(deck, id, numbers.get(id) ?? 0, outline.id, locale)).join('')}</div></details>`
  const slideIds = flattenOutline(deck.outline)
  const windowed = slideIds.length > NAVIGATOR_WINDOW_THRESHOLD
  const contents = windowed
    ? slideIds.slice(0, NAVIGATOR_WINDOW_SIZE).map(id => navigatorCard(deck, id, numbers.get(id) ?? 0, '', locale)).join('')
    : deck.outline.map(item).join('')
  return `<aside class="studio-navigator" data-navigator-total="${slideIds.length}" inert><header><div class="navigator-heading"><p>SLIDES</p><h2>${escapeHtml(deck.title)}</h2></div><div class="navigator-header-actions"><button type="button" data-group-create>${text.createGroup}</button><button type="button" data-open-overview>${text.overview}</button></div></header><nav aria-label="${text.pageNavigation}" role="listbox" aria-setsize="${slideIds.length}">${contents}<div class="navigator-drop-indicator" data-navigator-drop-indicator aria-hidden="true" hidden><span>${text.insertHere}</span></div></nav>${windowed ? `<label class="navigator-jump">${text.jumpToSlide} <input data-navigator-jump type="number" min="1" max="${slideIds.length}" value="1"></label>` : ''}<p data-navigator-status role="status"></p></aside>`
}

export interface StudioNavigatorDeck {
  slide(index: number): void
  on(event: 'slidechanged', listener: (event: { currentSlide?: HTMLElement }) => void): void
  off(event: 'slidechanged', listener: (event: { currentSlide?: HTMLElement }) => void): void
}

type NavigatorSlideStatus = { slideId: string, generation?: 'queued' | 'running' | 'completed' | 'failed', verification?: 'running' | 'passed' | 'warning' | 'failed' }

export function startStudioNavigator(root: HTMLElement, deck: StudioNavigatorDeck, options: { deckId: string, document: Readonly<DeckDocument>, outline: DeckOutlineItem[], locale?: UiLocale, onOutlineChange(outline: DeckOutlineItem[]): void }) {
  const locale = options.locale ?? 'zh-CN'
  const text = uiText(locale).studio
  const navigator = root.querySelector<HTMLElement>('.studio-navigator')!
  const nav = navigator.querySelector<HTMLElement>('nav')!
  const dropIndicator = navigator.querySelector<HTMLElement>('[data-navigator-drop-indicator]')!
  const slideIds = flattenOutline(options.outline)
  const windowed = slideIds.length > NAVIGATOR_WINDOW_THRESHOLD
  let windowStart = 0
  let cards = [...navigator.querySelectorAll<HTMLElement>('[data-navigator-slide]')]
  const status = navigator.querySelector<HTMLElement>('[data-navigator-status]')!
  let outline = structuredClone(options.outline)
  let draggedSlide = ''
  let draggedGroup = ''
  let dropTargetSlide = ''
  let dropEdge: NavigatorDropEdge = 'after'
  const slideStatuses = new Map<string, NavigatorSlideStatus>()
  const applyBadges = () => cards.forEach(card => {
    const statusValue = slideStatuses.get(card.dataset.navigatorSlide ?? '')
    const badges = card.querySelector<HTMLElement>('[data-navigator-badges]')
    if (badges) badges.innerHTML = statusValue ? `${statusValue.generation ? `<span data-generation-status="${statusValue.generation}">${statusValue.generation}</span>` : ''}${statusValue.verification ? `<span data-verification-status="${statusValue.verification}">${statusValue.verification}</span>` : ''}` : ''
  })
  let disposePreviews = hydrateGalleryPreviews(navigator)
  const renderWindow = (targetIndex: number) => {
    if (!windowed) return
    const maxStart = Math.max(0, slideIds.length - NAVIGATOR_WINDOW_SIZE)
    const nextStart = Math.max(0, Math.min(maxStart, targetIndex - Math.floor(NAVIGATOR_WINDOW_SIZE / 2)))
    if (nextStart === windowStart && cards.some(card => card.dataset.playbackIndex === String(targetIndex))) return
    windowStart = nextStart
    disposePreviews()
    nav.innerHTML = slideIds.slice(windowStart, windowStart + NAVIGATOR_WINDOW_SIZE)
      .map((id, offset) => navigatorCard(options.document, id, windowStart + offset + 1, '', locale)).join('')
    cards = [...nav.querySelectorAll<HTMLElement>('[data-navigator-slide]')]
    disposePreviews = hydrateGalleryPreviews(nav)
    applyBadges()
  }
  const setCurrent = (slideId: string | undefined) => {
    const index = slideId ? slideIds.indexOf(slideId) : -1
    if (index >= 0) renderWindow(index)
    cards.forEach(card => {
    const current = card.dataset.navigatorSlide === slideId
    if (current) card.setAttribute('aria-current', 'true')
    else card.removeAttribute('aria-current')
    const button = card.querySelector<HTMLButtonElement>('[data-navigator-select]')
    if (button) button.tabIndex = current ? 0 : -1
    })
  }
  let suppressPointerClickUntil = 0
  const selectIndex = (select: Element) => Number(select.closest<HTMLElement>('[data-playback-index]')?.dataset.playbackIndex)
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || event.pointerType !== 'mouse') return
    const select = event.target instanceof Element ? event.target.closest('[data-navigator-select]') : null
    const index = select ? selectIndex(select) : -1
    if (!Number.isInteger(index) || index < 0) return
    suppressPointerClickUntil = performance.now() + 500
    deck.slide(index)
  }
  const click = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null
    const select = target?.closest<HTMLButtonElement>('[data-navigator-select]')
    if (select) {
      if (event.detail > 0 && performance.now() < suppressPointerClickUntil) return
      const index = selectIndex(select)
      if (Number.isInteger(index) && index >= 0) deck.slide(index)
      return
    }
    if (target?.closest('[data-open-overview]')) window.open(localizeHref(`${location.pathname}?view=overview&deck=${encodeURIComponent(options.deckId)}`, locale), 'cadenza-overview')
    if (target?.closest('[data-group-create]')) {
      const title = window.prompt(text.groupName)?.trim()
      if (!title) return
      const base = title.toLocaleLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || 'group'
      let id = base
      let suffix = 2
      while (outline.some(item => item.kind === 'group' && item.id === id)) id = `${base}-${suffix++}`
      applyOutline(insertGroup(outline, outline.length, { id, title }))
      navigator.querySelector('nav')!.insertAdjacentHTML('beforeend', groupShell(id, title, locale))
    }
    const rename = target?.closest<HTMLButtonElement>('[data-group-rename]')?.dataset.groupRename
    if (rename) {
      const current = outline.find(item => item.kind === 'group' && item.id === rename)
      const title = window.prompt(text.renameGroup, current?.kind === 'group' ? current.title : '')?.trim()
      if (!title) return
      applyOutline(renameGroup(outline, rename, title))
      navigator.querySelector<HTMLElement>(`[data-navigator-group="${rename}"] > summary span`)!.textContent = title
    }
    const remove = target?.closest<HTMLButtonElement>('[data-group-ungroup]')?.dataset.groupUngroup
    if (remove) {
      const group = navigator.querySelector<HTMLDetailsElement>(`[data-navigator-group="${remove}"]`)
      if (!group) return
      const parent = group.parentElement!
      group.querySelectorAll<HTMLElement>(':scope > div > [data-navigator-slide]').forEach(card => { card.dataset.groupId = ''; parent.insertBefore(card, group) })
      group.remove()
      applyOutline(ungroup(outline, remove))
    }
  }
  const keydown = (event: KeyboardEvent) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-navigator-select]') : null
    if (!button) return
    const current = Number(button.closest<HTMLElement>('[data-playback-index]')?.dataset.playbackIndex)
    const offset = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (offset) {
      event.preventDefault()
      const target = Math.max(0, Math.min(slideIds.length - 1, current + offset))
      renderWindow(target)
      const targetButton = nav.querySelector<HTMLButtonElement>(`[data-navigator-select="${slideIds[target]}"]`)
      cards.forEach(card => { const candidate = card.querySelector<HTMLButtonElement>('[data-navigator-select]'); if (candidate) candidate.tabIndex = candidate === targetButton ? 0 : -1 })
      targetButton?.focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      deck.slide(current)
    }
  }
  const jump = (event: Event) => {
    const input = event.target instanceof HTMLInputElement && event.target.matches('[data-navigator-jump]') ? event.target : null
    if (!input) return
    const index = Math.max(0, Math.min(slideIds.length - 1, Number(input.value) - 1))
    renderWindow(index)
    deck.slide(index)
    nav.querySelector<HTMLButtonElement>(`[data-navigator-select="${slideIds[index]}"]`)?.focus()
  }
  const slideStatus = (event: CustomEvent<NavigatorSlideStatus>) => {
    if (!event.detail?.slideId) return
    slideStatuses.set(event.detail.slideId, event.detail)
    applyBadges()
  }
  const applyOutline = (next: DeckOutlineItem[]) => {
    outline = next
    options.onOutlineChange(structuredClone(next))
    renumber(navigator, next)
    status.textContent = text.savingOrder
  }
  const dragStart = (event: DragEvent) => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('[data-navigator-select]')) {
      event.preventDefault()
      return
    }
    const card = target?.closest<HTMLElement>('[data-navigator-slide]')
    const group = target?.closest<HTMLElement>('[data-navigator-group]')
    draggedSlide = card?.dataset.navigatorSlide ?? ''
    draggedGroup = draggedSlide ? '' : group?.dataset.navigatorGroup ?? ''
    card?.setAttribute('data-dragging', '')
    event.dataTransfer?.setData('text/plain', draggedSlide || draggedGroup)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }
  const dragOver = (event: DragEvent) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-navigator-slide], [data-navigator-group]')) return
    event.preventDefault()
    navigator.querySelectorAll('[data-drop-target]').forEach(element => element.removeAttribute('data-drop-target'))
    const card = event.target.closest<HTMLElement>('[data-navigator-slide]')
    if (draggedSlide && card && card.dataset.navigatorSlide !== draggedSlide) {
      const cardRect = card.getBoundingClientRect()
      const navRect = nav.getBoundingClientRect()
      dropTargetSlide = card.dataset.navigatorSlide ?? ''
      dropEdge = event.clientY < Math.floor(cardRect.top + cardRect.height / 2) ? 'before' : 'after'
      dropIndicator.dataset.dropTargetSlide = dropTargetSlide
      dropIndicator.dataset.dropEdge = dropEdge
      dropIndicator.style.top = `${(dropEdge === 'before' ? cardRect.top : cardRect.bottom) - navRect.top}px`
      dropIndicator.hidden = false
    } else {
      clearDropIndicator()
      event.target.closest<HTMLElement>('[data-navigator-group]')?.setAttribute('data-drop-target', '')
    }
  }
  const drop = (event: DragEvent) => {
    event.preventDefault()
    const scrollTop = navigator.scrollTop
    const target = event.target instanceof Element ? event.target : null
    const targetCard = target?.closest<HTMLElement>('[data-navigator-slide]')
    const targetGroup = target?.closest<HTMLElement>('[data-navigator-group]')
    try {
      if (draggedGroup && targetGroup?.dataset.navigatorGroup && draggedGroup !== targetGroup.dataset.navigatorGroup) {
        const targetIndex = outline.findIndex(item => item.kind === 'group' && item.id === targetGroup.dataset.navigatorGroup)
        applyOutline(moveGroup(outline, draggedGroup, targetIndex))
        reorderDom(navigator, outline, scrollTop)
      } else if (draggedSlide && targetCard?.dataset.navigatorSlide && draggedSlide !== targetCard.dataset.navigatorSlide) {
        const groupId = targetCard.dataset.groupId || undefined
        applyOutline(moveSlideToDropTarget(outline, draggedSlide, dropTargetSlide || targetCard.dataset.navigatorSlide, dropEdge, groupId))
        reorderDom(navigator, outline, scrollTop)
      } else if (draggedSlide && targetGroup?.dataset.navigatorGroup) {
        const item = outline.find(value => value.kind === 'group' && value.id === targetGroup.dataset.navigatorGroup)
        if (item?.kind === 'group') { applyOutline(moveSlide(outline, draggedSlide, { groupId: item.id, index: item.slideIds.length })); reorderDom(navigator, outline, scrollTop) }
      }
    } finally {
      draggedSlide = ''; draggedGroup = ''
      navigator.querySelectorAll('[data-drop-target]').forEach(element => element.removeAttribute('data-drop-target'))
      navigator.querySelectorAll('[data-dragging]').forEach(element => element.removeAttribute('data-dragging'))
      clearDropIndicator()
    }
  }
  const clearDropIndicator = () => {
    dropTargetSlide = ''
    dropEdge = 'after'
    dropIndicator.hidden = true
    delete dropIndicator.dataset.dropTargetSlide
    delete dropIndicator.dataset.dropEdge
    dropIndicator.style.removeProperty('top')
  }
  const dragEnd = () => {
    draggedSlide = ''; draggedGroup = ''
    navigator.querySelectorAll('[data-dragging], [data-drop-target]').forEach(element => { element.removeAttribute('data-dragging'); element.removeAttribute('data-drop-target') })
    clearDropIndicator()
  }
  const slideChanged = (event: { currentSlide?: HTMLElement }) => setCurrent(event.currentSlide?.dataset.slideId)
  navigator.addEventListener('click', click)
  navigator.addEventListener('pointerdown', pointerDown)
  navigator.addEventListener('keydown', keydown)
  navigator.addEventListener('change', jump)
  window.addEventListener('cadenza-slide-status', slideStatus as EventListener)
  navigator.addEventListener('dragstart', dragStart)
  navigator.addEventListener('dragover', dragOver)
  navigator.addEventListener('drop', drop)
  navigator.addEventListener('dragend', dragEnd)
  deck.on('slidechanged', slideChanged)
  setCurrent(cards[0]?.dataset.navigatorSlide)
  navigator.removeAttribute('inert')
  return () => { navigator.removeEventListener('click', click); navigator.removeEventListener('pointerdown', pointerDown); navigator.removeEventListener('keydown', keydown); navigator.removeEventListener('change', jump); navigator.removeEventListener('dragstart', dragStart); navigator.removeEventListener('dragover', dragOver); navigator.removeEventListener('drop', drop); navigator.removeEventListener('dragend', dragEnd); window.removeEventListener('cadenza-slide-status', slideStatus as EventListener); deck.off('slidechanged', slideChanged); disposePreviews() }
}

function navigatorCard(deck: Readonly<DeckDocument>, slideId: string, number: number, groupId = '', locale: UiLocale = 'zh-CN') {
  const text = uiText(locale)
  const slide = deck.slides[slideId]
  const total = Object.keys(deck.slides).length
  return `<article class="navigator-card" role="option" aria-posinset="${number}" aria-setsize="${total}" data-navigator-slide="${slideId}" data-playback-index="${number - 1}" data-group-id="${groupId}" draggable="true">
    <span class="navigator-number">${number}</span><button class="navigator-thumbnail" type="button" tabindex="${number === 1 ? 0 : -1}" draggable="false" data-navigator-select="${slideId}" aria-label="${escapeHtml(text.studio.selectSlide(slide.label, number, total))}"><div class="gallery-live-preview" data-gallery-slide-preview="${slide.layout}"><div class="gallery-preview-content"></div><template data-gallery-preview-template>${renderDeckSlides([slide], deck.master)}</template></div></button>
    <footer><strong>${escapeHtml(slide.label)}</strong><span class="navigator-badges" data-navigator-badges></span>${slide.notes?.trim() ? `<span class="navigator-notes" title="${text.overview.hasNotes}">NOTES</span>` : ''}</footer>
  </article>`
}

function groupShell(id: string, title: string, locale: UiLocale) {
  const text = uiText(locale).studio
  return `<details class="navigator-group" data-navigator-group="${id}" draggable="true" open><summary><span>${escapeHtml(title)}</span><b>0</b></summary><div class="navigator-group-actions"><button type="button" data-group-rename="${id}">${text.rename}</button><button type="button" data-group-ungroup="${id}">${text.ungroup}</button></div><div></div></details>`
}

function reorderDom(navigator: HTMLElement, outline: readonly DeckOutlineItem[], scrollTop: number) {
  const nav = navigator.querySelector('nav')!
  outline.forEach(item => {
    if (item.kind === 'slide') {
      const card = navigator.querySelector<HTMLElement>(`[data-navigator-slide="${item.slideId}"]`)!
      card.dataset.groupId = ''
      nav.append(card)
    } else {
      const group = navigator.querySelector<HTMLDetailsElement>(`[data-navigator-group="${item.id}"]`)!
      const body = group.querySelector<HTMLElement>(':scope > div:last-child')!
      item.slideIds.forEach(id => { const card = navigator.querySelector<HTMLElement>(`[data-navigator-slide="${id}"]`)!; card.dataset.groupId = item.id; body.append(card) })
      nav.append(group)
    }
  })
  navigator.scrollTop = scrollTop
  requestAnimationFrame(() => { navigator.scrollTop = scrollTop })
}

function renumber(navigator: HTMLElement, outline: readonly DeckOutlineItem[]) {
  flattenOutline(outline).forEach((id, index) => {
    const card = navigator.querySelector<HTMLElement>(`[data-navigator-slide="${id}"]`)
    if (!card) return
    card.dataset.playbackIndex = String(index)
    const number = card.querySelector<HTMLElement>('.navigator-number')
    if (number) number.textContent = String(index + 1)
  })
  outline.forEach(item => {
    if (item.kind === 'group') navigator.querySelector<HTMLElement>(`[data-navigator-group="${item.id}"] > summary b`)!.textContent = String(item.slideIds.length)
  })
}

function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
