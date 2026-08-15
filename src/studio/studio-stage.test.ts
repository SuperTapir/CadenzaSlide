import { describe, expect, it } from 'vitest'
import { clampZoomPercent, computeFitScale, createResizeFrameScheduler } from './studio-stage'

describe('Studio stage geometry', () => {
  it('fits a 1280×720 canvas into available space without changing its geometry', () => {
    expect(computeFitScale({ width: 1280, height: 720 }, { width: 1000, height: 700 })).toBeCloseTo(0.78125)
    expect(computeFitScale({ width: 1280, height: 720 }, { width: 1000, height: 400 })).toBeCloseTo(0.55556, 4)
  })

  it('uses centralized manual zoom limits', () => {
    expect(clampZoomPercent(12)).toBe(25)
    expect(clampZoomPercent(125)).toBe(125)
    expect(clampZoomPercent(900)).toBe(200)
  })

  it('coalesces resize work into one animation frame', () => {
    const queued: FrameRequestCallback[] = []
    const calls: number[] = []
    const schedule = createResizeFrameScheduler<number>(value => calls.push(value), callback => { queued.push(callback); return queued.length })
    schedule(1)
    schedule(2)
    schedule(3)
    expect(queued).toHaveLength(1)
    queued[0](0)
    expect(calls).toEqual([3])
  })
})
