import { generatedLucideIcons } from './generated-icons.ts'
import { generatedLineMdIcons } from './generated-line-md-icons.ts'
import { motionReadyVisualById } from './motion.ts'

export type VisualAssetKind = 'icon' | 'annotation' | 'illustration' | 'companion' | 'logo'
export type VisualAssetStatus = 'candidate' | 'production'
export type VisualTreatment = 'outline' | 'solid' | 'duotone' | 'one-bit-pixel'
export type VisualBehavior = 'none' | 'enter' | 'exit' | 'loop' | 'emphasis' | 'draw' | 'focus' | 'land' | 'rise' | 'pulse' | 'replace' | 'accumulate' | 'lock'

export interface VisualAssetDefinition {
  id: string
  kind: VisualAssetKind
  status: VisualAssetStatus
  label: string
  purposes: string[]
  aliases: string[]
  applicable: string[]
  forbidden: string[]
  geometry: {
    source: string
    viewBox: string
    aspectRatio: number
    complexity: number
  }
  treatments: VisualTreatment[]
  tokenRoles: string[]
  behaviors: VisualBehavior[]
  states: string[]
  provenance: {
    origin: string
    sourceUrl: string
    version: string
    license: string
    attribution?: string
    guidelines?: string
    trademark?: string
  }
  poster: { state: string, timeMs: number }
  reducedMotion: 'poster' | 'static' | 'short-transition'
  fidelity: { html: 'svg' | 'canvas' | 'raster', pptx: 'svg' | 'shapes' | 'raster' | 'unsupported' }
  family?: string
  motionParts?: string[]
  qualityTier?: 'core' | 'production' | 'hero'
}

export interface VisualCatalogIssue { code: string, path: string, message: string }
export interface VisualAssetMatch { asset: VisualAssetDefinition, score: number, matchedTerms: string[] }

export const iconGeometryById: Readonly<Record<string, { viewBox: string, body: string }>> = Object.freeze(Object.fromEntries(
  generatedLucideIcons.map(icon => [`icon:lucide-${icon.name}`, Object.freeze({ viewBox: icon.viewBox, body: icon.body })]),
))

export const visualGeometryById: Readonly<Record<string, { viewBox: string, body: string, partAddressed?: boolean }>> = Object.freeze({
  ...iconGeometryById,
  ...Object.fromEntries(generatedLineMdIcons.map(icon => [`icon:line-md-${icon.name}`, Object.freeze({ viewBox: icon.viewBox, body: icon.body })])),
})

export function visualGeometryFor(assetId: string) {
  return visualGeometryById[assetId]
}

const lucideVisualAssets: readonly VisualAssetDefinition[] = generatedLucideIcons.map(icon => {
  const motion = motionReadyVisualById[`icon:lucide-${icon.name}`]
  return Object.freeze({
  id: `icon:lucide-${icon.name}`,
  kind: 'icon' as const,
  status: 'production' as const,
  label: icon.label,
  purposes: [icon.groupLabel, icon.group],
  aliases: [...icon.aliases],
  applicable: ['content-card', 'process-node', 'section-marker', 'supporting-visual'],
  forbidden: ['brand-logo', 'unrelated-decoration'],
  geometry: {
    source: `lucide-static/icons/${icon.name}.svg`,
    viewBox: icon.viewBox,
    aspectRatio: aspectRatio(icon.viewBox),
    complexity: geometryComplexity(icon.body),
  },
  treatments: ['outline', 'one-bit-pixel'] as VisualTreatment[],
  tokenRoles: ['ink', 'paper', 'accent'],
  behaviors: ['none', ...(motion ? [motion.verb] : [])] as VisualBehavior[],
  states: ['default'],
  provenance: {
    origin: 'Lucide',
    sourceUrl: 'https://github.com/lucide-icons/lucide',
    version: '1.31.0',
    license: 'ISC',
    attribution: 'Lucide contributors',
  },
  poster: { state: 'default', timeMs: 0 },
  reducedMotion: 'poster' as const,
  fidelity: { html: 'svg' as const, pptx: 'svg' as const },
  family: `lucide:${icon.group}`,
  })
})

