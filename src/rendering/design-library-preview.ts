import { visualAssetById } from '../visual-assets/catalog.ts'
import { type UiLocale, uiText } from '../i18n/ui-locale'

export function renderDesignLibraryPreview(locale: UiLocale = 'zh-CN') {
  const text = uiText(locale).overview
  return `<dialog class="design-library-preview" data-testid="design-library-preview" aria-labelledby="design-library-preview-title">
      <header>
        <div><p>DESIGN LIBRARY PREVIEW</p><h2 id="design-library-preview-title"></h2></div>
        <div class="design-library-preview-actions"><button type="button" data-design-library-preview-poster hidden>Poster</button><button type="button" data-design-library-preview-one-bit hidden>1-bit</button><button type="button" data-design-library-preview-replay hidden>Replay</button><button type="button" data-design-library-preview-close aria-label="${text.closePreview}">×</button></div>
      </header>
      <div class="design-library-preview-stage" data-design-library-preview-content></div>
      <p class="design-library-preview-description" data-design-library-preview-description></p>
    </dialog>`
}

const presentationNavigationKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

export class DesignLibraryPreview {
  private trigger: HTMLButtonElement | null = null
  private started = false
  private readonly content: HTMLElement
  private readonly description: HTMLElement
  private readonly dialog: HTMLDialogElement
  private readonly root: HTMLElement
  private readonly replay: HTMLButtonElement
  private readonly oneBit: HTMLButtonElement
  private readonly poster: HTMLButtonElement
  private oneBitActive = false
  private posterActive = false
  private readonly title: HTMLElement

  constructor(
    root: HTMLElement,
    dialog: HTMLDialogElement,
  ) {
    this.root = root
    this.dialog = dialog
    const content = dialog.querySelector<HTMLElement>('[data-design-library-preview-content]')
    const description = dialog.querySelector<HTMLElement>('[data-design-library-preview-description]')
    const title = dialog.querySelector<HTMLElement>('#design-library-preview-title')
    const replay = dialog.querySelector<HTMLButtonElement>('[data-design-library-preview-replay]')
    const oneBit = dialog.querySelector<HTMLButtonElement>('[data-design-library-preview-one-bit]')
    const poster = dialog.querySelector<HTMLButtonElement>('[data-design-library-preview-poster]')
    if (!content || !description || !title || !replay || !oneBit || !poster) throw new Error('Design Library preview dialog is incomplete')
    this.content = content
    this.description = description
    this.title = title
    this.replay = replay
    this.oneBit = oneBit
    this.poster = poster
  }

  start() {
    if (this.started) return
    this.started = true
    this.root.addEventListener('click', this.handleRootClick)
    this.dialog.addEventListener('click', this.handleDialogClick)
    this.dialog.addEventListener('close', this.restoreFocus)
    document.addEventListener('keydown', this.keepDialogKeysLocal, true)
  }

  dispose() {
    if (!this.started) return
    if (this.dialog.open) this.dialog.close()
    this.root.removeEventListener('click', this.handleRootClick)
    this.dialog.removeEventListener('click', this.handleDialogClick)
    this.dialog.removeEventListener('close', this.restoreFocus)
    document.removeEventListener('keydown', this.keepDialogKeysLocal, true)
    this.content.replaceChildren()
    this.trigger = null
    this.started = false
  }

  private handleRootClick = (event: MouseEvent) => {
    const trigger = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('[data-design-library-preview]')
      : null
    if (!trigger || !this.root.contains(trigger)) return
    this.open(trigger)
  }

