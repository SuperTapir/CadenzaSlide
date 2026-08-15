import { type UiLocale, uiText } from '../i18n/ui-locale'

export type StudioInspectTarget = {
  slideId: string
  path: string
  nodeId?: string
  kind: string
  label: string
  snapshot: string
}

export type StudioInspectEdit = StudioInspectTarget & { instruction: string }

export function inspectTargetKey(target: Pick<StudioInspectTarget, 'slideId' | 'path' | 'nodeId'>) {
  return `${target.slideId}\n${target.path}\n${target.nodeId ?? ''}`
}

export function addInspectTarget(edits: StudioInspectEdit[], target: StudioInspectTarget) {
  const key = inspectTargetKey(target)
  const existing = edits.findIndex(edit => inspectTargetKey(edit) === key)
  if (existing < 0) return [...edits, { ...target, instruction: '' }]
  return edits.map((edit, index) => index === existing ? { ...edit, ...target, instruction: edit.instruction } : edit)
}

export function summarizeInspectSlides(edits: readonly StudioInspectEdit[], locale: UiLocale = 'zh-CN') {
  const slideIds = [...new Set(edits.map(edit => edit.slideId))]
  return { slideIds, label: uiText(locale).studio.inspectSummary(slideIds.length, slideIds) }
}

export function buildStudioEditPrompt(deckId: string, authoritativeFile: string, edits: readonly StudioInspectEdit[]) {
  const actionable = edits.filter(edit => edit.instruction.trim())
  if (!actionable.length) return ''
  const requests = actionable.map((edit, index) => [
    `${index + 1}. Slide: ${edit.slideId}`,
    `   Target: ${edit.label} (${edit.kind})`,
    `   Path: ${edit.path}`,
    edit.nodeId ? `   Node ID: ${edit.nodeId}` : '',
    `   Current snapshot: ${edit.snapshot || '(non-text element)'}`,
    `   Instruction: ${edit.instruction.trim()}`,
  ].filter(Boolean).join('\n')).join('\n\n')
  const inspectCommands = [...new Set(actionable.map(edit => `\`cadenza inspect ${deckId}/slide:${edit.slideId}\``))].join(', ')

  return `Please update this CadenzaSlide deck according to the inspected edit requests below.\n\nDeck: ${deckId}\nAuthoritative file: ${authoritativeFile}\n\nUse the target metadata as location hints. Confirm targets with ${inspectCommands} before editing, preserve all unspecified content and design intent, and do not treat the rendered DOM as the source of truth.\n\n${requests}\n\nAfter editing, run \`cadenza verify ${deckId} --browser\` and report the result.`
}

export async function copyStudioEditPrompt(
  prompt: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined = navigator.clipboard,
  fallback: (text: string) => boolean = copyWithTemporaryTextarea,
): Promise<'copied' | 'empty' | 'failed'> {
  if (!prompt) return 'empty'
  try {
    if (!clipboard) throw new Error('Clipboard API unavailable')
    await clipboard.writeText(prompt)
    return 'copied'
  } catch {
    return fallback(prompt) ? 'copied' : 'failed'
  }
}

function copyWithTemporaryTextarea(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  return copied
}

type StudioInspectControllerOptions = {
  root: HTMLElement
  deckRoot: HTMLElement
  deckId: string
  authoritativeFile: string
  locale?: UiLocale
}

type ActiveInspectDraft = { target: StudioInspectTarget, element: HTMLElement }

