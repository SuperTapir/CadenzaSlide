import { describe, expect, it } from 'vitest'
import {
  productionComponentDefinitions,
  productionComponentManifest,
  productionComponentQualificationFixtures,
  queryProductionComponents,
  registerProductionComponents,
  resolveCadenzaAxisToken,
  validateCompositionFixtures,
  validateCompositionTree,
  validateEvaluationCase,
  validateEvaluationResult,
  validateComponentQualification,
  type CompositionEvaluationCase,
  type CompositionEvaluationResult,
  type CompositionFixture,
  type ComponentQualificationFixtures,
  type CompositionNode,
} from './component-library'
import { assessCompositionFidelity, compositionBudgetProfiles, diagnoseComposition, estimateComposition, prepareCompositionExport, resolveComposition } from './component-diagnosis'
import { renderComposition } from '../rendering/component-renderer'

describe('Cadenza production component registry', () => {
  it('publishes three categories from one serializable read-only source', () => {
    expect(productionComponentDefinitions).toHaveLength(21)
    expect(productionComponentDefinitions.reduce<Record<string, typeof productionComponentDefinitions[number][]>>((groups, definition) => {
      ;(groups[definition.category] ??= []).push(definition)
      return groups
    }, {})).toMatchObject({
      layout: expect.arrayContaining([expect.objectContaining({ id: 'stack' }), expect.objectContaining({ id: 'split' })]),
      content: expect.arrayContaining([expect.objectContaining({ id: 'heading' }), expect.objectContaining({ id: 'metric' }), expect.objectContaining({ id: 'visual' }), expect.objectContaining({ id: 'code' })]),
      relationship: expect.arrayContaining([expect.objectContaining({ id: 'connector' })]),
    })
    expect(Object.isFrozen(productionComponentDefinitions)).toBe(true)
    expect(Object.isFrozen(productionComponentManifest)).toBe(true)
    expect(() => JSON.stringify(productionComponentManifest)).not.toThrow()
    expect(JSON.stringify(productionComponentManifest)).not.toMatch(/renderer|metric\.hero|process\.swimlane/)
  })

  it('rejects duplicate definitions at the shared registration boundary', () => {
    expect(() => registerProductionComponents([productionComponentDefinitions[0], productionComponentDefinitions[0]])).toThrow(/conflict.*stack@1/i)
  })

  it('rejects a component without qualification fixtures at registration time', () => {
    expect(() => registerProductionComponents([productionComponentDefinitions[0]])).toThrow(/qualification missing.*stack@1/i)
  })

  it('queries by intent, category and legal parent slot without producing geometry', () => {
    expect(queryProductionComponents({ intent: '左右主次分栏', category: 'layout' }).matches[0]).toMatchObject({ id: 'split', category: 'layout' })
    expect(queryProductionComponents({ intent: '关键指标', category: 'content' }).matches[0]).toMatchObject({ id: 'metric', category: 'content' })
    expect(queryProductionComponents({ parent: 'split', slot: 'primary' }).matches.every(definition => definition.category !== 'relationship')).toBe(true)
    expect(queryProductionComponents({ parent: 'split', slot: 'missing' })).toMatchObject({ matches: [], diagnosis: expect.stringContaining('unknown slot') })
    expect(queryProductionComponents({ intent: '完整 dashboard 模板' })).toMatchObject({ matches: [], diagnosis: expect.stringContaining('no matching') })
  })

  it('renders code and media treatments as native composable evidence', () => {
    const tree: CompositionNode = {
      nodeId: 'evidence-split', component: 'split', version: 1, slots: {
        primary: [{ nodeId: 'cli-code', component: 'code', version: 1, props: { language: 'bash', code: '$ project verify --browser', highlightLines: '1', caption: '运行浏览器验收；输出用于判断真实画布是否通过。' } }],
        secondary: [{ nodeId: 'ui-proof', component: 'media', version: 1, props: { src: '/ui.png', alt: '验证界面' }, axes: { kind: 'screenshot', treatment: 'tonal', span: 'contain' } }],
      },
    }
    expect(validateCompositionTree(tree)).toEqual([])
    const html = renderComposition(tree)
    expect(html).toContain('class="cadenza-component cadenza-code"')
    expect(html).toContain('<figcaption>运行浏览器验收；输出用于判断真实画布是否通过。</figcaption>')
    expect(html).toContain('data-media-kind="screenshot"')
    expect(html).toContain('data-media-treatment="tonal"')
  })
})

