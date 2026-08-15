import { isMotionPresetId, motionPresets, type MotionPresetId } from './presets'

const bayer4x4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

export function bayerMask(progress: number) {
  const removedCells = Math.round(Math.max(0, Math.min(1, progress)) * bayer4x4.length)
  return Uint8ClampedArray.from(bayer4x4, threshold => threshold < removedCells ? 0 : 255)
}

export interface FullSlideTransitionOptions {
  stage: HTMLElement
  revealRoot: HTMLElement
  getGridScale: () => number
  captureEnvironment: () => ImageData | null
  reducedMotion?: boolean
}

export class FullSlideTransition {
  private readonly stage: HTMLElement
  private readonly revealRoot: HTMLElement
  private readonly getGridScale: () => number
  private readonly captureEnvironment: () => ImageData | null
  private readonly maskCanvas = document.createElement('canvas')
  private readonly maskContext: CanvasRenderingContext2D
  private overlay: HTMLElement | null = null
  private animation: Animation | null = null
  private frame = 0
  private reducedMotion: boolean

  constructor(options: FullSlideTransitionOptions) {
    this.stage = options.stage
    this.revealRoot = options.revealRoot
    this.getGridScale = options.getGridScale
    this.captureEnvironment = options.captureEnvironment
    this.reducedMotion = options.reducedMotion ?? false
    this.maskCanvas.width = 4
    this.maskCanvas.height = 4
    const context = this.maskCanvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D transition mask is unavailable')
    this.maskContext = context
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced
    if (reduced) this.clear()
  }

  begin(previousSlide: HTMLElement, currentSlide: HTMLElement, renderOutgoing: () => void, renderIncoming: () => void) {
    this.clear()
    const motion = this.motionFromSlide(currentSlide)
    if (this.reducedMotion || motion === 'cut') {
      renderIncoming()
      return
    }

    const sameEnvironment = previousSlide.dataset.cadenzaScene === currentSlide.dataset.cadenzaScene
      && previousSlide.dataset.environmentMode === currentSlide.dataset.environmentMode
    if (!sameEnvironment) renderOutgoing()
    const overlay = this.createOverlay(previousSlide, motion, sameEnvironment ? null : this.captureEnvironment())
    this.overlay = overlay
    this.stage.append(overlay)
    try { renderIncoming() } catch (error) { this.clear(); throw error }
    this.keepOnlyChangedBackgroundPixels(overlay)
    overlay.dataset.transitionReady = ''
    if (motion === 'dissolve') this.runDissolve(overlay, motionPresets[motion].durationMs)
    else this.runMotion(overlay, motion)
  }

  dispose() { this.clear() }

  private createOverlay(previousSlide: HTMLElement, motion: MotionPresetId, outgoingFrame: ImageData | null) {
    const overlay = document.createElement('div')
    overlay.className = 'slide-transition-overlay'
    overlay.dataset.motion = motion
    overlay.setAttribute('aria-hidden', 'true')
    overlay.setAttribute('inert', '')

    if (outgoingFrame) {
      const snapshot = document.createElement('canvas')
      snapshot.className = 'slide-transition-background'
      snapshot.width = outgoingFrame.width
      snapshot.height = outgoingFrame.height
      snapshot.getContext('2d', { willReadFrequently: true })?.putImageData(outgoingFrame, 0, 0)
      overlay.append(snapshot)
    }

    const slides = this.revealRoot.querySelector<HTMLElement>('.slides')
    if (slides) {
      const reveal = document.createElement('div')
      reveal.className = 'reveal slide-transition-reveal'
      const slidesClone = slides.cloneNode(false) as HTMLElement
      const slideClone = previousSlide.cloneNode(true) as HTMLElement
      slideClone.classList.remove('past', 'future')
      slideClone.classList.add('present')
      slideClone.removeAttribute('aria-hidden')
      this.freezeEmbeddedMedia(previousSlide, slideClone)
      slidesClone.append(slideClone)
      reveal.append(slidesClone)
      overlay.append(reveal)
    }
    return overlay
  }

