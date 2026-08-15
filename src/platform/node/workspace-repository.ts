import {
  parseDeckDocument,
  parseWorkspaceConfig,
  type DeckDocument,
  type WorkspaceConfigV1,
} from '../../core/deck-document.ts'

export interface WorkspaceReader {
  exists(path: string): boolean
  readText(path: string): string
  listDirectories(path: string): string[]
}

export interface DeckSummary {
  id: string
  title: string
  path: string
}

export function discoverWorkspaceRoot(startPath: string, reader: WorkspaceReader) {
  let current = normalizeAbsolute(startPath)
  while (true) {
    if (reader.exists(joinPath(current, 'cadenza.config.json'))) return current
    const parent = parentPath(current)
    if (parent === current) return undefined
    current = parent
  }
}

export class WorkspaceRepository {
  readonly root: string
  readonly config: WorkspaceConfigV1
  private readonly reader: WorkspaceReader

  constructor(root: string, reader: WorkspaceReader) {
    this.root = normalizeAbsolute(root)
    this.reader = reader
    this.config = parseJson(
      reader.readText(joinPath(this.root, 'cadenza.config.json')),
      parseWorkspaceConfig,
      'cadenza.config.json',
    )
  }

  list(): DeckSummary[] {
    const decksRoot = joinPath(this.root, this.config.decksDirectory)
    return this.reader.listDirectories(decksRoot)
      .map(directory => {
        const path = joinPath(decksRoot, directory, 'deck.cadenza.json')
        if (!this.reader.exists(path)) return undefined
        const deck = this.load(directory)
        return { id: deck.id, title: deck.title, path }
      })
      .filter((deck): deck is DeckSummary => deck !== undefined)
      .sort((left, right) => left.id.localeCompare(right.id))
  }

  load(deckId: string): DeckDocument {
    assertId(deckId)
    const path = joinPath(this.root, this.config.decksDirectory, deckId, 'deck.cadenza.json')
    if (!this.reader.exists(path)) throw new Error(`Deck “${deckId}” not found at ${path}`)
    const deck = parseJson(this.reader.readText(path), parseDeckDocument, path)
    if (deck.id !== deckId) throw new Error(`Deck id “${deck.id}” does not match directory “${deckId}”`)
    return deck
  }

  loadDefault() {
    if (this.config.defaultDeck) return this.load(this.config.defaultDeck)
    const [first] = this.list()
    if (!first) throw new Error('Workspace contains no decks')
    return this.load(first.id)
  }
}

function parseJson<T>(text: string, parser: (value: unknown) => T, source: string) {
  let value: unknown
  try { value = JSON.parse(text) } catch (error) {
    throw new Error(`Invalid JSON in ${source}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return parser(value)
}

function assertId(value: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error(`Invalid deck id “${value}”`)
}

function joinPath(...parts: string[]) {
  return parts.join('/').replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
}

function parentPath(path: string) {
  if (path === '/') return '/'
  const index = path.lastIndexOf('/')
  return index <= 0 ? '/' : path.slice(0, index)
}

function normalizeAbsolute(path: string) {
  const normalized = path.replaceAll('\\', '/').replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  if (!normalized.startsWith('/')) throw new Error(`Workspace path must be absolute: ${path}`)
  return normalized
}
