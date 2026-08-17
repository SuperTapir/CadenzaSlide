import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createDefaultDeckMaster } from '../../core/deck-master'
import { extractDeckArchive, packDeckArchive } from './deck-archive'

function workspaceFixture() {
  const root = mkdtempSync(join(tmpdir(), 'cadenza-archive-'))
  const deckDir = join(root, 'decks', 'demo')
  mkdirSync(join(deckDir, 'assets', 'nested'), { recursive: true })
  writeFileSync(join(root, 'cadenza.config.json'), JSON.stringify({ version: 1, decksDirectory: 'decks', defaultDeck: 'demo' }))
  writeFileSync(join(deckDir, 'deck.cadenza.json'), JSON.stringify({
    version: 1, id: 'demo', title: 'Portable demo', status: 'complete', master: createDefaultDeckMaster(),
    slides: { intro: { id: 'intro', role: 'intro', layout: 'title', label: 'Intro', ariaLabel: 'Intro', title: ['Portable demo'] } },
    outline: [{ kind: 'slide', slideId: 'intro' }],
  }))
  writeFileSync(join(deckDir, 'assets', 'nested', 'pixel.bin'), new Uint8Array([0, 1, 2, 255]))
  return { root, deckDir }
}

describe('single-file deck archives', () => {
  it('packs a deterministic ZIP and restores a standalone workspace without changing the deck', async () => {
    const { root, deckDir } = workspaceFixture()
    const first = join(root, 'demo.cadenza')
    const second = join(root, 'demo-copy.cadenza')
    await packDeckArchive({ deckDir, output: first })
    await packDeckArchive({ deckDir, output: second })

    expect(readFileSync(first).subarray(0, 2).toString()).toBe('PK')
    expect(readFileSync(first).equals(readFileSync(second))).toBe(true)

    const target = join(root, 'restored')
    const result = await extractDeckArchive(first, target)
    expect(result).toEqual({ workspaceRoot: target, deckId: 'demo' })
    expect(JSON.parse(readFileSync(join(target, 'cadenza.config.json'), 'utf8'))).toEqual({ version: 1, decksDirectory: 'decks', defaultDeck: 'demo' })
    expect(readFileSync(join(target, 'decks', 'demo', 'deck.cadenza.json'), 'utf8')).toBe(readFileSync(join(deckDir, 'deck.cadenza.json'), 'utf8'))
    expect([...readFileSync(join(target, 'decks', 'demo', 'assets', 'nested', 'pixel.bin'))]).toEqual([0, 1, 2, 255])
  })

  it('rejects traversal entries before they can escape the temporary extraction root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cadenza-archive-'))
    const archive = join(root, 'hostile.cadenza')
    writeFileSync(archive, zipSync({
      'manifest.json': strToU8(JSON.stringify({ format: 'cadenza-deck', version: 1, document: 'deck.cadenza.json' })),
      'deck.cadenza.json': strToU8('{}'),
      '../escaped.txt': strToU8('nope'),
    }))

    await expect(extractDeckArchive(archive, join(root, 'opened'))).rejects.toThrow(/unsafe archive path/i)
    expect(existsSync(join(root, 'escaped.txt'))).toBe(false)
    expect(existsSync(join(root, 'opened'))).toBe(false)
  })

  it('refuses to replace an existing output file or workspace', async () => {
    const { root, deckDir } = workspaceFixture()
    const archive = join(root, 'demo.cadenza')
    writeFileSync(archive, 'keep')
    await expect(packDeckArchive({ deckDir, output: archive })).rejects.toThrow(/already exists/i)
    expect(readFileSync(archive, 'utf8')).toBe('keep')
    await expect(extractDeckArchive(archive, root)).rejects.toThrow(/already exists/i)
  })
})
