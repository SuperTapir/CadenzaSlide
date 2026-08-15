export const motionPresetIds = [
  'cut',
  'dissolve',
  'pass-left',
  'pass-up',
  'unfold',
  'focus',
  'land',
  'accumulate',
  'lock',
  'replace',
] as const

export type MotionPresetId = typeof motionPresetIds[number]

export interface MotionPreset {
  label: string
  description: string
  verb: string
  durationMs: number
}

export const motionPresets: Record<MotionPresetId, MotionPreset> = {
  cut: { label: 'CUT', description: '无残影硬切，保留 one-bit 的直接性。', verb: 'cut', durationMs: 0 },
  dissolve: { label: 'DISSOLVE', description: '短促明度溶解，用于相邻观点。', verb: 'dissolve', durationMs: 220 },
  'pass-left': { label: 'PASS LEFT', description: '内容沿阅读方向通过画面。', verb: 'pass', durationMs: 240 },
  'pass-up': { label: 'PASS UP', description: '向上通过，表达叙事推进。', verb: 'pass', durationMs: 240 },
  unfold: { label: 'UNFOLD', description: '像纸面一样从硬边展开。', verb: 'unfold', durationMs: 260 },
  focus: { label: 'FOCUS', description: '低幅缩放与显影共同聚焦。', verb: 'focus', durationMs: 220 },
  land: { label: 'LAND', description: '带重量地落到稳定位置。', verb: 'land', durationMs: 260 },
  accumulate: { label: 'ACCUMULATE', description: '从下方逐层累积进入。', verb: 'accumulate', durationMs: 260 },
  lock: { label: 'LOCK', description: '围绕偏置焦点收束并锁定。', verb: 'lock', durationMs: 240 },
  replace: { label: 'REPLACE', description: '新旧表面快速错位替换。', verb: 'replace', durationMs: 240 },
}

const motionPresetSet = new Set<string>(motionPresetIds)

export function isMotionPresetId(value: string | undefined): value is MotionPresetId {
  return value !== undefined && motionPresetSet.has(value)
}
