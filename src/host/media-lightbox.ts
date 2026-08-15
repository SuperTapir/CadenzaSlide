const mediaSelector = '.component-image-area img, .component-object-image img, .cadenza-media img, .component-video-area'
const navigationKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

export function isPresentationNavigationKey(key: string) {
  return navigationKeys.has(key)
}

export function renderMediaLightbox(locale: UiLocale = 'zh-CN') {
  const text = uiText(locale).studio
  return `<dialog class="media-lightbox" data-testid="media-lightbox" aria-label="${text.mediaPreview}">
      <div class="media-lightbox-toolbar" aria-label="${text.mediaControls}">
        <button type="button" data-media-lightbox-zoom-out aria-label="${text.zoomMediaOut}">−</button>
        <output data-media-lightbox-zoom-value aria-live="polite">100%</output>
        <button type="button" data-media-lightbox-zoom-in aria-label="${text.zoomMediaIn}">+</button>
        <button type="button" data-media-lightbox-reset aria-label="${text.resetMediaZoom}">${text.reset}</button>
      </div>
      <button class="media-lightbox-close" type="button" data-media-lightbox-close aria-label="${text.closeMediaPreview}">×</button>
      <div class="media-lightbox-content" data-media-lightbox-content></div>
    </dialog>`
}

export class MediaLightbox {
  private media: HTMLImageElement | HTMLVideoElement | null = null
  private sourceMedia: HTMLImageElement | HTMLVideoElement | null = null
  private placeholder: Comment | null = null
  private started = false
  private readonly scope: HTMLElement
  private readonly dialog: HTMLDialogElement
  private readonly content: HTMLElement
  private readonly zoomValue: HTMLOutputElement
  private scale = 1
  private translateX = 0
  private translateY = 0
  private drag: { pointerId: number, x: number, y: number, translateX: number, translateY: number } | null = null

  constructor(scope: HTMLElement, dialog: HTMLDialogElement) {
    this.scope = scope
    this.dialog = dialog
    const content = dialog.querySelector<HTMLElement>('[data-media-lightbox-content]')
    if (!content) throw new Error('Media lightbox content host is missing')
    this.content = content
    this.zoomValue = dialog.querySelector<HTMLOutputElement>('[data-media-lightbox-zoom-value]')!
  }

  start() {
    if (this.started) return
    this.started = true
    this.scope.querySelectorAll<HTMLElement>(mediaSelector).forEach((media) => {
      media.tabIndex = 0
      media.setAttribute('aria-haspopup', 'dialog')
      const hintHost = media instanceof HTMLImageElement ? media.closest<HTMLElement>('.component-image-area') : media
      hintHost?.setAttribute('data-media-zoomable', '')
    })
    this.scope.addEventListener('click', this.openFromEvent)
    this.scope.addEventListener('keydown', this.openFromKeyboard)
    this.dialog.addEventListener('click', this.handleDialogClick)
    this.dialog.addEventListener('cancel', this.handleCancel)
    this.dialog.addEventListener('close', this.restore)
    this.content.addEventListener('wheel', this.handleWheel, { passive: false })
    this.content.addEventListener('pointerdown', this.startDrag)
    this.content.addEventListener('pointermove', this.moveDrag)
    this.content.addEventListener('pointerup', this.endDrag)
    this.content.addEventListener('pointercancel', this.endDrag)
    document.addEventListener('keydown', this.blockRevealNavigation, true)
  }

  dispose() {
    if (!this.started) return
    if (this.dialog.open) this.dialog.close()
    this.restore()
    this.scope.removeEventListener('click', this.openFromEvent)
    this.scope.removeEventListener('keydown', this.openFromKeyboard)
    this.dialog.removeEventListener('click', this.handleDialogClick)
    this.dialog.removeEventListener('cancel', this.handleCancel)
    this.dialog.removeEventListener('close', this.restore)
    this.content.removeEventListener('wheel', this.handleWheel)
    this.content.removeEventListener('pointerdown', this.startDrag)
    this.content.removeEventListener('pointermove', this.moveDrag)
    this.content.removeEventListener('pointerup', this.endDrag)
    this.content.removeEventListener('pointercancel', this.endDrag)
    document.removeEventListener('keydown', this.blockRevealNavigation, true)
    this.started = false
  }

  private findMedia(target: EventTarget | null) {
    if (!(target instanceof Element)) return null
    const media = target.closest<HTMLImageElement | HTMLVideoElement>(mediaSelector)
    return media && this.scope.contains(media) ? media : null
  }

