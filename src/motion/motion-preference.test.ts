import { describe, expect, it, vi } from 'vitest'
import { MotionPreference, type MotionMediaQuery } from './motion-preference'

function fakeQuery(initial: boolean) {
  let listener: ((event: { matches: boolean }) => void) | undefined
  const query: MotionMediaQuery = {
    matches: initial,
    addEventListener: vi.fn((_event, next) => { listener = next }),
    removeEventListener: vi.fn((_event, next) => { if (listener === next) listener = undefined }),
  }
  return { query, emit: (matches: boolean) => listener?.({ matches }) }
}

describe('MotionPreference', () => {
  it('tracks live reduced-motion changes and disposes the listener', () => {
    const { query, emit } = fakeQuery(false)
    const preference = new MotionPreference(query)
    const listener = vi.fn()
    const unsubscribe = preference.subscribe(listener)

    expect(preference.reduced).toBe(false)
    emit(true)
    expect(preference.reduced).toBe(true)
    expect(listener).toHaveBeenCalledWith(true)

    unsubscribe()
    preference.dispose()
    emit(false)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(query.removeEventListener).toHaveBeenCalledOnce()
  })
})
