import type { FloatState } from '../engine/environment-drawers'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../host/reveal-options'

export function floatTransform(state: FloatState) {
  const deltaX = roundMotionValue((state.x - .5) * SLIDE_WIDTH)
  const deltaY = roundMotionValue((state.y - .46) * SLIDE_HEIGHT)
  return `translate(-50%, -50%) translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${roundMotionValue(state.tilt)}deg)`
}

function roundMotionValue(value: number) {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}
