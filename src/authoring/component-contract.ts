export type ProductionComponentCategory = 'layout' | 'content' | 'relationship'
export type ComponentPropType = 'string' | 'scalar' | 'boolean' | 'string-array' | 'number'
export interface ComponentPropDefinition { type: ComponentPropType, required?: boolean, maxLength?: number, maxItems?: number, min?: number, max?: number }

export interface ProductionComponentDefinition {
  id: string
  version: 1
  category: ProductionComponentCategory
  label: string
  purpose: string[]
  props: Record<string, ComponentPropDefinition>
  slots: Record<string, { min: number, max: number, categories: ProductionComponentCategory[] }>
  children?: { min: number, max: number, categories: ProductionComponentCategory[] }
  axes: Record<string, string[]>
  constraints: { minWidth: number, minHeight: number, maxText: number }
  tokenRoles: string[]
  fidelity: { html: 'native', pptx: 'native' | 'shapes' | 'unsupported' }
}

export type ProductionComponentManifestEntry = Readonly<ProductionComponentDefinition>

export interface CompositionNode {
  nodeId: string
  component: string
  version: 1
  props?: Record<string, unknown>
  axes?: Record<string, unknown>
  children?: CompositionNode[]
  slots?: Record<string, CompositionNode[]>
}

export interface CompositionIssue { path: string, message: string }

export interface CompositionFixture {
  id: string
  caseId?: string
  tree: CompositionNode
}

export interface ComponentQualificationFixtures {
  minimal: CompositionNode
  boundary: CompositionNode
  fallback: CompositionNode
  compositions: CompositionFixture[]
}

export interface CompositionEvaluationCase {
  id: string
  narrative: string
  content: unknown
  requiredFacts: string[]
  signals: string[]
  forbiddenInferences: string[]
  acceptable: { rootComponents: string[], requiredComponents: string[], minDistinctFingerprints: number }
}

export interface CompositionEvaluationResult {
  caseId: string
  candidates: Array<{
    candidateId: string
    fingerprint: string
    budget: { density: number, cost: number }
    screenshot: { path: string, status: 'captured' | 'reviewed' | 'failed' }
  }>
}

export type CompositionProfile = 'stage' | 'thumbnail' | 'export'
export type CompositionDiagnosisStatus = 'fit' | 'compress' | 'split' | 'fallback' | 'reject'
export interface CompositionDiagnosis {
  status: CompositionDiagnosisStatus
  reasons: string[]
  profile: CompositionProfile
  density: number
  cost: number
  rendered: false
}
