import { describe, expect, it, vi } from 'vitest'
import { addInspectTarget, buildStudioEditPrompt, copyStudioEditPrompt, inspectTargetKey, summarizeInspectSlides, type StudioInspectEdit, type StudioInspectTarget } from './studio-inspect'

const title: StudioInspectTarget = {
  slideId: 'intro',
  path: '$.slides.intro.title',
  kind: 'title',
  label: 'Title',
  snapshot: 'Cross the boundary',
}

describe('Studio inspect feedback', () => {
  it('uses slide, path, and optional composition node as stable session identity', () => {
    expect(inspectTargetKey(title)).toBe('intro\n$.slides.intro.title\n')
    expect(inspectTargetKey({ ...title, nodeId: 'heading-1' })).toBe('intro\n$.slides.intro.title\nheading-1')
  })

  it('adds targets once and preserves the existing instruction', () => {
    const first = addInspectTarget([], title)
    first[0].instruction = '标题更短一些'
    const duplicate = addInspectTarget(first, { ...title, snapshot: 'new rendered text' })

    expect(duplicate).toHaveLength(1)
    expect(duplicate[0]).toMatchObject({ instruction: '标题更短一些', snapshot: 'new rendered text' })
  })

  it('builds one actionable multi-slide prompt and omits blank edits', () => {
    const edits: StudioInspectEdit[] = [
      { ...title, instruction: '改成更克制的中文标题' },
      { slideId: 'evidence', path: '$.slides.evidence.objects[1].tree', nodeId: 'metric-growth', kind: 'metric', label: 'Metric', snapshot: '82%', instruction: '  强调这是同比增长  ' },
      { slideId: 'unused', path: '$.slides.unused.body', kind: 'text', label: 'Body', snapshot: 'ignore', instruction: '  ' },
    ]

    const prompt = buildStudioEditPrompt('research-story', '/workspace/decks/research-story/deck.cadenza.json', edits)

    expect(prompt).toContain('Deck: research-story')
    expect(prompt).toContain('Authoritative file: /workspace/decks/research-story/deck.cadenza.json')
    expect(prompt).toContain('Slide: intro')
    expect(prompt).toContain('Path: $.slides.evidence.objects[1].tree')
    expect(prompt).toContain('Node ID: metric-growth')
    expect(prompt).toContain('Instruction: 强调这是同比增长')
    expect(prompt).toContain('cadenza inspect')
    expect(prompt).toContain('cadenza verify research-story --browser')
    expect(prompt).not.toContain('Slide: unused')
  })

  it('copies with the Clipboard API and falls back locally when it fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const fallback = vi.fn().mockReturnValue(true)

    await expect(copyStudioEditPrompt('prompt', { writeText }, fallback)).resolves.toBe('copied')
    expect(fallback).toHaveBeenCalledWith('prompt')
    await expect(copyStudioEditPrompt('', { writeText }, fallback)).resolves.toBe('empty')
    await expect(copyStudioEditPrompt('prompt', undefined, () => false)).resolves.toBe('failed')
  })

  it('summarizes unique affected slides in queue order', () => {
    const edits: StudioInspectEdit[] = [
      { ...title, instruction: 'shorter' },
      { ...title, path: '$.slides.intro.subtitle', instruction: 'clearer' },
      { ...title, slideId: 'evidence', instruction: 'verify' },
    ]
    expect(summarizeInspectSlides(edits)).toEqual({ slideIds: ['intro', 'evidence'], label: '2 个页面 · intro、evidence' })
  })
})
