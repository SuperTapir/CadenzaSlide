import { describe, expect, it, vi } from 'vitest'
import { AnimationLoop, type FrameScheduler } from './animation-loop'

function fakeScheduler() {
  let nextId = 1
  const callbacks = new Map<number, FrameRequestCallback>()
  const scheduler: FrameScheduler = {
    request: vi.fn((callback) => {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    }),
    cancel: vi.fn((id) => callbacks.delete(id)),
  }
  return { scheduler, callbacks }
}

describe('AnimationLoop', () => {
  it('重复 start 时只创建一个 frame chain', () => {
    const { scheduler, callbacks } = fakeScheduler()
    const render = vi.fn()
    const loop = new AnimationLoop(render, scheduler)

    loop.start()
    loop.start()
    expect(scheduler.request).toHaveBeenCalledTimes(1)

    const [id, callback] = [...callbacks.entries()][0]
    callbacks.delete(id)
    callback(16)
    expect(render).toHaveBeenCalledWith(16)
    expect(scheduler.request).toHaveBeenCalledTimes(2)
  })

  it('stop 和 dispose 幂等且停止后不再调度', () => {
    const { scheduler, callbacks } = fakeScheduler()
    const loop = new AnimationLoop(vi.fn(), scheduler)
    loop.start()
    loop.stop()
    loop.stop()
    loop.dispose()
    loop.dispose()

    expect(callbacks.size).toBe(0)
    expect(scheduler.cancel).toHaveBeenCalledTimes(1)
    expect(() => loop.start()).toThrow(/disposed/i)
  })
})
