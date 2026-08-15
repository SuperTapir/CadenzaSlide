import type { SlideContentSignals } from '../../../src/authoring/slide-composer'

export interface GenerationRegressionCase {
  id: string
  kind: 'narrative' | 'data-comparison' | 'high-density-technical'
  signals: SlideContentSignals
  acceptance: { minCandidates: number, requiredComponents: string[], minDistinctFingerprints: number }
}

export const generationRegressionCorpus: readonly GenerationRegressionCase[] = [
  {
    id: 'corpus-narrative-launch', kind: 'narrative',
    signals: {
      id: 'corpus-narrative-launch',
      claim: { id: 'narrative-claim', text: '一次发布先建立共同理解，再推动行动' },
      sequence: { id: 'narrative-sequence', items: ['看见变化', '理解原因', '确认选择', '开始行动'] },
      media: [{ id: 'narrative-media', src: '/regression-assets/cadenza-hero-one-bit-source.png', alt: '人物沿着建筑曲线走向明亮入口' }],
      quotes: [{ id: 'narrative-voice', text: '清晰不是减少信息，而是建立顺序。', author: '项目负责人', source: '发布复盘' }],
    },
    acceptance: { minCandidates: 3, requiredComponents: ['heading', 'list', 'media', 'quote'], minDistinctFingerprints: 2 },
  },
  {
    id: 'corpus-data-compare', kind: 'data-comparison',
    signals: {
      id: 'corpus-data-compare',
      claim: { id: 'compare-claim', text: '方案 B 用更少等待换来更稳定交付' },
      evidence: [{ id: 'compare-a', text: '方案 A 依赖串行审批' }, { id: 'compare-b', text: '方案 B 并行验证关键风险' }],
      metrics: [{ id: 'compare-cycle', label: '交付周期', value: '−32%' }, { id: 'compare-rework', label: '返工次数', value: '−41%' }],
      relationships: [{ from: 'compare-a', to: 'compare-b', label: '改进为' }],
    },
    acceptance: { minCandidates: 3, requiredComponents: ['metric', 'card', 'connector'], minDistinctFingerprints: 2 },
  },
  {
    id: 'corpus-technical-gate', kind: 'high-density-technical',
    signals: {
      id: 'corpus-technical-gate',
      claim: { id: 'technical-claim', text: '发布门禁必须同时守住结构、渲染与证据' },
      evidence: [
        { id: 'technical-schema', text: 'Schema 拒绝未知字段' },
        { id: 'technical-layout', text: 'Layout 检查语义覆盖' },
        { id: 'technical-render', text: 'Render 捕获资源与字体失败' },
        { id: 'technical-geometry', text: 'Geometry 检查裁切与溢出' },
        { id: 'technical-review', text: 'Visual review 判断层级与调性' },
      ],
      metrics: [{ id: 'technical-rules', label: '确定性规则', value: 24 }, { id: 'technical-channels', label: '验证通道', value: 5 }],
    },
    acceptance: { minCandidates: 3, requiredComponents: ['heading', 'card', 'metric'], minDistinctFingerprints: 2 },
  },
]