export class StudioInspectController {
  private readonly options: StudioInspectControllerOptions
  private edits: StudioInspectEdit[] = []
  private activeDraft: ActiveInspectDraft | null = null
  private enabled = false
  private locked = false
  private positionFrame = 0
  private readonly toggle: HTMLButtonElement
  private readonly count: HTMLElement
  private readonly list: HTMLElement
  private readonly empty: HTMLElement
  private readonly status: HTMLOutputElement
  private readonly copyButton: HTMLButtonElement
  private readonly clearButton: HTMLButtonElement
  private readonly queueToggle: HTMLButtonElement
  private readonly stage: HTMLElement
  private readonly editor: HTMLElement
  private readonly editorTitle: HTMLElement
  private readonly editorTarget: HTMLElement
  private readonly draft: HTMLTextAreaElement
  private readonly confirmButton: HTMLButtonElement
  private readonly cancelButton: HTMLButtonElement
  private readonly text: ReturnType<typeof uiText>['studio']
  private readonly locale: UiLocale

  constructor(options: StudioInspectControllerOptions) {
    this.options = options
    this.locale = options.locale ?? 'zh-CN'
    this.text = uiText(this.locale).studio
    const query = <T extends Element>(selector: string) => options.root.querySelector<T>(selector)!
    this.toggle = query('#inspect-toggle')
    this.count = query('#studio-edit-count')
    this.list = query('#studio-edit-list')
    this.empty = query('#studio-edit-empty')
    this.status = query('#studio-edit-status')
    this.copyButton = query('#copy-edit-prompt')
    this.clearButton = query('#clear-edit-queue')
    this.queueToggle = query('#edit-queue-toggle')
    this.stage = query('[data-testid="studio-stage"]')
    this.editor = query('#studio-inspect-editor')
    this.editorTitle = query('#studio-inspect-editor-title')
    this.editorTarget = query('#studio-inspect-target')
    this.draft = query('#studio-inspect-draft')
    this.confirmButton = query('#studio-inspect-confirm')
    this.cancelButton = query('#studio-inspect-cancel')
  }

  start() {
    this.toggle.addEventListener('click', this.toggleInspect)
    this.options.deckRoot.addEventListener('click', this.selectFromCanvas, true)
    this.options.deckRoot.addEventListener('keydown', this.selectFromKeyboard, true)
    this.list.addEventListener('input', this.updateInstruction)
    this.list.addEventListener('click', this.removeEdit)
    this.copyButton.addEventListener('click', this.copyPrompt)
    this.clearButton.addEventListener('click', this.clearEdits)
    this.queueToggle.addEventListener('click', this.closeEditorForQueue)
    this.editor.addEventListener('click', this.chooseSuggestion)
    this.editor.addEventListener('keydown', this.handleEditorKeydown)
    this.draft.addEventListener('input', this.updateDraftState)
    this.confirmButton.addEventListener('click', this.confirmDraft)
    this.cancelButton.addEventListener('click', this.cancelDraft)
    this.stage.addEventListener('scroll', this.scheduleEditorPosition)
    window.addEventListener('resize', this.scheduleEditorPosition)
    this.render()
  }

  dispose() {
    this.toggle.removeEventListener('click', this.toggleInspect)
    this.options.deckRoot.removeEventListener('click', this.selectFromCanvas, true)
    this.options.deckRoot.removeEventListener('keydown', this.selectFromKeyboard, true)
    this.list.removeEventListener('input', this.updateInstruction)
    this.list.removeEventListener('click', this.removeEdit)
    this.copyButton.removeEventListener('click', this.copyPrompt)
    this.clearButton.removeEventListener('click', this.clearEdits)
    this.queueToggle.removeEventListener('click', this.closeEditorForQueue)
    this.editor.removeEventListener('click', this.chooseSuggestion)
    this.editor.removeEventListener('keydown', this.handleEditorKeydown)
    this.draft.removeEventListener('input', this.updateDraftState)
    this.confirmButton.removeEventListener('click', this.confirmDraft)
    this.cancelButton.removeEventListener('click', this.cancelDraft)
    this.stage.removeEventListener('scroll', this.scheduleEditorPosition)
    window.removeEventListener('resize', this.scheduleEditorPosition)
    this.setEnabled(false)
  }

