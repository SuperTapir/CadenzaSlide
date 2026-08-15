import type { DeckDocument } from '../../core/deck-document'

export type DeckDocumentStoreStatus =
  | { kind: 'persisted' }
  | { kind: 'memory' }
  | { kind: 'error', message: string }

export type DeckDocumentSaver = (document: DeckDocument) => Promise<{ persisted: boolean }>

export class DeckDocumentStore {
  private current: DeckDocument
  private pendingSave = Promise.resolve()
  private lastSaveError: unknown = null
  private readonly save: DeckDocumentSaver
  private readonly onStatus: (status: DeckDocumentStoreStatus) => void

  constructor(
    document: DeckDocument,
    save: DeckDocumentSaver,
    onStatus: (status: DeckDocumentStoreStatus) => void = () => {},
  ) {
    this.current = document
    this.save = save
    this.onStatus = onStatus
  }

  get document(): DeckDocument { return this.current }

  update(updater: (document: DeckDocument) => DeckDocument): DeckDocument {
    this.current = updater(this.current)
    const snapshot = structuredClone(this.current)
    this.pendingSave = this.pendingSave.then(async () => {
      try {
        const result = await this.save(snapshot)
        this.lastSaveError = null
        this.onStatus({ kind: result.persisted ? 'persisted' : 'memory' })
      } catch (error) {
        this.lastSaveError = error
        this.onStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    })
    return this.current
  }

  whenIdle(): Promise<void> { return this.pendingSave }

  async whenPersisted(): Promise<void> {
    await this.pendingSave
    if (this.lastSaveError) throw this.lastSaveError
  }
}
