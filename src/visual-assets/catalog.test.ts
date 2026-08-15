import { describe, expect, it } from 'vitest'
import {
  productionVisualAssets,
  qualifyVisualAssetCatalog,
  queryVisualAssets,
  rankVisualAssets,
  validateSvgGeometry,
  visualAssetCatalog,
  type VisualAssetDefinition,
} from './catalog'
import { generatedLucideIcons } from './generated-icons'

const fixture = (overrides: Partial<VisualAssetDefinition> = {}): VisualAssetDefinition => ({
  id: 'icon:fixture',
  kind: 'icon',
  status: 'production',
  label: 'Fixture',
  purposes: ['测试', 'fixture'],
  aliases: ['sample'],
  applicable: ['content-card'],
  forbidden: ['brand-logo'],
  geometry: { source: 'fixture.svg', viewBox: '0 0 256 256', aspectRatio: 1, complexity: 1 },
  treatments: ['outline', 'one-bit-pixel'],
  tokenRoles: ['ink', 'paper'],
  behaviors: ['none', 'focus'],
  states: ['default'],
  provenance: {
    origin: 'Lucide',
    sourceUrl: 'https://github.com/lucide-icons/lucide',
    version: '1.31.0',
    license: 'ISC',
  },
  poster: { state: 'default', timeMs: 0 },
  reducedMotion: 'poster',
  fidelity: { html: 'svg', pptx: 'svg' },
  ...overrides,
})

describe('visual asset catalog qualification', () => {
  it('rejects duplicate stable IDs and incomplete production provenance', () => {
    const issues = qualifyVisualAssetCatalog([
      fixture(),
      fixture({ provenance: { origin: '', sourceUrl: '', version: '', license: '' } }),
    ])
    expect(issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'visual.duplicate-id',
      'visual.provenance',
    ]))
  })

  it('keeps candidate assets out of production queries', () => {
    const assets = [
      fixture({ id: 'icon:production-search', label: 'Search', purposes: ['搜索'] }),
      fixture({ id: 'icon:candidate-search', status: 'candidate', label: 'Search candidate', purposes: ['搜索'] }),
    ]
    expect(queryVisualAssets(assets, { intent: '搜索', kind: 'icon' }).map(asset => asset.id)).toEqual([
      'icon:production-search',
    ])
  })

  it('returns semantic evidence and prefers a precise Lucide intent over a broad category match', () => {
    const matches = rankVisualAssets(productionVisualAssets, { intent: '增长趋势', kind: 'icon', behavior: 'none' })
    expect(matches[0]).toMatchObject({ asset: { id: 'icon:lucide-trending-up' }, matchedTerms: expect.arrayContaining(['增长', 'trending', 'up']) })
    expect(matches[0].score).toBeGreaterThan(matches[1].score)
  })

  it('can request a qualified motion behavior without mixing static icons into the result', () => {
    const matches = rankVisualAssets(productionVisualAssets, { intent: '搜索发现', kind: 'icon', behavior: 'enter' })
    expect(matches[0].asset.id).toBe('icon:line-md-search')
    expect(matches.every(match => match.asset.behaviors.includes('enter'))).toBe(true)
  })

  it('rejects executable or externally-referenced SVG geometry', () => {
    for (const svg of [
      '<svg><script>alert(1)</script></svg>',
      '<svg onload="alert(1)"></svg>',
      '<svg><foreignObject><div>unsafe</div></foreignObject></svg>',
      '<svg><image href="https://example.com/tracker.png"/></svg>',
      '<svg><use href="https://example.com/icons.svg#x"/></svg>',
    ]) expect(validateSvgGeometry(svg)).not.toEqual([])
    expect(validateSvgGeometry('<svg viewBox="0 0 256 256"><path d="M16 16h224v224H16z"/></svg>')).toEqual([])
  })

  it('ships at least 150 unique production icons without counting variants', () => {
    const icons = productionVisualAssets.filter(asset => asset.kind === 'icon')
    const staticIcons = icons.filter(asset => asset.family?.startsWith('lucide:'))
    const animatedIcons = icons.filter(asset => asset.family === 'line-md:animated')
    expect(new Set(icons.map(asset => asset.id)).size).toBeGreaterThanOrEqual(150)
    expect(staticIcons.length).toBeGreaterThanOrEqual(150)
    expect(staticIcons.every(asset => asset.id.startsWith('icon:lucide-') && asset.provenance.origin === 'Lucide')).toBe(true)
    expect(animatedIcons).toHaveLength(48)
    expect(icons.every(asset => asset.provenance.license && asset.provenance.version)).toBe(true)
  })

  it('does not expose legacy Cadenza originals in catalog or runtime geometry', () => {
    expect(visualAssetCatalog).toHaveLength(208)
    expect(visualAssetCatalog.every(asset => asset.id.startsWith('icon:lucide-') || asset.id.startsWith('icon:line-md-'))).toBe(true)
  })

  it('preserves the Lucide root stroke contract when adapting SVG geometry', () => {
    expect(generatedLucideIcons).toHaveLength(160)
    expect(generatedLucideIcons.every(icon => icon.body.startsWith(
      '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    ))).toBe(true)
  })
})
