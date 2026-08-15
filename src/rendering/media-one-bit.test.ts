import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { ditherRgba } from '../engine/one-bit/reference'
import { oneBitImageSelector, oneBitOptionsFromTokens } from './media-one-bit'

describe('token-driven one-bit slide media', () => {
  it('maps CSS paper and ink tokens into the image dither palette', () => {
    expect(oneBitOptionsFromTokens('#c6c5b6', '#25251f')).toMatchObject({
      paper: [198, 197, 182],
      ink: [37, 37, 31],
    })
  })

  it('quantizes continuous-tone pixels to only the two design-token colours', () => {
    const options = oneBitOptionsFromTokens('rgb(198, 197, 182)', 'rgb(37, 37, 31)')
    const input = new Uint8ClampedArray(Array.from({ length: 16 }, (_, index) => {
      const value = index * 17
      return [value, value, value, 255]
    }).flat())
    const output = ditherRgba(input, 4, 4, options)
    const colours = new Set(Array.from({ length: 16 }, (_, index) => [...output.slice(index * 4, index * 4 + 3)].join(',')))
    expect(colours).toEqual(new Set(['198,197,182', '37,37,31']))
  })

  it('covers master images, primitive images and atomic media with one shared selector', () => {
    expect(oneBitImageSelector).toContain('.component-image-area img')
    expect(oneBitImageSelector).toContain('.component-object-image img')
    expect(oneBitImageSelector).toContain('.cadenza-media img')
    expect(oneBitImageSelector).toContain('[data-media-treatment="one-bit"]')
    expect(oneBitImageSelector).not.toContain(':not(')
  })

  it('keeps slide media strictly grayscale or one-bit outside the original-source lightbox', () => {
    const styles = new URL('../styles/', import.meta.url)
    const css = readdirSync(styles).sort().map(file => readFileSync(new URL(file, styles), 'utf8')).join('\n')
    const tonalRules = [...css.matchAll(/[^{}]*data-media-treatment="tonal"[^{}]*\{([^}]*)\}/g)].map(match => match[1])

    expect(tonalRules.length).toBeGreaterThan(0)
    expect(tonalRules.every(rule => rule.includes('grayscale(1)') && !rule.includes('sepia'))).toBe(true)
    expect(css).not.toContain('data-media-treatment="original"')
    expect(css).toContain('data-media-lightbox-original')
  })
})
