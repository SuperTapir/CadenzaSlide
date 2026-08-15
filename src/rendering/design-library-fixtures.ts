import { createDefaultDeckMaster, type DeckMaster } from '../core/deck-master'
import { renderDeckSlides, type CoreSlide, type SlideImage } from './core-templates'

const base = { role: 'content' as const, label: '母版预览' }
const wide: SlideImage = { src: '/hello-apple.svg', alt: '横向示例图', aspectRatio: 1.6 }
const portrait: SlideImage = { src: '/cadenza-hero-one-bit-source.png', alt: '纵向示例图', aspectRatio: 0.72 }

export const designLibraryFixtures = {
  title: { ...base, id: 'fixture-title', role: 'intro', label: '封面母版预览', layout: 'title', title: ['让表达', '保持一致'], subtitle: '默认母版自动管理背景与位置', author: 'Cadenza', date: '2025/03/24' },
  'title-photo': { ...base, id: 'fixture-title-photo', layout: 'title-photo', title: ['标题与图片'], subtitle: '海报式封面', image: { ...wide, caption: '渲染兜底必须隐藏的反例图注' } },
  'title-photo-alt': { ...base, id: 'fixture-title-photo-alt', layout: 'title-photo-alt', title: ['标题与图片'], subtitle: '纵向媒体也能成立', image: portrait },
  'title-bullets': { ...base, id: 'fixture-title-bullets', layout: 'title-bullets', title: ['清晰的内容页'], subtitle: '普通页面使用低强度标题', items: ['母版提供起点', '组件实时补足证据', '仍然保持一条主线'], slotOverrides: { items: { frame: { width: 38 } } }, objects: [{ kind: 'chart', frame: { x: 50, y: 45, width: 44, height: 44 }, chart: 'bar', values: [{ label: '结构', value: 72 }, { label: '证据', value: 91 }, { label: '表达', value: 84 }] }] },
  'title-bullets-photo': { ...base, id: 'fixture-title-bullets-photo', layout: 'title-bullets-photo', title: ['图文并行'], subtitle: '标题与图片保持稳定层级', items: ['简洁', '稳定', '可调整'], image: wide },
  section: { ...base, id: 'fixture-section', layout: 'section', title: ['第二部分'], subtitle: '章节页保持统一背景', sectionNumber: '02' },
  'title-only': { ...base, id: 'fixture-title-only', layout: 'title-only', title: ['母版只是开始'], subtitle: 'AI 根据内容关系继续构图', objects: [{ kind: 'table', frame: { x: 6, y: 48, width: 53, height: 37 }, columns: ['输入', '处理', '结果'], rows: [['资料', '提炼', '主张'], ['数据', '验证', '证据']] }, { kind: 'text', frame: { x: 64, y: 50, width: 30, height: 31 }, text: '同一调性下，实时增加真正有意义的内容。' }] },
  agenda: { ...base, id: 'fixture-agenda', layout: 'agenda', title: ['议程'], subtitle: '今天讨论三个部分', items: [{ number: '01', title: '背景' }, { number: '02', title: '方案' }, { number: '03', title: '行动' }] },
  statement: { ...base, id: 'fixture-statement', layout: 'statement', title: ['一个系统', '胜过一组散乱页面'], subtitle: '关键观点也保留标题层级' },
  'big-fact': { ...base, id: 'fixture-big-fact', layout: 'big-fact', value: '14', factLabel: '个稳定核心版式' },
  quote: { ...base, id: 'fixture-quote', layout: 'quote', quote: 'Good design is as little design as possible.', attribution: 'Dieter Rams', source: 'Ten Principles for Good Design · Vitsœ' },
  gallery: { ...base, id: 'fixture-gallery', layout: 'gallery', images: [{ ...wide, caption: '主图说明' }, { ...portrait, caption: '竖图说明' }, { ...wide, alt: '第三张图', caption: '辅助图片说明' }] },
  photo: { ...base, id: 'fixture-photo', layout: 'photo', image: { ...wide, caption: '全图说明文字' } },
  blank: { ...base, id: 'fixture-blank', layout: 'blank', ariaLabel: '空白组合页', objects: [{ kind: 'text', frame: { x: 8, y: 10, width: 45, height: 12 }, text: 'Blank + components' }] },
} satisfies Record<string, CoreSlide>

export function renderDesignLibraryFixture(layout: keyof typeof designLibraryFixtures, master: Readonly<DeckMaster> = createDefaultDeckMaster()) {
  return renderDeckSlides([designLibraryFixtures[layout]], master)
}
