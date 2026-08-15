import { describe, expect, it } from 'vitest'
import { localizeHref, resolveUiLocale, uiText } from './ui-locale'

describe('UI locale', () => {
  it('prefers an explicit supported lang query and normalizes aliases', () => {
    expect(resolveUiLocale(new URL('https://example.test/?lang=en'), 'zh-CN')).toBe('en')
    expect(resolveUiLocale(new URL('https://example.test/?lang=en-US'), 'zh-CN')).toBe('en')
    expect(resolveUiLocale(new URL('https://example.test/?lang=zh'), 'en-US')).toBe('zh-CN')
  })

  it('falls back to the browser language and preserves Chinese as the no-browser default', () => {
    expect(resolveUiLocale(new URL('https://example.test/'), 'en-GB')).toBe('en')
    expect(resolveUiLocale(new URL('https://example.test/'), 'zh-TW')).toBe('zh-CN')
    expect(resolveUiLocale(new URL('https://example.test/'))).toBe('zh-CN')
  })

  it('keeps the selected locale on internal UI links', () => {
    expect(localizeHref('?view=overview&deck=demo', 'en')).toBe('?view=overview&deck=demo&lang=en')
    expect(localizeHref('?view=overview&deck=demo', 'zh-CN')).toBe('?view=overview&deck=demo&lang=zh-CN')
  })

  it('provides typed English and Chinese UI copy', () => {
    expect(uiText('en').studio.endPresentation).toBe('End presentation')
    expect(uiText('zh-CN').studio.endPresentation).toBe('结束放映')
  })
})