describe('Cadenza composition tree boundary', () => {
  const validTree: CompositionNode = {
    nodeId: 'root-split',
    component: 'split',
    version: 1,
    axes: { ratio: '2:1', direction: 'horizontal' },
    slots: {
      primary: [{
        nodeId: 'claim-stack', component: 'stack', version: 1,
        children: [
          { nodeId: 'claim-heading', component: 'heading', version: 1, props: { text: '增长来自高价值客户' } },
          { nodeId: 'claim-copy', component: 'copy', version: 1, props: { text: '三项证据共同支持该判断。' } },
        ],
      }],
      secondary: [{ nodeId: 'claim-metric', component: 'metric', version: 1, props: { label: 'ARR', value: '¥8.2M' } }],
    },
  }

  it('accepts a finite registered tree with stable IDs and named slots', () => {
    expect(validateCompositionTree(validTree)).toEqual([])
  })

  it('rejects duplicate IDs, arbitrary style and illegal children before rendering', () => {
    const tree = structuredClone(validTree)
    tree.slots!.secondary![0].nodeId = 'claim-heading'
    tree.slots!.secondary![0].props = { label: 'ARR', value: '¥8.2M', style: 'color:red' }
    tree.slots!.secondary![0].children = [{ nodeId: 'illegal-child', component: 'copy', version: 1, props: { text: 'No' } }]
    expect(validateCompositionTree(tree)).toEqual(expect.arrayContaining([
      { path: 'slots.secondary[0].nodeId', message: 'node ID must be unique' },
      { path: 'slots.secondary[0].props.style', message: 'visual or executable fields are not allowed' },
      { path: 'slots.secondary[0].children', message: 'metric does not accept children' },
    ]))
  })

  it('rejects unknown components, invalid slots and unbounded trees', () => {
    const unknown = structuredClone(validTree)
    unknown.slots!.tertiary = [{ nodeId: 'unknown-node', component: 'dashboard-template', version: 1 }]
    expect(validateCompositionTree(unknown)).toEqual(expect.arrayContaining([
      { path: 'slots.tertiary', message: 'split does not accept this slot' },
      { path: 'slots.tertiary[0].component', message: 'component is not registered' },
    ]))

    let deep: CompositionNode = { nodeId: 'depth-6', component: 'heading', version: 1, props: { text: 'Deep' } }
    for (let index = 5; index >= 0; index--) deep = { nodeId: `depth-${index}`, component: 'stack', version: 1, children: [deep] }
    expect(validateCompositionTree(deep)).toContainEqual({ path: 'children[0].children[0].children[0].children[0].children[0]', message: 'composition depth exceeds 5' })

    const wide: CompositionNode = { nodeId: 'wide-root', component: 'grid', version: 1, children: Array.from({ length: 32 }, (_, index) => ({ nodeId: `wide-${index}`, component: 'card', version: 1, props: { title: `Card ${index}` } })) }
    expect(validateCompositionTree(wide)).toContainEqual({ path: '$', message: 'composition node count exceeds 32' })
  })

  it('derives props, slots and child category/cardinality checks from definitions', () => {
    const invalid: CompositionNode & { frame?: unknown } = {
      nodeId: 'invalid-root', component: 'split', version: 1, frame: { x: 1 },
      slots: {
        primary: [
          { nodeId: 'invalid-relation', component: 'connector', version: 1, props: { from: 'a', to: 'b', arbitrary: true } },
          { nodeId: 'extra-primary', component: 'heading', version: 1, props: { text: 'Extra' } },
        ],
        secondary: [],
      },
    }
    expect(validateCompositionTree(invalid)).toEqual(expect.arrayContaining([
      { path: 'frame', message: 'unknown composition node field' },
      { path: 'slots.primary', message: 'split.primary requires 1–1 children' },
      { path: 'slots.primary[0].component', message: 'relationship is not allowed in split.primary' },
      { path: 'slots.primary[0].props.arbitrary', message: 'unknown prop for connector' },
      { path: 'slots.secondary', message: 'split.secondary requires 1–1 children' },
    ]))

    const crowded: CompositionNode = {
      nodeId: 'crowded-stack', component: 'stack', version: 1,
      children: Array.from({ length: 13 }, (_, index) => ({ nodeId: `crowded-${index}`, component: 'card', version: 1, props: { title: `Item ${index}` } })),
    }
    expect(validateCompositionTree(crowded)).toContainEqual({ path: 'children', message: 'stack requires 1–12 children' })
  })

  it('accepts only registered axes and maps visual axes to Cadenza tokens', () => {
    expect(resolveCadenzaAxisToken('gap', 'compact')).toBe('space-2')
    expect(resolveCadenzaAxisToken('density', 'open')).toBe('density-open')
    expect(resolveCadenzaAxisToken('emphasis', 'strong')).toBe('surface-ink')
    expect(resolveCadenzaAxisToken('direction', 'horizontal')).toBeUndefined()

    const invalid = structuredClone(validTree)
    invalid.axes = { ratio: '3:2', gap: -4, transform: 'translateX(4px)', color: '#ff00ff' }
    expect(validateCompositionTree(invalid)).toEqual(expect.arrayContaining([
      { path: 'axes.ratio', message: 'invalid axis value for split; expected 1:1, 2:1, or 1:2' },
      { path: 'axes.gap', message: 'invalid axis value for split; expected compact, normal, or open' },
      { path: 'axes.transform', message: 'visual or executable fields are not allowed' },
      { path: 'axes.color', message: 'visual or executable fields are not allowed' },
    ]))
  })
})

