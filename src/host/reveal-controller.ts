import type { EnvironmentMode, SceneId } from '../engine/types'
import { isEnvironmentMode, isEnvironmentPresetId } from '../engine/environment-presets'

type RevealHostEvent = 'slidechanged' | 'overviewshown' | 'overviewhidden'

export interface RevealSlideChangedEvent {
  previousSlide?: HTMLElement
  currentSlide?: HTMLElement
}

export interface RevealDeckLike {
  getCurrentSlide(): HTMLElement | undefined
  on(event: RevealHostEvent, listener: (event?: RevealSlideChangedEvent) => void): void
  off(event: RevealHostEvent, listener: (event?: RevealSlideChangedEvent) => void): void
}

export interface FullSlideTransitionLike {
  begin(previousSlide: HTMLElement, currentSlide: HTMLElement, renderOutgoing: () => void, renderIncoming: () => void): void
  dispose(): void
}

export interface CadenzaRuntimeLike {
  start(): void
  setScene(scene: SceneId, mode: EnvironmentMode): void
  renderNow(): void
  setOverviewActive(active: boolean): void
  dispose(): void
}

export function sceneFromSlide(slide: HTMLElement | undefined): SceneId {
  const candidate = slide?.dataset.cadenzaScene
  return isEnvironmentPresetId(candidate) ? candidate : 'field'
}

export function environmentModeFromSlide(slide: HTMLElement | undefined): EnvironmentMode {
  const candidate = slide?.dataset.environmentMode
  return isEnvironmentMode(candidate) ? candidate : 'static'
}

export class RevealHostController {
  private started = false
  private disposed = false
  private overviewActive = false
  private sceneSynced = false
  private readonly deck: RevealDeckLike
  private readonly runtime: CadenzaRuntimeLike
  private readonly onSceneChange: (scene: SceneId, slide: HTMLElement | undefined) => void
  private readonly slideTransition?: FullSlideTransitionLike

  constructor(
    deck: RevealDeckLike,
    runtime: CadenzaRuntimeLike,
    onSceneChange: (scene: SceneId, slide: HTMLElement | undefined) => void = () => {},
    slideTransition?: FullSlideTransitionLike,
  ) {
    this.deck = deck
    this.runtime = runtime
    this.onSceneChange = onSceneChange
    this.slideTransition = slideTransition
  }

  start() {
    if (this.started || this.disposed) return
    this.started = true
    this.deck.on('slidechanged', this.syncScene)
    this.deck.on('overviewshown', this.showOverview)
    this.deck.on('overviewhidden', this.hideOverview)
    this.runtime.start()
    this.syncScene()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.started) {
      this.deck.off('slidechanged', this.syncScene)
      this.deck.off('overviewshown', this.showOverview)
      this.deck.off('overviewhidden', this.hideOverview)
    }
    this.slideTransition?.dispose()
    this.runtime.dispose()
  }

  private syncScene = (event?: RevealSlideChangedEvent) => {
    if (this.overviewActive) return
    const slide = this.deck.getCurrentSlide()
    const scene = sceneFromSlide(slide)
    const mode = environmentModeFromSlide(slide)
    if (this.sceneSynced) {
      if (event?.previousSlide && event.currentSlide && this.slideTransition) {
        this.slideTransition.begin(event.previousSlide, event.currentSlide, () => this.runtime.renderNow(), () => {
          this.runtime.setScene(scene, mode)
          this.runtime.renderNow()
        })
      } else this.runtime.setScene(scene, mode)
    }
    else {
      this.runtime.setScene(scene, mode)
      this.sceneSynced = true
    }
    this.onSceneChange(scene, slide)
  }

  private showOverview = () => {
    this.overviewActive = true
    this.runtime.setOverviewActive(true)
  }

  private hideOverview = () => {
    this.overviewActive = false
    this.runtime.setOverviewActive(false)
    this.syncScene()
  }
}
