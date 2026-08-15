import { visualAssetById } from '../visual-assets/catalog.ts'
import type {
  ComponentQualificationFixtures,
  CompositionEvaluationCase,
  CompositionEvaluationResult,
  CompositionFixture,
  CompositionIssue,
  CompositionNode,
  ProductionComponentCategory,
  ProductionComponentDefinition,
  ProductionComponentManifestEntry,
} from './component-contract.ts'

export type {
  ComponentPropDefinition,
  ComponentQualificationFixtures,
  CompositionDiagnosis,
  CompositionDiagnosisStatus,
  CompositionEvaluationCase,
  CompositionEvaluationResult,
  CompositionFixture,
  CompositionIssue,
  CompositionNode,
  CompositionProfile,
  ProductionComponentCategory,
  ProductionComponentDefinition,
  ProductionComponentManifestEntry,
} from './component-contract.ts'

const childCategories: ProductionComponentCategory[] = ['layout', 'content', 'relationship']
const visualCategories: ProductionComponentCategory[] = ['layout', 'content']
const gapAxis = ['compact', 'normal', 'open']
const densityAxis = ['compact', 'normal', 'open']
const emphasisAxis = ['quiet', 'normal', 'strong']
const alignmentAxis = ['start', 'center', 'end', 'stretch']
const definition = (
  id: string,
  category: ProductionComponentCategory,
  label: string,
  purpose: string[],
  options: Partial<Pick<ProductionComponentDefinition, 'props' | 'slots' | 'children' | 'axes' | 'constraints' | 'tokenRoles' | 'fidelity'>> = {},
): ProductionComponentDefinition => ({
  id, version: 1, category, label, purpose,
  props: options.props ?? {}, slots: options.slots ?? {}, axes: options.axes ?? {},
  constraints: options.constraints ?? { minWidth: 12, minHeight: 8, maxText: 320 },
  tokenRoles: options.tokenRoles ?? ['ink', 'paper', 'accent', 'space'],
  fidelity: options.fidelity ?? { html: 'native', pptx: 'shapes' },
  ...(options.children ? { children: options.children } : {}),
})