describe('composition fixture and evaluation harness', () => {
  const tree: CompositionNode = {
    nodeId: 'summary-root', component: 'split', version: 1,
    slots: {
      primary: [{ nodeId: 'summary-metric', component: 'metric', version: 1, props: { label: 'ARR', value: '¥8.2M' } }],
      secondary: [{ nodeId: 'summary-list', component: 'list', version: 1, props: { items: ['高价值客户增长', '留存保持稳定'] } }],
    },
  }

  const fixture: CompositionFixture = { id: 'business-summary-split', caseId: 'business-summary', tree }
  const evaluationCase: CompositionEvaluationCase = {
    id: 'business-summary',
    narrative: 'business-summary',
    content: { claim: '增长来自高价值客户', metric: 'ARR ¥8.2M', evidence: ['高价值客户增长', '留存保持稳定'] },
    requiredFacts: ['增长来自高价值客户', 'ARR ¥8.2M', '高价值客户增长', '留存保持稳定'],
    signals: ['claim', 'metric', 'evidence'],
    forbiddenInferences: ['不得推断未提供的增长率', '不得增加客户名称'],
    acceptable: { rootComponents: ['split', 'stack', 'grid'], requiredComponents: ['metric'], minDistinctFingerprints: 2 },
  }

  it('validates reusable composition fixtures and rejects duplicate or invalid entries', () => {
    expect(validateCompositionFixtures([fixture])).toEqual([])
    expect(validateCompositionFixtures([fixture, fixture])).toEqual(expect.arrayContaining([
      { path: '[1].id', message: 'fixture ID must be unique' },
    ]))
    expect(validateCompositionFixtures([{ ...fixture, id: 'invalid-fixture', tree: { ...tree, component: 'metric' } }])).toContainEqual({
      path: '[0].tree.slots.primary', message: 'metric does not accept this slot',
    })
  })

  it('requires facts, signals, forbidden inference and acceptable composition features', () => {
    expect(validateEvaluationCase(evaluationCase)).toEqual([])
    expect(validateEvaluationCase({ ...evaluationCase, requiredFacts: [], signals: [], forbiddenInferences: [], acceptable: { rootComponents: [], requiredComponents: [], minDistinctFingerprints: 0 } })).toEqual(expect.arrayContaining([
      { path: 'requiredFacts', message: 'at least one required fact is required' },
      { path: 'signals', message: 'at least one structure signal is required' },
      { path: 'forbiddenInferences', message: 'at least one forbidden inference is required' },
      { path: 'acceptable.rootComponents', message: 'at least one root component is required' },
      { path: 'acceptable.minDistinctFingerprints', message: 'must be a positive integer' },
    ]))
  })

  it('keeps measured candidate evidence separate and requires fingerprint, budget and screenshot review', () => {
    const result: CompositionEvaluationResult = {
      caseId: 'business-summary',
      candidates: [{
        candidateId: 'business-summary-seed-1',
        fingerprint: 'split(horizontal,2:1)[metric|list]',
        budget: { density: 42, cost: 31 },
        screenshot: { path: 'artifacts/business-summary-seed-1.png', status: 'reviewed' },
      }],
    }
    expect(validateEvaluationResult(result)).toEqual([])
    expect(validateEvaluationResult({ ...result, candidates: [{ candidateId: 'broken', fingerprint: '', budget: { density: -1, cost: Number.NaN }, screenshot: { path: '', status: 'captured' } }] })).toEqual(expect.arrayContaining([
      { path: 'candidates[0].fingerprint', message: 'fingerprint is required' },
      { path: 'candidates[0].budget.density', message: 'budget measurement must be a non-negative finite number' },
      { path: 'candidates[0].budget.cost', message: 'budget measurement must be a non-negative finite number' },
      { path: 'candidates[0].screenshot.path', message: 'screenshot evidence path is required' },
      { path: 'candidates[0].screenshot.status', message: 'screenshot must be reviewed or failed' },
    ]))
  })
})

