import type { CompositionNode } from './component-library'
import type { CompositionSlideObject, Frame } from '../core/deck-master'

export const NUMBERED_SERIES_CONTENT_FRAME: Readonly<Frame> = Object.freeze({ x: 6, y: 35, width: 88, height: 49 })

export interface NumberedSeriesScenarioDefinition {
  id: `series-${string}`
  label: string
  description: string
  applicableWhen: string
  boundaries: string[]
  failureConditions: string[]
  fixtures: Array<{ id: string, topic: string, tree: CompositionNode }>
}

export function numberedSeriesComposition(compositionId: string, tree: CompositionNode): CompositionSlideObject {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(compositionId)) throw new Error('compositionId must be stable kebab-case')
  return { kind: 'composition', compositionId, frame: { ...NUMBERED_SERIES_CONTENT_FRAME }, tree }
}

export const numberedSeriesScenarioCatalog: readonly NumberedSeriesScenarioDefinition[] = [
  scenario('series-peer-panels', '同级判断面板', '二至四个同级判断共享相同视觉权重。', '并列责任、原则或类别', ['2–4 panels', 'one claim per panel'], ['存在真实先后关系', '单项需要强媒体'], [
    fixture('peer-ai-responsibility', 'AI 协作责任', panelGrid('peer-ai-responsibility', [['执行力', '可以交给 AI'], ['判断力', '留在人手里'], ['结果责任', '最终由人承担']])),
    fixture('peer-release-owners', '软件发布职责', panelGrid('peer-release-owners', [['产品', '定义范围'], ['工程', '验证实现'], ['运营', '确认发布']])),
  ]),
  scenario('series-ordered-gates', '有序门禁', '三至四个必须依次通过的门禁。', '有明确顺序和通过条件', ['3–4 steps', 'stable order'], ['步骤可并行', '超过四步需要拆页'], [
    fixture('gates-ai-milestone', 'AI 项目里程碑', panelGrid('gates-ai-milestone', [['只保留一个目标'], ['写清完成条件'], ['真实运行检查'], ['通过后开放范围']], true)),
    fixture('gates-release', '产品发布门禁', panelGrid('gates-release', [['冻结需求'], ['回归通过'], ['灰度验证']], true)),
  ]),
  scenario('series-evidence-split', '证据展开', '保留上一页的系列标题，用一张后续页把关键判断展开为可读证据。', '上一页已提出抽象观点，截图、目录、产品图或真实输出能显著帮助理解', ['same series title', '2–3 evidence items', 'one new media'], ['只是复述或重复上一页文字', '媒体无法证明主张', '颜色证据被错误去色'], [
    fixture('split-research-repo', '源码调研', evidenceSplit('split-research-repo', [['官方资料', '解决事实边界'], ['成熟源码', '提供实现起点'], ['参考目录', '让上下文持续存在']], '/cadenza-hero-one-bit-source.png', '参考项目目录')),
    fixture('split-user-research', '用户研究', evidenceSplit('split-user-research', [['访谈', '发现真实语言'], ['录屏', '保留行为时序']], '/hello-apple.svg', '研究证据板')),
  ]),
  scenario('series-asymmetric-evidence', '非对称证据', '左侧短证据栈与右侧综合判断形成 2+1 结构。', '多个输入共同支持一个更强结论', ['2–3 primary items', 'one synthesis'], ['三项完全同级', '右侧只是重复标题'], [
    fixture('asymmetric-context', 'AI 上下文', asymmetric('asymmetric-context', [['文字说明', '定义意图与异常'], ['录屏', '保留真实时序']], ['同帧对照', '让差异可见、可复查、可反复比较'])),
    fixture('asymmetric-experiment', '实验复盘', asymmetric('asymmetric-experiment', [['日志', '记录发生了什么'], ['指标', '量化影响范围']], ['结论', '把证据汇总成下一轮决策'])),
  ]),
  scenario('series-code-contract', '代码契约', '真实命令与用途、作用对象和可观察结果并列。', '需要向 Agent 暴露经过源码、文档或实际运行确认的入口', ['one verified code sample', 'visible explanation', '1–4 observable guarantees'], ['代码只是装饰', '命令或输出没有来源、属于虚构', '未解释结果含义或通过标准', 'GUI 无法映射为稳定契约'], [
    fixture('code-cli-entry', 'Agent CLI', codeContract('code-cli-entry', '$ cadenza verify research-story --browser', '验证 Deck 文档并在真实浏览器画布检查；错误会阻止验收，warning 需要复核', [['DOCUMENT', '检查 schema 与内容契约'], ['BROWSER', '检查真实几何与媒体表现']])),
    fixture('code-project-tests', '项目测试', codeContract('code-project-tests', '$ npm test', '运行仓库的自动化测试；进程退出码为 0 才表示测试门禁通过', [['COMMAND', '来自 package.json scripts.test'], ['RESULT', '以真实退出码和测试报告为准']])),
  ]),
]

