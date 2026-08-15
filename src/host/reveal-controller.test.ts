import { describe, expect, it, vi } from 'vitest'
import { environmentModeFromSlide, RevealHostController, sceneFromSlide, type RevealSlideChangedEvent } from './reveal-controller'
import type { SceneId } from '../engine/types'

class FakeDeck {
  private listeners = new Map<string, Set<(event?: RevealSlideChangedEvent) => void>>()
  currentSlide: HTMLElement | null

  constructor(currentSlide: HTMLElement | null) {
    this.currentSlide = currentSlide
  }

  getCurrentSlide() { return this.currentSlide ?? undefined }

  on(event: string, listener: (event?: RevealSlideChangedEvent) => void) {
    const listeners = this.listeners.get(event) ?? new Set()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }

  off(event: string, listener: (event?: RevealSlideChangedEvent) => void) {
    this.listeners.get(event)?.delete(listener)
  }

  emit(event: string, payload?: RevealSlideChangedEvent) {
    this.listeners.get(event)?.forEach((listener) => listener(payload))
  }
}

function slide(scene?: string) {
  return { dataset: scene ? { cadenzaScene: scene } : {} } as HTMLElement
}

describe('sceneFromSlide', () => {
  it('reads a supported Cadenza scene from a Reveal slide', () => {
    expect(sceneFromSlide(slide('raster'))).toBe('raster')
    expect(sceneFromSlide(slide('contour'))).toBe('contour')
  })

  it('falls back safely when the slide has no supported scene', () => {
    expect(sceneFromSlide(slide('unknown'))).toBe('field')
    expect(sceneFromSlide(undefined)).toBe('field')
  })
})

describe('environmentModeFromSlide', () => {
  it('reads supported modes and defaults safely to static', () => {
    expect(environmentModeFromSlide({ dataset: { environmentMode: 'loop' } } as unknown as HTMLElement)).toBe('loop')
    expect(environmentModeFromSlide({ dataset: { environmentMode: 'ambient' } } as unknown as HTMLElement)).toBe('static')
    expect(environmentModeFromSlide(undefined)).toBe('static')
  })
})

describe('RevealHostController', () => {
  it('starts Cadenza, syncs slide changes, and releases every listener', () => {
    const deck = new FakeDeck(slide('float'))
    const scenes: SceneId[] = []
    const runtime = {
      start: vi.fn(),
      setScene: vi.fn((scene: SceneId) => scenes.push(scene)),
      renderNow: vi.fn(),
      setOverviewActive: vi.fn(),
      dispose: vi.fn(),
    }
    const onSceneChange = vi.fn()
    const controller = new RevealHostController(deck, runtime, onSceneChange)

    controller.start()
    expect(runtime.start).toHaveBeenCalledOnce()
    expect(scenes).toEqual(['float'])
    expect(onSceneChange).toHaveBeenLastCalledWith('float', deck.currentSlide)

    deck.currentSlide = slide('halo')
    deck.emit('slidechanged')
    expect(scenes).toEqual(['float', 'halo'])
    expect(runtime.setScene).toHaveBeenLastCalledWith('halo', 'static')

    controller.dispose()
    deck.currentSlide = slide('raster')
    deck.emit('slidechanged')
    expect(scenes).toEqual(['float', 'halo'])
    expect(runtime.dispose).toHaveBeenCalledOnce()
  })

  it('captures the complete outgoing slide before switching the shared environment', () => {
    const previousSlide = slide('field')
    const currentSlide = slide('halo')
    const deck = new FakeDeck(previousSlide)
    const calls: string[] = []
    const runtime = {
      start: vi.fn(),
      setScene: vi.fn(() => calls.push('scene')),
      renderNow: vi.fn(() => calls.push('render')),
      setOverviewActive: vi.fn(),
      dispose: vi.fn(),
    }
    const transition = {
      begin: vi.fn((_previous: HTMLElement, _current: HTMLElement, renderOutgoing: () => void, renderIncoming: () => void) => {
        renderOutgoing()
        calls.push('overlay')
        renderIncoming()
      }),
      dispose: vi.fn(),
    }
    const controller = new RevealHostController(deck, runtime, undefined, transition)

    controller.start()
    calls.length = 0
    deck.currentSlide = currentSlide
    deck.emit('slidechanged', { previousSlide, currentSlide })

    expect(calls).toEqual(['render', 'overlay', 'scene', 'render'])
    expect(transition.begin).toHaveBeenCalledWith(previousSlide, currentSlide, expect.any(Function), expect.any(Function))
    controller.dispose()
    expect(transition.dispose).toHaveBeenCalledOnce()
  })

  it('freezes the shared environment in overview and restores the selected slide on exit', () => {
    const deck = new FakeDeck(slide('field'))
    const scenes: SceneId[] = []
    const runtime = {
      start: vi.fn(),
      setScene: vi.fn((scene: SceneId) => scenes.push(scene)),
      renderNow: vi.fn(),
      setOverviewActive: vi.fn(),
      dispose: vi.fn(),
    }
    const controller = new RevealHostController(deck, runtime)

    controller.start()
    deck.emit('overviewshown')
    expect(runtime.setOverviewActive).toHaveBeenLastCalledWith(true)

    deck.currentSlide = slide('raster')
    deck.emit('slidechanged')
    expect(scenes).toEqual(['field'])

    deck.emit('overviewhidden')
    expect(runtime.setOverviewActive).toHaveBeenLastCalledWith(false)
    expect(scenes).toEqual(['field', 'raster'])

    controller.dispose()
    deck.emit('overviewshown')
    expect(runtime.setOverviewActive).toHaveBeenCalledTimes(2)
  })
})
