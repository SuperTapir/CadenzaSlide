import { describe, expect, it } from 'vitest'
import { defaultFontThemeId, fontThemeIds, fontThemes, isFontThemeId } from './themes'

describe('Cadenza typography themes', () => {
  it('ships three ordered bilingual themes with Industrial as the default', () => {
    expect(fontThemeIds).toEqual(['industrial', 'technical', 'editorial'])
    expect(defaultFontThemeId).toBe('industrial')
  })

  it.each(fontThemeIds)('%s defines display, body and mono roles for Latin and CJK', (id) => {
    const theme = fontThemes[id]
    expect(theme.label.length).toBeGreaterThan(0)
    expect(theme.description.length).toBeGreaterThan(0)
    expect(theme.sample).toMatch(/[A-Za-z]/)
    expect(theme.sample).toMatch(/[\u3400-\u9fff]/)
    expect(Object.keys(theme.roles)).toEqual(['display', 'body', 'mono'])
    for (const role of Object.values(theme.roles)) {
      expect(role.latin.length).toBeGreaterThan(0)
      expect(role.cjk.length).toBeGreaterThan(0)
    }
  })

  it('rejects unknown persisted theme ids', () => {
    expect(isFontThemeId('technical')).toBe(true)
    expect(isFontThemeId('comic-sans')).toBe(false)
    expect(isFontThemeId(undefined)).toBe(false)
  })
})