describe('taxonomy tag flow', () => {
  it('allows a cluster to wrap coordinate-free content tags', () => {
    const tree: CompositionNode = {
      nodeId: 'tag-flow', component: 'cluster', version: 1, axes: { wrap: 'wrap', gap: 'compact', alignment: 'start' },
      children: [
        { nodeId: 'tag-one', component: 'caption', version: 1, props: { text: 'Stack' } },
        { nodeId: 'tag-two', component: 'caption', version: 1, props: { text: 'Cluster' } },
      ],
    }
    expect(validateCompositionTree(tree)).toEqual([])
    expect(renderComposition(tree)).toContain('data-axis-wrap="wrap"')
  })
})

describe('composition diagnosis and finite degradation', () => {
  const tree: CompositionNode = {
    nodeId: 'diagnosis-root', component: 'split', version: 1,
    axes: { direction: 'horizontal', ratio: '2:1', gap: 'normal' },
    slots: {
      primary: [{ nodeId: 'diagnosis-heading', component: 'heading', version: 1, props: { text: '增长来自高价值客户' } }],
      secondary: [{ nodeId: 'diagnosis-metric', component: 'metric', version: 1, props: { label: 'ARR', value: '¥8.2M', source: 'FY2026' } }],
    },
  }

  it('estimates a legal tree deterministically and uses stricter thumbnail budgets', () => {
    expect(estimateComposition(tree, { width: 84, height: 58 })).toEqual(estimateComposition(tree, { width: 84, height: 58 }))
    expect(estimateComposition(tree, { width: 84, height: 58 })).toMatchObject({ nodeCount: 3, textLength: expect.any(Number), density: expect.any(Number), cost: expect.any(Number) })
    expect(compositionBudgetProfiles.thumbnail.hardCost).toBeLessThan(compositionBudgetProfiles.stage.hardCost)
    expect(diagnoseComposition(tree, { profile: 'stage', frame: { width: 84, height: 58 } }).status).toBe('fit')
  })

  it('rejects invalid trees before budgeting and splits content beyond hard limits', () => {
    expect(diagnoseComposition({ ...tree, component: 'unknown' }, { profile: 'stage', frame: { width: 84, height: 58 } })).toMatchObject({
      status: 'reject', reasons: expect.arrayContaining([expect.stringContaining('component is not registered')]), rendered: false,
    })
    const crowded: CompositionNode = {
      nodeId: 'crowded-root', component: 'grid', version: 1, axes: { columns: '4', density: 'compact' },
      children: Array.from({ length: 12 }, (_, index) => ({ nodeId: `crowded-card-${index}`, component: 'card', version: 1, props: { title: `Item ${index}`, body: '必要事实'.repeat(48) } })),
    }
    expect(diagnoseComposition(crowded, { profile: 'stage', frame: { width: 20, height: 12 } })).toMatchObject({ status: 'split', rendered: false })
  })

  it('applies at most one deterministic compact degradation and preserves node IDs', () => {
    const tiny = { profile: 'stage' as const, frame: { width: 10, height: 7 } }
    expect(diagnoseComposition(tree, tiny).status).toBe('compress')
    const first = resolveComposition(tree, tiny)
    expect(first).toEqual(resolveComposition(tree, tiny))
    expect(first.steps).toHaveLength(1)
    expect(first.steps[0]).toMatchObject({ reason: expect.stringContaining('compact'), informationLoss: 'visual' })
    expect(first.tree.nodeId).toBe(tree.nodeId)
    expect(first.tree.axes).toMatchObject({ gap: 'compact' })
  })
})

