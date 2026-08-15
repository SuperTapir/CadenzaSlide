import { describe, expect, it } from 'vitest'
import { generatedLineMdIcons } from './generated-line-md-icons'

describe('generated Line MD animation library', () => {
  it('ships a deliberately small production allowlist with safe inline geometry', () => {
    expect(generatedLineMdIcons).toHaveLength(48)
    expect(generatedLineMdIcons.every(icon => icon.animated)).toBe(true)
    expect(generatedLineMdIcons.filter(icon => icon.qualityTier === 'hero')).toHaveLength(12)
    expect(generatedLineMdIcons.filter(icon => icon.mode === 'loop').length).toBeGreaterThanOrEqual(10)
    for (const icon of generatedLineMdIcons) {
      expect(icon.name).not.toMatch(/(?:filled|twotone|off|transition)/)
      expect(icon.body).not.toMatch(/<script|<foreignObject|\son[a-z]+=/i)
      expect(icon.body).not.toContain('/ calcMode=')
      expect(icon.body).not.toContain('data-visual-motion-accent')
    }
  })

  it('marks the exact hero-qualified high-frequency set', () => {
    expect(generatedLineMdIcons.filter(icon => icon.qualityTier === 'hero').map(icon => icon.name).sort()).toEqual([
      'account-add', 'bell-loop', 'check-list-3', 'cog-loop', 'confirm-circle', 'download-loop',
      'edit', 'image', 'phone-call-loop', 'search', 'speed-loop', 'star-pulsating-loop',
    ])
  })

  it('normalizes interpolated SMIL segments to Material motion curves', () => {
    for (const icon of generatedLineMdIcons.filter(icon => icon.animated)) {
      const animations = [...icon.body.matchAll(/<(?:animate|animateTransform)\b([^>]*)>/g)]
      for (const [, attributes] of animations) {
        if (!/\bdur=/.test(attributes)) continue
        if (attributes.includes('calcMode="linear"')) {
          expect(attributes, icon.name).toContain('repeatCount="indefinite"')
        } else {
          expect(attributes, icon.name).toContain('calcMode="spline"')
          expect(attributes, icon.name).toMatch(/keySplines="(?:0\.2 0 0 1|0\.05 0\.7 0\.1 1)/)
        }
      }
    }
    const cog = generatedLineMdIcons.find(icon => icon.name === 'cog-loop')!
    expect(cog.body).toContain('dur="30s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12" calcMode="linear"')
  })

  it('namespaces masks and definitions so many inline icons cannot collide', () => {
    const ids = generatedLineMdIcons.flatMap(icon => [...icon.body.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]))
    expect(new Set(ids).size).toBe(ids.length)
    for (const icon of generatedLineMdIcons) {
      const localIds = new Set([...icon.body.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]))
      for (const [, reference] of icon.body.matchAll(/url\(#([^)]+)\)/g)) expect(localIds.has(reference), `${icon.name}: ${reference}`).toBe(true)
    }
  })

  it('keeps the bell semantic loop restrained and resting between rings', () => {
    const bell = generatedLineMdIcons.find(icon => icon.name === 'bell-loop')!
    expect(bell.mode).toBe('loop')
    expect(bell.body).toContain('dur="6s"')
    expect(bell.body).toContain('keyTimes="0;0.05;0.15;0.2;1"')
    expect(bell.body).toContain('values="0 12 3;3 12 3;-3 12 3;0 12 3;0 12 3"')
    expect(bell.body).toContain('keySplines="0.2 0 0 1;0.2 0 0 1;0.2 0 0 1;0.2 0 0 1"')
  })
})
