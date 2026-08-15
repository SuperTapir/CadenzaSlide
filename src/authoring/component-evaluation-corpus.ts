import type { SlideContentSignals } from './slide-composer'

export interface ComposerEvaluationCorpusCase {
  id: string
  narrative: 'business-summary' | 'feature-explanation' | 'comparison' | 'steps' | 'timeline' | 'people' | 'system-relationship' | 'quote' | 'media-narrative'
  signals: SlideContentSignals
  requiredComponents: string[]
  forbiddenInferences: string[]
}

export const componentEvaluationCorpus: readonly ComposerEvaluationCorpusCase[] = [
  {
    id: 'eval-business-summary', narrative: 'business-summary', requiredComponents: ['metric'], forbiddenInferences: ['未提供的增长率'],
    signals: { id: 'eval-business-summary', claim: { id: 'business-claim', text: '增长来自高价值客户' }, evidence: [{ id: 'business-evidence', text: '净收入留存保持稳定' }], metrics: [{ id: 'business-arr', label: 'ARR', value: '¥8.2M', source: 'FY2026 Finance' }] },
  },
  {
    id: 'eval-feature-explanation', narrative: 'feature-explanation', requiredComponents: ['media', 'card'], forbiddenInferences: ['未承诺的发布日期'],
    signals: { id: 'eval-feature-explanation', claim: { id: 'feature-claim', text: '组件组合替代固定模板' }, evidence: [{ id: 'feature-registry', text: 'registry 提供有限 props 与 axes' }, { id: 'feature-verify', text: 'Verify 在渲染前拒绝非法树' }], media: [{ id: 'feature-media', src: '/cadenza-hero-one-bit-source.png', alt: 'Cadenza 组件 Gallery', caption: '同一 registry 驱动预览与渲染' }] },
  },
  {
    id: 'eval-comparison', narrative: 'comparison', requiredComponents: ['card', 'connector'], forbiddenInferences: ['未提供的成本差异'],
    signals: { id: 'eval-comparison', claim: { id: 'comparison-claim', text: '原子组合比宏表达更可复用' }, evidence: [{ id: 'comparison-before', text: '旧方案把页面类型固化为 variant' }, { id: 'comparison-after', text: '新方案把关系交给父级 layout' }], relationships: [{ from: 'comparison-before', to: 'comparison-after', label: 'replaced by' }] },
  },
  {
    id: 'eval-steps', narrative: 'steps', requiredComponents: ['list'], forbiddenInferences: ['未提供的第四步'],
    signals: { id: 'eval-steps', claim: { id: 'steps-claim', text: '生成遵循可验证的有限流程' }, sequence: { id: 'steps-sequence', items: ['拆分内容信号', '生成合法候选', '全尺寸复核'] } },
  },
  {
    id: 'eval-timeline', narrative: 'timeline', requiredComponents: ['list', 'caption'], forbiddenInferences: ['未提供的具体日期'],
    signals: { id: 'eval-timeline', claim: { id: 'timeline-claim', text: '交付按阶段推进' }, sequence: { id: 'timeline-sequence', items: ['研究', '组件基线', 'Composer', '发布门槛'] }, media: [{ id: 'timeline-media', src: '/cadenza-hero-one-bit-source.png', alt: '交付阶段示意', source: '项目计划' }] },
  },
  {
    id: 'eval-people', narrative: 'people', requiredComponents: ['profile'], forbiddenInferences: ['未提供的个人履历'],
    signals: { id: 'eval-people', claim: { id: 'people-claim', text: '跨职能团队共同维护表达系统' }, profiles: [{ id: 'people-design', name: 'Mina', role: 'Design' }, { id: 'people-engineering', name: 'Kai', role: 'Engineering' }] },
  },
  {
    id: 'eval-system-relationship', narrative: 'system-relationship', requiredComponents: ['connector'], forbiddenInferences: ['不存在的第三方服务'],
    signals: { id: 'eval-system-relationship', claim: { id: 'system-claim', text: '一套 registry 贯通查询、渲染与验证' }, evidence: [{ id: 'system-registry', text: 'Production registry' }, { id: 'system-verify', text: 'Verify' }], relationships: [{ from: 'system-registry', to: 'system-verify', label: 'drives' }, { from: 'system-verify', to: 'system-claim', label: 'protects' }] },
  },
  {
    id: 'eval-quote', narrative: 'quote', requiredComponents: ['quote'], forbiddenInferences: ['未提供的演讲场合'],
    signals: { id: 'eval-quote', claim: { id: 'quote-claim', text: '形式必须服务内容' }, quotes: [{ id: 'quote-source', text: 'Design is how it works.', author: 'Steve Jobs', source: 'Interview' }] },
  },
  {
    id: 'eval-media-narrative', narrative: 'media-narrative', requiredComponents: ['media'], forbiddenInferences: ['图片中不存在的功能'],
    signals: { id: 'eval-media-narrative', claim: { id: 'media-claim', text: '视觉证据与主张共享一条阅读路径' }, media: [{ id: 'media-product', src: '/cadenza-hero-one-bit-source.png', alt: 'Cadenza 编辑器画面', caption: '原子组件在画布内组合', source: 'Product capture' }], evidence: [{ id: 'media-evidence', text: '同一 renderer 跨 layout 复用' }] },
  },
]