  setLocked(locked: boolean) {
    this.locked = locked
    if (locked) this.setEnabled(false)
    this.toggle.disabled = locked
    this.list.querySelectorAll<HTMLTextAreaElement | HTMLButtonElement>('textarea,button').forEach(element => { element.disabled = locked })
    this.copyButton.disabled = locked || !this.hasActionableEdits()
    this.clearButton.disabled = locked || !this.edits.length
    this.editor.querySelectorAll<HTMLTextAreaElement | HTMLButtonElement>('textarea,button').forEach(element => { element.disabled = locked })
  }

  refreshTargets() { this.closeEditor(false); this.syncInteractiveTargets(); this.syncMarkers() }

  private toggleInspect = () => this.setEnabled(!this.enabled)

  private setEnabled(enabled: boolean) {
    this.enabled = enabled && !this.locked
    this.options.root.dataset.inspectMode = String(this.enabled)
    this.toggle.setAttribute('aria-pressed', String(this.enabled))
    this.toggle.textContent = this.enabled ? 'Inspect On' : 'Inspect'
    if (!this.enabled) this.closeEditor(false)
    this.syncInteractiveTargets()
    if (this.enabled) this.status.textContent = this.text.inspectEnabled
  }

  private selectFromCanvas = (event: Event) => {
    if (!this.enabled) return
    const origin = event.target instanceof Element ? event.target : null
    if (origin) this.selectTarget(origin, event)
  }

  private selectFromKeyboard = (event: KeyboardEvent) => {
    if (!this.enabled || (event.key !== 'Enter' && event.key !== ' ')) return
    const origin = event.target instanceof Element ? event.target : null
    if (origin) this.selectTarget(origin, event)
  }

  private selectTarget(origin: Element, event: Event) {
    const inspected = this.inspectTargetFrom(origin)
    if (!inspected) return
    event.preventDefault()
    event.stopImmediatePropagation()
    this.openEditor(inspected.target, inspected.element)
  }

  private inspectTargetFrom(origin: Element): { target: StudioInspectTarget, element: HTMLElement } | null {
    const node = origin.closest<HTMLElement>('[data-node-id]')
    const located = (node ?? origin).closest<HTMLElement>('[data-inspect-path]')
    if (!located) return null
    const slide = located.closest<HTMLElement>('[data-slide-id]')
    const path = located.dataset.inspectPath
    if (!slide?.dataset.slideId || !path) return null
    const exact = node && located.contains(node) ? node : located
    const image = exact.matches('img') ? exact as HTMLImageElement : exact.querySelector<HTMLImageElement>('img')
    return {
      element: exact,
      target: {
        slideId: slide.dataset.slideId,
        path,
        nodeId: node?.dataset.nodeId,
        kind: exact.dataset.inspectKind ?? located.dataset.inspectKind ?? exact.dataset.componentKind ?? 'element',
        label: exact.dataset.inspectLabel ?? located.dataset.inspectLabel ?? 'Slide element',
        snapshot: (image?.alt || exact.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 240),
      },
    }
  }

  private openEditor(target: StudioInspectTarget, element: HTMLElement) {
    const existing = this.edits.find(edit => inspectTargetKey(edit) === inspectTargetKey(target))
    this.activeDraft = { target, element }
    this.editorTitle.textContent = this.text.editTarget(target.label)
    this.editorTarget.textContent = `${target.slideId} · ${target.nodeId ?? target.path}`
    this.draft.value = existing?.instruction ?? ''
    this.confirmButton.textContent = existing ? this.text.update : this.text.confirm
    this.confirmButton.setAttribute('aria-label', existing ? this.text.updateQueue : this.text.addQueue)
    this.confirmButton.disabled = !this.draft.value.trim()
    this.editor.hidden = false
    this.syncMarkers()
    requestAnimationFrame(() => {
      this.positionEditor()
      this.draft.focus()
    })
  }

