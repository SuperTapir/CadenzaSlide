import { describe, expect, it } from 'vitest'
import { preflightCompositionCandidate, type SlideContentSignals } from './slide-composer'
import type { CompositionNode } from './component-library'

const input = { profile: 'stage' as const, frame: { width: 84, height: 58 }, format: 'html' as const }
const validSignals: SlideContentSignals = {
  id: 'preflight-proof', claim: { id: 'claim', text: '生成前拒绝坏候选' },
  evidence: [{ id: 'evidence', text: '结构化规则提供证据' }],
}
const validTree: CompositionNode = {
  nodeId: 'root', component: 'stack', version: 1, children: [
    { nodeId: 'heading', component: 'heading', version: 1, props: { text: '生成前拒绝坏候选' } },
    { nodeId: 'copy', component: 'copy', version: 1, props: { text: '结构化规则提供证据' } },
  ],
}

describe('versioned candidate preflight', () => {
  const overCapacityTree: CompositionNode = {
    nodeId: 'capacity-root', component: 'stack', version: 1,
    children: Array.from({ length: 11 }, (_, group) => ({
      nodeId: `capacity-group-${group}`, component: 'stack', version: 1,
      children: [0, 1].map(item => ({ nodeId: `capacity-${group}-${item}`, component: 'copy', version: 1, props: { text: `证据 ${group}-${item}` } })),
    })),
  }
  const imbalancedSignals: SlideContentSignals = {
    id: 'imbalanced-split', claim: { id: 'split-claim', text: '主区只有一个标题' },
    evidence: [1, 2, 3].map(index => ({ id: `split-evidence-${index}`, text: `证据 ${index}` })),
  }
  const imbalancedTree: CompositionNode = {
    nodeId: 'imbalanced-root', component: 'split', version: 1, slots: {
      primary: [{ nodeId: 'split-claim', component: 'heading', version: 1, props: { text: '主区只有一个标题' } }],
      secondary: [{ nodeId: 'split-grid', component: 'grid', version: 1, axes: { columns: '3' }, children: [1, 2, 3].map(index => ({ nodeId: `split-evidence-${index}`, component: 'card', version: 1, props: { title: `证据 ${index}`, body: `证据 ${index}` } })) }],
    },
  }
  const crampedSignals: SlideContentSignals = {
    id: 'cramped-stack', evidence: Array.from({ length: 8 }, (_, index) => ({ id: `cramped-${index}`, text: `内容 ${index}` })),
  }
  const crampedTree: CompositionNode = {
    nodeId: 'cramped-root', component: 'stack', version: 1, axes: { gap: 'normal', density: 'open' },
    children: Array.from({ length: 8 }, (_, index) => ({ nodeId: `cramped-${index}`, component: 'card', version: 1, props: { title: `内容 ${index}` } })),
  }
  const cases: Array<[string, { signals: SlideContentSignals, tree: CompositionNode, frame?: { width: number, height: number }, ruleId: string }]> = [
    ['missing content signals', { signals: { id: 'empty' }, tree: validTree, ruleId: 'content.signals' }],
    ['empty split slot', { signals: validSignals, tree: { nodeId: 'split', component: 'split', version: 1, slots: { primary: [validTree], secondary: [] } }, ruleId: 'composition.slot-contract' }],
    ['capacity overload', { signals: validSignals, tree: overCapacityTree, ruleId: 'composition.capacity' }],
    ['invalid relationship endpoint', { signals: { ...validSignals, relationships: [{ from: 'missing', to: 'claim' }] }, tree: validTree, ruleId: 'content.signals' }],
    ['intrinsic frame failure', { signals: validSignals, tree: validTree, frame: { width: 1, height: 1 }, ruleId: 'composition.intrinsic.profile-budget' }],
    ['semantic type overload', { signals: { id: 'long-copy', claim: { id: 'long', text: '字'.repeat(700) } }, tree: { nodeId: 'copy-long', component: 'copy', version: 1, props: { text: '字'.repeat(700) } }, ruleId: 'composition.semantic-type-budget' }],
    ['content coverage failure', { signals: { id: 'single', claim: { id: 'only', text: '唯一主张' } }, tree: { nodeId: 'only', component: 'heading', version: 1, props: { text: '唯一主张' } }, ruleId: 'layout.content-coverage' }],
    ['imbalanced split regions', { signals: imbalancedSignals, tree: imbalancedTree, ruleId: 'layout.region-balance' }],
    ['cumulative vertical intrinsic failure', { signals: crampedSignals, tree: crampedTree, ruleId: 'composition.intrinsic.profile-budget' }],
  ]

  it.each(cases)('rejects %s before deck write', (_name, fixture) => {
    const result = preflightCompositionCandidate(fixture.signals, fixture.tree, { ...input, ...(fixture.frame ? { frame: fixture.frame } : {}) })
    expect(result.ok).toBe(false)
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: fixture.ruleId,
      severity: 'error',
      target: { slideId: fixture.signals.id, componentId: fixture.tree.nodeId },
      evidence: expect.objectContaining({ kind: 'structured-candidate' }),
    })]))
    expect(result.recommendation).toMatchObject({ action: expect.stringMatching(/repair|simplify|split/) })
    expect(JSON.stringify(result)).not.toMatch(/screenshot|computedStyle|browser geometry/i)
  })

  it('accepts a legal candidate with versioned structured evidence and a browser follow-up', () => {
    const result = preflightCompositionCandidate(validSignals, validTree, input)
    expect(result).toMatchObject({ schemaVersion: 1, ok: true, findings: [], requiredPostWriteChannels: ['document', 'render', 'geometry'] })
  })

  it('rejects a nested stack that cannot fit its allocated vertical split region', () => {
    const signals: SlideContentSignals = {
      id: 'nested-vertical-budget',
      evidence: Array.from({ length: 8 }, (_, index) => ({ id: `nested-${index + 1}`, text: `高密度内容 ${index + 1}` })),
    }
    const card = (index: number): CompositionNode => ({
      nodeId: `nested-${index}`, component: 'card', version: 1, props: { title: `高密度内容 ${index}` },
    })
    const tree: CompositionNode = {
      nodeId: 'nested-split', component: 'split', version: 1, axes: { direction: 'vertical', ratio: '1:2', gap: 'normal' },
      slots: {
        primary: [{ nodeId: 'nested-primary', component: 'stack', version: 1, axes: { gap: 'normal' }, children: [card(1), card(2), card(3)] }],
        secondary: [{ nodeId: 'nested-secondary', component: 'stack', version: 1, axes: { gap: 'normal' }, children: [card(4), card(5), card(6), card(7), card(8)] }],
      },
    }

    const result = preflightCompositionCandidate(signals, tree, input)
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: 'composition.intrinsic.profile-budget',
      evidence: expect.objectContaining({ paths: expect.arrayContaining(['slots.primary[0]']) }),
    })]))
  })

  it('rejects an imbalanced split nested below a shared page heading', () => {
    const signals: SlideContentSignals = {
      id: 'nested-imbalanced-split',
      claim: { id: 'nested-claim', text: '共享主张' },
      evidence: Array.from({ length: 4 }, (_, index) => ({ id: `nested-proof-${index + 1}`, text: `证据 ${index + 1}` })),
    }
    const tree: CompositionNode = {
      nodeId: 'nested-balance-root', component: 'stack', version: 1, children: [
        { nodeId: 'nested-claim', component: 'heading', version: 1, props: { text: '共享主张' } },
        {
          nodeId: 'nested-balance-split', component: 'split', version: 1, slots: {
            primary: [{ nodeId: 'nested-proof-1', component: 'card', version: 1, props: { title: '证据 1' } }],
            secondary: [{
              nodeId: 'nested-balance-grid', component: 'grid', version: 1, axes: { columns: '3' },
              children: [2, 3, 4].map(index => ({ nodeId: `nested-proof-${index}`, component: 'card', version: 1, props: { title: `证据 ${index}`, body: `证据 ${index}` } })),
            }],
          },
        },
      ],
    }

    const result = preflightCompositionCandidate(signals, tree, input)
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: 'layout.region-balance',
      evidence: expect.objectContaining({ paths: expect.arrayContaining(['children[1]']) }),
    })]))
  })
})
