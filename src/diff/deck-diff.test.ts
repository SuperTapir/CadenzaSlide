import { describe, expect, it } from 'vitest'
import { demoDeckDocument } from '../examples/demo-deck'
import { summarizeDeckDiff } from './deck-diff'

describe('deck semantic diff', () => {
  it('distinguishes notes, content, master and outline changes', () => {
    const next = structuredClone(demoDeckDocument)
    const ids = Object.keys(next.slides)
    next.slides[ids[0]].notes = 'Changed notes'
    next.master.layouts.title.background = 'white'
    next.outline = [...next.outline].reverse()
    expect(summarizeDeckDiff(demoDeckDocument, next)).toMatchObject({ slides: { [ids[0]]: ['notes'] }, outlineChanged: true, masterChanged: true })
  })
})