const rawDefinitions: ProductionComponentDefinition[] = [
  definition('stack', 'layout', 'Stack', ['纵向堆叠', '垂直节奏', '内容序列'], { children: { min: 1, max: 12, categories: childCategories }, axes: { direction: ['vertical', 'horizontal'], alignment: alignmentAxis, gap: gapAxis, density: densityAxis, emphasis: emphasisAxis } }),
  definition('cluster', 'layout', 'Cluster', ['横向聚合', '标签组', '同级短项'], { children: { min: 1, max: 12, categories: childCategories }, axes: { direction: ['horizontal', 'vertical'], alignment: alignmentAxis, distribution: ['start', 'center', 'end', 'between'], wrap: ['nowrap', 'wrap'], gap: gapAxis, density: densityAxis } }),
  definition('grid', 'layout', 'Grid', ['网格', '平级集合', '多列'], { children: { min: 1, max: 12, categories: childCategories }, axes: { columns: ['2', '3', '4', 'auto'], alignment: alignmentAxis, gap: gapAxis, density: densityAxis } }),
  definition('split', 'layout', 'Split', ['左右主次分栏', '上下分区', '双区布局'], { slots: { primary: { min: 1, max: 1, categories: visualCategories }, secondary: { min: 1, max: 1, categories: visualCategories } }, axes: { direction: ['horizontal', 'vertical'], ratio: ['1:1', '2:1', '1:2'], order: ['primary-first', 'secondary-first'], alignment: alignmentAxis, gap: gapAxis, emphasis: emphasisAxis } }),
  definition('inset', 'layout', 'Inset', ['画中画', '局部强调', '嵌入证据'], { slots: { base: { min: 1, max: 1, categories: visualCategories }, inset: { min: 1, max: 1, categories: ['content'] } }, axes: { position: ['top-left', 'top-right', 'bottom-left', 'bottom-right'], span: ['small', 'medium', 'large'], gap: gapAxis, emphasis: emphasisAxis } }),
  definition('overlay', 'layout', 'Overlay', ['叠加', '媒体叠字', '前后层'], { slots: { base: { min: 1, max: 1, categories: ['content'] }, overlay: { min: 1, max: 1, categories: visualCategories } }, axes: { position: ['top', 'center', 'bottom'], alignment: alignmentAxis, gap: gapAxis, emphasis: emphasisAxis } }),
  definition('heading', 'content', 'Heading', ['页面标题', '主张', '章节标题'], { props: { text: { type: 'string', required: true, maxLength: 120 }, eyebrow: { type: 'string', maxLength: 40 } }, axes: { alignment: alignmentAxis, emphasis: emphasisAxis, span: ['display', 'title', 'section'] } }),
  definition('copy', 'content', 'Copy', ['正文', '解释', '短段落'], { props: { text: { type: 'string', required: true, maxLength: 700 } }, axes: { alignment: alignmentAxis, density: densityAxis, emphasis: emphasisAxis } }),
  definition('metric', 'content', 'Metric', ['关键指标', '数值', '经营结果'], { props: { label: { type: 'string', required: true, maxLength: 50 }, value: { type: 'scalar', required: true }, trend: { type: 'string', maxLength: 30 }, source: { type: 'string', maxLength: 80 } }, axes: { alignment: alignmentAxis, density: densityAxis, emphasis: emphasisAxis } }),
  definition('list', 'content', 'List', ['清单', '证据列表', '有序条目'], { props: { items: { type: 'string-array', required: true, maxItems: 12, maxLength: 160 }, ordered: { type: 'boolean' } }, axes: { direction: ['vertical', 'horizontal'], density: densityAxis, emphasis: emphasisAxis } }),
  definition('card', 'content', 'Card', ['内容卡片', '单项说明', '表面强调'], { props: { title: { type: 'string', required: true, maxLength: 80 }, body: { type: 'string', maxLength: 260 }, meta: { type: 'string', maxLength: 40 } }, axes: { alignment: alignmentAxis, density: densityAxis, emphasis: emphasisAxis, span: ['1', '2', 'full'] } }),
  definition('quote', 'content', 'Quote', ['引语', '原话', '引用'], { props: { text: { type: 'string', required: true, maxLength: 420 }, author: { type: 'string', maxLength: 80 }, source: { type: 'string', maxLength: 120 } }, axes: { alignment: alignmentAxis, emphasis: emphasisAxis } }),
  definition('media', 'content', 'Media', ['图片', '媒体', '视觉证据'], { props: { src: { type: 'string', required: true, maxLength: 500 }, alt: { type: 'string', required: true, maxLength: 180 }, caption: { type: 'string', maxLength: 180 } }, axes: { alignment: alignmentAxis, emphasis: emphasisAxis, span: ['contain', 'cover', 'bleed'], kind: ['photo', 'product', 'illustration', 'screenshot', 'diagram'], treatment: ['one-bit', 'tonal'] } }),
  definition('code', 'content', 'Code', ['命令行证据', '代码片段', '可执行契约'], { props: { language: { type: 'string', required: true, maxLength: 40 }, code: { type: 'string', required: true, maxLength: 1200 }, highlightLines: { type: 'string', maxLength: 80 }, caption: { type: 'string', maxLength: 180 } }, axes: { density: densityAxis, emphasis: emphasisAxis }, constraints: { minWidth: 24, minHeight: 18, maxText: 1200 } }),
  definition('visual', 'content', 'Visual', ['图标', '插画', '批注', '角色视觉'], {
    props: { asset: { type: 'string', required: true, maxLength: 160 }, alt: { type: 'string', required: true, maxLength: 180 }, caption: { type: 'string', maxLength: 180 } },
    axes: {
      role: ['icon', 'annotation', 'illustration', 'companion'],
      prominence: ['inline', 'support', 'hero'],
      treatment: ['outline', 'solid', 'duotone', 'one-bit-pixel'],
      state: ['default', 'start', 'end', 'idle', 'thinking', 'discover', 'explain', 'success', 'warning'],
      behavior: ['none', 'enter', 'exit', 'loop', 'emphasis', 'draw', 'focus', 'land', 'rise', 'pulse', 'replace', 'accumulate', 'lock'],
    },
    constraints: { minWidth: 10, minHeight: 10, maxText: 180 },
    fidelity: { html: 'native', pptx: 'shapes' },
  }),
  definition('profile', 'content', 'Profile', ['人物', '团队成员', '角色介绍'], { props: { name: { type: 'string', required: true, maxLength: 80 }, role: { type: 'string', maxLength: 80 }, bio: { type: 'string', maxLength: 260 }, avatar: { type: 'string', maxLength: 500 } }, axes: { alignment: alignmentAxis, density: densityAxis, emphasis: emphasisAxis } }),
  definition('logo', 'content', 'Logo', ['品牌', '组织标识', '合作伙伴'], { props: { name: { type: 'string', required: true, maxLength: 80 }, src: { type: 'string', maxLength: 500 }, alt: { type: 'string', maxLength: 180 } }, axes: { alignment: alignmentAxis, emphasis: emphasisAxis, span: ['small', 'medium', 'large'] } }),
  definition('caption', 'content', 'Caption', ['来源说明', '图注', '脚注'], { props: { text: { type: 'string', required: true, maxLength: 180 }, source: { type: 'string', maxLength: 180 } }, axes: { alignment: alignmentAxis, density: densityAxis, emphasis: emphasisAxis } }),
  definition('divider', 'relationship', 'Divider', ['分隔', '章节边界', '区域关系'], { props: { label: { type: 'string', maxLength: 80 } }, axes: { direction: ['horizontal', 'vertical'], emphasis: emphasisAxis } }),
  definition('connector', 'relationship', 'Connector', ['连接', '方向关系', '节点关系'], { props: { from: { type: 'string', required: true, maxLength: 80 }, to: { type: 'string', required: true, maxLength: 80 }, label: { type: 'string', maxLength: 80 } }, axes: { direction: ['forward', 'reverse', 'bidirectional'], emphasis: emphasisAxis } }),
  definition('progress', 'relationship', 'Progress', ['进度', '目标完成度', '状态'], { props: { value: { type: 'number', required: true, min: 0, max: 100 }, label: { type: 'string', maxLength: 80 }, target: { type: 'string', maxLength: 80 } }, axes: { direction: ['horizontal', 'vertical'], density: densityAxis, emphasis: emphasisAxis } }),
]

