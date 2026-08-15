import type { RenderableDeckSlide } from '../rendering/core-templates.ts'
import type { DeckDocument, DeckOutlineGroup, DeckOutlineItem } from './deck-document.ts'

export class DeckOutlineOperationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'DeckOutlineOperationError'
    this.code = code
  }
}

export function flattenOutline(outline: readonly DeckOutlineItem[]) {
  return outline.flatMap(item => item.kind === 'slide' ? [item.slideId] : item.slideIds)
}

export function findSlide(deck: Readonly<DeckDocument>, slideId: string): RenderableDeckSlide | undefined {
  return deck.slides[slideId]
}

export function insertGroup(
  outline: readonly DeckOutlineItem[],
  index: number,
  group: Pick<DeckOutlineGroup, 'id' | 'title'>,
) {
  assertIndex(index, outline.length, true)
  if (outline.some(item => item.kind === 'group' && item.id === group.id)) {
    throw new DeckOutlineOperationError('group.duplicate-id', `Group “${group.id}” already exists`)
  }
  const next = cloneOutline(outline)
  next.splice(index, 0, { kind: 'group', id: group.id, title: group.title, slideIds: [] })
  return next
}

export function renameGroup(outline: readonly DeckOutlineItem[], groupId: string, title: string) {
  if (!title.trim()) throw new DeckOutlineOperationError('group.title', 'Group title must not be empty')
  let found = false
  const next = outline.map(item => {
    if (item.kind !== 'group' || item.id !== groupId) return cloneItem(item)
    found = true
    return { ...item, title: title.trim(), slideIds: [...item.slideIds] }
  })
  if (!found) throw new DeckOutlineOperationError('group.not-found', `Group “${groupId}” not found`)
  return next
}

export function ungroup(outline: readonly DeckOutlineItem[], groupId: string) {
  let found = false
  const next = outline.flatMap(item => {
    if (item.kind !== 'group' || item.id !== groupId) return [cloneItem(item)]
    found = true
    return item.slideIds.map(slideId => ({ kind: 'slide' as const, slideId }))
  })
  if (!found) throw new DeckOutlineOperationError('group.not-found', `Group “${groupId}” not found`)
  return next
}

export function moveSlide(
  outline: readonly DeckOutlineItem[],
  slideId: string,
  target: { groupId?: string, index: number },
) {
  const next = cloneOutline(outline)
  let removed = false
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const item = next[index]
    if (item.kind === 'slide' && item.slideId === slideId) {
      next.splice(index, 1)
      removed = true
    } else if (item.kind === 'group') {
      const child = item.slideIds.indexOf(slideId)
      if (child >= 0) {
        item.slideIds.splice(child, 1)
        removed = true
      }
    }
  }
  if (!removed) throw new DeckOutlineOperationError('slide.not-found', `Slide “${slideId}” not found`)

  if (target.groupId !== undefined) {
    const group = next.find((item): item is DeckOutlineGroup => item.kind === 'group' && item.id === target.groupId)
    if (!group) throw new DeckOutlineOperationError('group.not-found', `Group “${target.groupId}” not found`)
    assertIndex(target.index, group.slideIds.length, true)
    group.slideIds.splice(target.index, 0, slideId)
  } else {
    assertIndex(target.index, next.length, true)
    next.splice(target.index, 0, { kind: 'slide', slideId })
  }
  return next
}

export function moveGroup(outline: readonly DeckOutlineItem[], groupId: string, targetIndex: number) {
  const next = cloneOutline(outline)
  const sourceIndex = next.findIndex(item => item.kind === 'group' && item.id === groupId)
  if (sourceIndex < 0) throw new DeckOutlineOperationError('group.not-found', `Group “${groupId}” not found`)
  const [group] = next.splice(sourceIndex, 1)
  assertIndex(targetIndex, next.length, true)
  next.splice(targetIndex, 0, group)
  return next
}

function cloneOutline(outline: readonly DeckOutlineItem[]) {
  return outline.map(cloneItem)
}

function cloneItem(item: DeckOutlineItem): DeckOutlineItem {
  return item.kind === 'slide' ? { ...item } : { ...item, slideIds: [...item.slideIds] }
}

function assertIndex(index: number, length: number, allowEnd: boolean) {
  const maximum = allowEnd ? length : length - 1
  if (!Number.isInteger(index) || index < 0 || index > maximum) {
    throw new DeckOutlineOperationError('outline.index', `Target index ${index} is outside 0..${maximum}`)
  }
}
