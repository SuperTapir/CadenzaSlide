import type { SlideContentSignals } from '../../../src/authoring/slide-composer'

export interface VisualRegressionCase {
  id: string
  domain: 'enterprise-strategy' | 'technical-architecture' | 'people-culture' | 'data-conclusion' | 'product-narrative'
  signals: SlideContentSignals
  expectedFamilies: string[]
}

export const visualRegressionCorpus: readonly VisualRegressionCase[] = Object.freeze([
  {
    id: 'enterprise-growth', domain: 'enterprise-strategy', expectedFamilies: ['lucide:business', 'lucide:data'],
    signals: { id: 'enterprise-growth', claim: { id: 'enterprise-claim', text: '企业战略聚焦高质量增长' }, evidence: [{ id: 'enterprise-evidence', text: '商业组织与增长目标保持一致' }] },
  },
  {
    id: 'architecture-flow', domain: 'technical-architecture', expectedFamilies: ['lucide:technology', 'lucide:process'],
    signals: { id: 'architecture-flow', claim: { id: 'architecture-claim', text: '技术架构把系统能力编排成流程' }, sequence: { id: 'architecture-sequence', items: ['接收输入', '系统处理', '输出结果'] } },
  },
  {
    id: 'culture-collaboration', domain: 'people-culture', expectedFamilies: ['lucide:people', 'lucide:communication'],
    signals: { id: 'culture-collaboration', claim: { id: 'culture-claim', text: '团队文化依赖持续协作与沟通' }, evidence: [{ id: 'culture-evidence', text: '成员围绕共同目标形成反馈' }] },
  },
  {
    id: 'data-trend', domain: 'data-conclusion', expectedFamilies: ['lucide:data'],
    signals: { id: 'data-trend', claim: { id: 'data-claim', text: '数据趋势显示增长仍在延续' }, metrics: [{ id: 'data-metric', label: '增长趋势', value: '向上' }], evidence: [{ id: 'data-evidence', text: '分析结果支持结论' }] },
  },
  {
    id: 'product-creation', domain: 'product-narrative', expectedFamilies: ['lucide:creation'],
    signals: { id: 'product-creation', claim: { id: 'product-claim', text: '产品让创建与编辑形成一条路径' }, sequence: { id: 'product-sequence', items: ['创建内容', '编辑结构', '完成交付'] } },
  },
])