const lineMdVisualAssets: readonly VisualAssetDefinition[] = generatedLineMdIcons.map(icon => Object.freeze({
  id: `icon:line-md-${icon.name}`,
  kind: 'icon' as const,
  status: 'production' as const,
  label: icon.label,
  purposes: ['animated icon', icon.mode, ...icon.aliases],
  aliases: [...icon.aliases, 'line md'],
  applicable: ['supporting-visual', 'section-marker', 'process-node', icon.mode === 'loop' ? 'ambient-status' : 'entrance'],
  forbidden: ['unrelated-decoration'],
  geometry: { source: `@iconify-json/line-md:${icon.name}`, viewBox: icon.viewBox, aspectRatio: aspectRatio(icon.viewBox), complexity: geometryComplexity(icon.body) },
  treatments: [icon.name.includes('filled') ? 'solid' : 'outline', 'one-bit-pixel'] as VisualTreatment[],
  tokenRoles: ['ink', 'paper'],
  behaviors: ['none', ...(icon.animated ? [icon.mode] : [])] as VisualBehavior[],
  states: ['default'],
  provenance: {
    origin: 'Line MD / Iconify JSON',
    sourceUrl: 'https://github.com/cyberalien/line-md',
    version: '1.2.16',
    license: 'MIT',
    attribution: 'Material Line Icons by Vjacheslav Trushkin',
  },
  poster: { state: 'default', timeMs: icon.posterTimeMs },
  reducedMotion: 'poster' as const,
  fidelity: { html: 'svg' as const, pptx: 'svg' as const },
  family: 'line-md:animated',
  qualityTier: icon.qualityTier,
}))

export const visualAssetCatalog: readonly VisualAssetDefinition[] = Object.freeze([...lucideVisualAssets, ...lineMdVisualAssets])

export const productionVisualAssets: readonly VisualAssetDefinition[] = Object.freeze(visualAssetCatalog.filter(asset => asset.status === 'production'))

export const visualAssetById: Readonly<Record<string, VisualAssetDefinition>> = Object.freeze(Object.fromEntries(
  productionVisualAssets.map(asset => [asset.id, asset]),
))

export function queryVisualAssets(
  assets: readonly VisualAssetDefinition[],
  input: { intent?: string, kind?: VisualAssetKind, treatment?: VisualTreatment, behavior?: VisualBehavior, avoidIds?: readonly string[], avoidFamilies?: readonly string[] },
) {
  return rankVisualAssets(assets, input).map(result => result.asset)
}

export function rankVisualAssets(
  assets: readonly VisualAssetDefinition[],
  input: { intent?: string, kind?: VisualAssetKind, treatment?: VisualTreatment, behavior?: VisualBehavior, avoidIds?: readonly string[], avoidFamilies?: readonly string[] },
): VisualAssetMatch[] {
  const terms = tokenize(input.intent ?? '')
  const avoidedIds = new Set(input.avoidIds ?? [])
  const avoidedFamilies = new Set(input.avoidFamilies ?? [])
  return assets
    .filter(asset => asset.status === 'production')
    .filter(asset => !input.kind || asset.kind === input.kind)
    .filter(asset => !input.treatment || asset.treatments.includes(input.treatment))
    .filter(asset => !input.behavior || asset.behaviors.includes(input.behavior))
    .filter(asset => !avoidedIds.has(asset.id))
    .map(asset => {
      const match = scoreAsset(asset, terms)
      return { asset, score: match.score - (asset.family && avoidedFamilies.has(asset.family) ? 3 : 0), matchedTerms: match.matchedTerms }
    })
    .filter(result => !terms.length || result.score > 0)
    .sort((left, right) => right.score - left.score || left.asset.id.localeCompare(right.asset.id))
}

export function qualifyVisualAssetCatalog(assets: readonly VisualAssetDefinition[]): VisualCatalogIssue[] {
  const issues: VisualCatalogIssue[] = []
  const ids = new Set<string>()
  for (const [index, asset] of assets.entries()) {
    const path = `$[${index}]`
    if (!/^(?:icon|annotation|illustration|companion|logo):[a-z0-9][a-z0-9-]*$/.test(asset.id)) {
      issues.push({ code: 'visual.id', path: `${path}.id`, message: 'asset ID must use a supported kind prefix and kebab-case name' })
    }
    if (ids.has(asset.id)) issues.push({ code: 'visual.duplicate-id', path: `${path}.id`, message: `duplicate visual asset ID: ${asset.id}` })
    ids.add(asset.id)
    if (asset.status === 'production' && !completeProvenance(asset.provenance)) {
      issues.push({ code: 'visual.provenance', path: `${path}.provenance`, message: 'production asset requires origin, source URL, version and license' })
    }
    if (!asset.label.trim() || !asset.purposes.length) issues.push({ code: 'visual.semantics', path, message: 'asset requires a label and at least one purpose' })
    if (!asset.treatments.length || !asset.tokenRoles.length) issues.push({ code: 'visual.treatment', path, message: 'asset requires treatments and token roles' })
    if (!asset.states.includes(asset.poster.state)) issues.push({ code: 'visual.poster', path: `${path}.poster`, message: 'poster state must be declared by the asset' })
  }
  return issues
}

