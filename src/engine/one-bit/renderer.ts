import { CanvasOneBitBackend, WebGlOneBitBackend, type OneBitBackend, type OneBitBackendKind } from './backends'
import { computeRenderSize, type RenderSize } from './core'
import { DEFAULT_ONE_BIT_OPTIONS, type OneBitOptions } from './reference'

export interface OneBitRendererOptions extends Omit<OneBitOptions, 'gridScale'> {
  gridScale: number
  maxPixelRatio: number
  maxPixelCount: number
  fallbackMaxPixelRatio: number
  fallbackMaxPixelCount: number
  preferWebGl: boolean
}

const defaults: Readonly<OneBitRendererOptions> = {
  ...DEFAULT_ONE_BIT_OPTIONS,
  maxPixelRatio: 1.5,
  maxPixelCount: 1920 * 1080,
  fallbackMaxPixelRatio: 1,
  fallbackMaxPixelCount: 1280 * 720,
  preferWebGl: true,
}

export class OneBitRenderer {
  private backend: OneBitBackend
  private options: OneBitRendererOptions
  private renderSize: RenderSize | null = null
  private lastDisplaySize: { cssWidth: number, cssHeight: number, devicePixelRatio: number } | null = null
  private disposed = false
  private readonly host: HTMLElement

  constructor(host: HTMLElement, options: Partial<OneBitRendererOptions> = {}) {
    this.host = host
    this.options = { ...defaults, ...options }
    this.backend = this.createBackend()
    this.mountBackend()
  }

  get kind(): OneBitBackendKind { return this.backend.kind }
  get canvas() { return this.backend.canvas }
  get size(): Readonly<RenderSize> | null { return this.renderSize }

  setGridScale(gridScale: number) {
    if (!Number.isFinite(gridScale) || gridScale <= 0) throw new RangeError('gridScale must be positive')
    this.options.gridScale = gridScale
  }

  resize(cssWidth: number, cssHeight: number, devicePixelRatio = window.devicePixelRatio || 1) {
    this.assertUsable()
    this.lastDisplaySize = { cssWidth, cssHeight, devicePixelRatio }
    const next = this.computeSize(cssWidth, cssHeight, devicePixelRatio)
    if (!this.renderSize || next.width !== this.renderSize.width || next.height !== this.renderSize.height) {
      this.backend.resize(next.width, next.height)
    }
    this.renderSize = next
    return next
  }

  render(source: CanvasImageSource) {
    this.assertUsable()
    if (!this.renderSize) throw new Error('OneBitRenderer must be resized before rendering')
    const bufferScale = (this.renderSize.scaleX + this.renderSize.scaleY) * .5
    this.backend.render(source, {
      paper: this.options.paper,
      ink: this.options.ink,
      contrast: this.options.contrast,
      gridScale: Math.max(1, this.options.gridScale * bufferScale),
    })
  }

  captureFrame() {
    this.assertUsable()
    return this.backend.captureFrame()
  }

  simulateContextLossForDiagnostics() {
    this.assertUsable()
    return this.backend.simulateContextLossForDiagnostics?.() ?? false
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.backend.dispose()
    this.backend.canvas.remove()
    delete this.host.dataset.renderer
  }

  private createBackend(): OneBitBackend {
    if (this.options.preferWebGl) {
      try {
        return new WebGlOneBitBackend(this.switchToCanvasBackend)
      } catch {
        // Canvas 2D below is the required compatibility path.
      }
    }
    return new CanvasOneBitBackend()
  }

  private switchToCanvasBackend = () => {
    if (this.disposed || this.backend.kind === 'canvas2d') return
    const previous = this.backend
    const fallback = new CanvasOneBitBackend()
    this.backend = fallback
    if (this.lastDisplaySize) {
      const { cssWidth, cssHeight, devicePixelRatio } = this.lastDisplaySize
      this.renderSize = this.computeSize(cssWidth, cssHeight, devicePixelRatio)
      fallback.resize(this.renderSize.width, this.renderSize.height)
    }
    previous.canvas.replaceWith(fallback.canvas)
    previous.dispose()
    this.decorateCanvas()
    this.host.dispatchEvent(new CustomEvent('onebitbackendchange', { detail: { kind: this.backend.kind } }))
  }

  private mountBackend() {
    this.host.replaceChildren(this.backend.canvas)
    this.decorateCanvas()
  }

  private computeSize(cssWidth: number, cssHeight: number, devicePixelRatio: number) {
    const fallback = this.backend.kind === 'canvas2d'
    return computeRenderSize({
      cssWidth,
      cssHeight,
      devicePixelRatio,
      maxPixelRatio: fallback ? this.options.fallbackMaxPixelRatio : this.options.maxPixelRatio,
      maxPixelCount: fallback ? this.options.fallbackMaxPixelCount : this.options.maxPixelCount,
    })
  }

  private decorateCanvas() {
    this.backend.canvas.className = 'environment-canvas'
    this.backend.canvas.setAttribute('aria-hidden', 'true')
    this.backend.canvas.dataset.renderer = this.backend.kind
    this.host.dataset.renderer = this.backend.kind
  }

  private assertUsable() {
    if (this.disposed) throw new Error('OneBitRenderer is disposed')
  }
}
