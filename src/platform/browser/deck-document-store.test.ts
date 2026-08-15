import { describe, expect, it, vi } from 'vitest'
import { demoDeckDocument } from '../../examples/demo-deck'
import { DeckDocumentStore, type DeckDocumentStoreStatus } from './deck-document-store'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('DeckDocumentStore', () => {
  it('keeps immutable snapshots and saves updates strictly in order', async () => {
    const firstSave = deferred<{ persisted: boolean }>()
    const savedTitles: string[] = []
    const save = vi.fn(async (document: typeof demoDeckDocument) => {
      savedTitles.push(document.title)
      if (savedTitles.length === 1) return firstSave.promise
      return { persisted: true }
    })
    const store = new DeckDocumentStore(demoDeckDocument, save)

    store.update(document => ({ ...document, title: 'First' }))
    store.update(document => ({ ...document, title: 'Second' }))
    await Promise.resolve()

    expect(savedTitles).toEqual(['First'])
    firstSave.resolve({ persisted: true })
    await store.whenIdle()
    expect(savedTitles).toEqual(['First', 'Second'])
    expect(store.document.title).toBe('Second')
  })

  it('reports save status and recovers the queue after a failed write', async () => {
    const statuses: DeckDocumentStoreStatus[] = []
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('deck.conflict'))
      .mockResolvedValueOnce({ persisted: true })
    const store = new DeckDocumentStore(demoDeckDocument, save, status => statuses.push(status))

    store.update(document => ({ ...document, title: 'Conflicted' }))
    await store.whenIdle()
    await expect(store.whenPersisted()).rejects.toThrow('deck.conflict')
    store.update(document => ({ ...document, title: 'Recovered' }))
    await store.whenIdle()
    await expect(store.whenPersisted()).resolves.toBeUndefined()

    expect(save).toHaveBeenCalledTimes(2)
    expect(statuses[0]).toMatchObject({ kind: 'error', message: 'deck.conflict' })
    expect(statuses[1]).toEqual({ kind: 'persisted' })
  })

  it('reports memory-only repositories without treating them as failures', async () => {
    const statuses: DeckDocumentStoreStatus[] = []
    const store = new DeckDocumentStore(demoDeckDocument, async () => ({ persisted: false }), status => statuses.push(status))

    store.update(document => ({ ...document, title: 'Preview' }))
    await store.whenIdle()

    expect(statuses).toEqual([{ kind: 'memory' }])
  })
})