  private confirmDraft = () => {
    const active = this.activeDraft
    const instruction = this.draft.value.trim()
    if (!active || !instruction) return
    this.edits = addInspectTarget(this.edits, active.target)
    const edit = this.edits.find(item => inspectTargetKey(item) === inspectTargetKey(active.target))!
    edit.instruction = instruction
    this.closeEditor(true)
    this.render()
  }

  private cancelDraft = () => this.closeEditor(true)

  private closeEditorForQueue = () => this.closeEditor(false)

  private closeEditor(restoreFocus: boolean) {
    const target = this.activeDraft?.element
    this.activeDraft = null
    this.editor.hidden = true
    this.editor.style.removeProperty('left')
    this.editor.style.removeProperty('top')
    delete this.editor.dataset.placement
    if (this.positionFrame) cancelAnimationFrame(this.positionFrame)
    this.positionFrame = 0
    this.syncMarkers()
    if (restoreFocus && target?.isConnected) target.focus()
  }

  private chooseSuggestion = (event: Event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-inspect-suggestion]') : null
    const suggestions: Record<string, string> = { polish: this.text.inspectPolish, longer: this.text.inspectLonger, shorter: this.text.inspectShorter, verify: this.text.inspectVerify }
    const suggestion = button?.dataset.inspectSuggestion ? suggestions[button.dataset.inspectSuggestion] : undefined
    if (!suggestion) return
    this.draft.value = suggestion
    this.updateDraftState()
    this.draft.focus()
  }

  private updateDraftState = () => { this.confirmButton.disabled = !this.draft.value.trim() }

  private handleEditorKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    this.closeEditor(true)
  }

  private scheduleEditorPosition = () => {
    if (!this.activeDraft || this.positionFrame) return
    this.positionFrame = requestAnimationFrame(() => {
      this.positionFrame = 0
      this.positionEditor()
    })
  }

  private positionEditor() {
    const target = this.activeDraft?.element
    if (!target?.isConnected || this.editor.hidden) return
    const targetRect = target.getBoundingClientRect()
    const editorRect = this.editor.getBoundingClientRect()
    const margin = 12
    const gap = 10
    const maxLeft = Math.max(margin, window.innerWidth - editorRect.width - margin)
    const left = Math.max(margin, Math.min(targetRect.left, maxLeft))
    const below = targetRect.bottom + gap
    const fitsBelow = below + editorRect.height <= window.innerHeight - margin
    const preferredTop = fitsBelow ? below : targetRect.top - editorRect.height - gap
    const maxTop = Math.max(margin, window.innerHeight - editorRect.height - margin)
    const top = Math.max(margin, Math.min(preferredTop, maxTop))
    this.editor.style.left = `${Math.round(left)}px`
    this.editor.style.top = `${Math.round(top)}px`
    this.editor.dataset.placement = fitsBelow ? 'bottom' : 'top'
  }

  private updateInstruction = (event: Event) => {
    const textarea = event.target instanceof HTMLTextAreaElement ? event.target : null
    const key = textarea?.dataset.editKey
    if (!textarea || !key) return
    const edit = this.edits.find(item => inspectTargetKey(item) === key)
    if (edit) edit.instruction = textarea.value
    this.copyButton.disabled = this.locked || !this.hasActionableEdits()
    this.status.textContent = `${summarizeInspectSlides(this.edits, this.locale).label} · ${this.hasActionableEdits() ? this.text.canCopy : this.text.fillRequest}`
  }

  private removeEdit = (event: Event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-remove-edit]') : null
    const key = button?.dataset.removeEdit
    if (!key) return
    this.edits = this.edits.filter(edit => inspectTargetKey(edit) !== key)
    this.render()
  }

  private clearEdits = () => {
    this.edits = []
    this.render()
    this.status.textContent = this.text.queueCleared
  }

  private copyPrompt = async () => {
    const prompt = buildStudioEditPrompt(this.options.deckId, this.options.authoritativeFile, this.edits)
    const result = await copyStudioEditPrompt(prompt)
    const copiedCount = this.edits.filter(edit => edit.instruction.trim()).length
    this.status.textContent = result === 'copied' ? this.text.copiedEdits(copiedCount) : result === 'empty' ? this.text.emptyEdits : this.text.clipboardFailed
  }

  private hasActionableEdits() { return this.edits.some(edit => edit.instruction.trim()) }

  private render() {
    this.list.replaceChildren(...this.edits.map(edit => this.renderEdit(edit)))
    const summary = summarizeInspectSlides(this.edits, this.locale)
    this.count.textContent = String(summary.slideIds.length)
    this.queueToggle.setAttribute('aria-label', this.text.editQueueLabel(summary.label))
    this.queueToggle.title = summary.label
    this.empty.hidden = this.edits.length > 0
    this.clearButton.disabled = this.locked || !this.edits.length
    this.copyButton.disabled = this.locked || !this.hasActionableEdits()
    if (this.edits.length) this.status.textContent = `${summary.label} · ${this.hasActionableEdits() ? this.text.canCopy : this.text.fillRequest}`
    this.syncMarkers()
  }

  private renderEdit(edit: StudioInspectEdit) {
    const key = inspectTargetKey(edit)
    const article = document.createElement('article')
    article.className = 'studio-edit-item'
    const header = document.createElement('header')
    const label = document.createElement('div')
    const title = document.createElement('b')
    title.textContent = edit.label
    const location = document.createElement('small')
    location.textContent = `${edit.slideId} · ${edit.nodeId ?? edit.path}`
    label.append(title, location)
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.dataset.removeEdit = key
    remove.setAttribute('aria-label', this.text.removeEdit(edit.label))
    remove.textContent = this.text.remove
    header.append(label, remove)
    const snapshot = document.createElement('p')
    snapshot.textContent = edit.snapshot || this.text.nonTextElement
    const textarea = document.createElement('textarea')
    textarea.dataset.editKey = key
    textarea.value = edit.instruction
    textarea.placeholder = this.text.agentInstructionPlaceholder
    textarea.setAttribute('aria-label', this.text.agentInstructionLabel(edit.label))
    textarea.disabled = this.locked
    article.append(header, snapshot, textarea)
    return article
  }

  private syncMarkers() {
    this.options.deckRoot.querySelectorAll<HTMLElement>('[data-inspect-selected]').forEach(element => element.removeAttribute('data-inspect-selected'))
    for (const edit of this.edits) {
      const location = [...this.options.deckRoot.querySelectorAll<HTMLElement>('[data-inspect-path]')].find(element => element.dataset.inspectPath === edit.path && element.closest<HTMLElement>('[data-slide-id]')?.dataset.slideId === edit.slideId)
      const target = edit.nodeId ? [...(location?.querySelectorAll<HTMLElement>('[data-node-id]') ?? [])].find(element => element.dataset.nodeId === edit.nodeId) : location
      target?.setAttribute('data-inspect-selected', '')
    }
    this.activeDraft?.element.setAttribute('data-inspect-selected', '')
  }

  private syncInteractiveTargets() {
    const targets = this.options.deckRoot.querySelectorAll<HTMLElement>('[data-inspect-path], [data-node-id]')
    targets.forEach(target => {
      if (this.enabled) {
        if (!target.hasAttribute('tabindex')) {
          target.tabIndex = 0
          target.dataset.inspectTabAdded = ''
        }
        if (!target.hasAttribute('aria-label')) target.setAttribute('aria-label', target.dataset.inspectLabel ?? target.textContent?.trim().replace(/\s+/g, ' ').slice(0, 120) ?? 'Slide element')
      } else if (target.hasAttribute('data-inspect-tab-added')) {
        target.removeAttribute('tabindex')
        delete target.dataset.inspectTabAdded
      }
    })
  }
}
