export const elementMotionIds = [
  'appear',
  'rise',
  'unfold',
  'accumulate',
  'focus',
  'draw',
  'count',
  'replace',
] as const

export type ElementMotionId = typeof elementMotionIds[number]

export interface ElementMotionPreset {
  label: string
  description: string
  verb: string
  durationMs: number
}

export const elementMotions: Record<ElementMotionId, ElementMotionPreset> = {
  appear: { label: 'APPEAR', description: '短促显现，适合默认信息揭示。', verb: 'appear', durationMs: 160 },
  rise: { label: 'RISE', description: '从下方小幅进入，表达补充关系。', verb: 'rise', durationMs: 220 },
  unfold: { label: 'UNFOLD', description: '从中心硬边展开，适合卡片与图片。', verb: 'unfold', durationMs: 240 },
  accumulate: { label: 'ACCUMULATE', description: '逐项向上累积，适合列表和步骤。', verb: 'accumulate', durationMs: 240 },
  focus: { label: 'FOCUS', description: '低幅聚焦进入，适合重点对象。', verb: 'focus', durationMs: 220 },
  draw: { label: 'DRAW', description: '沿阅读方向揭示线条或短句。', verb: 'draw', durationMs: 260 },
  count: { label: 'COUNT', description: '数字从零计至终值，适合指标。', verb: 'count', durationMs: 280 },
  replace: { label: 'REPLACE', description: '轻微错位替换，适合状态变化。', verb: 'replace', durationMs: 220 },
}

const elementMotionSet = new Set<string>(elementMotionIds)

export function isElementMotionId(value: string | undefined): value is ElementMotionId {
  return value !== undefined && elementMotionSet.has(value)
}