describe('component extension qualification', () => {
  const card = productionComponentDefinitions.find(definition => definition.id === 'card')!
  const cardNode = (id: string): CompositionNode => ({ nodeId: id, component: 'card', version: 1, props: { title: id } })
  const fixtures: ComponentQualificationFixtures = {
    minimal: cardNode('card-minimal'),
    boundary: cardNode('card-boundary'),
    fallback: cardNode('card-fallback'),
    compositions: [
      { id: 'card-in-stack', tree: { nodeId: 'stack-root', component: 'stack', version: 1, children: [cardNode('card-stack')] } },
      { id: 'card-in-grid', tree: { nodeId: 'grid-root', component: 'grid', version: 1, children: [cardNode('card-grid')] } },
      { id: 'card-in-split', tree: { nodeId: 'split-root', component: 'split', version: 1, slots: { primary: [cardNode('card-split')], secondary: [{ nodeId: 'split-copy', component: 'copy', version: 1, props: { text: 'Evidence' } }] } } },
    ],
  }

  it('accepts a complete definition only with three structurally distinct composition usages', () => {
    expect(validateComponentQualification(card, fixtures)).toEqual([])
  })

  it('qualifies every production component with minimal, boundary, fallback and three compositions', () => {
    expect(Object.keys(productionComponentQualificationFixtures)).toHaveLength(productionComponentDefinitions.length)
    expect(productionComponentDefinitions.flatMap(definition => validateComponentQualification(definition, productionComponentQualificationFixtures[definition.id]).map(issue => ({ component: definition.id, ...issue })))).toEqual([])
  })

  it('rejects incomplete contracts and template-shaped usage evidence', () => {
    expect(validateComponentQualification({ ...card, tokenRoles: [], constraints: { ...card.constraints, maxText: 0 } }, undefined)).toEqual(expect.arrayContaining([
      { path: 'tokenRoles', message: 'at least one Cadenza token role is required' },
      { path: 'constraints.maxText', message: 'constraint must be a positive finite number' },
      { path: 'fixtures', message: 'minimal, boundary, fallback, and composition fixtures are required' },
    ]))
    expect(validateComponentQualification(card, { ...fixtures, compositions: [fixtures.compositions[0], fixtures.compositions[0], fixtures.compositions[0]] })).toContainEqual({
      path: 'fixtures.compositions', message: 'component requires three structurally distinct composition usages',
    })
  })
})

