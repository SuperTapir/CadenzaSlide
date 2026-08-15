export interface NotesStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export class SpeakerNotesRepository {
  private readonly storage: NotesStorage
  private readonly deckId: string

  constructor(storage: NotesStorage, deckId: string) {
    this.storage = storage
    this.deckId = deckId
  }

  load(slideId: string) {
    return this.storage.getItem(this.key(slideId))
  }

  save(slideId: string, note: string) {
    this.storage.setItem(this.key(slideId), note)
  }

  private key(slideId: string) {
    return `cadenza:speaker-notes:${encodeURIComponent(this.deckId)}:${encodeURIComponent(slideId)}`
  }
}

export interface SpeakerNotesStore {
  load(slideId: string): string | null
  save(slideId: string, note: string): void
}

export function resolveSpeakerNote(saved: string | null, authored: string) {
  return saved === null ? authored.trim() : saved
}

export function isRevealReceiver(search: string) {
  return new URLSearchParams(search).has('receiver')
}

interface SpeakerNotesDeckLike {
  getCurrentSlide(): HTMLElement | undefined
  on(event: 'slidechanged', listener: () => void): void
  off(event: 'slidechanged', listener: () => void): void
}

interface SpeakerNotesEditorElements {
  textarea: HTMLTextAreaElement
  slideLabel: HTMLElement
  status: HTMLElement
}

export class SpeakerNotesEditor {
  private readonly deck: SpeakerNotesDeckLike
  private readonly repository: SpeakerNotesStore
  private readonly elements: SpeakerNotesEditorElements
  private readonly text: ReturnType<typeof uiText>['studio']
  private activeSlide: HTMLElement | null = null
  private dirty = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    deck: SpeakerNotesDeckLike,
    repository: SpeakerNotesStore,
    elements: SpeakerNotesEditorElements,
    locale: UiLocale = 'zh-CN',
  ) {
    this.deck = deck
    this.repository = repository
    this.elements = elements
    this.text = uiText(locale).studio
  }

  hydrate(slides: Iterable<HTMLElement>) {
    for (const slide of slides) {
      const slideId = slide.dataset.notesId
      if (!slideId) continue
      const saved = this.repository.load(slideId)
      if (saved !== null) this.writeSlideNote(slide, saved)
    }
  }

  start() {
    this.elements.textarea.addEventListener('input', this.updateDraft)
    this.elements.textarea.addEventListener('keydown', this.keepEditorKeysLocal)
    this.deck.on('slidechanged', this.syncOpenEditor)
    this.loadSlide(this.deck.getCurrentSlide())
  }

  dispose() {
    if (this.dirty) this.persist()
    this.clearSaveTimer()
    this.elements.textarea.removeEventListener('input', this.updateDraft)
    this.elements.textarea.removeEventListener('keydown', this.keepEditorKeysLocal)
    this.deck.off('slidechanged', this.syncOpenEditor)
  }

  flush() {
    if (this.dirty) this.persist()
  }

  private persist() {
    const slideId = this.activeSlide?.dataset.notesId
    if (!this.activeSlide || !slideId) return
    this.clearSaveTimer()
    const note = this.elements.textarea.value.trim()
    this.repository.save(slideId, note)
    this.writeSlideNote(this.activeSlide, note)
    this.dirty = false
    this.elements.status.textContent = this.text.notesSaved
  }

  private syncOpenEditor = () => {
    if (this.dirty) this.persist()
    this.loadSlide(this.deck.getCurrentSlide())
  }

  private updateDraft = () => {
    if (!this.activeSlide) return
    this.writeSlideNote(this.activeSlide, this.elements.textarea.value.trim())
    this.dirty = true
    this.elements.status.textContent = this.text.notesSaving
    this.clearSaveTimer()
    this.saveTimer = setTimeout(() => this.persist(), 400)
  }

  private clearSaveTimer() {
    if (this.saveTimer === null) return
    clearTimeout(this.saveTimer)
    this.saveTimer = null
  }

  private keepEditorKeysLocal = (event: KeyboardEvent) => event.stopPropagation()

  private loadSlide(slide: HTMLElement | undefined) {
    const slideId = slide?.dataset.notesId
    if (!slide || !slideId) {
      this.activeSlide = null
      return
    }
    this.activeSlide = slide
    const authored = slide.querySelector<HTMLElement>('aside.notes')?.textContent ?? ''
    this.elements.textarea.value = resolveSpeakerNote(this.repository.load(slideId), authored)
    this.elements.slideLabel.textContent = slide.dataset.notesLabel ?? slideId
    this.dirty = false
    this.elements.status.textContent = this.text.notesLoaded
  }

  private writeSlideNote(slide: HTMLElement, note: string) {
    let notes = slide.querySelector<HTMLElement>('aside.notes')
    if (!notes) {
      notes = document.createElement('aside')
      notes.className = 'notes'
      slide.append(notes)
    }
    notes.textContent = note
  }

}
import { type UiLocale, uiText } from '../i18n/ui-locale'
