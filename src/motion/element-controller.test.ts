import { describe, expect, it, vi } from 'vitest'
import { ElementMotionController, parseCountValue } from './element-controller'

describe('element motion count controller', () => {
  it('parses prefixes, decimals, padded integers and suffixes', () => {
    expect(parseCountValue('02')).toEqual({ prefix: '', value: 2, suffix: '', precision: 0, pad: 2 })
    expect(parseCountValue('99.5%')).toEqual({ prefix: '', value: 99.5, suffix: '%', precision: 1, pad: 0 })
    expect(parseCountValue('¥1,280')).toEqual({ prefix: '¥', value: 1280, suffix: '', precision: 0, pad: 0 })
    expect(parseCountValue('many')).toBeNull()
  })

  it('animates on fragmentshown and resets on fragmenthidden', () => {
    const listeners = new Map<string, (event: { fragment?: HTMLElement }) => void>()
    let now = 0
    let frame: FrameRequestCallback | undefined
    const deck = {
      on: vi.fn((event: string, listener: (event: { fragment?: HTMLElement }) => void) => listeners.set(event, listener)),
      off: vi.fn(),
    }
    const fragment = { dataset: { countValue: '12' }, textContent: '12' } as unknown as HTMLElement
    const controller = new ElementMotionController(deck, false, {
      now: () => now,
      request: (callback) => { frame = callback; return 1 },
      cancel: vi.fn(),
    })

    controller.start()
    listeners.get('fragmenthidden')?.({ fragment })
    expect(fragment.textContent).toBe('0')
    listeners.get('fragmentshown')?.({ fragment })
    now = 280
    frame?.(now)
    expect(fragment.textContent).toBe('12')
    controller.dispose()
    expect(deck.off).toHaveBeenCalledTimes(2)
  })

  it('jumps to the final value when reduced motion is enabled', () => {
    const listeners = new Map<string, (event: { fragment?: HTMLElement }) => void>()
    const fragment = { dataset: { countValue: '64%' }, textContent: '0%' } as unknown as HTMLElement
    const controller = new ElementMotionController({
      on: (event, listener) => listeners.set(event, listener),
      off: vi.fn(),
    }, true)

    controller.start()
    listeners.get('fragmentshown')?.({ fragment })
    expect(fragment.textContent).toBe('64%')
  })
})
