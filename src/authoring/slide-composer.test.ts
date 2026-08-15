import { describe, expect, it } from 'vitest'
import { composeSlideCandidates, collectProvidedContent, compositionFingerprint, deriveVisualIntent, describeCompositionRhythm, preflightCompositionCandidate, validateSlideContentSignals, type SlideContentSignals } from './slide-composer'
import { validateCompositionTree } from './component-library'

describe('slide composer content signal contract', () => {
  const signals: SlideContentSignals = {
    id: 'business-summary',
    claim: { id: 'claim-growth', text: '增长来自高价值客户' },
    evidence: [
      { id: 'evidence-retention', text: '净收入留存保持稳定', source: 'FY2026 finance' },
      { id: 'evidence-enterprise', text: '企业客户贡献提升' },
    ],
    metrics: [{ id: 'metric-arr', label: 'ARR', value: '¥8.2M', source: 'FY2026 finance' }],
    sequence: { id: 'sequence-delivery', items: ['验证需求', '交付组件', '复核页面'] },
    media: [{ id: 'media-product', src: '/assets/product.png', alt: 'Cadenza 编辑界面', caption: '组件组合工作流' }],
    relationships: [{ from: 'evidence-enterprise', to: 'claim-growth', label: 'supports' }],
  }

  it('accepts explicit claim, evidence, metric, order, media, source and relationship signals', () => {
    expect(validateSlideContentSignals(signals)).toEqual([])
  })

  it('returns only user-provided facts and never fills absent signals', () => {
    expect(collectProvidedContent({ id: 'claim-only', claim: { id: 'claim-one', text: '只提供一个主张' } })).toEqual({
      ids: ['claim-one'],
      texts: ['只提供一个主张'],
      sources: [],
    })
    const inventory = collectProvidedContent(signals)
    expect(inventory.texts).toEqual([
      '增长来自高价值客户', '净收入留存保持稳定', '企业客户贡献提升',
      'ARR', '¥8.2M', '验证需求', '交付组件', '复核页面', 'Cadenza 编辑界面', '组件组合工作流', 'supports',
    ])
    expect(inventory.sources).toEqual(['FY2026 finance'])
    expect(inventory.texts).not.toContain('增长率')
  })

  it('rejects empty input, unstable IDs, duplicate facts and invented relationship endpoints', () => {
    expect(validateSlideContentSignals({ id: 'empty-slide' })).toContainEqual({ path: '$', message: 'at least one content signal is required' })
    expect(validateSlideContentSignals({ id: 'Bad ID', claim: { id: 'claim', text: 'Claim' } })).toContainEqual({ path: 'id', message: 'slide signal ID must be stable kebab-case' })
    expect(validateSlideContentSignals({ ...signals, evidence: [{ id: 'claim-growth', text: 'Duplicate' }] })).toContainEqual({ path: 'evidence[0].id', message: 'content signal ID must be unique' })
    expect(validateSlideContentSignals({ ...signals, relationships: [{ from: 'missing-fact', to: 'claim-growth' }] })).toContainEqual({ path: 'relationships[0].from', message: 'relationship endpoint is not a provided content signal' })
  })

  it('requires accessible media and bounded sequence content', () => {
    expect(validateSlideContentSignals({ id: 'bad-media', media: [{ id: 'media-one', src: '/asset.png', alt: '' }] })).toContainEqual({ path: 'media[0].alt', message: 'media alternative text is required' })
    expect(validateSlideContentSignals({ id: 'bad-sequence', sequence: { id: 'sequence-one', items: [] } })).toContainEqual({ path: 'sequence.items', message: 'sequence requires 1–12 items' })
  })

  it('keeps quote, profile and logo as first-class signals instead of generic cards', () => {
    const editorial: SlideContentSignals = {
      id: 'editorial-identity',
      quotes: [{ id: 'quote-design', text: 'Design is how it works.', author: 'Steve Jobs', source: 'Interview' }],
      profiles: [{ id: 'profile-ada', name: 'Ada Lovelace', role: 'Research', bio: '把关系转译为系统。' }],
      logos: [{ id: 'logo-cadenza', name: 'Cadenza', src: '/logo.svg', alt: 'Cadenza logo' }],
    }
    expect(validateSlideContentSignals(editorial)).toEqual([])
    const result = composeSlideCandidates(editorial, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' })
    expect(result.candidates.length).toBeGreaterThan(1)
    expect(result.candidates.every(candidate => {
      const components = JSON.stringify(candidate.tree)
      return components.includes('"component":"quote"') && components.includes('"component":"profile"') && components.includes('"component":"logo"')
    })).toBe(true)
    expect(collectProvidedContent(editorial).texts).toEqual(['Design is how it works.', 'Steve Jobs', 'Ada Lovelace', 'Research', '把关系转译为系统。', 'Cadenza', 'Cadenza logo'])
  })
})

describe('slide composer candidate generation and hard filters', () => {
  const signals: SlideContentSignals = {
    id: 'growth-proof',
    claim: { id: 'claim-growth', text: '增长来自高价值客户', source: 'FY2026 review' },
    evidence: [{ id: 'evidence-retention', text: '留存保持稳定' }],
    metrics: [{ id: 'metric-arr', label: 'ARR', value: '¥8.2M', source: 'Finance' }],
    media: [{ id: 'media-product', src: '/product.png', alt: '产品界面', caption: '组合式工作流', source: 'Product' }],
    relationships: [{ from: 'evidence-retention', to: 'claim-growth', label: 'supports' }],
  }

  it('builds several coordinate-free primitive trees and keeps every provided fact', () => {
    const result = composeSlideCandidates(signals, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' })
    expect(result.inputIssues).toEqual([])
    expect(result.filterOrder).toEqual(['signals', 'slots', 'capacity', 'intrinsic', 'profile-budget', 'tokens', 'fidelity'])
    expect(result.candidates.length).toBeGreaterThanOrEqual(3)
    const inventory = collectProvidedContent(signals)
    for (const candidate of result.candidates) {
      expect(validateCompositionTree(candidate.tree)).toEqual([])
      const serialized = JSON.stringify(candidate.tree)
      expect([...inventory.texts, ...inventory.sources].every(fact => serialized.includes(fact))).toBe(true)
      expect(serialized).not.toMatch(/"(?:x|y|width|height|style|color|transform)"/)
      expect(candidate.usedSignalIds).toEqual(inventory.ids)
    }
    expect(new Set(result.candidates.map(candidate => candidate.tree.component)).size).toBeGreaterThan(1)
  })

  it('keeps a shared claim above wide split evidence so peer rows start on one baseline', () => {
    const dense: SlideContentSignals = {
      id: 'shared-claim-split',
      claim: { id: 'shared-claim', text: '发布门禁必须同时守住结构、渲染与证据' },
      evidence: Array.from({ length: 5 }, (_, index) => ({ id: `shared-evidence-${index + 1}`, text: `证据 ${index + 1}` })),
      metrics: [{ id: 'shared-metric-a', label: '规则', value: 24 }, { id: 'shared-metric-b', label: '通道', value: 5 }],
    }
    const candidate = composeSlideCandidates(dense, { profile: 'stage', frame: { width: 84, height: 68 }, format: 'html' }).candidates
      .find(item => item.id.endsWith('split-wide'))
    expect(candidate?.tree).toMatchObject({
      component: 'stack',
      children: [
        { nodeId: 'shared-claim', component: 'heading' },
        { component: 'split', slots: { primary: [expect.any(Object)], secondary: [expect.any(Object)] } },
      ],
    })
  })

  it('expands a singleton list inside a major split region instead of leaving its visual weight at the top', () => {
    const narrative: SlideContentSignals = {
      id: 'open-split-list',
      claim: { id: 'open-split-claim', text: '先建立共同理解，再推动行动' },
      sequence: { id: 'open-split-sequence', items: ['看见变化', '理解原因', '确认选择', '开始行动'] },
      quotes: [{ id: 'open-split-quote', text: '清晰来自顺序', author: '项目负责人' }],
    }
    const candidate = composeSlideCandidates(narrative, { profile: 'stage', frame: { width: 84, height: 68 }, format: 'html' }).candidates
      .find(item => item.id.endsWith('split-wide'))
    const split = candidate?.tree.children?.find(child => child.component === 'split')
    expect(split?.slots?.primary?.[0]).toMatchObject({ component: 'list', axes: { density: 'open' } })
  })

  it('returns no candidate JSON when input relationships are invalid', () => {
    const invalid = structuredClone(signals)
    invalid.relationships![0].from = 'invented-evidence'
    expect(composeSlideCandidates(invalid, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' })).toMatchObject({
      candidates: [],
      inputIssues: expect.arrayContaining([{ path: 'relationships[0].from', message: 'relationship endpoint is not a provided content signal' }]),
    })
  })

  it('hard-rejects every over-budget tree instead of rendering partial output', () => {
    const result = composeSlideCandidates(signals, { profile: 'thumbnail', frame: { width: 1, height: 1 }, format: 'html' })
    expect(result.candidates).toEqual([])
    expect(result.rejected.length).toBeGreaterThan(0)
    expect(result.rejected.every(candidate => candidate.stage === 'profile-budget' && candidate.tree === undefined)).toBe(true)
  })

  it('ranks deterministically with unique structural fingerprints and inspectable explanations', () => {
    const input = { profile: 'stage' as const, frame: { width: 84, height: 58 }, format: 'html' as const }
    const first = composeSlideCandidates(signals, input)
    expect(first).toEqual(composeSlideCandidates(signals, input))
    expect(first.candidates.map(candidate => candidate.score)).toEqual([...first.candidates.map(candidate => candidate.score)].sort((left, right) => right - left))
    expect(new Set(first.candidates.map(candidate => candidate.fingerprint)).size).toBe(first.candidates.length)
    expect(first.candidates.every(candidate => candidate.explanation.reasons.length > 0 && candidate.explanation.summary.includes(candidate.tree.component))).toBe(true)
  })

  it('fingerprints structure and controlled axes without leaking content or node IDs', () => {
    const left = { nodeId: 'left-heading', component: 'heading', version: 1 as const, props: { text: 'Alpha' }, axes: { emphasis: 'strong' } }
    const right = { nodeId: 'right-heading', component: 'heading', version: 1 as const, props: { text: 'Beta' }, axes: { emphasis: 'strong' } }
    expect(compositionFingerprint(left)).toBe(compositionFingerprint(right))
    expect(compositionFingerprint(left)).not.toMatch(/Alpha|Beta|left-heading|right-heading/)
    expect(compositionFingerprint({ ...right, axes: { emphasis: 'quiet' } })).not.toBe(compositionFingerprint(right))
  })

  it('uses seed only to vary the order of close legal structures', () => {
    const base = { profile: 'stage' as const, frame: { width: 84, height: 58 }, format: 'html' as const }
    const seedZero = composeSlideCandidates(signals, { ...base, seed: 0 })
    const seedOne = composeSlideCandidates(signals, { ...base, seed: 1 })
    expect(seedZero).toEqual(composeSlideCandidates(signals, { ...base, seed: 0 }))
    expect(seedZero.candidates[0].fingerprint).not.toBe(seedOne.candidates[0].fingerprint)
    expect(new Set(seedZero.candidates.map(candidate => candidate.fingerprint))).toEqual(new Set(seedOne.candidates.map(candidate => candidate.fingerprint)))
    expect(Math.abs(seedZero.candidates[0].score - seedOne.candidates[0].score)).toBeLessThanOrEqual(6)
    expect(seedZero.candidates.every(candidate => candidate.usedSignalIds.join('|') === seedOne.candidates[0].usedSignalIds.join('|'))).toBe(true)
  })

  it('penalizes an adjacent-page fingerprint only among semantically close candidates', () => {
    const base = { profile: 'stage' as const, frame: { width: 84, height: 58 }, format: 'html' as const }
    const first = composeSlideCandidates(signals, base)
    const next = composeSlideCandidates(signals, { ...base, avoidFingerprints: [first.candidates[0].fingerprint] })
    expect(next.candidates[0].fingerprint).not.toBe(first.candidates[0].fingerprint)
    expect(next.candidates.find(candidate => candidate.fingerprint === first.candidates[0].fingerprint)?.repetitionPenalty).toBeGreaterThan(0)
    expect(Math.abs(next.candidates[0].score - first.candidates[0].score)).toBeLessThanOrEqual(6)
  })

  it('describes and avoids repeated primary axis, density, and emphasis among close candidates', () => {
    const base = { profile: 'stage' as const, frame: { width: 84, height: 58 }, format: 'html' as const }
    const first = composeSlideCandidates(signals, base).candidates[0]
    expect(first.rhythm).toEqual(describeCompositionRhythm(first.tree))
    expect(first.rhythm).toMatchObject({ fingerprint: first.fingerprint, primaryAxis: expect.any(String), density: expect.any(String), emphasis: expect.any(String) })

    const next = composeSlideCandidates(signals, { ...base, adjacentRhythms: [first.rhythm] })
    expect(next.candidates[0].rhythm.primaryAxis).not.toBe(first.rhythm.primaryAxis)
    expect(next.candidates.some(candidate => candidate.repetitionPenalty > 0 && candidate.explanation.reasons.some(reason => reason.includes('rhythm repetition')))).toBe(true)
    expect(Math.abs(next.candidates[0].score - first.score)).toBeLessThanOrEqual(6)
  })

  it('rejects a legally shaped but visibly empty major-canvas composition before rendering', () => {
    const claimOnly: SlideContentSignals = { id: 'single-claim', claim: { id: 'only-claim', text: '唯一主张' } }
    const base = { profile: 'stage' as const, frame: { width: 84, height: 58 }, format: 'html' as const }
    const result = composeSlideCandidates(claimOnly, base)
    expect(result.candidates).toEqual([])
    expect(result.rejected).toContainEqual(expect.objectContaining({ id: 'single-claim-stack', stage: 'capacity' }))
    expect(result.recommendation).toMatchObject({ action: 'simplify', preserveSignalIds: ['only-claim'] })
    expect(result.recommendation?.reason).toContain('statement/section master')
  })

  it('exposes a semantic fill estimate on every accepted candidate', () => {
    const result = composeSlideCandidates(signals, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' })
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.candidates.every(candidate => candidate.coverage.fillRatio >= 0.35 && candidate.coverage.visualUnits > 0)).toBe(true)
  })

  it('marks open-density candidates so the renderer expands real surfaces instead of empty containers', () => {
    const result = composeSlideCandidates(signals, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' })
    const openCandidates = result.candidates.filter(candidate => candidate.id.includes('stack-open') || candidate.id.includes('grid-'))
    expect(openCandidates.length).toBeGreaterThan(0)
    expect(openCandidates.every(candidate => candidate.tree.axes?.density === 'open')).toBe(true)
  })

  it('top-aligns generated split slots so unequal content does not shift comparison baselines', () => {
    const result = composeSlideCandidates(signals, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' })
    const splits = result.candidates.flatMap(candidate => candidate.tree.component === 'split'
      ? [candidate.tree]
      : candidate.tree.children?.filter(child => child.component === 'split') ?? [])
    expect(splits.length).toBeGreaterThan(0)
    expect(splits.every(split => split.axes?.alignment === 'start')).toBe(true)
    expect(splits.every(split => split.slots?.secondary?.[0].component !== 'stack' || split.slots.secondary[0].axes?.density === 'open')).toBe(true)
  })

  it('returns structured split guidance without an unvalidated tree when content exceeds capacity', () => {
    const crowded: SlideContentSignals = {
      id: 'crowded-evidence',
      claim: { id: 'crowded-claim', text: '证据需要拆页' },
      evidence: Array.from({ length: 13 }, (_, index) => ({ id: `crowded-evidence-${index}`, text: `Evidence ${index}` })),
    }
    const result = composeSlideCandidates(crowded, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' })
    expect(result.candidates).toEqual([])
    expect(result.recommendation).toMatchObject({ action: 'split', preserveSignalIds: collectProvidedContent(crowded).ids })
    expect(result.recommendation?.groups.every(group => group.signalIds.length <= 6)).toBe(true)
    expect(result.recommendation).not.toHaveProperty('tree')
  })

  it('returns repair or simplify guidance for invalid signals and impossible frames', () => {
    expect(composeSlideCandidates({ id: 'empty' }, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' }).recommendation).toMatchObject({ action: 'repair-signals' })
    expect(composeSlideCandidates(signals, { profile: 'thumbnail', frame: { width: 1, height: 1 }, format: 'html' }).recommendation).toMatchObject({ action: 'simplify', preserveSignalIds: collectProvidedContent(signals).ids })
  })

  it('derives a supporting visual intent for abstract content and ranks a semantic Lucide visual candidate', () => {
    const abstract: SlideContentSignals = {
      id: 'ai-workflow',
      claim: { id: 'ai-claim', text: 'AI 自动化流程把输入转化为可验证输出' },
      sequence: { id: 'ai-sequence', items: ['理解输入', '编排步骤', '验证结果'] },
    }
    expect(deriveVisualIntent(abstract)).toMatchObject({ shouldUseVisual: true, hasStrongMedia: false, prominence: 'support', behavior: 'none' })
    const result = composeSlideCandidates(abstract, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' })
    expect(result.candidates[0].visual).toMatchObject({ assetId: expect.stringMatching(/^icon:lucide-/), family: expect.stringMatching(/^lucide:/), prominence: 'support', behavior: 'none' })
    expect(result.candidates[0].explanation.reasons).toContain('semantic visual supports abstract content without competing media')
  })

  it('does not add a decorative icon when the slide already has strong media', () => {
    const result = composeSlideCandidates(signals, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' })
    expect(deriveVisualIntent(signals)).toMatchObject({ shouldUseVisual: false, hasStrongMedia: true })
    expect(result.candidates.every(candidate => candidate.visual === undefined && !JSON.stringify(candidate.tree).includes('"component":"visual"'))).toBe(true)
  })

  it('uses Line MD only when motion is explicitly allowed and avoids the previous asset across slides', () => {
    const search: SlideContentSignals = {
      id: 'search-flow',
      claim: { id: 'search-claim', text: '搜索发现关键证据' },
      evidence: [{ id: 'search-evidence', text: '从资料中定位匹配内容' }],
    }
    const first = composeSlideCandidates(search, {
      profile: 'stage', frame: { width: 84, height: 58 }, format: 'html',
      visualPolicy: { mode: 'auto', allowMotion: true, preferredBehavior: 'enter' },
    }).candidates[0]
    expect(first.visual).toMatchObject({ assetId: 'icon:line-md-search', behavior: 'enter' })
    const next = composeSlideCandidates(search, {
      profile: 'stage', frame: { width: 84, height: 58 }, format: 'html',
      visualPolicy: { mode: 'auto', allowMotion: true, preferredBehavior: 'enter', history: [first.visual!] },
    }).candidates[0]
    expect(next.visual?.assetId).not.toBe(first.visual?.assetId)
  })

  it('preflights visual registry/axis contracts and blocks focus competition with strong media', () => {
    const mediaSignals: SlideContentSignals = {
      id: 'visual-preflight',
      claim: { id: 'visual-claim', text: '真实截图已经承担主视觉' },
      media: [{ id: 'visual-media', src: '/product.png', alt: '产品界面' }],
    }
    const tree = {
      nodeId: 'visual-preflight-stack', component: 'stack', version: 1 as const, children: [
        { nodeId: 'visual-claim', component: 'heading', version: 1 as const, props: { text: '真实截图已经承担主视觉' } },
        { nodeId: 'visual-media', component: 'media', version: 1 as const, props: { src: '/product.png', alt: '产品界面' } },
        { nodeId: 'bad-visual', component: 'visual', version: 1 as const, props: { asset: 'icon:unknown', alt: 'Unknown' }, axes: { role: 'icon', prominence: 'hero', treatment: 'outline', state: 'default', behavior: 'loop' } },
      ],
    }
    const preflight = preflightCompositionCandidate(mediaSignals, tree, { profile: 'stage', frame: { width: 84, height: 58 }, format: 'html' })
    expect(preflight.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'visual.asset-contract' }),
      expect.objectContaining({ ruleId: 'visual.focus' }),
    ]))
  })

  it('rejects a display quote squeezed into the narrow third of a horizontal split', () => {
    const narrowQuote: SlideContentSignals = {
      id: 'narrow-quote',
      claim: { id: 'narrow-claim', text: '项目仍在继续' },
      quotes: [{ id: 'narrow-source', text: '继续向着愚昧山峰进发吧，也不用太担心跌下来。' }],
    }
    const tree = {
      nodeId: 'narrow-root', component: 'split', version: 1 as const,
      axes: { direction: 'horizontal', ratio: '1:2', order: 'primary-first' },
      slots: {
        primary: [{ nodeId: 'narrow-stack', component: 'stack', version: 1 as const, children: [
          { nodeId: 'narrow-visual', component: 'visual', version: 1 as const, props: { asset: 'icon:lucide-git-merge', alt: '项目汇合' }, axes: { role: 'icon', prominence: 'support', treatment: 'one-bit-pixel', state: 'default', behavior: 'none' } },
          { nodeId: 'narrow-source', component: 'quote', version: 1 as const, props: { text: '继续向着愚昧山峰进发吧，也不用太担心跌下来。' } },
        ] }],
        secondary: [{ nodeId: 'narrow-claim', component: 'heading', version: 1 as const, props: { text: '项目仍在继续' } }],
      },
    }
    const preflight = preflightCompositionCandidate(narrowQuote, tree, { profile: 'stage', frame: { width: 88, height: 86 }, format: 'html' })
    expect(preflight.findings).toContainEqual(expect.objectContaining({
      ruleId: 'composition.intrinsic.profile-budget',
      message: expect.stringContaining('Quote'),
    }))
  })
})