describe('layout component renderers', () => {
  const heading = (id: string): CompositionNode => ({ nodeId: id, component: 'heading', version: 1, props: { text: id } })
  const metric = (id: string): CompositionNode => ({ nodeId: id, component: 'metric', version: 1, props: { label: id, value: '42' } })
  const media = (id: string): CompositionNode => ({ nodeId: id, component: 'media', version: 1, props: { src: '/hero.png', alt: id } })

  const layouts: CompositionNode[] = [
    { nodeId: 'layout-stack', component: 'stack', version: 1, axes: { direction: 'vertical', gap: 'open' }, children: [heading('stack-heading'), metric('stack-metric')] },
    { nodeId: 'layout-cluster', component: 'cluster', version: 1, axes: { distribution: 'between', gap: 'normal' }, children: [heading('cluster-heading'), metric('cluster-metric')] },
    { nodeId: 'layout-grid', component: 'grid', version: 1, axes: { columns: '2', gap: 'normal' }, children: [heading('grid-heading'), metric('grid-metric')] },
    { nodeId: 'layout-split', component: 'split', version: 1, axes: { direction: 'horizontal', ratio: '2:1' }, slots: { primary: [heading('split-heading')], secondary: [metric('split-metric')] } },
    { nodeId: 'layout-inset', component: 'inset', version: 1, axes: { position: 'bottom-right', span: 'small' }, slots: { base: [media('inset-media')], inset: [metric('inset-metric')] } },
    { nodeId: 'layout-overlay', component: 'overlay', version: 1, axes: { position: 'bottom', emphasis: 'strong' }, slots: { base: [media('overlay-media')], overlay: [heading('overlay-heading')] } },
  ]

  it('renders six distinct relation structures with stable metadata and no coordinates', () => {
    const html = layouts.map(renderComposition)
    expect(new Set(html.map(value => value.match(/cadenza-(stack|cluster|grid|split|inset|overlay)/)?.[1])).size).toBe(6)
    layouts.forEach((layout, index) => {
      expect(html[index]).toContain(`data-node-id="${layout.nodeId}"`)
      expect(html[index]).toContain(`data-cadenza-component="${layout.component}"`)
      expect(html[index]).not.toMatch(/style=|left:|top:|width:|height:/)
    })
    expect(html[3]).toContain('data-slot="primary"')
    expect(html[3]).toContain('data-slot="secondary"')
    expect(html[4]).toContain('data-slot="inset"')
    expect(html[5]).toContain('data-slot="overlay"')
  })

  it('uses finite axes as data attributes and renders deterministically', () => {
    expect(renderComposition(layouts[0])).toBe(renderComposition(layouts[0]))
    expect(renderComposition(layouts[0])).toContain('data-axis-gap="open"')
    expect(renderComposition(layouts[3])).toContain('data-axis-ratio="2:1"')
  })

  it('refuses invalid trees before producing partial HTML', () => {
    expect(() => renderComposition({ ...layouts[0], component: 'dashboard-template' })).toThrow(/component is not registered/i)
  })
})

describe('core content component renderers', () => {
  const nodes: CompositionNode[] = [
    { nodeId: 'content-heading', component: 'heading', version: 1, props: { eyebrow: 'FY 2026', text: '增长来自高价值客户' }, axes: { emphasis: 'strong', span: 'display' } },
    { nodeId: 'content-copy', component: 'copy', version: 1, props: { text: '收入增长与留存改善共同支持这一判断。' } },
    { nodeId: 'content-metric', component: 'metric', version: 1, props: { label: 'ARR', value: '¥8.2M', trend: '+32%', source: 'FY2026' }, axes: { emphasis: 'strong' } },
    { nodeId: 'content-list', component: 'list', version: 1, props: { items: ['高价值客户增长', '留存保持稳定'], ordered: true } },
    { nodeId: 'content-card', component: 'card', version: 1, props: { meta: '01', title: '证据优先', body: '所有视觉关系必须来自真实内容信号。' } },
  ]

  it('renders accessible semantic HTML and escapes all content', () => {
    const [heading, copy, metric, list, card] = nodes.map(renderComposition)
    expect(heading).toMatch(/<header[^>]+><span class="cadenza-eyebrow">FY 2026<\/span><h3>增长来自高价值客户<\/h3><\/header>/)
    expect(copy).toContain('<p class="cadenza-component cadenza-copy"')
    expect(metric).toMatch(/<article[^>]+aria-label="ARR ¥8\.2M"/)
    expect(metric).toContain('<strong>¥8.2M</strong>')
    expect(list).toContain('<ol class="cadenza-component cadenza-list"')
    expect(list).toContain('<li>高价值客户增长</li>')
    expect(card).toMatch(/<article[^>]+><small>01<\/small><h4>证据优先<\/h4><p>所有视觉关系必须来自真实内容信号。<\/p><\/article>/)
    expect(renderComposition({ nodeId: 'escape-heading', component: 'heading', version: 1, props: { text: '<script>alert(1)</script>' } })).not.toContain('<script>')
  })

  it('reuses the exact same metric renderer across split, grid and overlay compositions', () => {
    const metric = nodes[2]
    const metricHtml = renderComposition(metric)
    const compositions: CompositionNode[] = [
      { nodeId: 'reuse-split', component: 'split', version: 1, slots: { primary: [metric], secondary: [nodes[1]] } },
      { nodeId: 'reuse-grid', component: 'grid', version: 1, children: [metric, nodes[4]] },
      { nodeId: 'reuse-overlay', component: 'overlay', version: 1, slots: { base: [{ nodeId: 'reuse-media', component: 'media', version: 1, props: { src: '/hero.png', alt: 'Mountain' } }], overlay: [metric] } },
    ]
    expect(compositions.map(renderComposition).every(html => html.includes(metricHtml))).toBe(true)
  })

  it('rejects missing, mistyped and over-capacity content props before rendering', () => {
    expect(validateCompositionTree({ nodeId: 'bad-heading', component: 'heading', version: 1, props: {} })).toContainEqual({ path: 'props.text', message: 'required prop is missing' })
    expect(validateCompositionTree({ nodeId: 'bad-list', component: 'list', version: 1, props: { items: 'not-an-array' } })).toContainEqual({ path: 'props.items', message: 'expected an array of strings' })
    expect(validateCompositionTree({ nodeId: 'long-list', component: 'list', version: 1, props: { items: Array.from({ length: 13 }, (_, index) => `Item ${index}`) } })).toContainEqual({ path: 'props.items', message: 'must contain at most 12 items' })
  })
})

