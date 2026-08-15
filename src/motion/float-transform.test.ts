import { describe, expect, it } from 'vitest'
import { floatTransform } from './float-transform'

describe('FLOAT semantic transform', () => {
  it('converts normalized motion into Reveal logical pixels without layout properties', () => {
    expect(floatTransform({ x: .5, y: .46, tilt: 0 })).toBe('translate(-50%, -50%) translate3d(0px, 0px, 0) rotate(0deg)')
    expect(floatTransform({ x: .5 + 62 / 1280, y: .46 + 25 / 720, tilt: 1.5 })).toBe('translate(-50%, -50%) translate3d(62px, 25px, 0) rotate(1.5deg)')
  })
})
