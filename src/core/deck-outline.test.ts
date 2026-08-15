import { describe, expect, it } from 'vitest'
import {
  DeckOutlineOperationError,
  findSlide,
  flattenOutline,
  insertGroup,
  moveGroup,
  moveSlide,
  renameGroup,
  ungroup,
} from './deck-outline'
import { demoDeckDocument } from '../examples/demo-deck'
import type { DeckOutlineItem } from './deck-document'

const outline: readonly DeckOutlineItem[] = [
  { kind: 'slide', slideId: 'a' },
  { kind: 'group', id: 'middle', title: 'Middle', slideIds: ['b', 'c'] },
  { kind: 'slide', slideId: 'd' },
]

describe('deck outline operations', () => {
  it('flattens groups without turning them into playable slides', () => {
    expect(flattenOutline(outline)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('looks slides up by stable id', () => {
    expect(findSlide(demoDeckDocument, 'intro')?.label).toBe('封面')
    expect(findSlide(demoDeckDocument, 'missing')).toBeUndefined()
  })

  it('ships a coherent Cadenza aesthetic manifesto before the system-proof appendix', () => {
    expect(demoDeckDocument.title).toBe('Cadenza — 为内容重新作曲')
    expect(demoDeckDocument.slides.intro).toMatchObject({
      title: ['不是模板', '是表达的乐器'],
      subtitle: 'CADENZA / COMPOSE WITH INTENT',
    })
    expect(flattenOutline(demoDeckDocument.outline).slice(0, 17)).toEqual([
      'intro', 'title-photo', 'title-photo-alt', 'title-bullets', 'title-bullets-photo',
      'section', 'title-only', 'agenda', 'statement', 'big-fact', 'quote',
      'gallery1', 'gallery2', 'gallery3', 'gallery4', 'photo', 'blank',
    ])
    expect(demoDeckDocument.outline.at(-1)).toMatchObject({ kind: 'group', title: '系统证明 / SYSTEM PROOF' })
  })

  it('inserts and renames a one-level organizational group immutably', () => {
    const inserted = insertGroup(outline, 1, { id: 'new-group', title: 'New group' })
    const renamed = renameGroup(inserted, 'new-group', 'Examples')
    expect(renamed[1]).toEqual({ kind: 'group', id: 'new-group', title: 'Examples', slideIds: [] })
    expect(outline).toHaveLength(3)
  })

  it('moves a slide across group boundaries without changing linear identity', () => {
    const movedIn = moveSlide(outline, 'a', { groupId: 'middle', index: 1 })
    expect(movedIn).toEqual([
      { kind: 'group', id: 'middle', title: 'Middle', slideIds: ['b', 'a', 'c'] },
      { kind: 'slide', slideId: 'd' },
    ])
    expect(flattenOutline(movedIn)).toEqual(['b', 'a', 'c', 'd'])

    const movedOut = moveSlide(movedIn, 'a', { index: 2 })
    expect(movedOut).toEqual([
      { kind: 'group', id: 'middle', title: 'Middle', slideIds: ['b', 'c'] },
      { kind: 'slide', slideId: 'd' },
      { kind: 'slide', slideId: 'a' },
    ])
  })

  it('moves a whole group while retaining internal slide order', () => {
    expect(moveGroup(outline, 'middle', 0)).toEqual([
      { kind: 'group', id: 'middle', title: 'Middle', slideIds: ['b', 'c'] },
      { kind: 'slide', slideId: 'a' },
      { kind: 'slide', slideId: 'd' },
    ])
  })

  it('ungroups in place and keeps every slide', () => {
    expect(ungroup(outline, 'middle')).toEqual([
      { kind: 'slide', slideId: 'a' },
      { kind: 'slide', slideId: 'b' },
      { kind: 'slide', slideId: 'c' },
      { kind: 'slide', slideId: 'd' },
    ])
  })

  it('rejects missing ids, duplicate groups and invalid target indexes', () => {
    expect(() => moveSlide(outline, 'missing', { index: 0 })).toThrowError(DeckOutlineOperationError)
    expect(() => insertGroup(outline, 0, { id: 'middle', title: 'Duplicate' })).toThrow(/already exists/i)
    expect(() => moveGroup(outline, 'middle', 99)).toThrow(/index/i)
    expect(() => renameGroup(outline, 'missing', 'Nope')).toThrow(/not found/i)
  })
})