  private open(media: HTMLImageElement | HTMLVideoElement) {
    if (this.dialog.open || !media.parentNode) return
    this.sourceMedia = media
    if (media instanceof HTMLImageElement) {
      this.media = media.cloneNode(true) as HTMLImageElement
      const originalSource = media.dataset.oneBitSource || media.currentSrc || media.src
      this.media.removeAttribute('srcset')
      this.media.removeAttribute('sizes')
      this.media.removeAttribute('data-one-bit-ready')
      this.media.removeAttribute('data-one-bit-processing')
      this.media.removeAttribute('data-one-bit-error')
      this.media.removeAttribute('data-one-bit-source')
      this.media.setAttribute('data-media-lightbox-original', '')
      this.media.src = originalSource
      this.content.append(this.media)
    } else {
      this.media = media
      this.placeholder = document.createComment('cadenza-media-lightbox')
      media.parentNode.insertBefore(this.placeholder, media)
      this.content.append(media)
    }
    this.dialog.dataset.mediaKind = media instanceof HTMLVideoElement ? 'video' : 'image'
    this.resetZoom()
    this.dialog.showModal()
  }

  private openFromEvent = (event: MouseEvent) => {
    const media = this.findMedia(event.target)
    if (!media) return
    event.preventDefault()
    event.stopPropagation()
    this.open(media)
  }

  private openFromKeyboard = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    const media = this.findMedia(event.target)
    if (!media) return
    event.preventDefault()
    event.stopPropagation()
    this.open(media)
  }

  private handleDialogClick = (event: MouseEvent) => {
    if (event.target === this.dialog || (event.target instanceof Element && event.target.closest('[data-media-lightbox-close]'))) {
      this.dialog.close()
      return
    }
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('[data-media-lightbox-zoom-in]')) return this.setZoom(this.scale + .25)
    if (target?.closest('[data-media-lightbox-zoom-out]')) return this.setZoom(this.scale - .25)
    if (target?.closest('[data-media-lightbox-reset]')) return this.resetZoom()
    if (event.target === this.media && this.media instanceof HTMLVideoElement) this.toggleVideo()
  }

  private handleWheel = (event: WheelEvent) => {
    if (!this.media) return
    event.preventDefault()
    const rect = this.content.getBoundingClientRect()
    this.setZoom(this.scale * Math.exp(-event.deltaY * .002), event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2))
  }

  private startDrag = (event: PointerEvent) => {
    if (this.scale <= 1 || event.button !== 0) return
    this.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, translateX: this.translateX, translateY: this.translateY }
    this.content.setPointerCapture(event.pointerId)
    this.dialog.setAttribute('data-media-dragging', '')
    event.preventDefault()
  }

  private moveDrag = (event: PointerEvent) => {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return
    this.translateX = this.drag.translateX + event.clientX - this.drag.x
    this.translateY = this.drag.translateY + event.clientY - this.drag.y
    this.applyTransform()
  }

  private endDrag = (event: PointerEvent) => {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return
    this.drag = null
    this.dialog.removeAttribute('data-media-dragging')
    if (this.content.hasPointerCapture(event.pointerId)) this.content.releasePointerCapture(event.pointerId)
  }

  private setZoom(next: number, anchorX = 0, anchorY = 0) {
    const scale = Math.max(1, Math.min(5, next))
    const ratio = scale / this.scale
    this.translateX = anchorX - (anchorX - this.translateX) * ratio
    this.translateY = anchorY - (anchorY - this.translateY) * ratio
    this.scale = scale
    if (scale === 1) { this.translateX = 0; this.translateY = 0 }
    this.applyTransform()
  }

  private resetZoom() {
    this.scale = 1
    this.translateX = 0
    this.translateY = 0
    this.applyTransform()
  }

  private applyTransform() {
    if (this.media) this.media.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`
    this.zoomValue.value = `${Math.round(this.scale * 20) * 5}%`
    this.zoomValue.textContent = this.zoomValue.value
    this.dialog.toggleAttribute('data-media-zoomed', this.scale > 1)
  }

  private handleCancel = (event: Event) => {
    event.preventDefault()
    this.dialog.close()
  }

  private blockRevealNavigation = (event: KeyboardEvent) => {
    if (!this.dialog.open) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      this.dialog.close()
      return
    }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); return this.setZoom(this.scale + .25) }
    if (event.key === '-') { event.preventDefault(); return this.setZoom(this.scale - .25) }
    if (event.key === '0') { event.preventDefault(); return this.resetZoom() }
    if (!isPresentationNavigationKey(event.key)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.key === ' ' && this.media instanceof HTMLVideoElement) this.toggleVideo()
  }

  private toggleVideo() {
    if (!(this.media instanceof HTMLVideoElement)) return
    if (this.media.paused) void this.media.play().catch(() => {})
    else this.media.pause()
  }

  private restore = () => {
    const media = this.media
    if (media && this.placeholder?.parentNode) {
      this.placeholder.parentNode.insertBefore(media, this.placeholder)
      this.placeholder.remove()
    } else media?.remove()
    this.sourceMedia?.focus({ preventScroll: true })
    this.media = null
    this.sourceMedia = null
    this.placeholder = null
    delete this.dialog.dataset.mediaKind
    this.resetZoom()
  }
}
import { type UiLocale, uiText } from '../i18n/ui-locale'