export const productionComponentQualificationFixtures: Readonly<Record<string, ComponentQualificationFixtures>> = Object.freeze(Object.fromEntries(
  rawDefinitions.map(item => [item.id, makeQualificationFixtures(item)]),
))

export function registerProductionComponents(definitions: readonly ProductionComponentDefinition[], qualifications?: Readonly<Record<string, ComponentQualificationFixtures>>) {
  const keys = new Set<string>()
  for (const item of definitions) {
    const key = `${item.id}@${item.version}`
    if (keys.has(key)) throw new Error(`Production component registry conflict: ${key}`)
    keys.add(key)
  }
  for (const item of definitions) {
    const key = `${item.id}@${item.version}`
    const fixtures = qualifications?.[item.id]
    if (!fixtures) throw new Error(`Production component qualification missing: ${key}`)
    const signatures = new Set(fixtures.compositions.flatMap(fixture => [...componentUsageSignatures(fixture.tree, item.id)]))
    if (signatures.size < 3) throw new Error(`Production component qualification requires three compositions: ${key}`)
  }
  return Object.freeze([...definitions])
}

export const productionComponentDefinitions = registerProductionComponents(rawDefinitions, productionComponentQualificationFixtures)
export const productionComponentManifest: readonly ProductionComponentManifestEntry[] = Object.freeze(productionComponentDefinitions.map(item => Object.freeze(structuredClone(item))))

const productionIds = new Set(productionComponentManifest.map(component => component.id))
const forbiddenFields = new Set(['style', 'className', 'css', 'script', 'renderer', 'onClick', 'fontFamily', 'color', 'boxShadow', 'borderRadius', 'transform'])
const allowedNodeFields = new Set(['nodeId', 'component', 'version', 'props', 'axes', 'children', 'slots'])

const cadenzaAxisTokens: Record<string, Record<string, string>> = {
  gap: { compact: 'space-2', normal: 'space-4', open: 'space-8' },
  density: { compact: 'density-compact', normal: 'density-normal', open: 'density-open' },
  emphasis: { quiet: 'surface-none', normal: 'surface-paper', strong: 'surface-ink' },
}

export function resolveCadenzaAxisToken(axis: string, value: string) { return cadenzaAxisTokens[axis]?.[value] }

