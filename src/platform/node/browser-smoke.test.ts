import { describe, expect, it } from 'vitest'
import { isIgnorableBrowserConsoleError } from './browser-smoke'

describe('browser smoke console error classification', () => {
  it('ignores the known non-rendering Bilibili fingerprint report noise', () => {
    expect(isIgnorableBrowserConsoleError('@bilibili/bili-user-fingerprint(report): report is not found')).toBe(true)
  })

  it('keeps first-party and unknown console errors blocking', () => {
    expect(isIgnorableBrowserConsoleError('Failed to render slide')).toBe(false)
    expect(isIgnorableBrowserConsoleError('Uncaught TypeError: boom')).toBe(false)
  })
})
