import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const skillRoot = resolve('.agents/skills/cadenza-presentations')
const skill = readFileSync(resolve(skillRoot, 'SKILL.md'), 'utf8')
const authoringWorkflow = readFileSync(resolve(skillRoot, 'references/authoring-workflow.md'), 'utf8')
const creationGuidance = readFileSync(resolve(skillRoot, 'references/creation-guidance.md'), 'utf8')

function frontmatter(text: string) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error('Missing YAML frontmatter')
  return Object.fromEntries(match[1].split('\n').map(line => {
    const separator = line.indexOf(':')
    return [line.slice(0, separator), line.slice(separator + 1).trim()]
  }))
}

describe('repo-scoped Cadenza skill', () => {
  it('has valid minimal metadata and every linked reference exists', () => {
    const metadata = frontmatter(skill)
    expect(metadata.name).toBe('cadenza-presentations')
    expect(metadata.description.length).toBeGreaterThan(80)
    expect(Object.keys(metadata)).toEqual(['name', 'description'])
    const references = [...skill.matchAll(/\]\((references\/[^)]+)\)/g)].map(match => match[1])
    expect(references.length).toBeGreaterThanOrEqual(4)
    for (const reference of references) expect(existsSync(resolve(skillRoot, reference))).toBe(true)
  })

  it('forward-covers a real creation request with local source material', () => {
    const prompt = '请基于 /data/research 创建一个能在 Web 放映的 presentation，先让我确认 outline'
    expect(prompt).toMatch(/创建.*presentation/)
    expect(skill).toContain('For a new deck')
    expect(skill).toContain('Read user-provided source files in place')
    expect(skill).toContain('wait for explicit user confirmation')
  })

  it('forward-covers a slide-id revision request without internal AI patching', () => {
    const prompt = '修改 demo 的 slide:pricing，并更新它的演讲者注释'
    expect(prompt).toMatch(/slide:pricing/)
    expect(skill).toContain('inspect <deck-id>/slide:<slide-id>')
    expect(skill).toContain('edit the authoritative file directly')
    expect(skill).toContain('Do not create an internal patch')
  })

  it('states the Agent-native boundary and does not request model credentials', () => {
    expect(skill).toContain('Cadenza never calls AI')
    expect(skill).toContain('never request an API key')
    expect(skill).not.toMatch(/OPENAI_API_KEY|ANTHROPIC_API_KEY/)
  })

  it('calibrates delivery scale before creating an outline instead of guessing page count', () => {
    expect(skill).toContain('creation contract')
    expect(authoringWorkflow).toContain('目标页数范围')
    expect(authoringWorkflow).toContain('演讲时长')
    expect(authoringWorkflow).toContain('屏幕比例')
    expect(authoringWorkflow).toContain('重点章节')
    expect(authoringWorkflow).toContain('不要根据源材料长度自行猜测页数')
    expect(authoringWorkflow).toContain('明确记录假设')
  })

  it('uses progressive guidance without forcing every deck through an interview', () => {
    expect(skill).toContain('creation-guidance.md')
    expect(creationGuidance).toContain('快速路径')
    expect(creationGuidance).toContain('引导路径')
    expect(creationGuidance).toContain('Strategy')
    expect(creationGuidance).toContain('Substance')
    expect(creationGuidance).toContain('Structure')
    expect(creationGuidance).toContain('Design')
    expect(creationGuidance).toContain('Build')
    expect(creationGuidance).toContain('不要重复询问')
    expect(creationGuidance).toContain('最多 3 个')
  })

  it('makes the outline checkpoint reviewable before slide generation', () => {
    expect(creationGuidance).toContain('每页一句话')
    expect(creationGuidance).toContain('叙事作用')
    expect(creationGuidance).toContain('证据来源')
    expect(creationGuidance).toContain('等待用户明确确认')
    expect(authoringWorkflow).toContain('creation-guidance.md')
  })

  it('exposes long-running deck creation as an observable execution queue', () => {
    expect(creationGuidance).toContain('执行队列')
    expect(creationGuidance).toContain('host-native plan')
    expect(creationGuidance).toContain('同时只有一个任务处于进行中')
    expect(creationGuidance).toContain('不要虚构进度')
    expect(creationGuidance).toContain('资源准备')
    expect(creationGuidance).toContain('分批构建')
    expect(creationGuidance).toContain('技术验证与视觉验证')
  })

  it('keeps the outline visible while deferring expensive build batches until approval', () => {
    expect(creationGuidance).toContain('把完整 outline 紧接在执行队列之后展示')
    expect(creationGuidance).toContain('确认前')
    expect(creationGuidance).toContain('不得开始完整页面构建')
    expect(creationGuidance).toContain('连续页码或章节')
    expect(creationGuidance).toContain('完成一批就立即更新')
  })

  it('treats masters as complete, startup or canvas without mechanically filling space', () => {
    expect(skill).toContain('complete → startup → canvas')
    expect(authoringWorkflow).toContain('master.layouts.<layout>.authoring')
    expect(creationGuidance).toContain('base-sufficient')
    expect(creationGuidance).toContain('justified-canvas')
    expect(creationGuidance).toContain('不得为了填满页面')
    expect(creationGuidance).toContain('不得仅为获得自由坐标而使用 `blank`')
  })

  it('records master decisions in the host execution record without creating another deck source', () => {
    expect(creationGuidance).toContain('slide ID、layout、authoring path 与理由')
    expect(creationGuidance).toContain('host-native 执行记录')
    expect(creationGuidance).toContain('不得写入第二份 deck 内容')
  })

  it('routes repeated visual failures into the Design System and keeps smoke separate from taste', () => {
    expect(authoringWorkflow).toContain('内容问题还是 Design System 问题')
    expect(authoringWorkflow).toContain('不要逐页打补丁')
    expect(authoringWorkflow).toContain('Cover')
    expect(authoringWorkflow).toContain('技术 smoke 不能证明视觉质量')
    expect(authoringWorkflow).toContain('实际 Audience viewport')
    expect(authoringWorkflow).toContain('孤字行')
    expect(authoringWorkflow).toContain('一两个字')
    expect(authoringWorkflow).toContain('「」')
    expect(authoringWorkflow).toContain('中文引号')
  })
})
