import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WorkspaceReader } from '../../platform/node/workspace-repository.ts'
import { discoverWorkspaceRoot } from '../../platform/node/workspace-repository.ts'
import { createDefaultDeckMaster } from '../../core/deck-master.ts'

export interface RuntimeContext {
  runtimeRoot: string
  workspaceRoot: string
}

const runtimeModuleDirectory = dirname(fileURLToPath(import.meta.url))
export const defaultRuntimeRoot = [resolve(runtimeModuleDirectory, '../..'), resolve(runtimeModuleDirectory, '../../..')]
  .find(candidate => existsSync(resolve(candidate, 'package.json')))
  ?? resolve(runtimeModuleDirectory, '../..')

export function resolveRuntimeContext(options: {
  cwd: string
  runtimeRoot?: string
  workspace?: string
  reader: WorkspaceReader
}): RuntimeContext | undefined {
  const requested = options.workspace ? resolve(options.cwd, options.workspace) : options.cwd
  const workspaceRoot = discoverWorkspaceRoot(requested, options.reader)
  return workspaceRoot ? { runtimeRoot: resolve(options.runtimeRoot ?? defaultRuntimeRoot), workspaceRoot } : undefined
}

export function initializeWorkspace(path: string) {
  const root = resolve(path)
  const config = resolve(root, 'cadenza.config.json')
  if (existsSync(config)) throw Object.assign(new Error(`Cadenza workspace already exists at ${root}`), { code: 'cli.workspace-exists' })
  mkdirSync(resolve(root, 'decks'), { recursive: true })
  writeFileSync(config, `${JSON.stringify({ version: 1, decksDirectory: 'decks' }, null, 2)}\n`, { flag: 'wx' })
  const readme = resolve(root, 'README.md')
  if (!existsSync(readme)) writeFileSync(readme, '# Cadenza workspace\n\nDecks live in `decks/<deck-id>/` with `deck.cadenza.json` and optional `assets/`.\n', { flag: 'wx' })
  return root
}

export function initializeDeck(workspaceRoot: string, decksDirectory: string, deckId: string, title = deckId) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(deckId)) {
    throw Object.assign(new Error(`Invalid deck id “${deckId}”; use kebab-case`), { code: 'cli.deck-id' })
  }
  const normalizedTitle = title.trim()
  if (!normalizedTitle) throw Object.assign(new Error('Deck title must not be empty'), { code: 'cli.deck-title' })
  const deckDir = resolve(workspaceRoot, decksDirectory, deckId)
  if (existsSync(deckDir)) throw Object.assign(new Error(`Deck “${deckId}” already exists at ${deckDir}`), { code: 'cli.deck-exists' })

  const deck = {
    version: 1,
    id: deckId,
    title: normalizedTitle,
    status: 'outline',
    master: createDefaultDeckMaster(),
    slides: {
      intro: {
        id: 'intro', role: 'intro', layout: 'title', label: normalizedTitle,
        ariaLabel: normalizedTitle, title: [normalizedTitle],
      },
    },
    outline: [{ kind: 'slide', slideId: 'intro' }],
  }
  mkdirSync(resolve(deckDir, 'assets'), { recursive: true })
  const file = resolve(deckDir, 'deck.cadenza.json')
  writeFileSync(file, `${JSON.stringify(deck, null, 2)}\n`, { flag: 'wx' })
  return { deckId, file, assets: resolve(deckDir, 'assets') }
}
