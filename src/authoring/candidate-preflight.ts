import { productionComponentDefinitions, validateCompositionTree, type CompositionNode } from './component-library.ts'
import { diagnoseComposition } from './component-diagnosis.ts'
import { estimateCompositionCoverage } from './composition-coverage.ts'
import { collectProvidedContent, deriveVisualIntent, validateSlideContentSignals, type SlideContentSignals } from './slide-content-signals.ts'
import type { CandidatePreflightFinding, CandidatePreflightResult, SlideCompositionInput } from './slide-composer.ts'

/**
 * Rejects structurally provable failures before candidate JSON is selected or
 * written. It deliberately makes no browser/paint claims; those remain required
 * post-write channels because CSS, fonts and raster media are not available here.
 */
export function preflightCompositionCandidate(signals: SlideContentSignals, tree: CompositionNode, input: SlideCompositionInput): CandidatePreflightResult {
  const findings: CandidatePreflightFinding[] = []
  const inventory = collectProvidedContent(signals)
  const target = { slideId: typeof signals.id === 'string' ? signals.id : 'unknown-slide', componentId: tree.nodeId }
  const add = (ruleId: CandidatePreflightFinding['ruleId'], message: string, evidence: CandidatePreflightFinding['evidence']) => {
    if (!findings.some(finding => finding.ruleId === ruleId)) findings.push({ ruleId, severity: 'error', target, message, evidence })
  }

  const signalIssues = validateSlideContentSignals(signals)
  if (signalIssues.length) add('content.signals', '内容信号不满足生成契约', { kind: 'structured-candidate', paths: signalIssues.map(issue => issue.path) })
  if (inventory.ids.length > 12) add('composition.capacity', '单页内容信号超过 12 个，必须拆页后再组合', {
    kind: 'structured-candidate', values: { signalCount: inventory.ids.length, maximum: 12 },
  })

  const treeIssues = validateCompositionTree(tree)
  const capacityIssues = treeIssues.filter(issue => /node count exceeds|depth exceeds/.test(issue.message))
  const contractIssues = treeIssues.filter(issue => !capacityIssues.includes(issue))
  const visualContractIssues = contractIssues.filter(issue => issue.message.includes('visual ') || issue.path.includes('props.asset') || issue.path.includes('axes.treatment') || issue.path.includes('axes.state') || issue.path.includes('axes.behavior') || issue.path.includes('axes.role'))
  const structuralContractIssues = contractIssues.filter(issue => !visualContractIssues.includes(issue))
  if (visualContractIssues.length) add('visual.asset-contract', '视觉资产 ID 或 role/prominence/treatment/state/behavior 不满足 production 契约', { kind: 'structured-candidate', paths: visualContractIssues.map(issue => issue.path) })
  if (structuralContractIssues.length) add('composition.slot-contract', '组件树或 slot 不满足结构契约', { kind: 'structured-candidate', paths: structuralContractIssues.map(issue => issue.path) })
  if (capacityIssues.length) add('composition.capacity', '组件树超过生成前容量上限', { kind: 'structured-candidate', paths: capacityIssues.map(issue => issue.path), values: { nodeCount: countCompositionNodes(tree) } })
  const competingVisuals = collectVisualNodes(tree).filter(node => node.axes?.prominence === 'hero' || node.axes?.prominence === 'support')
  if (deriveVisualIntent(signals).hasStrongMedia && competingVisuals.length) add('visual.focus', '页面已有强媒体或结构焦点，不得再加入竞争性的 hero/support visual', {
    kind: 'structured-candidate', paths: competingVisuals.map(node => `${node.nodeId}.axes.prominence`), values: { visualCount: competingVisuals.length },
  })

  if (!treeIssues.length) {
    const treeText = collectCompositionText(tree)
    const missing = [...inventory.texts, ...inventory.sources].filter(value => !treeText.has(value))
    if (missing.length) add('content.signal-preservation', '候选未保留全部输入事实', { kind: 'structured-candidate', values: { missingCount: missing.length } })

    const intrinsicFailures = collectIntrinsicFrameFailures(tree, input.frame)
    if (intrinsicFailures.length) add('composition.intrinsic.profile-budget', '嵌套布局的累计最小高度超过其实际分配区域', {
      kind: 'structured-candidate',
      paths: intrinsicFailures.map(failure => failure.path),
      values: {
        minimumHeight: Math.max(...intrinsicFailures.map(failure => failure.minimumHeight)),
        allocatedHeight: Math.min(...intrinsicFailures.map(failure => failure.allocatedHeight)),
      },
    })
    const narrowQuotes = collectNarrowQuoteFailures(tree, input.frame)
    if (narrowQuotes.length) add('composition.intrinsic.profile-budget', 'Quote 被分配到过窄的阅读栏；请扩大区域或改用 Copy，避免展示字号产生碎行和裁切', {
      kind: 'structured-candidate',
      paths: narrowQuotes.map(failure => failure.path),
      values: { allocatedWidth: Math.min(...narrowQuotes.map(failure => failure.allocatedWidth)), minimumWidth: 32 },
    })

    const diagnosis = diagnoseComposition(tree, input)
    if (diagnosis.status === 'split' || diagnosis.status === 'fallback' || diagnosis.status === 'reject') {
      add('composition.intrinsic.profile-budget', '候选超出目标画布的固有尺寸或 profile 预算', {
        kind: 'structured-candidate', values: { frameWidth: input.frame.width, frameHeight: input.frame.height, density: diagnosis.density, cost: diagnosis.cost },
      })
    }

    const textLength = collectCompositionTextLength(tree)
    if (isMajorCanvas(input.frame) && textLength >= 600) {
      add('composition.semantic-type-budget', '单页文本超过舞台语义排版预算，应拆页或压缩内容', { kind: 'structured-candidate', values: { textLength, limit: 599 } })
    }

    const coverage = estimateCompositionCoverage(tree)
    if (isMajorCanvas(input.frame) && coverage.fillRatio < 0.3) {
      add('layout.content-coverage', '候选无法为主要内容画布提供足够的有意义覆盖', { kind: 'structured-candidate', values: { fillRatio: coverage.fillRatio, minimum: 0.3 } })
    }
    const balanceFailures = isMajorCanvas(input.frame) ? collectRegionBalanceFailures(tree) : []
    if (balanceFailures.length) {
      const worst = balanceFailures.reduce((left, right) => left.balance <= right.balance ? left : right)
      add('layout.region-balance', 'split 主次分区的语义容量失衡，应重组内容或选择其他结构', {
        kind: 'structured-candidate',
        paths: balanceFailures.map(failure => failure.path),
        values: { primaryUnits: worst.primaryUnits, secondaryUnits: worst.secondaryUnits, balance: worst.balance, minimum: 0.45 },
      })
    }
  }

  const result: CandidatePreflightResult = { schemaVersion: 1, ok: findings.length === 0, findings, requiredPostWriteChannels: ['document', 'render', 'geometry'] }
  if (findings.length) {
    const action = findings.some(finding => finding.ruleId === 'content.signals' || finding.ruleId === 'composition.slot-contract' || finding.ruleId === 'content.signal-preservation' || finding.ruleId === 'visual.asset-contract' || finding.ruleId === 'visual.focus')
      ? 'repair'
      : findings.some(finding => finding.ruleId === 'composition.capacity' || finding.ruleId === 'composition.semantic-type-budget')
        ? 'split'
        : 'simplify'
    result.recommendation = {
      action,
      reason: findings.map(finding => finding.message).join('；'),
      preserveSignalIds: [...inventory.ids],
      groups: action === 'split' ? chunk(inventory.ids, 6).map(signalIds => ({ signalIds })) : inventory.ids.length ? [{ signalIds: [...inventory.ids] }] : [],
    }
  }
  return result
}

