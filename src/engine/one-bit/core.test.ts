import { describe, expect, it } from 'vitest'
import { computeRenderSize, projectNormalizedPoint } from './core'

describe('computeRenderSize', () => {
  it('按 CSS 尺寸和受限 DPR 计算桌面 buffer', () => {
    expect(computeRenderSize({
      cssWidth: 1280,
      cssHeight: 720,
      devicePixelRatio: 2,
      maxPixelRatio: 1.5,
      maxPixelCount: 1920 * 1080,
    })).toEqual({ width: 1920, height: 1080, scaleX: 1.5, scaleY: 1.5 })
  })

  it('窄屏不会继续固定使用 1280×720 buffer', () => {
    expect(computeRenderSize({
      cssWidth: 320,
      cssHeight: 180,
      devicePixelRatio: 3,
      maxPixelRatio: 1.5,
      maxPixelCount: 1920 * 1080,
    })).toEqual({ width: 480, height: 270, scaleX: 1.5, scaleY: 1.5 })
  })

  it('高 DPR 超出像素预算时等比缩小', () => {
    expect(computeRenderSize({
      cssWidth: 1920,
      cssHeight: 1080,
      devicePixelRatio: 2,
      maxPixelRatio: 2,
      maxPixelCount: 1920 * 1080,
    })).toEqual({ width: 1920, height: 1080, scaleX: 1, scaleY: 1 })
  })
})

describe('projectNormalizedPoint', () => {
  it.each([
    [320, 180],
    [1280, 720],
    [1920, 1080],
  ])('把 normalized stage 坐标投影到 %d×%d content box', (width, height) => {
    expect(projectNormalizedPoint({ x: 0.571875, y: 0.512778 }, width, height)).toEqual({
      x: 0.571875 * width,
      y: 0.512778 * height,
    })
  })
})
