import { describe, expect, it } from 'vitest'
import { isRevealReceiver, SpeakerNotesRepository, resolveSpeakerNote } from './speaker-notes'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('SpeakerNotesRepository', () => {
  it('keeps notes isolated by deck and stable slide id', () => {
    const storage = new MemoryStorage()
    const deckA = new SpeakerNotesRepository(storage, 'deck-a')
    const deckB = new SpeakerNotesRepository(storage, 'deck-b')

    deckA.save('intro', 'A 的开场备注')
    deckB.save('intro', 'B 的开场备注')

    expect(deckA.load('intro')).toBe('A 的开场备注')
    expect(deckB.load('intro')).toBe('B 的开场备注')
    expect(deckA.load('missing')).toBeNull()
  })

  it('persists an intentionally empty note instead of restoring authored copy', () => {
    const storage = new MemoryStorage()
    const repository = new SpeakerNotesRepository(storage, 'deck')

    repository.save('intro', '')

    expect(repository.load('intro')).toBe('')
    expect(resolveSpeakerNote(repository.load('intro'), '源码里的备注')).toBe('')
  })

  it('uses authored copy only when no saved note exists', () => {
    expect(resolveSpeakerNote(null, '  默认备注  ')).toBe('默认备注')
  })
})

describe('isRevealReceiver', () => {
  it('identifies only Reveal speaker preview receiver URLs', () => {
    expect(isRevealReceiver('?receiver&progress=false')).toBe(true)
    expect(isRevealReceiver('?renderer=canvas2d')).toBe(false)
    expect(isRevealReceiver('')).toBe(false)
  })
})