interface IntrinsicFrameFailure { path: string; minimumHeight: number; allocatedHeight: number }
interface RegionBalanceFailure { path: string; primaryUnits: number; secondaryUnits: number; balance: number }
interface NarrowQuoteFailure { path: string; allocatedWidth: number }

function collectNarrowQuoteFailures(node: CompositionNode, frame: { width: number; height: number }, path = '$'): NarrowQuoteFailure[] {
  if (node.component === 'quote' && frame.width < 32 && String(node.props?.text ?? '').trim().length >= 18) return [{ path, allocatedWidth: frame.width }]
  const failures: NarrowQuoteFailure[] = []
  if (node.component === 'split' && node.axes?.direction === 'horizontal') {
    const [primaryRatio, secondaryRatio] = String(node.axes?.ratio ?? '1:1').split(':').map(Number)
    const total = primaryRatio + secondaryRatio
    const primary = node.slots?.primary?.[0]
    const secondary = node.slots?.secondary?.[0]
    if (primary) failures.push(...collectNarrowQuoteFailures(primary, { ...frame, width: frame.width * primaryRatio / total }, childPath(path, 'slots.primary[0]')))
    if (secondary) failures.push(...collectNarrowQuoteFailures(secondary, { ...frame, width: frame.width * secondaryRatio / total }, childPath(path, 'slots.secondary[0]')))
    return failures
  }
  const horizontalChildren = node.component === 'stack' && node.axes?.direction === 'horizontal'
  const gridColumns = node.component === 'grid' ? Number(node.axes?.columns) : 0
  node.children?.forEach((child, index) => failures.push(...collectNarrowQuoteFailures(child, {
    ...frame,
    width: horizontalChildren ? frame.width / node.children!.length : gridColumns > 1 ? frame.width / gridColumns : frame.width,
  }, childPath(path, `children[${index}]`))))
  for (const [slot, children] of Object.entries(node.slots ?? {})) children.forEach((child, index) => failures.push(...collectNarrowQuoteFailures(child, frame, childPath(path, `slots.${slot}[${index}]`))))
  return failures
}