describe('editorial and media content component renderers', () => {
  it('renders quote, media, profile, logo and caption with semantic accessible markup', () => {
    expect(renderComposition({ nodeId: 'content-quote', component: 'quote', version: 1, props: { text: 'Design is how it works.', author: 'Steve Jobs', source: 'Interview' } })).toMatch(
      /<blockquote[^>]+><p>Design is how it works\.<\/p><footer>Steve Jobs<cite>Interview<\/cite><\/footer><\/blockquote>/,
    )
    expect(renderComposition({ nodeId: 'content-media', component: 'media', version: 1, props: { src: '/assets/product.png', alt: '产品界面', caption: '首期交付范围' } })).toMatch(
      /<figure[^>]+><img src="\/assets\/product\.png" alt="产品界面" loading="lazy" data-media-kind="photo" data-media-treatment="one-bit"><figcaption>首期交付范围<\/figcaption><\/figure>/,
    )
    expect(renderComposition({ nodeId: 'content-profile', component: 'profile', version: 1, props: { name: 'Ada Lovelace', role: 'Research', bio: '把抽象关系转译为可验证系统。' } })).toMatch(
      /<article[^>]+aria-label="Ada Lovelace, Research"><span class="cadenza-avatar-fallback" aria-hidden="true">AL<\/span><h4>Ada Lovelace<\/h4><strong>Research<\/strong><p>把抽象关系转译为可验证系统。<\/p><\/article>/,
    )
    expect(renderComposition({ nodeId: 'content-logo', component: 'logo', version: 1, props: { name: 'Cadenza' } })).toMatch(
      /<figure[^>]+aria-label="Cadenza"><span class="cadenza-logo-wordmark">Cadenza<\/span><\/figure>/,
    )
    expect(renderComposition({ nodeId: 'content-caption', component: 'caption', version: 1, props: { text: '数据截至 FY2026', source: 'Finance' } })).toMatch(
      /<aside[^>]+><span>数据截至 FY2026<\/span><cite>Finance<\/cite><\/aside>/,
    )
  })

  it('fails closed for missing media, missing alternative text and excessive editorial copy', () => {
    expect(validateCompositionTree({ nodeId: 'missing-media', component: 'media', version: 1, props: { alt: '产品界面' } })).toContainEqual({ path: 'props.src', message: 'required prop is missing' })
    expect(validateCompositionTree({ nodeId: 'missing-alt', component: 'media', version: 1, props: { src: '/assets/product.png' } })).toContainEqual({ path: 'props.alt', message: 'required prop is missing' })
    expect(validateCompositionTree({ nodeId: 'long-quote', component: 'quote', version: 1, props: { text: 'x'.repeat(421) } })).toContainEqual({ path: 'props.text', message: 'must contain at most 420 characters' })
  })

  it('escapes media and identity fields and never emits executable markup', () => {
    const profile = renderComposition({ nodeId: 'safe-profile', component: 'profile', version: 1, props: { name: '<img src=x onerror=alert(1)>', role: 'R&D' } })
    const media = renderComposition({ nodeId: 'safe-media', component: 'media', version: 1, props: { src: '/asset?name="hero"', alt: '<script>alert(1)</script>' } })
    expect(profile).not.toContain('<img src=x')
    expect(media).not.toContain('<script>')
    expect(media).toContain('src="/asset?name=&quot;hero&quot;"')
  })
})