export function validateSvgGeometry(svg: string): VisualCatalogIssue[] {
  const checks: Array<[RegExp, string]> = [
    [/<script\b/i, 'script elements are forbidden'],
    [/\son[a-z]+\s*=/i, 'event attributes are forbidden'],
    [/<foreignObject\b/i, 'foreignObject is forbidden'],
    [/<(?:iframe|audio|video)\b/i, 'embedded executable media is forbidden'],
    [/<image\b/i, 'raster image elements are forbidden'],
    [/\b(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:)/i, 'external and data references are forbidden'],
  ]
  return checks.flatMap(([pattern, message]) => pattern.test(svg) ? [{ code: 'visual.svg-unsafe', path: '$', message }] : [])
}

function completeProvenance(provenance: VisualAssetDefinition['provenance']) {
  return Boolean(provenance.origin.trim() && provenance.sourceUrl.trim() && provenance.version.trim() && provenance.license.trim())
}

function scoreAsset(asset: VisualAssetDefinition, terms: string[]) {
  const fields = [asset.id, asset.label, ...asset.purposes, ...asset.aliases].map(value => value.toLowerCase())
  const matchedTerms: string[] = []
  const score = terms.reduce((total, term) => {
    const termScore = fields.reduce((best, field, index) => {
      if (field === term) return Math.max(best, index < 2 ? 8 : 5)
      if (field.includes(term) || term.includes(field)) return Math.max(best, index < 2 ? 4 : 2)
      return best
    }, 0)
    if (termScore) matchedTerms.push(term)
    return total + termScore
  }, 0)
  return { score, matchedTerms }
}

function tokenize(value: string) {
  const normalized = value.toLowerCase()
  const terms = normalized.split(/[\s，、/：:；;（）()]+/).map(term => term.trim()).filter(Boolean)
  for (const [phrase, aliases] of Object.entries(semanticTermAliases)) {
    if (normalized.includes(phrase)) terms.push(phrase, ...aliases)
  }
  return [...new Set(terms)]
}

const semanticTermAliases: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'ai': ['intelligence', 'brain', 'bot'], '人工智能': ['ai', 'intelligence', 'brain', 'bot'], '智能': ['ai', 'brain', 'bot'],
  '增长': ['growth', 'trending', 'up'], '趋势': ['trend', 'trending'], '下降': ['down', 'decline'], '数据': ['data', 'analytics', 'chart'],
  '搜索': ['search'], '发现': ['discover', 'search'], '筛选': ['filter'],
  '流程': ['process', 'workflow', 'route'], '编排': ['workflow', 'orchestration'], '同步': ['refresh', 'sync'],
  '创建': ['create', 'plus'], '新增': ['add', 'plus'], '编辑': ['edit', 'pencil'],
  '成功': ['success', 'check', 'confirm'], '完成': ['complete', 'check', 'confirm'], '警告': ['warning', 'alert'], '风险': ['risk', 'alert', 'shield'],
  '安全': ['security', 'shield', 'lock'], '隐私': ['privacy', 'lock'],
  '团队': ['team', 'users'], '协作': ['collaboration', 'users', 'message'], '沟通': ['communication', 'message'],
  '文档': ['document', 'file'], '知识': ['knowledge', 'book'], '云': ['cloud'], '上传': ['upload'], '下载': ['download'],
  '时间': ['time', 'clock'], '计划': ['plan', 'calendar'], '方向': ['direction', 'arrow'], '变化': ['change', 'move'],
})

function aspectRatio(viewBox: string) {
  const values = viewBox.trim().split(/[\s,]+/).map(Number)
  return values.length === 4 && values.every(Number.isFinite) && values[3] > 0 ? values[2] / values[3] : 1
}

function geometryComplexity(body: string) {
  return Math.max(1, body.match(/<(?:path|circle|rect|line|polyline|polygon|ellipse)\b/g)?.length ?? 1)
}
