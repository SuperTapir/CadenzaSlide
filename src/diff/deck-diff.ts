import type { DeckDocument } from '../core/deck-document.ts'

export interface DeckDiffSummary {
  slides: Record<string, Array<'added' | 'removed' | 'content' | 'notes' | 'design'>>
  outlineChanged: boolean
  masterChanged: boolean
}

export function summarizeDeckDiff(before: Readonly<DeckDocument>, after: Readonly<DeckDocument>): DeckDiffSummary {
  const slides: DeckDiffSummary['slides'] = {}
  const ids = new Set([...Object.keys(before.slides), ...Object.keys(after.slides)])
  for (const id of ids) {
    const left = before.slides[id]
    const right = after.slides[id]
    if (!left) { slides[id] = ['added']; continue }
    if (!right) { slides[id] = ['removed']; continue }
    const changes: Array<'content' | 'notes' | 'design'> = []
    const { notes: leftNotes, ...leftContent } = left
    const { notes: rightNotes, ...rightContent } = right
    if (leftNotes !== rightNotes) changes.push('notes')
    if (JSON.stringify(leftContent) !== JSON.stringify(rightContent)) changes.push('content')
    if (changes.length) slides[id] = changes
  }
  return { slides, outlineChanged: JSON.stringify(before.outline) !== JSON.stringify(after.outline), masterChanged: JSON.stringify(before.master) !== JSON.stringify(after.master) }
}