function scenario(id: NumberedSeriesScenarioDefinition['id'], label: string, description: string, applicableWhen: string, boundaries: string[], failureConditions: string[], fixtures: NumberedSeriesScenarioDefinition['fixtures']): NumberedSeriesScenarioDefinition {
  return { id, label, description, applicableWhen, boundaries, failureConditions, fixtures }
}

function fixture(id: string, topic: string, tree: CompositionNode) { return { id, topic, tree } }
function panel(nodeId: string, title: string, body?: string, meta?: string): CompositionNode {
  return { nodeId, component: 'card', version: 1, props: { title, ...(body ? { body } : {}), ...(meta ? { meta } : {}) }, axes: { alignment: 'center', density: 'open', emphasis: 'strong' } }
}
function panelGrid(nodeId: string, items: string[][], ordered = false): CompositionNode {
  return { nodeId: `${nodeId}-grid`, component: 'grid', version: 1, axes: { columns: String(items.length), gap: 'normal', density: 'open' }, children: items.map(([title, body], index) => panel(`${nodeId}-${index + 1}`, title, body, ordered ? String(index + 1).padStart(2, '0') : undefined)) }
}
function evidenceSplit(nodeId: string, items: string[][], src: string, alt: string): CompositionNode {
  return { nodeId: `${nodeId}-split`, component: 'split', version: 1, axes: { ratio: '2:1', gap: 'open', alignment: 'stretch' }, slots: { primary: [{ nodeId: `${nodeId}-stack`, component: 'stack', version: 1, axes: { gap: 'compact', density: 'open' }, children: items.map(([title, body], index) => panel(`${nodeId}-${index + 1}`, title, body)) }], secondary: [{ nodeId: `${nodeId}-media`, component: 'media', version: 1, props: { src, alt }, axes: { span: 'contain', kind: 'screenshot', treatment: 'tonal' } }] } }
}
function asymmetric(nodeId: string, items: string[][], synthesis: string[]): CompositionNode {
  return { nodeId: `${nodeId}-split`, component: 'split', version: 1, axes: { ratio: '1:1', gap: 'open', alignment: 'stretch' }, slots: { primary: [{ nodeId: `${nodeId}-stack`, component: 'stack', version: 1, axes: { gap: 'compact', density: 'open' }, children: items.map(([title, body], index) => panel(`${nodeId}-${index + 1}`, title, body)) }], secondary: [{ nodeId: `${nodeId}-synthesis-stack`, component: 'stack', version: 1, axes: { density: 'open' }, children: [panel(`${nodeId}-synthesis`, synthesis[0], synthesis[1])] }] } }
}
function codeContract(nodeId: string, code: string, caption: string, guarantees: string[][]): CompositionNode {
  return { nodeId: `${nodeId}-split`, component: 'split', version: 1, axes: { ratio: '2:1', gap: 'open', alignment: 'stretch' }, slots: { primary: [{ nodeId: `${nodeId}-code`, component: 'code', version: 1, props: { language: 'bash', code, caption } }], secondary: [{ nodeId: `${nodeId}-guarantees`, component: 'stack', version: 1, axes: { gap: 'compact', density: 'open' }, children: guarantees.map(([title, body], index) => panel(`${nodeId}-guarantee-${index + 1}`, title, body)) }] } }
}
