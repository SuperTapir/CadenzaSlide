import { renderDeckSlides } from '../rendering/core-templates'
import type { DeckDocument } from '../core/deck-document'
import { flattenOutline } from '../core/deck-outline'
import { hydrateGalleryPreviews } from '../rendering/gallery-previews'
import { DesignLibraryPreview, renderDesignLibraryPreview } from '../rendering/design-library-preview'
import { hydrateOneBitImages } from '../rendering/media-one-bit'
import { hydrateOneBitVisuals } from '../visual-assets/one-bit-visual'
import { hydrateSmilVisuals } from '../visual-assets/smil-visual'
import { renderUiLocaleSwitcher, type UiLocale, uiText } from '../i18n/ui-locale'

export function renderDeckOverview(deck: Readonly<DeckDocument>, locale: UiLocale = 'zh-CN', currentHref = `?view=overview&deck=${encodeURIComponent(deck.id)}`) {
  const text = uiText(locale).overview
  const groupBySlide = new Map<string, string>()
  const groups = deck.outline.flatMap(item => {
    if (item.kind !== 'group') return []
    item.slideIds.forEach(slideId => groupBySlide.set(slideId, item.id))
    return [{ id: item.id, title: item.title }]
  })
  const cards = flattenOutline(deck.outline).map((slideId, index) => {
    const slide = deck.slides[slideId]
    const group = groupBySlide.get(slideId) ?? ''
    return `<article class="overview-card" data-overview-card data-slide-id="${slide.id}" data-group-id="${group}">
      <button class="overview-preview" type="button" data-design-library-preview="slide:${slide.id}" data-design-library-preview-label="${escapeHtml(slide.label)} · ${slide.id}" data-design-library-preview-description="${escapeHtml(slide.notes ? text.hasNotes : text.noNotes)}" aria-label="${text.preview}${text.separator}${escapeHtml(slide.label)}">
        <div class="gallery-live-preview" data-gallery-slide-preview="${slide.layout}" data-gallery-preview-background="${deck.master.layouts[slide.layout in deck.master.layouts ? slide.layout as keyof typeof deck.master.layouts : 'blank'].background}"><div class="gallery-preview-content"></div><template data-gallery-preview-template>${renderDeckSlides([slide], deck.master)}</template></div>
      </button>
      <footer><span class="overview-number">${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(slide.label)}</strong><code>${slide.id}</code></div><button type="button" data-copy-slide-id="${slide.id}" aria-label="${text.copyId}${text.separator}${slide.id}">${text.copyId}</button></footer>
    </article>`
  }).join('')
  return `<main class="deck-overview" data-testid="deck-overview">
    <header class="overview-header"><div><p>CADENZA / OVERVIEW · ${deck.status === 'outline' ? text.outlineCheckpoint : text.completeDeck}</p><h1>${escapeHtml(deck.title)}</h1></div>${renderUiLocaleSwitcher(locale, currentHref)}<div class="overview-summary"><strong>${flattenOutline(deck.outline).length}</strong><span>${deck.status === 'outline' ? text.outlineSlides : text.slides}</span></div></header>
    <div class="overview-tools"><label>${text.search}<input type="search" data-overview-search aria-label="${text.searchLabel}" placeholder="${text.searchPlaceholder}"></label><label>${text.group}<select data-overview-group aria-label="${text.groupLabel}"><option value="">${text.allGroups}</option>${groups.map(group => `<option value="${group.id}">${escapeHtml(group.title)}</option>`).join('')}</select></label><span data-overview-status role="status"></span></div>
    <section class="overview-grid" aria-label="${text.region}">${cards}</section>
    ${renderDesignLibraryPreview(locale)}
  </main>`
}

export function startDeckOverview(root: HTMLElement, locale: UiLocale = 'zh-CN') {
  const text = uiText(locale).overview
  const disposeOneBitImages = hydrateOneBitImages(root)
  const disposeOneBitVisuals = hydrateOneBitVisuals(root)
  const disposeSmilVisuals = hydrateSmilVisuals(root)
  const preview = new DesignLibraryPreview(root, root.querySelector<HTMLDialogElement>('[data-testid="design-library-preview"]')!)
  const disposeHydration = hydrateGalleryPreviews(root)
  const search = root.querySelector<HTMLInputElement>('[data-overview-search]')!
  const group = root.querySelector<HTMLSelectElement>('[data-overview-group]')!
  const status = root.querySelector<HTMLElement>('[data-overview-status]')!
  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase()
    root.querySelectorAll<HTMLElement>('[data-overview-card]').forEach(card => {
      const matchesText = !query || (card.textContent ?? '').toLocaleLowerCase().includes(query)
      const matchesGroup = !group.value || card.dataset.groupId === group.value
      card.hidden = !(matchesText && matchesGroup)
    })
  }
  const copy = async (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-copy-slide-id]') : null
    const id = button?.dataset.copySlideId
    if (!id) return
    try { await navigator.clipboard.writeText(id) } catch {
      const textarea = document.createElement('textarea')
      textarea.value = id
      document.body.append(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    status.textContent = `${text.copied} ${id}`
  }
  search.addEventListener('input', filter)
  group.addEventListener('change', filter)
  root.addEventListener('click', copy)
  preview.start()
  let events: EventSource | undefined
  void fetch('/api/config').then(response => {
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) return
    events = new EventSource('/api/events')
    events.addEventListener('workspace-change', (event) => {
      const value = JSON.parse((event as MessageEvent).data) as { path?: string }
      if (value.path?.endsWith('deck.cadenza.json')) location.reload()
    })
  }).catch(() => {})
  return () => { events?.close(); search.removeEventListener('input', filter); group.removeEventListener('change', filter); root.removeEventListener('click', copy); preview.dispose(); disposeHydration(); disposeSmilVisuals(); disposeOneBitVisuals(); disposeOneBitImages() }
}

function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
