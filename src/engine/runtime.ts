import { AnimationLoop } from './animation-loop'
import heroUrl from '../assets/hero.png'
import { environmentDrawers, getFloatState } from './environment-drawers'
import { OneBitRenderer, type OneBitRendererOptions } from './one-bit/renderer'
import type { DitherScale, EnvironmentMode, SceneId, StageState } from './types'
import { floatTransform } from '../motion/float-transform'
import { shouldRenderContinuously } from '../motion/render-policy'

export class CadenzaRuntime {
  private readonly sourceCanvas = document.createElement('canvas')
  private readonly source: CanvasRenderingContext2D
  private readonly renderer: OneBitRenderer
  private readonly mediaImage = new Image()
  private readonly loop: AnimationLoop
  private readonly resizeObserver: ResizeObserver | null
  private environmentStartedAt = performance.now()
  private pausedAt = 0
  private disposed = false
  private runtimeStarted = false
  private overviewActive = false
  private reducedMotion = false
  private authoredEnvironmentMode: EnvironmentMode = 'static'
  private developmentTimings: number[] = []
  private state: StageState = { scene: 'field', environmentMode: 'static', ditherScale: 3, playing: true }
  private readonly stage: HTMLElement
  private readonly floatCard: HTMLElement
  private readonly environmentHost: HTMLElement