function collectRegionBalanceFailures(node: CompositionNode, path = '$'): RegionBalanceFailure[] {
  const failures: RegionBalanceFailure[] = []
  const primary = node.component === 'split' ? node.slots?.primary?.[0] : undefined
  const secondary = node.component === 'split' ? node.slots?.secondary?.[0] : undefined
  if (primary && secondary) {
    const primaryUnits = estimateCompositionCoverage(primary).visualUnits
    const secondaryUnits = estimateCompositionCoverage(secondary).visualUnits
    const balance = Math.min(primaryUnits, secondaryUnits) / Math.max(1, Math.max(primaryUnits, secondaryUnits))
    if (balance < 0.45) failures.push({ path, primaryUnits, secondaryUnits, balance })
  }
  node.children?.forEach((child, index) => failures.push(...collectRegionBalanceFailures(child, childPath(path, `children[${index}]`))))
  for (const [slot, children] of Object.entries(node.slots ?? {})) {
    children.forEach((child, index) => failures.push(...collectRegionBalanceFailures(child, childPath(path, `slots.${slot}[${index}]`))))
  }
  return failures
}

function collectIntrinsicFrameFailures(node: CompositionNode, frame: { width: number; height: number }, path = '$'): IntrinsicFrameFailure[] {
  const failures: IntrinsicFrameFailure[] = []
  const minimumHeight = minimumIntrinsicHeight(node)
  if (minimumHeight > frame.height) failures.push({ path, minimumHeight, allocatedHeight: frame.height })

  if (node.component !== 'split' || node.axes?.direction !== 'vertical') return failures
  const primary = node.slots?.primary?.[0]
  const secondary = node.slots?.secondary?.[0]
  if (!primary || !secondary) return failures
  const gap = gapBudget(node)
  const available = Math.max(0, frame.height - gap)
  const [primaryShare, secondaryShare] = splitShares(node.axes?.ratio)
  const childFrame = (share: number) => ({ width: frame.width, height: available * share })
  failures.push(...collectIntrinsicFrameFailures(primary, childFrame(primaryShare), childPath(path, 'slots.primary[0]')))
  failures.push(...collectIntrinsicFrameFailures(secondary, childFrame(secondaryShare), childPath(path, 'slots.secondary[0]')))
  return failures
}

