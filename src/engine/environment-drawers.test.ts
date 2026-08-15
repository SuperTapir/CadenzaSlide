import { describe, expect, it } from 'vitest'
import { environmentPresetIds } from './environment-presets'
import { environmentDrawers } from './environment-drawers'

function recordingContext() {
  const fills: string[] = []
  const points: Array<[number, number]> = []
  const arcs: Array<[number, number, number]> = []
  const gradients: Array<{ x0: number, y0: number, x1: number, y1: number, stops: Array<[number, string]> }> = []
  const radialGradients: Array<{ x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, stops: Array<[number, string]> }> = []
  const context = {
    fillStyle: '',
    fillRect(this: CanvasRenderingContext2D) { fills.push(String(this.fillStyle)) },
    beginPath() {},
    moveTo(x: number, y: number) { points.push([x, y]) },
    lineTo(x: number, y: number) { points.push([x, y]) },
    closePath() {},
    fill() {},
    stroke() {},
    arc(x: number, y: number, radius: number) { arcs.push([x, y, radius]) },
    createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
      const gradient = { x0, y0, x1, y1, stops: [] as Array<[number, string]> }
      gradients.push(gradient)
      return { addColorStop(offset: number, colour: string) { gradient.stops.push([offset, colour]) } }
    },
    createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
      const gradient = { x0, y0, r0, x1, y1, r1, stops: [] as Array<[number, string]> }
      radialGradients.push(gradient)
      return { addColorStop(offset: number, colour: string) { gradient.stops.push([offset, colour]) } }
    },
  } as unknown as CanvasRenderingContext2D
  return { context, fills, points, arcs, gradients, radialGradients }
}

function draw(scene: 'field' | 'grid' | 'halo' | 'fold' | 'strata' | 'target', time: number, mode: 'static' | 'loop' = 'loop') {
  const recording = recordingContext()
  environmentDrawers[scene]({ ...recording, width: 1280, height: 720, time, mode })
  return recording
}

describe('environment drawers', () => {
  it('implements every registered environment without orphan drawers', () => {
    expect(Object.keys(environmentDrawers)).toEqual(environmentPresetIds)
  })

  it('GRID 扫光在相邻帧持续移动，而不是长时间停住后跳变', () => {
    const centers = Array.from({ length: 61 }, (_, frame) => draw('grid', frame * 1000 / 60).gradients)
      .filter((gradients) => gradients.length >= 2)
      .map((gradients) => (gradients[1].x0 + gradients[1].x1) / 2)
    expect(centers).toHaveLength(61)
    expect(new Set(centers).size).toBeGreaterThan(30)
  })

  it('GRID 在 6 秒内完成一次连续扫光，任意时刻都没有空档', () => {
    const centersAt = (time: number) => draw('grid', time).gradients.map((gradient) => (gradient.x0 + gradient.x1) / 2)
    expect(centersAt(3000)[1] - centersAt(0)[1]).toBeGreaterThan(600)
    for (let time = 0; time < 6000; time += 500) {
      expect(centersAt(time).some((center) => center >= 0 && center <= 1280)).toBe(true)
    }
  })

  it('GRID 的 Loop 接缝由相邻光带平铺衔接', () => {
    const visibleCenters = (time: number) => draw('grid', time).gradients
      .map((gradient) => (gradient.x0 + gradient.x1) / 2)
      .filter((center) => center >= -1 && center <= 1281)
    const before = visibleCenters(5999)
    const after = visibleCenters(1)
    expect(before).toHaveLength(2)
    expect(after).toHaveLength(2)
    expect(after.map((center, index) => Math.abs(center - before[index]))).toEqual([expect.any(Number), expect.any(Number)])
    expect(Math.max(...after.map((center, index) => Math.abs(center - before[index])))).toBeLessThan(1)
  })

  it('STRATA 的轻动幅度足以跨越 1-bit 点阵量化', () => {
    const start = draw('strata', 0).points[0][1]
    const quarterCycle = draw('strata', 3000).points[0][1]
    expect(Math.abs(quarterCycle - start)).toBeGreaterThan(10)
  })

  it('FOLD 的铰链运动不会被 1-bit 点阵吞掉', () => {
    const start = draw('fold', 0).points[1][0]
    const quarterCycle = draw('fold', 3000).points[1][0]
    expect(Math.abs(quarterCycle - start)).toBeGreaterThan(20)
  })

  it('TARGET 沿可辨识轨迹移动，而不是在原地抖动', () => {
    const [startX, startY] = draw('target', 0).arcs[0]
    const [quarterX, quarterY] = draw('target', 3000).arcs[0]
    expect(Math.hypot(quarterX - startX, quarterY - startY)).toBeGreaterThan(20)
  })

  it('FIELD 的焦点位移足以跨越 1-bit 点阵量化', () => {
    const start = draw('field', 0).radialGradients[0]
    const quarterCycle = draw('field', 2000).radialGradients[0]
    expect(Math.abs(quarterCycle.x1 - start.x1)).toBeGreaterThan(35)
  })

  it('HALO 的呼吸幅度足以跨越 1-bit 点阵量化', () => {
    const start = draw('halo', 0).radialGradients[0]
    const quarterCycle = draw('halo', 2000).radialGradients[0]
    expect(Math.abs(quarterCycle.r1 - start.r1)).toBeGreaterThan(20)
  })

  it.each(['grid', 'fold', 'strata', 'target'] as const)('%s 静止模式不随时间漂移', (scene) => {
    const start = draw(scene, 0, 'static')
    const later = draw(scene, 3000, 'static')
    expect({ fills: later.fills, points: later.points, arcs: later.arcs, gradients: later.gradients }).toEqual({ fills: start.fills, points: start.points, arcs: start.arcs, gradients: start.gradients })
  })
})
