import { describe, expect, it } from 'vitest'
import { bayerMask } from './slide-transition'

describe('full slide transition', () => {
  it('removes the outgoing page cell by cell with a Bayer mask', () => {
    expect([...bayerMask(0)]).toEqual(new Array(16).fill(255))

    const halfway = [...bayerMask(.5)]
    expect(halfway.filter(alpha => alpha === 0)).toHaveLength(8)
    expect(halfway.filter(alpha => alpha === 255)).toHaveLength(8)

    expect([...bayerMask(1)]).toEqual(new Array(16).fill(0))
  })
})
