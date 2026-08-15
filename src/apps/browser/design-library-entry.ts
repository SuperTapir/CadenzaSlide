import { DesignLibraryPreview } from '../../rendering/design-library-preview'
import { hydrateGalleryPreviews } from '../../rendering/gallery-previews'
import { renderSystemGallery } from '../../rendering/system-gallery'
import { hydrateOneBitImages } from '../../rendering/media-one-bit'
import { hydrateOneBitVisuals } from '../../visual-assets/one-bit-visual'
import { hydrateSmilVisuals } from '../../visual-assets/smil-visual'
import { resolveUiLocale, uiText } from '../../i18n/ui-locale'

const locale = resolveUiLocale(new URL(location.href), navigator.language)
const ui = uiText(locale)
document.documentElement.dataset.appMode = 'library'
document.documentElement.lang = locale
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<main class="design-library-page">${renderSystemGallery(locale, location.href)}</main>`

const gallery = document.querySelector<HTMLElement>('#system-gallery')!
const disposeOneBitImages = hydrateOneBitImages(gallery)
const disposeOneBitVisuals = hydrateOneBitVisuals(gallery)
const disposeSmilVisuals = hydrateSmilVisuals(gallery)
const search = gallery.querySelector<HTMLInputElement>('[data-gallery-search]')!
const sections = [...gallery.querySelectorAll<HTMLDetailsElement>('[data-gallery-section]')]
const preview = new DesignLibraryPreview(
  gallery,
  gallery.querySelector<HTMLDialogElement>('[data-testid="design-library-preview"]')!,
)
const previewDisposers = new Map<HTMLElement, () => void>()
const visualStatus = gallery.querySelector<HTMLSelectElement>('[data-visual-status-filter]')!
const visualKind = gallery.querySelector<HTMLSelectElement>('[data-visual-kind-filter]')!
const visualQuality = gallery.querySelector<HTMLSelectElement>('[data-visual-quality-filter]')!
const visualMotion = gallery.querySelector<HTMLSelectElement>('[data-visual-motion-filter]')!
const visualMotionMode = gallery.querySelector<HTMLSelectElement>('[data-visual-motion-mode-filter]')!

const hydrateSection = (section: HTMLElement) => {
  if (!previewDisposers.has(section)) previewDisposers.set(section, hydrateGalleryPreviews(section))
}
const hydrateVisualSection = (section: HTMLElement) => {
  if (section.dataset.gallerySection !== 'visuals' || section.hasAttribute('data-visual-gallery-hydrated')) return
  const host = section.querySelector<HTMLElement>('[data-visual-gallery-host]')!
  const template = section.querySelector<HTMLTemplateElement>('[data-visual-gallery-template]')!
  host.append(template.content.cloneNode(true))
  section.setAttribute('data-visual-gallery-hydrated', '')
}
const handleToggle = (event: Event) => {
  const section = event.currentTarget as HTMLDetailsElement
  if (section.open) requestAnimationFrame(() => {
    hydrateVisualSection(section)
    hydrateSection(section)
    handleSearch()
  })
}
const handleSearch = () => {
  const query = search.value.trim().toLocaleLowerCase()
  sections.forEach((section) => {
    if (section.dataset.gallerySection === 'visuals' && !section.hasAttribute('data-visual-gallery-hydrated')) {
      if (query || visualStatus.value || visualKind.value || visualQuality.value || visualMotion.value || visualMotionMode.value) hydrateVisualSection(section)
      else { section.hidden = false; return }
    }
    let matches = 0
    section.querySelectorAll<HTMLElement>('.gallery-card').forEach((card) => {
      const textMatch = !query || (card.dataset.visualSearch ?? card.textContent ?? '').toLocaleLowerCase().includes(query)
      const statusMatch = !card.hasAttribute('data-gallery-visual') || !visualStatus.value || card.dataset.visualStatus === visualStatus.value
      const kindMatch = !card.hasAttribute('data-gallery-visual') || !visualKind.value || card.dataset.visualKind === visualKind.value
      const qualityMatch = !card.hasAttribute('data-gallery-visual') || !visualQuality.value
        || (visualQuality.value === 'animated' ? card.dataset.visualMotion !== 'none' : card.dataset.visualQuality === visualQuality.value)
      const motionMatch = !card.hasAttribute('data-gallery-visual') || !visualMotion.value
        || (visualMotion.value === 'animated' ? card.dataset.visualMotion !== 'none' : card.dataset.visualMotion === 'none')
      const motionModeMatch = !card.hasAttribute('data-gallery-visual') || !visualMotionMode.value || card.dataset.visualMotionMode === visualMotionMode.value
      const match = textMatch && statusMatch && kindMatch && qualityMatch && motionMatch && motionModeMatch
      card.hidden = !match
      if (match) matches += 1
    })
    section.hidden = matches === 0
    if (query && matches > 0) {
      section.open = true
      hydrateSection(section)
    }
  })
}
const handleClick = async (event: MouseEvent) => {
  if (event.target instanceof Element && event.target.closest('[data-gallery-close]')) window.close()
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-copy-composition]') : null
  const template = button?.closest<HTMLElement>('[data-gallery-component], [data-gallery-composition]')?.querySelector<HTMLTemplateElement>('[data-component-composition-json]')
  if (button && template) {
    const value = template.content.textContent ?? ''
    try {
      await navigator.clipboard.writeText(value)
      button.textContent = ui.gallery.copiedComposition
    } catch {
      button.textContent = ui.gallery.copyFailed
    }
  }
}

gallery.hidden = false
sections.forEach((section) => {
  section.addEventListener('toggle', handleToggle)
  if (section.open) hydrateSection(section)
})
gallery.addEventListener('click', handleClick)
search.addEventListener('input', handleSearch)
visualStatus.addEventListener('change', handleSearch)
visualKind.addEventListener('change', handleSearch)
visualQuality.addEventListener('change', handleSearch)
visualMotion.addEventListener('change', handleSearch)
visualMotionMode.addEventListener('change', handleSearch)
preview.start()

window.addEventListener('beforeunload', () => {
  disposeOneBitImages()
  disposeOneBitVisuals()
  disposeSmilVisuals()
  preview.dispose()
  previewDisposers.forEach(dispose => dispose())
  gallery.removeEventListener('click', handleClick)
  search.removeEventListener('input', handleSearch)
  visualStatus.removeEventListener('change', handleSearch)
  visualKind.removeEventListener('change', handleSearch)
  visualQuality.removeEventListener('change', handleSearch)
  visualMotion.removeEventListener('change', handleSearch)
  visualMotionMode.removeEventListener('change', handleSearch)
  sections.forEach(section => section.removeEventListener('toggle', handleToggle))
}, { once: true })