export function queryProductionComponents(input: { intent?: string, category?: ProductionComponentCategory, parent?: string, slot?: string }) {
  let allowedCategories: readonly ProductionComponentCategory[] | undefined
  if (input.parent || input.slot) {
    const parent = productionComponentDefinitions.find(item => item.id === input.parent)
    if (!parent) return { matches: [], diagnosis: `unknown parent component: ${input.parent ?? ''}` }
    const slot = input.slot ? parent.slots[input.slot] : undefined
    if (!slot) return { matches: [], diagnosis: `unknown slot ${input.slot ?? ''} for ${parent.id}` }
    allowedCategories = slot.categories
  }
  const words = input.intent?.toLowerCase().split(/[\s，、的与和]+/).filter(Boolean) ?? []
  const scored = productionComponentDefinitions
    .filter(item => (!input.category || item.category === input.category) && (!allowedCategories || allowedCategories.includes(item.category)))
    .map(item => ({ item, score: words.reduce((score, word) => score + [item.id, item.label, ...item.purpose].filter(value => value.toLowerCase().includes(word) || word.includes(value.toLowerCase())).length, 0) }))
    .filter(result => !words.length || result.score > 0)
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .map(result => result.item)
  return scored.length ? { matches: scored } : { matches: scored, diagnosis: `no matching production component for ${input.intent ?? 'query'}` }
}

export function validateCompositionTree(value: unknown): CompositionIssue[] {
  const issues: CompositionIssue[] = []
  const ids = new Set<string>()
  const connectors: Array<{ path: string, from?: string, to?: string }> = []
  let nodeCount = 0

  function visit(node: unknown, path: string, depth: number) {
    if (!isRecord(node)) { issues.push({ path, message: 'composition node must be an object' }); return }
    nodeCount++
    if (depth >= 5) { issues.push({ path, message: 'composition depth exceeds 5' }); return }

    for (const key of Object.keys(node)) if (!allowedNodeFields.has(key)) issues.push({ path: childPath(path, key), message: 'unknown composition node field' })

    const nodeId = node.nodeId
    if (typeof nodeId !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(nodeId)) issues.push({ path: childPath(path, 'nodeId'), message: 'node ID must be stable kebab-case' })
    else if (ids.has(nodeId)) issues.push({ path: childPath(path, 'nodeId'), message: 'node ID must be unique' })
    else ids.add(nodeId)

    const component = typeof node.component === 'string' ? node.component : ''
    const componentDefinition = productionComponentDefinitions.find(item => item.id === component && item.version === node.version)
    if (!productionIds.has(component) || !componentDefinition) issues.push({ path: childPath(path, 'component'), message: 'component is not registered' })
    if (node.version !== 1) issues.push({ path: childPath(path, 'version'), message: 'component version is not supported' })
    if (component === 'connector' && isRecord(node.props)) connectors.push({ path: childPath(path, 'props'), from: typeof node.props.from === 'string' ? node.props.from : undefined, to: typeof node.props.to === 'string' ? node.props.to : undefined })
    rejectUnsafe(node.props, childPath(path, 'props'), issues)
    rejectUnsafe(node.axes, childPath(path, 'axes'), issues)

    if (node.props !== undefined && !isRecord(node.props)) issues.push({ path: childPath(path, 'props'), message: 'props must be an object' })
    else if (componentDefinition) validateProps(isRecord(node.props) ? node.props : {}, componentDefinition, path, issues)
    if (node.axes !== undefined && !isRecord(node.axes)) issues.push({ path: childPath(path, 'axes'), message: 'axes must be an object' })
    else if (componentDefinition && isRecord(node.axes)) for (const [axis, value] of Object.entries(node.axes)) {
      if (forbiddenFields.has(axis)) continue
      const values = componentDefinition.axes[axis]
      if (!values) issues.push({ path: childPath(childPath(path, 'axes'), axis), message: `unknown axis for ${component}` })
      else if (typeof value !== 'string' || !values.includes(value)) issues.push({ path: childPath(childPath(path, 'axes'), axis), message: `invalid axis value for ${component}; expected ${humanList(values)}` })
    }
    if (component === 'visual' && componentDefinition) validateVisualNode(node, path, issues)

    if (node.children !== undefined) {
      if (!componentDefinition?.children) issues.push({ path: childPath(path, 'children'), message: `${component || 'component'} does not accept children` })
      if (!Array.isArray(node.children)) issues.push({ path: childPath(path, 'children'), message: 'children must be an array' })
      else {
        if (componentDefinition?.children && !within(node.children.length, componentDefinition.children)) issues.push({ path: childPath(path, 'children'), message: `${component} requires ${componentDefinition.children.min}–${componentDefinition.children.max} children` })
        node.children.forEach((child, index) => {
          validateChildCategory(child, componentDefinition?.children?.categories, indexedPath(path, 'children', index), component, 'children', issues)
          visit(child, indexedPath(path, 'children', index), depth + 1)
        })
      }
    } else if (componentDefinition?.children && componentDefinition.children.min > 0) {
      issues.push({ path: childPath(path, 'children'), message: `${component} requires ${componentDefinition.children.min}–${componentDefinition.children.max} children` })
    }

    if (node.slots !== undefined) {
      if (!isRecord(node.slots)) issues.push({ path: childPath(path, 'slots'), message: 'slots must be an object' })
      else for (const [slot, children] of Object.entries(node.slots)) {
        const slotPath = childPath(childPath(path, 'slots'), slot)
        const slotDefinition = componentDefinition?.slots[slot]
        if (!slotDefinition) issues.push({ path: slotPath, message: `${component || 'component'} does not accept this slot` })
        if (!Array.isArray(children)) issues.push({ path: slotPath, message: 'slot must contain an array' })
        else {
          if (slotDefinition && !within(children.length, slotDefinition)) issues.push({ path: slotPath, message: `${component}.${slot} requires ${slotDefinition.min}–${slotDefinition.max} children` })
          children.forEach((child, index) => {
            validateChildCategory(child, slotDefinition?.categories, `${slotPath}[${index}]`, component, slot, issues)
            visit(child, `${slotPath}[${index}]`, depth + 1)
          })
        }
      }
    }
    if (componentDefinition) for (const [slot, slotDefinition] of Object.entries(componentDefinition.slots)) {
      const children = isRecord(node.slots) ? node.slots[slot] : undefined
      if (!Array.isArray(children) && slotDefinition.min > 0) issues.push({ path: childPath(childPath(path, 'slots'), slot), message: `${component}.${slot} requires ${slotDefinition.min}–${slotDefinition.max} children` })
    }
  }

  visit(value, '$', 0)
  const edges = new Set<string>()
  for (const connector of connectors) {
    if (connector.from && connector.to && connector.from === connector.to) issues.push({ path: childPath(connector.path, 'to'), message: 'connector endpoints must be distinct' })
    for (const endpoint of ['from', 'to'] as const) if (connector[endpoint] && !ids.has(connector[endpoint]!)) issues.push({ path: childPath(connector.path, endpoint), message: 'connector endpoint does not exist in this composition' })
    if (connector.from && connector.to) {
      const edge = `${connector.from}\u0000${connector.to}`
      if (edges.has(edge)) issues.push({ path: connector.path, message: 'duplicate connector edge is not allowed' })
      else edges.add(edge)
    }
  }
  if (nodeCount > 32) issues.push({ path: '$', message: 'composition node count exceeds 32' })
  return issues
}

