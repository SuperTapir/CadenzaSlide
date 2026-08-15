import { parseDeckDocument, type DeckDocument } from '../../core/deck-document'
import { verifyDeckValue } from '../../verification/deck-verifier'

export class BrowserDeckRepository {
  document: DeckDocument
  private etag: string | null
  private readonly deckId: string
  private readonly connected: boolean
  private saveCompletion: Promise<void> = Promise.resolve()

  private constructor(document: DeckDocument, deckId: string, etag: string | null, connected: boolean) {
    this.document = document
    this.deckId = deckId
    this.etag = etag
    this.connected = connected
  }

  get isConnected() { return this.connected }

  async hasExternalChange() {
    if (!this.connected) return false
    await this.saveCompletion
    const response = await fetch(`/api/decks/${encodeURIComponent(this.deckId)}`)
    if (!response.ok) throw new Error(`deck.refresh：HTTP ${response.status}`)
    const etag = response.headers.get('etag')
    return Boolean(etag && this.etag && etag !== this.etag)
  }

  static async open(currentUrl: URL) {
    let deckId = currentUrl.searchParams.get('deck')
    if (!deckId) {
      const config = await fetch('/api/config')
      if (!config.ok || !(config.headers.get('content-type') ?? '').includes('application/json')) throw new Error('Workspace API unavailable')
      const value = await config.json() as { defaultDeck?: string }
      if (!value.defaultDeck) throw new Error('Workspace has no default deck')
      deckId = value.defaultDeck
    }
    const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`)
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) throw new Error('Deck API unavailable')
    const source = await response.json()
    return new BrowserDeckRepository(parseDeckDocument(resolveWorkspaceAssets(source, deckId)), deckId, response.headers.get('etag'), true)
  }

  static memory(document: DeckDocument) {
    return new BrowserDeckRepository(structuredClone(document), document.id, null, false)
  }

  async save(document: DeckDocument) {
    const report = verifyDeckValue(document)
    if (!report.ok) throw new Error(`deck.verify：${report.findings.filter(finding => finding.severity === 'error').map(finding => `${finding.ruleId} ${finding.path}`).join('；')}`)
    const parsed = parseDeckDocument(document)
    if (!this.connected) { this.document = parsed; return { persisted: false } }
    let release!: () => void
    this.saveCompletion = new Promise(resolve => { release = resolve })
    try {
      const response = await fetch(`/api/decks/${encodeURIComponent(this.deckId)}`, {
        method: 'PUT', headers: { 'content-type': 'application/json', ...(this.etag ? { 'if-match': this.etag } : {}) }, body: JSON.stringify(restoreWorkspaceAssets(parsed, this.deckId)),
      })
      if (response.status === 409) throw new Error('deck.conflict：Agent 已修改文件，请刷新后重试')
      if (!response.ok) throw new Error(`deck.save：HTTP ${response.status} ${await response.text()}`)
      this.etag = response.headers.get('etag')
      this.document = parsed
      return { persisted: true }
    } finally { release() }
  }
}

function restoreWorkspaceAssets(value: unknown, deckId: string): unknown {
  const prefix = `/api/decks/${encodeURIComponent(deckId)}/assets/`
  if (typeof value === 'string') return value.startsWith(prefix) ? `assets/${value.slice(prefix.length)}` : value
  if (Array.isArray(value)) return value.map(entry => restoreWorkspaceAssets(entry, deckId))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, restoreWorkspaceAssets(entry, deckId)]))
}

function resolveWorkspaceAssets(value: unknown, deckId: string): unknown {
  if (typeof value === 'string' && value.startsWith('assets/')) return `/api/decks/${encodeURIComponent(deckId)}/${value}`
  if (Array.isArray(value)) return value.map(entry => resolveWorkspaceAssets(entry, deckId))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveWorkspaceAssets(entry, deckId)]))
}