describe('relationship component renderers', () => {
  const relatedTree: CompositionNode = {
    nodeId: 'relationship-root', component: 'stack', version: 1,
    children: [
      { nodeId: 'source-card', component: 'card', version: 1, props: { title: 'Input' } },
      { nodeId: 'flow-edge', component: 'connector', version: 1, props: { from: 'source-card', to: 'target-card', label: 'enables' }, axes: { direction: 'forward', emphasis: 'strong' } },
      { nodeId: 'target-card', component: 'card', version: 1, props: { title: 'Outcome' } },
      { nodeId: 'delivery-progress', component: 'progress', version: 1, props: { value: 67, label: 'Delivery', target: '100%' } },
      { nodeId: 'section-rule', component: 'divider', version: 1, props: { label: 'Evidence' } },
    ],
  }

  it('renders finite semantic relationships with native progress and Cadenza metadata', () => {
    const html = renderComposition(relatedTree)
    expect(html).toMatch(/<div class="cadenza-component cadenza-connector"[^>]+role="img" aria-label="source-card to target-card" data-from="source-card" data-to="target-card">/)
    expect(html).toContain('<span class="cadenza-connector-stroke" aria-hidden="true"></span><small>enables</small>')
    expect(html).toMatch(/<div class="cadenza-component cadenza-progress"[^>]+><span>Delivery<\/span><progress max="100" value="67">67%<\/progress><strong>67%<\/strong><small>100%<\/small><\/div>/)
    expect(html).toMatch(/<div class="cadenza-component cadenza-divider"[^>]+role="separator"><span>Evidence<\/span><\/div>/)
    expect(html).not.toMatch(/style=|<svg|<script/)
  })

  it('rejects invented, self-referential and duplicate edges before rendering', () => {
    const invented = structuredClone(relatedTree)
    ;(invented.children![1].props as Record<string, unknown>).to = 'missing-card'
    expect(validateCompositionTree(invented)).toContainEqual({ path: 'children[1].props.to', message: 'connector endpoint does not exist in this composition' })

    const self = structuredClone(relatedTree)
    ;(self.children![1].props as Record<string, unknown>).to = 'source-card'
    expect(validateCompositionTree(self)).toContainEqual({ path: 'children[1].props.to', message: 'connector endpoints must be distinct' })

    const duplicate = structuredClone(relatedTree)
    duplicate.children!.splice(2, 0, { ...structuredClone(duplicate.children![1]), nodeId: 'duplicate-edge' })
    expect(validateCompositionTree(duplicate)).toContainEqual({ path: 'children[2].props', message: 'duplicate connector edge is not allowed' })
  })

  it('constrains progress to the finite zero-to-one-hundred contract', () => {
    expect(validateCompositionTree({ nodeId: 'bad-progress', component: 'progress', version: 1, props: { value: 101 } })).toContainEqual({ path: 'props.value', message: 'must be at most 100' })
  })
})

describe('composition fidelity contract', () => {
  const tree: CompositionNode = {
    nodeId: 'fidelity-split', component: 'split', version: 1,
    slots: {
      primary: [{ nodeId: 'fidelity-heading', component: 'heading', version: 1, props: { text: 'Editable by construction' } }],
      secondary: [{ nodeId: 'fidelity-metric', component: 'metric', version: 1, props: { label: 'Coverage', value: '100%' } }],
    },
  }

  it('declares composition-level HTML and PPTX fidelity without bitmap flattening', () => {
    expect(assessCompositionFidelity(tree)).toEqual({ html: 'native', pptx: 'shapes', editable: true, rasterized: false, unsupportedComponents: [] })
    expect(prepareCompositionExport(tree, 'html')).toMatchObject({ renderer: 'native-dom', editable: true, rasterized: false })
    expect(prepareCompositionExport(tree, 'pptx')).toMatchObject({ renderer: 'editable-shapes', editable: true, rasterized: false })
  })
})