export function validateCompositionFixtures(fixtures: readonly CompositionFixture[]): CompositionIssue[] {
  const issues: CompositionIssue[] = []
  const ids = new Set<string>()
  fixtures.forEach((fixture, index) => {
    if (!fixture.id || ids.has(fixture.id)) issues.push({ path: `[${index}].id`, message: 'fixture ID must be unique' })
    else ids.add(fixture.id)
    for (const issue of validateCompositionTree(fixture.tree)) {
      issues.push({ path: issue.path === '$' ? `[${index}].tree` : `[${index}].tree.${issue.path}`, message: issue.message })
    }
  })
  return issues
}

export function validateEvaluationCase(value: CompositionEvaluationCase): CompositionIssue[] {
  const issues: CompositionIssue[] = []
  requireItems(value.requiredFacts, 'requiredFacts', 'at least one required fact is required', issues)
  requireItems(value.signals, 'signals', 'at least one structure signal is required', issues)
  requireItems(value.forbiddenInferences, 'forbiddenInferences', 'at least one forbidden inference is required', issues)
  requireItems(value.acceptable.rootComponents, 'acceptable.rootComponents', 'at least one root component is required', issues)
  if (!Number.isInteger(value.acceptable.minDistinctFingerprints) || value.acceptable.minDistinctFingerprints < 1) issues.push({ path: 'acceptable.minDistinctFingerprints', message: 'must be a positive integer' })
  return issues
}

export function validateEvaluationResult(value: CompositionEvaluationResult): CompositionIssue[] {
  const issues: CompositionIssue[] = []
  if (!value.caseId) issues.push({ path: 'caseId', message: 'case ID is required' })
  if (!value.candidates.length) issues.push({ path: 'candidates', message: 'at least one measured candidate is required' })
  value.candidates.forEach((candidate, index) => {
    const path = `candidates[${index}]`
    if (!candidate.fingerprint) issues.push({ path: `${path}.fingerprint`, message: 'fingerprint is required' })
    for (const key of ['density', 'cost'] as const) if (!Number.isFinite(candidate.budget[key]) || candidate.budget[key] < 0) issues.push({ path: `${path}.budget.${key}`, message: 'budget measurement must be a non-negative finite number' })
    if (!candidate.screenshot.path) issues.push({ path: `${path}.screenshot.path`, message: 'screenshot evidence path is required' })
    if (!['reviewed', 'failed'].includes(candidate.screenshot.status)) issues.push({ path: `${path}.screenshot.status`, message: 'screenshot must be reviewed or failed' })
  })
  return issues
}