  private handleDialogClick = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('[data-design-library-preview-replay]')) {
      this.renderTriggeredPreview()
      return
    }
    if (event.target instanceof Element && event.target.closest('[data-design-library-preview-one-bit]')) {
      this.oneBitActive = !this.oneBitActive
      this.updateOneBitLabel()
      this.renderTriggeredPreview()
      return
    }
    if (event.target instanceof Element && event.target.closest('[data-design-library-preview-poster]')) {
      this.posterActive = !this.posterActive
      this.poster.setAttribute('aria-pressed', String(this.posterActive))
      this.poster.textContent = this.posterActive ? 'Live' : 'Poster'
      this.renderTriggeredPreview()
      return
    }
    if (event.target === this.dialog || (event.target instanceof Element && event.target.closest('[data-design-library-preview-close]'))) {
      this.dialog.close()
    }
  }

  private keepDialogKeysLocal = (event: KeyboardEvent) => {
    if (!this.dialog.open) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      this.dialog.close()
      return
    }
    if (presentationNavigationKeys.has(event.key)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  private open(trigger: HTMLButtonElement) {
    if (!trigger.querySelector('.gallery-live-preview, .gallery-typography-preview') || this.dialog.open) return
    this.trigger = trigger
    this.title.textContent = trigger.dataset.designLibraryPreviewLabel ?? 'Preview'
    this.description.textContent = trigger.dataset.designLibraryPreviewDescription ?? ''
    const cardMotion = trigger.closest<HTMLElement>('[data-visual-motion]')?.dataset.visualMotion
    const hasMotion = (cardMotion !== undefined && cardMotion !== 'none')
      || Boolean(trigger.querySelector('.cadenza-visual:not([data-axis-behavior="none"])'))
    this.replay.hidden = !hasMotion
    const sourceVisual = trigger.querySelector<HTMLElement>('.cadenza-visual')
    const candidate = trigger.closest<HTMLElement>('[data-visual-status]')?.dataset.visualStatus === 'candidate'
    this.oneBit.hidden = !sourceVisual || candidate
    this.poster.hidden = !hasMotion
    this.oneBitActive = sourceVisual?.dataset.axisTreatment === 'one-bit-pixel'
    this.posterActive = false
    this.poster.setAttribute('aria-pressed', 'false')
    this.poster.textContent = 'Poster'
    this.updateOneBitLabel()
    this.renderTriggeredPreview()
    this.dialog.showModal()
  }

  private renderTriggeredPreview() {
    const source = this.trigger?.querySelector<HTMLElement>('.gallery-live-preview, .gallery-typography-preview')
    if (!source) return
    const preview = source.cloneNode(true) as HTMLElement
    preview.classList.toggle('visual-preview-poster', this.posterActive)
    preview.querySelectorAll<HTMLElement>('.cadenza-visual').forEach(visual => {
      const asset = visualAssetById[visual.dataset.visualAsset ?? '']
      const vectorTreatment = asset?.treatments.find(treatment => treatment !== 'one-bit-pixel') ?? 'outline'
      visual.dataset.axisTreatment = this.oneBitActive ? 'one-bit-pixel' : vectorTreatment
    })
    preview.removeAttribute('aria-hidden')
    preview.querySelectorAll('[aria-hidden]').forEach((element) => element.removeAttribute('aria-hidden'))
    preview.querySelector<HTMLElement>('.gallery-thumbnail-reveal')?.style.setProperty('--gallery-preview-scale', '.75')
    copyCanvases(source, preview)
    this.content.replaceChildren(preview)
  }

  private restoreFocus = () => {
    this.content.replaceChildren()
    this.replay.hidden = true
    this.oneBit.hidden = true
    this.poster.hidden = true
    this.oneBitActive = false
    this.posterActive = false
    this.trigger?.focus({ preventScroll: true })
    this.trigger = null
  }

  private updateOneBitLabel() {
    this.oneBit.textContent = this.oneBitActive ? 'Vector' : '1-bit'
    this.oneBit.setAttribute('aria-pressed', String(this.oneBitActive))
  }
}

function copyCanvases(source: HTMLElement, preview: HTMLElement) {
  const sourceCanvases = source.querySelectorAll<HTMLCanvasElement>('canvas')
  const previewCanvases = preview.querySelectorAll<HTMLCanvasElement>('canvas')
  sourceCanvases.forEach((canvas, index) => {
    const copy = previewCanvases[index]
    if (!copy) return
    copy.width = canvas.width
    copy.height = canvas.height
    copy.getContext('2d')?.drawImage(canvas, 0, 0)
  })
}
