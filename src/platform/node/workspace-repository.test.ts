import { describe, expect, it } from 'vitest'
import { WorkspaceRepository, discoverWorkspaceRoot, type WorkspaceReader } from './workspace-repository'
import { createDefaultDeckMaster } from '../../core/deck-master'

function memoryReader(files: Record<string, unknown>): WorkspaceReader {
  const text = new Map(Object.entries(files).map(([path, value]) => [path, JSON.stringify(value)]))
  return {
    exists: path => text.has(path),
    readText: path => {
      const value = text.get(path)
      if (value === undefined) throw new Error(`ENOENT ${path}`)
      return value
    },
    listDirectories: path => {
      const prefix = `${path.replace(/\/$/, '')}/`
      return [...new Set([...text.keys()]
        .filter(entry => entry.startsWith(prefix))
        .map(entry => entry.slice(prefix.length).split('/')[0])
        .filter(Boolean))]
    },
  }
}

const slide = (id: string) => ({
  id, role: 'content', layout: 'blank', label: id, ariaLabel: id,
})

const deck = (id: string, title: string) => ({
  version: 1, id, title, status: 'complete', master: createDefaultDeckMaster(),
  slides: { [id]: slide(id) },
  outline: [{ kind: 'slide', slideId: id }],
})

describe('workspace discovery and repository', () => {
  const reader = memoryReader({
    '/work/cadenza.config.json': { version: 1, decksDirectory: 'decks', defaultDeck: 'alpha' },
    '/work/decks/alpha/deck.cadenza.json': deck('alpha', 'Alpha'),
    '/work/decks/beta/deck.cadenza.json': deck('beta', 'Beta'),
    '/work/decks/not-a-deck/readme.json': {},
  })

  it('discovers the nearest workspace while walking upward', () => {
    expect(discoverWorkspaceRoot('/work/decks/alpha/assets', reader)).toBe('/work')
    expect(discoverWorkspaceRoot('/outside', reader)).toBeUndefined()
  })

  it('lists and loads multiple decks from the configured directory', () => {
    const repository = new WorkspaceRepository('/work', reader)
    expect(repository.list()).toEqual([
      { id: 'alpha', title: 'Alpha', path: '/work/decks/alpha/deck.cadenza.json' },
      { id: 'beta', title: 'Beta', path: '/work/decks/beta/deck.cadenza.json' },
    ])
    expect(repository.load('beta').title).toBe('Beta')
    expect(repository.loadDefault().id).toBe('alpha')
  })

  it('rejects directory/deck identity mismatches instead of selecting another deck', () => {
    const mismatch = memoryReader({
      '/work/cadenza.config.json': { version: 1, decksDirectory: 'decks' },
      '/work/decks/requested/deck.cadenza.json': deck('other', 'Other'),
    })
    expect(() => new WorkspaceRepository('/work', mismatch).load('requested')).toThrow(/does not match/i)
  })

  it('never synthesizes playback or UI preference fields into loaded documents', () => {
    const loaded = new WorkspaceRepository('/work', reader).load('alpha') as unknown as Record<string, unknown>
    expect(loaded.currentSlide).toBeUndefined()
    expect(loaded.collapsedGroups).toBeUndefined()
  })
})