export function validateComponentQualification(definition: ProductionComponentDefinition, fixtures?: ComponentQualificationFixtures): CompositionIssue[] {
  const issues: CompositionIssue[] = []
  if (!definition.id || !/^[a-z][a-z0-9-]*$/.test(definition.id)) issues.push({ path: 'id', message: 'stable component ID is required' })
  if (!definition.purpose.length) issues.push({ path: 'purpose', message: 'at least one purpose is required' })
  if (!isRecord(definition.props)) issues.push({ path: 'props', message: 'props schema is required' })
  if (!definition.slots || !definition.axes) issues.push({ path: 'slots', message: 'slots and axes schema are required' })
  for (const [key, value] of Object.entries(definition.constraints)) if (!Number.isFinite(value) || value <= 0) issues.push({ path: `constraints.${key}`, message: 'constraint must be a positive finite number' })
  if (!definition.tokenRoles.length) issues.push({ path: 'tokenRoles', message: 'at least one Cadenza token role is required' })
  if (definition.fidelity.html !== 'native' || !definition.fidelity.pptx) issues.push({ path: 'fidelity', message: 'HTML and PPTX fidelity declarations are required' })
  if (!fixtures) { issues.push({ path: 'fixtures', message: 'minimal, boundary, fallback, and composition fixtures are required' }); return issues }

  for (const key of ['minimal', 'boundary', 'fallback'] as const) {
    for (const issue of validateCompositionTree(fixtures[key])) issues.push({ path: `fixtures.${key}.${issue.path === '$' ? '' : issue.path}`.replace(/\.$/, ''), message: issue.message })
    if (!componentUsageSignatures(fixtures[key], definition.id).size) issues.push({ path: `fixtures.${key}`, message: `fixture must use ${definition.id}` })
  }
  issues.push(...validateCompositionFixtures(fixtures.compositions).map(issue => ({ ...issue, path: `fixtures.compositions${issue.path}` })))
  const signatures = new Set(fixtures.compositions.flatMap(fixture => [...componentUsageSignatures(fixture.tree, definition.id)]))
  if (signatures.size < 3) issues.push({ path: 'fixtures.compositions', message: 'component requires three structurally distinct composition usages' })
  return issues
}

function rejectUnsafe(value: unknown, path: string, issues: CompositionIssue[]) {
  if (Array.isArray(value)) { value.forEach((item, index) => rejectUnsafe(item, `${path}[${index}]`, issues)); return }
  if (!isRecord(value)) return
  for (const [key, child] of Object.entries(value)) {
    const fieldPath = childPath(path, key)
    if (forbiddenFields.has(key)) issues.push({ path: fieldPath, message: 'visual or executable fields are not allowed' })
    else rejectUnsafe(child, fieldPath, issues)
  }
}

function validateProps(props: Record<string, unknown>, definition: ProductionComponentDefinition, path: string, issues: CompositionIssue[]) {
  const propsPath = childPath(path, 'props')
  for (const key of Object.keys(props)) {
    if (!forbiddenFields.has(key) && !(key in definition.props)) issues.push({ path: childPath(propsPath, key), message: `unknown prop for ${definition.id}` })
  }
  for (const [key, schema] of Object.entries(definition.props)) {
    const value = props[key]
    const valuePath = childPath(propsPath, key)
    if (value === undefined || value === null || (schema.type === 'string' && value === '')) {
      if (schema.required) issues.push({ path: valuePath, message: 'required prop is missing' })
      continue
    }
    if (schema.type === 'string' && typeof value !== 'string') issues.push({ path: valuePath, message: 'expected a string' })
    else if (schema.type === 'scalar' && !(typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)))) issues.push({ path: valuePath, message: 'expected a string or finite number' })
    else if (schema.type === 'boolean' && typeof value !== 'boolean') issues.push({ path: valuePath, message: 'expected a boolean' })
    else if (schema.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) issues.push({ path: valuePath, message: 'expected a finite number' })
    else if (schema.type === 'string-array' && (!Array.isArray(value) || value.some(item => typeof item !== 'string'))) issues.push({ path: valuePath, message: 'expected an array of strings' })
    else {
      if (typeof value === 'string' && schema.maxLength && value.length > schema.maxLength) issues.push({ path: valuePath, message: `must contain at most ${schema.maxLength} characters` })
      if (Array.isArray(value)) {
        if (schema.maxItems && value.length > schema.maxItems) issues.push({ path: valuePath, message: `must contain at most ${schema.maxItems} items` })
        const maxLength = schema.maxLength
        if (maxLength && value.some(item => typeof item === 'string' && item.length > maxLength)) issues.push({ path: valuePath, message: `items must contain at most ${maxLength} characters` })
      }
      if (typeof value === 'number' && schema.min !== undefined && value < schema.min) issues.push({ path: valuePath, message: `must be at least ${schema.min}` })
      if (typeof value === 'number' && schema.max !== undefined && value > schema.max) issues.push({ path: valuePath, message: `must be at most ${schema.max}` })
    }
  }
}