function minimumIntrinsicHeight(node: CompositionNode): number {
  const own = productionComponentDefinitions.find(item => item.id === node.component)?.constraints.minHeight ?? 8
  const children = node.children ?? []
  const slotChildren = Object.values(node.slots ?? {}).flat()
  if (node.component === 'stack' && children.length) return node.axes?.direction === 'horizontal'
    ? Math.max(own, ...children.map(minimumIntrinsicHeight))
    : Math.max(own, children.reduce((sum, child) => sum + minimumIntrinsicHeight(child), gapBudget(node) * Math.max(0, children.length - 1)))
  if (node.component === 'cluster' && children.length) return node.axes?.direction === 'vertical'
    ? Math.max(own, children.reduce((sum, child) => sum + minimumIntrinsicHeight(child), gapBudget(node) * Math.max(0, children.length - 1)))
    : Math.max(own, ...children.map(minimumIntrinsicHeight))
  if (node.component === 'grid' && children.length) {
    const columns = node.axes?.columns === '3' ? 3 : node.axes?.columns === '4' ? 4 : 2
    const rows = Array.from({ length: Math.ceil(children.length / columns) }, (_, row) => Math.max(...children.slice(row * columns, (row + 1) * columns).map(minimumIntrinsicHeight)))
    return Math.max(own, rows.reduce((sum, height) => sum + height, gapBudget(node) * Math.max(0, rows.length - 1)))
  }
  if (node.component === 'split' && slotChildren.length) return node.axes?.direction === 'vertical'
    ? Math.max(own, slotChildren.reduce((sum, child) => sum + minimumIntrinsicHeight(child), gapBudget(node) * Math.max(0, slotChildren.length - 1)))
    : Math.max(own, ...slotChildren.map(minimumIntrinsicHeight))
  if ((node.component === 'inset' || node.component === 'overlay') && slotChildren.length) return Math.max(own, ...slotChildren.map(minimumIntrinsicHeight))
  return own
}

function gapBudget(node: CompositionNode) { return node.axes?.gap === 'open' ? 7 : node.axes?.gap === 'compact' ? 2 : 4 }

function splitShares(ratio: unknown): [number, number] {
  if (ratio === '2:1') return [2 / 3, 1 / 3]
  if (ratio === '1:2') return [1 / 3, 2 / 3]
  return [1 / 2, 1 / 2]
}

function childPath(path: string, child: string) { return path === '$' ? child : `${path}.${child}` }


function countCompositionNodes(tree: CompositionNode) {
  let count = 0
  const walk = (node: CompositionNode) => {
    count++
    node.children?.forEach(walk)
    Object.values(node.slots ?? {}).flat().forEach(walk)
  }
  walk(tree)
  return count
}

function collectVisualNodes(tree: CompositionNode) {
  const nodes: CompositionNode[] = []
  const walk = (node: CompositionNode) => {
    if (node.component === 'visual') nodes.push(node)
    node.children?.forEach(walk)
    Object.values(node.slots ?? {}).flat().forEach(walk)
  }
  walk(tree)
  return nodes
}

function collectCompositionTextLength(tree: CompositionNode) {
  let length = 0
  const visit = (value: unknown) => {
    if (typeof value === 'string' || typeof value === 'number') length += String(value).length
    else if (Array.isArray(value)) value.forEach(visit)
    else if (isRecord(value)) Object.values(value).forEach(visit)
  }
  const walk = (node: CompositionNode) => {
    visit(node.props)
    node.children?.forEach(walk)
    Object.values(node.slots ?? {}).flat().forEach(walk)
  }
  walk(tree)
  return length
}

function isMajorCanvas(frame: { width: number, height: number }) {
  return frame.width >= 60 && frame.height >= 35
}


function collectCompositionText(tree: CompositionNode) {
  const values = new Set<string>()
  const visit = (value: unknown) => {
    if (typeof value === 'string' || typeof value === 'number') values.add(String(value))
    else if (Array.isArray(value)) value.forEach(visit)
    else if (isRecord(value)) Object.values(value).forEach(visit)
  }
  const walk = (node: CompositionNode) => {
    visit(node.props)
    node.children?.forEach(walk)
    Object.values(node.slots ?? {}).flat().forEach(walk)
  }
  walk(tree)
  return values
}


function chunk<T>(values: readonly T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size))
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
