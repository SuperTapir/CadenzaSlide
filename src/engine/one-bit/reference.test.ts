import { describe, expect, it } from 'vitest'
import { DEFAULT_ONE_BIT_OPTIONS, ditherRgba } from './reference'

function solidRgba(width: number, height: number, value: number) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  return data
}

describe('ditherRgba', () => {
  it('相同输入和配置产生逐字节相同的输出', () => {
    const input = solidRgba(8, 8, 128)
    const first = ditherRgba(input, 8, 8, DEFAULT_ONE_BIT_OPTIONS)
    const second = ditherRgba(input, 8, 8, DEFAULT_ONE_BIT_OPTIONS)
    expect(second).toEqual(first)
  })

  it('输出只包含不透明 paper 和 ink', () => {
    const output = ditherRgba(solidRgba(8, 8, 128), 8, 8, DEFAULT_ONE_BIT_OPTIONS)
    const colors = new Set<string>()
    for (let i = 0; i < output.length; i += 4) {
      colors.add(`${output[i]},${output[i + 1]},${output[i + 2]},${output[i + 3]}`)
    }
    expect(colors).toEqual(new Set(['185,185,173,255', '48,47,40,255']))
  })

  it('grid scale 2 会把每个 Bayer threshold 扩展为 2×2 cell', () => {
    const output = ditherRgba(solidRgba(8, 8, 128), 8, 8, {
      ...DEFAULT_ONE_BIT_OPTIONS,
      gridScale: 2,
    })
    for (let cellY = 0; cellY < 4; cellY += 1) {
      for (let cellX = 0; cellX < 4; cellX += 1) {
        const first = (cellY * 2 * 8 + cellX * 2) * 4
        for (let y = 0; y < 2; y += 1) {
          for (let x = 0; x < 2; x += 1) {
            expect(output[((cellY * 2 + y) * 8 + cellX * 2 + x) * 4]).toBe(output[first])
          }
        }
      }
    }
  })

  it('允许复用调用方提供的输出 buffer', () => {
    const target = new Uint8ClampedArray(4 * 4 * 4)
    expect(ditherRgba(solidRgba(4, 4, 128), 4, 4, DEFAULT_ONE_BIT_OPTIONS, target)).toBe(target)
  })
})
