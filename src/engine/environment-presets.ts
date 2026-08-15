export const environmentPresetIds = [
  'black',
  'white',
  'field',
  'grid',
  'beam',
  'contour',
  'void',
  'float',
  'halo',
  'raster',
  'aperture',
  'track',
  'shutter',
  'orbit',
  'steps',
  'fold',
  'portal',
  'ribbon',
  'strata',
  'target',
] as const

export type SceneId = typeof environmentPresetIds[number]
export const environmentModes = ['static', 'loop'] as const
export type EnvironmentMode = typeof environmentModes[number]

export interface EnvironmentPreset {
  label: string
  title: string
  description: string
  modes: typeof environmentModes
  defaultMode: EnvironmentMode
  motif: string
  verb: string
}

export const environmentPresets: Record<SceneId, EnvironmentPreset> = {
  black: {
    label: 'BLACK', title: 'Absolute ink.',
    description: '纯黑底色；轻动模式只保留边缘反色标记。', modes: environmentModes, defaultMode: 'static', motif: 'absolute-ink', verb: 'hold',
  },
  white: {
    label: 'WHITE', title: 'Absolute paper.',
    description: '纯白底色；轻动模式只保留边缘反色标记。', modes: environmentModes, defaultMode: 'static', motif: 'absolute-paper', verb: 'hold',
  },
  field: {
    label: 'FIELD', title: 'A field appears.',
    description: '柔和光场用于开场与收束。', modes: environmentModes, defaultMode: 'static', motif: 'radial-field', verb: 'focus',
  },
  grid: {
    label: 'GRID', title: 'Structure has rhythm.',
    description: '规则分区适合目录与进度信息。', modes: environmentModes, defaultMode: 'static', motif: 'sectional-lattice', verb: 'accumulate',
  },
  beam: {
    label: 'BEAM', title: 'A section cuts through.',
    description: '硬边方向场建立章节切换。', modes: environmentModes, defaultMode: 'static', motif: 'diagonal-cut', verb: 'cut',
  },
  contour: {
    label: 'CONTOUR', title: 'Meaning has depth.',
    description: '等高线为正文提供低干扰层次。', modes: environmentModes, defaultMode: 'static', motif: 'topographic-rings', verb: 'focus',
  },
  void: {
    label: 'VOID', title: 'Silence is a surface.',
    description: '高留白环境用于代码与收尾。', modes: environmentModes, defaultMode: 'static', motif: 'edge-plane', verb: 'hold',
  },
  float: {
    label: 'FLOAT', title: 'An object keeps its weight.',
    description: '对象、光场和投影共享缓慢运动状态。', modes: environmentModes, defaultMode: 'static', motif: 'weighted-card', verb: 'land',
  },
  halo: {
    label: 'HALO', title: 'Focus holds the subject.',
    description: '焦点光晕为矢量与清晰内容留出稳定中心。', modes: environmentModes, defaultMode: 'static', motif: 'focal-halo', verb: 'focus',
  },
  raster: {
    label: 'RASTER', title: 'Pixels enter the field.',
    description: '位图与视频帧进入实时 one-bit renderer。', modes: environmentModes, defaultMode: 'static', motif: 'raster-stage', verb: 'replace',
  },
  aperture: {
    label: 'APERTURE', title: 'Open one view.',
    description: '巨大裁切圆孔建立聚焦与遮挡。', modes: environmentModes, defaultMode: 'static', motif: 'cropped-aperture', verb: 'focus',
  },
  track: {
    label: 'TRACK', title: 'Follow one path.',
    description: '一条连续轨道连接起点与目标。', modes: environmentModes, defaultMode: 'static', motif: 'single-track', verb: 'pass',
  },
  shutter: {
    label: 'SHUTTER', title: 'Planes reveal.',
    description: '三片硬边遮板控制显露。', modes: environmentModes, defaultMode: 'static', motif: 'three-shutters', verb: 'unfold',
  },
  orbit: {
    label: 'ORBIT', title: 'Scale finds relation.',
    description: '一个大环与一个尺度点形成闭环。', modes: environmentModes, defaultMode: 'static', motif: 'ring-and-satellite', verb: 'accumulate',
  },
  steps: {
    label: 'STEPS', title: 'Mass lands in stages.',
    description: '三层阶梯质量建立落点。', modes: environmentModes, defaultMode: 'static', motif: 'three-step-mass', verb: 'land',
  },
  fold: {
    label: 'FOLD', title: 'One surface turns.',
    description: '三面纸折表达替换与体积。', modes: environmentModes, defaultMode: 'static', motif: 'paper-fold', verb: 'replace',
  },
  portal: {
    label: 'PORTAL', title: 'Frames narrow attention.',
    description: '嵌套边界逐层收束视线。', modes: environmentModes, defaultMode: 'static', motif: 'nested-portal', verb: 'focus',
  },
  ribbon: {
    label: 'RIBBON', title: 'A path crosses.',
    description: '一条粗带穿过画布并保留安静区域。', modes: environmentModes, defaultMode: 'static', motif: 'crossing-ribbon', verb: 'pass',
  },
  strata: {
    label: 'STRATA', title: 'Evidence accumulates.',
    description: '少量宽阔地层表达累积。', modes: environmentModes, defaultMode: 'static', motif: 'broad-strata', verb: 'accumulate',
  },
  target: {
    label: 'TARGET', title: 'A relation locks.',
    description: '大尺度准星锁定偏置焦点。', modes: environmentModes, defaultMode: 'static', motif: 'offset-target', verb: 'lock',
  },
}

const presetIdSet = new Set<string>(environmentPresetIds)
const environmentModeSet = new Set<string>(environmentModes)

export function isEnvironmentPresetId(value: string | undefined): value is SceneId {
  return value !== undefined && presetIdSet.has(value)
}

export function isEnvironmentMode(value: string | undefined): value is EnvironmentMode {
  return value !== undefined && environmentModeSet.has(value)
}

export function loopPhase(time: number, duration = 12_000) {
  if (!Number.isFinite(time)) return 0
  return Math.sin((time / duration) * Math.PI * 2)
}
