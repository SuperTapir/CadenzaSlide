import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('presentation color contracts', () => {
  it('never renders paper surfaces through transparency', () => {
    const css = readdirSync('src/styles').sort().map(file => readFileSync(`src/styles/${file}`, 'utf8')).join('\n')
    const translucentMixes = css.match(/color-mix\([^)]*var\(--paper(?:-bright)?\)[^)]*transparent[^)]*\)/g) ?? []
    const translucentPaperBackgrounds = (css.match(/[^{}]+\{[^{}]*\}/g) ?? []).filter(rule =>
      /background(?:-color|-image)?\s*:[^;]*var\(--paper(?:-bright)?\)/.test(rule)
      && /opacity\s*:\s*(?:0?\.\d+)/.test(rule),
    )
    expect({ translucentMixes, translucentPaperBackgrounds }).toEqual({
      translucentMixes: [],
      translucentPaperBackgrounds: [],
    })
  })
})