function validateVisualNode(node: Record<string, unknown>, path: string, issues: CompositionIssue[]) {
  const props = isRecord(node.props) ? node.props : {}
  const axes = isRecord(node.axes) ? node.axes : {}
  const asset = typeof props.asset === 'string' ? visualAssetById[props.asset] : undefined
  if (!asset) {
    if (typeof props.asset === 'string' && props.asset) issues.push({ path: childPath(childPath(path, 'props'), 'asset'), message: 'visual asset is not registered for production' })
    return
  }
  const role = typeof axes.role === 'string' ? axes.role : asset.kind
  if (role !== asset.kind) issues.push({ path: childPath(childPath(path, 'axes'), 'role'), message: `visual role does not match registered asset kind ${asset.kind}` })
  const treatment = typeof axes.treatment === 'string' ? axes.treatment : asset.treatments[0]
  if (!asset.treatments.includes(treatment as never)) issues.push({ path: childPath(childPath(path, 'axes'), 'treatment'), message: `visual treatment is not supported by ${asset.id}` })
  const state = typeof axes.state === 'string' ? axes.state : asset.poster.state
  if (!asset.states.includes(state)) issues.push({ path: childPath(childPath(path, 'axes'), 'state'), message: `visual state is not supported by ${asset.id}` })
  const behavior = typeof axes.behavior === 'string' ? axes.behavior : 'none'
  if (!asset.behaviors.includes(behavior as never)) issues.push({ path: childPath(childPath(path, 'axes'), 'behavior'), message: `visual behavior is not supported by ${asset.id}` })
}

function validateChildCategory(value: unknown, allowed: readonly ProductionComponentCategory[] | undefined, path: string, parent: string, slot: string, issues: CompositionIssue[]) {
  if (!isRecord(value) || typeof value.component !== 'string' || !allowed) return
  const child = productionComponentDefinitions.find(item => item.id === value.component)
  if (child && !allowed.includes(child.category)) issues.push({ path: childPath(path, 'component'), message: `${child.category} is not allowed in ${parent}.${slot}` })
}

function within(count: number, bounds: { min: number, max: number }) { return count >= bounds.min && count <= bounds.max }
function humanList(values: readonly string[]) { return values.length < 2 ? values.join('') : `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}` }

function requireItems(value: unknown[], path: string, message: string, issues: CompositionIssue[]) {
  if (!Array.isArray(value) || value.length === 0) issues.push({ path, message })
}

function componentUsageSignatures(tree: CompositionNode, componentId: string) {
  const signatures = new Set<string>()
  function visit(node: CompositionNode, relation: string) {
    if (node.component === componentId) signatures.add(relation)
    node.children?.forEach(child => visit(child, `${node.component}.children`))
    for (const [slot, children] of Object.entries(node.slots ?? {})) children.forEach(child => visit(child, `${node.component}.${slot}`))
  }
  visit(tree, '$')
  return signatures
}

function makeQualificationFixtures(definition: ProductionComponentDefinition): ComponentQualificationFixtures {
  return {
    minimal: makeUsageTree(definition, 'stack', `${definition.id}-minimal`, 'minimal'),
    boundary: makeUsageTree(definition, 'cluster', `${definition.id}-boundary`, 'boundary'),
    fallback: makeUsageTree(definition, 'grid', `${definition.id}-fallback`, 'fallback'),
    compositions: (['stack', 'cluster', 'grid'] as const).map(parent => ({
      id: `${definition.id}-in-${parent}`,
      tree: makeUsageTree(definition, parent, `${definition.id}-${parent}`, 'minimal'),
    })),
  }
}

