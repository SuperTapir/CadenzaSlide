export const fontThemeIds = ['industrial', 'technical', 'editorial'] as const

export type FontThemeId = typeof fontThemeIds[number]

export interface FontRolePair {
  latin: string
  cjk: string
}

export interface FontTheme {
  label: string
  description: string
  sample: string
  roles: {
    display: FontRolePair
    body: FontRolePair
    mono: FontRolePair
  }
}

export const defaultFontThemeId: FontThemeId = 'industrial'

export const fontThemes: Record<FontThemeId, FontTheme> = {
  industrial: {
    label: 'INDUSTRIAL',
    description: '高密度黑体标题与克制正文，作为 Cadenza 默认调性。',
    sample: '构建 ONE-BIT SYSTEM',
    roles: {
      display: { latin: 'Archivo Variable', cjk: 'Noto Sans SC Variable' },
      body: { latin: 'IBM Plex Sans Variable', cjk: 'Noto Sans SC Variable' },
      mono: { latin: 'IBM Plex Mono', cjk: 'Noto Sans SC Variable' },
    },
  },
  technical: {
    label: 'TECHNICAL',
    description: '统一、理性且易读，适合技术说明、表格和产品发布。',
    sample: '实时 RENDER PIPELINE',
    roles: {
      display: { latin: 'IBM Plex Sans Variable', cjk: 'Noto Sans SC Variable' },
      body: { latin: 'IBM Plex Sans Variable', cjk: 'Noto Sans SC Variable' },
      mono: { latin: 'IBM Plex Mono', cjk: 'Noto Sans SC Variable' },
    },
  },
  editorial: {
    label: 'EDITORIAL',
    description: '中英文衬线字形成叙事张力，适合引言、研究与长内容。',
    sample: '让 THOUGHTS 成为材料',
    roles: {
      display: { latin: 'Source Serif 4 Variable', cjk: 'Noto Serif SC Variable' },
      body: { latin: 'Source Serif 4 Variable', cjk: 'Noto Serif SC Variable' },
      mono: { latin: 'IBM Plex Mono', cjk: 'Noto Sans SC Variable' },
    },
  },
}

const fontThemeIdSet = new Set<string>(fontThemeIds)

export function isFontThemeId(value: string | undefined): value is FontThemeId {
  return value !== undefined && fontThemeIdSet.has(value)
}