  private runDissolve(overlay: HTMLElement, durationMs: number) {
    const startedAt = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs)
      this.applyMask(overlay, progress)
      if (progress < 1 && this.overlay === overlay) this.frame = requestAnimationFrame(tick)
      else if (this.overlay === overlay) this.clear()
    }
    this.applyMask(overlay, 0)
    this.frame = requestAnimationFrame(tick)
  }

  private keepOnlyChangedBackgroundPixels(overlay: HTMLElement) {
    const snapshot = overlay.querySelector<HTMLCanvasElement>('.slide-transition-background')
    if (!snapshot) return
    const incomingFrame = this.captureEnvironment()
    if (!incomingFrame || snapshot.width !== incomingFrame.width || snapshot.height !== incomingFrame.height) return
    const outgoingContext = snapshot.getContext('2d', { willReadFrequently: true })
    if (!outgoingContext) return
    try {
      const outgoing = outgoingContext.getImageData(0, 0, snapshot.width, snapshot.height)
      const incoming = incomingFrame.data
      let unchangedPixels = 0
      let changedPixels = 0
      for (let index = 0; index < outgoing.data.length; index += 4) {
        if (outgoing.data[index] === incoming[index]
          && outgoing.data[index + 1] === incoming[index + 1]
          && outgoing.data[index + 2] === incoming[index + 2]) {
          outgoing.data[index + 3] = 0
          unchangedPixels += 1
        } else changedPixels += 1
      }
      outgoingContext.putImageData(outgoing, 0, 0)
      overlay.dataset.backgroundUnchangedPixels = String(unchangedPixels)
      overlay.dataset.backgroundChangedPixels = String(changedPixels)
    } catch { /* A full outgoing snapshot is the safe fallback when pixels cannot be read. */ }
  }

  private freezeEmbeddedMedia(original: HTMLElement, clone: HTMLElement) {
    const canvases = [...original.querySelectorAll('canvas')]
    clone.querySelectorAll('canvas').forEach((canvas, index) => {
      const source = canvases[index]
      if (!source) return
      canvas.width = source.width
      canvas.height = source.height
      try { canvas.getContext('2d')?.drawImage(source, 0, 0) } catch { /* Blank canvas is the safe fallback. */ }
    })
    const videos = [...original.querySelectorAll('video')]
    clone.querySelectorAll('video').forEach((video, index) => {
      const source = videos[index]
      if (source?.readyState && source.videoWidth && source.videoHeight) {
        const frame = document.createElement('canvas')
        frame.className = video.className
        frame.style.cssText = video.style.cssText
        frame.width = source.videoWidth
        frame.height = source.videoHeight
        try {
          frame.getContext('2d')?.drawImage(source, 0, 0)
          video.replaceWith(frame)
          return
        } catch { /* Poster-only fallback below. */ }
      }
      video.removeAttribute('autoplay')
      video.removeAttribute('src')
      video.querySelectorAll('source').forEach(source => source.removeAttribute('src'))
    })
    clone.querySelectorAll('iframe').forEach(frame => frame.removeAttribute('src'))
  }

  private applyMask(overlay: HTMLElement, progress: number) {
    const gridScale = Math.max(1, Math.round(this.getGridScale()))
    const tileSize = gridScale * 4
    if (this.maskCanvas.width !== tileSize) {
      this.maskCanvas.width = tileSize
      this.maskCanvas.height = tileSize
    }
    const mask = bayerMask(progress)
    const image = this.maskContext.createImageData(tileSize, tileSize)
    for (let y = 0; y < tileSize; y += 1) for (let x = 0; x < tileSize; x += 1) {
      const offset = (y * tileSize + x) * 4
      image.data[offset] = 255
      image.data[offset + 1] = 255
      image.data[offset + 2] = 255
      image.data[offset + 3] = mask[Math.floor(y / gridScale) * 4 + Math.floor(x / gridScale)]
    }
    this.maskContext.putImageData(image, 0, 0)
    const maskUrl = `url(${this.maskCanvas.toDataURL()})`
    const size = `${tileSize}px`
    overlay.style.maskMode = 'alpha'
    overlay.style.maskImage = maskUrl
    overlay.style.maskSize = size
    overlay.style.maskRepeat = 'repeat'
    overlay.style.webkitMaskImage = maskUrl
    overlay.style.webkitMaskSize = size
    overlay.style.webkitMaskRepeat = 'repeat'
  }

  private runMotion(overlay: HTMLElement, motion: Exclude<MotionPresetId, 'cut' | 'dissolve'>) {
    this.animation = overlay.animate(motionFrames[motion], {
      duration: motionPresets[motion].durationMs,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'forwards',
    })
    void this.animation.finished.catch(() => {}).then(() => {
      if (this.overlay === overlay) this.clear()
    })
  }

  private motionFromSlide(slide: HTMLElement): MotionPresetId {
    return isMotionPresetId(slide.dataset.cadenzaMotion) ? slide.dataset.cadenzaMotion : 'dissolve'
  }

  private clear() {
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
    this.animation?.cancel()
    this.animation = null
    this.overlay?.remove()
    this.overlay = null
  }
}

const motionFrames: Record<Exclude<MotionPresetId, 'cut' | 'dissolve'>, Keyframe[]> = {
  'pass-left': [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(-8%, 0, 0)' }],
  'pass-up': [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, -6%, 0)' }],
  unfold: [{ clipPath: 'inset(0)' }, { clipPath: 'inset(0 0 0 100%)' }],
  focus: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.985)' }],
  land: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, -2%, 0)' }],
  accumulate: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, -3%, 0)' }],
  lock: [{ clipPath: 'circle(140% at 72% 43%)' }, { clipPath: 'circle(0 at 72% 43%)' }],
  replace: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(-7%, 0, 0) skewX(2deg)' }],
}