function makeUsageTree(definition: ProductionComponentDefinition, parent: 'stack' | 'cluster' | 'grid', prefix: string, mode: 'minimal' | 'boundary' | 'fallback'): CompositionNode {
  const subject = makeFixtureNode(definition, `${prefix}-subject`, mode, prefix)
  const children = definition.id === 'connector'
    ? [fixtureCard(`${prefix}-source`), subject, fixtureCard(`${prefix}-target`)]
    : [subject]
  return { nodeId: `${prefix}-root`, component: parent, version: 1, children }
}

function makeFixtureNode(definition: ProductionComponentDefinition, nodeId: string, mode: 'minimal' | 'boundary' | 'fallback', prefix: string): CompositionNode {
  const axes = definition.id === 'visual' ? { role: 'icon', prominence: 'support', treatment: 'one-bit-pixel', state: 'default', behavior: 'loop' } : Object.fromEntries(Object.entries(definition.axes).flatMap(([axis, values]) => {
    if (mode === 'minimal') return []
    const preferred = mode === 'fallback'
      ? ['compact', 'quiet', 'normal'].find(value => values.includes(value))
      : values.at(-1)
    return preferred ? [[axis, preferred]] : []
  }))
  const props = makeFixtureProps(definition, mode)
  if (definition.id === 'connector') Object.assign(props, { from: `${prefix}-source`, to: `${prefix}-target` })
  const node: CompositionNode = {
    nodeId, component: definition.id, version: 1,
    ...(Object.keys(props).length ? { props } : {}),
    ...(Object.keys(axes).length ? { axes } : {}),
  }
  if (definition.children) {
    const count = mode === 'boundary' ? definition.children.max : definition.children.min
    node.children = Array.from({ length: count }, (_, index) => fixtureHeading(`${nodeId}-child-${index}`))
  }
  if (Object.keys(definition.slots).length) {
    node.slots = Object.fromEntries(Object.entries(definition.slots).map(([slot, slotDefinition]) => [slot, Array.from({ length: slotDefinition.min }, (_, index) => {
      const childId = `${nodeId}-${slot}-${index}`
      if (definition.id === 'inset' || definition.id === 'overlay') return slot === 'base' ? fixtureMedia(childId) : fixtureHeading(childId)
      return slot === 'primary' ? fixtureHeading(childId) : fixtureCopy(childId)
    })]))
  }
  return node
}

function makeFixtureProps(definition: ProductionComponentDefinition, mode: 'minimal' | 'boundary' | 'fallback') {
  if (definition.id === 'visual') return { asset: 'icon:line-md-bell-loop', alt: 'Ringing bell loop' }
  const props: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(definition.props)) {
    if (!schema.required && mode !== 'boundary') continue
    if (schema.type === 'boolean') { props[key] = true; continue }
    if (schema.type === 'number') { props[key] = mode === 'boundary' ? schema.max ?? 100 : schema.min ?? 50; continue }
    if (schema.type === 'scalar') { props[key] = '42'; continue }
    if (schema.type === 'string-array') {
      const count = mode === 'boundary' ? schema.maxItems ?? 1 : 1
      const length = mode === 'boundary' ? schema.maxLength ?? 8 : Math.min(8, schema.maxLength ?? 8)
      props[key] = Array.from({ length: count }, () => 'x'.repeat(length))
      continue
    }
    const length = mode === 'boundary' ? schema.maxLength ?? 8 : Math.min(8, schema.maxLength ?? 8)
    props[key] = 'x'.repeat(length)
  }
  return props
}

function fixtureHeading(nodeId: string): CompositionNode { return { nodeId, component: 'heading', version: 1, props: { text: 'Evidence' } } }
function fixtureCopy(nodeId: string): CompositionNode { return { nodeId, component: 'copy', version: 1, props: { text: 'Evidence' } } }
function fixtureCard(nodeId: string): CompositionNode { return { nodeId, component: 'card', version: 1, props: { title: nodeId } } }
function fixtureMedia(nodeId: string): CompositionNode { return { nodeId, component: 'media', version: 1, props: { src: '/fixture.png', alt: 'Fixture' } } }

function childPath(path: string, child: string) { return path === '$' ? child : `${path}.${child}` }
function indexedPath(path: string, child: string, index: number) { return `${path === '$' ? child : `${path}.${child}`}[${index}]` }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