  constructor(
    environmentHost: HTMLElement,
    stage: HTMLElement,
    floatCard: HTMLElement,
    rendererOptions: Partial<OneBitRendererOptions> = {},
  ) {
    this.environmentHost = environmentHost
    this.stage = stage
    this.floatCard = floatCard
    const source = this.sourceCanvas.getContext('2d', { alpha: false })
    if (!source) throw new Error('Canvas 2D source context is unavailable')
    this.source = source
    this.mediaImage.decoding = 'async'
    this.mediaImage.src = heroUrl
    this.renderer = new OneBitRenderer(environmentHost, { ...rendererOptions, gridScale: this.state.ditherScale })
    this.loop = new AnimationLoop(this.render)
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.resize)
    this.resizeObserver?.observe(environmentHost)
    this.resize()
  }

  get currentState(): Readonly<StageState> { return { ...this.state } }
  get rendererKind() { return this.renderer.kind }
  get isReducedMotion() { return this.reducedMotion }
  get authoredMode() { return this.authoredEnvironmentMode }

  setScene(scene: SceneId, environmentMode: EnvironmentMode = 'static') {
    if (scene === this.state.scene && this.effectiveMode(environmentMode) === this.state.environmentMode) {
      this.authoredEnvironmentMode = environmentMode
      this.syncStageMode()
      return
    }
    this.applyScene(scene, environmentMode)
    this.requestRender()
  }

  setReducedMotion(reduced: boolean) {
    if (this.reducedMotion === reduced) return
    this.reducedMotion = reduced
    this.state.environmentMode = this.effectiveMode(this.authoredEnvironmentMode)
    this.stage.toggleAttribute('data-reduced-motion', reduced)
    this.syncStageMode()
    if (reduced && this.state.scene === 'float') this.floatCard.style.transform = floatTransform(getFloatState(0, 'static'))
    this.requestRender()
  }

  private applyScene(scene: SceneId, authoredMode: EnvironmentMode) {
    this.state.scene = scene
    this.authoredEnvironmentMode = authoredMode
    this.state.environmentMode = this.effectiveMode(authoredMode)
    this.environmentStartedAt = performance.now()
    this.pausedAt = 0
    this.stage.dataset.scene = scene
    this.syncStageMode()
    if (scene !== 'float') this.floatCard.style.transform = ''
  }

  private effectiveMode(mode: EnvironmentMode): EnvironmentMode {
    return this.reducedMotion ? 'static' : mode
  }

  private syncStageMode() {
    this.stage.dataset.environmentMode = this.state.environmentMode
    this.stage.dataset.authoredEnvironmentMode = this.authoredEnvironmentMode
  }

  toggleEnvironmentMode(): EnvironmentMode {
    this.authoredEnvironmentMode = this.authoredEnvironmentMode === 'static' ? 'loop' : 'static'
    this.state.environmentMode = this.effectiveMode(this.authoredEnvironmentMode)
    this.environmentStartedAt = performance.now()
    this.pausedAt = 0
    this.syncStageMode()
    this.requestRender()
    return this.state.environmentMode
  }

  toggleScale(): DitherScale {
    this.state.ditherScale = this.state.ditherScale === 3 ? 5 : 3
    this.renderer.setGridScale(this.state.ditherScale)
    this.requestRender()
    return this.state.ditherScale
  }

  togglePlaying() {
    const now = performance.now()
    if (this.state.playing) this.pausedAt = now - this.environmentStartedAt
    else this.environmentStartedAt = now - this.pausedAt
    this.state.playing = !this.state.playing
    this.requestRender()
  }

  setOverviewActive(active: boolean) {
    this.overviewActive = active
    this.stage.dataset.overview = String(active)
    if (active) this.loop.stop()
    else this.requestRender()
  }

  start() { this.runtimeStarted = true; this.requestRender() }
  stop() { this.runtimeStarted = false; this.loop.stop() }
  renderNow() {
    if (!this.runtimeStarted || this.overviewActive || this.disposed || !this.renderer.size) return
    this.render(performance.now())
  }
  captureFrame() { return this.renderer.captureFrame() }
  simulateContextLossForDiagnostics() { return this.renderer.simulateContextLossForDiagnostics() }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.resizeObserver?.disconnect()
    this.loop.dispose()
    this.renderer.dispose()
  }

  private getEnvironmentTime(now: number) { return this.state.playing ? now - this.environmentStartedAt : this.pausedAt }

  private drawEnvironment(time: number) {
    const { width, height } = this.sourceCanvas
    environmentDrawers[this.state.scene]({
      context: this.source,
      width,
      height,
      time,
      mode: this.state.environmentMode,
      image: this.mediaImage,
    })
  }

  private syncSemanticLayer(time: number) {
    if (this.state.scene !== 'float') return
    const state = getFloatState(time, this.state.environmentMode)
    this.floatCard.style.transform = floatTransform(state)
  }

  private resize = () => {
    if (this.disposed) return
    const rect = this.environmentHost.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const size = this.renderer.resize(rect.width, rect.height)
    if (this.sourceCanvas.width !== size.width || this.sourceCanvas.height !== size.height) {
      this.sourceCanvas.width = size.width
      this.sourceCanvas.height = size.height
    }
    this.requestRender()
  }

  private render: FrameRequestCallback = (now) => {
    if (this.disposed) return
    const frameStarted = import.meta.env.DEV ? performance.now() : 0
    const time = this.getEnvironmentTime(now)
    this.drawEnvironment(time)
    this.renderer.render(this.sourceCanvas)
    this.syncSemanticLayer(time)
    if (import.meta.env.DEV) this.recordDevelopmentTiming(performance.now() - frameStarted)
    if (!shouldRenderContinuously({ mode: this.state.environmentMode, playing: this.state.playing })) this.loop.stop()
  }

  private requestRender() {
    if (!this.runtimeStarted || this.overviewActive || this.disposed || !this.renderer.size) return
    this.loop.start()
  }

  private recordDevelopmentTiming(duration: number) {
    this.developmentTimings.push(duration)
    if (this.developmentTimings.length > 120) this.developmentTimings.shift()
    if (this.developmentTimings.length < 30) return
    const sorted = [...this.developmentTimings].sort((a, b) => a - b)
    const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    this.stage.dataset.renderAverageMs = average.toFixed(2)
    this.stage.dataset.renderP95Ms = sorted[Math.floor((sorted.length - 1) * .95)].toFixed(2)
  }
}
