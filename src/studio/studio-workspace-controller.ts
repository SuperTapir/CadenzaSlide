import type { SceneId } from '../engine/environment-presets'
import { isEnvironmentPresetId } from '../engine/environment-presets'
import type { CadenzaRuntime } from '../engine/runtime'
import { flattenOutline } from '../core/deck-outline'
import type { DeckDocument, DeckOutlineItem } from '../core/deck-document'
import { coreLayoutIds, type CoreLayoutId } from '../core/deck-master'
import { renderDeckSlides } from '../rendering/core-templates'
import { renderGallerySlidePreview } from '../rendering/gallery-previews'
import { SpeakerNotesEditor } from '../host/speaker-notes'
import type { PresentationSessionController } from '../presentation/presentation-session-controller'
import { isFontThemeId, type FontThemeId } from '../typography/themes'
import type { DeckDocumentStore } from '../platform/browser/deck-document-store'
import { startStudioNavigator } from './studio-navigator'
import { computeFitScale, createResizeFrameScheduler } from './studio-stage'
import { createStudioWorkspaceState, reduceStudioWorkspace, STUDIO_ZOOM_STEP, type StudioPanel, type StudioWorkspaceState } from './studio-workspace-state'
import { changeSlideLayout, layoutInspectorView, reapplySlideLayout, setPlaceholderVisible } from './studio-layout-inspector'
import { queryStudioWorkspaceElements, type StudioWorkspaceElements } from './studio-workspace-elements'
import { StudioInspectController } from './studio-inspect'
import { type UiLocale, uiText } from '../i18n/ui-locale'

type StudioSlideChangedEvent = { currentSlide?: HTMLElement }

export interface StudioWorkspaceDeck {
  getCurrentSlide(): HTMLElement | undefined
  getPlugin(id: string): unknown
  on(event: 'slidechanged', listener: (event: StudioSlideChangedEvent) => void): void
  off(event: 'slidechanged', listener: (event: StudioSlideChangedEvent) => void): void
  slide(index: number, fragment?: number): void
  sync(): void
}

type StudioWorkspaceOptions = {
  root: HTMLElement
  deckRoot: HTMLElement
  authoredSlides: HTMLElement[]
  deckId: string
  sessionId: string
  audienceUrl: string
  designLibraryUrl: string
  deck: StudioWorkspaceDeck
  runtime: CadenzaRuntime
  documentStore: DeckDocumentStore
  session: PresentationSessionController
  applyFontTheme(id: FontThemeId): void
  applyBackground(id: SceneId): void
  updateMode(): void
  locale?: UiLocale
}

export class StudioWorkspaceController {
  private readonly options: StudioWorkspaceOptions
  private readonly elements: StudioWorkspaceElements
  private readonly notesEditor: SpeakerNotesEditor
  private readonly inspectController: StudioInspectController
  private readonly preferenceKey: string
  private readonly text: ReturnType<typeof uiText>['studio']
  private workspaceState: StudioWorkspaceState
  private readonly resizeObserver: ResizeObserver
  private restoreFocusTo: HTMLElement | null = null
  private drawerResizeStart: { pointerId: number, y: number, extent: number } | null = null
  private audienceWindow: Window | null = null
  private disposeNavigator = () => {}
  private started = false
  private disposed = false

  constructor(options: StudioWorkspaceOptions) {
    this.options = options
    this.text = uiText(options.locale ?? 'zh-CN').studio
    this.elements = queryStudioWorkspaceElements(options.root)
    this.workspaceState = createStudioWorkspaceState(options.authoredSlides[0]?.dataset.slideId ?? '')
    const scheduleScale = createResizeFrameScheduler(() => this.applyStageScale())
    this.resizeObserver = new ResizeObserver(() => scheduleScale(undefined))
    this.preferenceKey = `cadenza:studio-ui:v1:${encodeURIComponent(options.deckId)}`
    this.notesEditor = new SpeakerNotesEditor(options.deck, {
      load: slideId => options.documentStore.document.slides[slideId]?.notes ?? null,
      save: (slideId, note) => options.documentStore.update(document => ({
        ...document,
        slides: { ...document.slides, [slideId]: { ...document.slides[slideId], notes: note } },
      })),
    }, {
      textarea: this.elements.notesTextarea,
      slideLabel: this.elements.notesSlideLabel,
      status: this.elements.notesStatus,
    }, options.locale)
    this.inspectController = new StudioInspectController({
      root: options.root,
      deckRoot: options.deckRoot,
      deckId: options.deckId,
      authoritativeFile: `decks/${options.deckId}/deck.cadenza.json`,
      locale: options.locale,
    })
  }

  start() {
    if (this.started || this.disposed) return
    this.started = true
    this.restorePreference()
    this.elements.sessionStatus.querySelector<HTMLElement>('[data-session-id]')!.textContent = this.options.sessionId.slice(0, 8)
    this.notesEditor.hydrate(this.options.authoredSlides)
    this.notesEditor.start()
    this.inspectController.start()
    this.elements.galleryToggle.addEventListener('click', this.openDesignLibrary)
    this.elements.environmentPreset.addEventListener('change', this.changeEnvironment)
    this.elements.fontTheme.addEventListener('change', this.changeFont)
    this.elements.scale.addEventListener('click', this.toggleScale)
    this.elements.motion.addEventListener('click', this.toggleMotion)
    this.elements.play.addEventListener('click', this.togglePlaying)
    this.elements.audienceOpen.addEventListener('click', this.openAudience)
    this.elements.speakerOpen.addEventListener('click', this.openSpeaker)
    this.elements.presentationOpen.addEventListener('click', this.openPresentation)
    this.elements.presentationEnd.addEventListener('click', this.endPresentation)
    this.elements.layoutSelect.addEventListener('change', this.changeCurrentLayout)
    this.elements.placeholderList.addEventListener('change', this.changePlaceholderVisibility)
    this.elements.reapplyLayoutButton.addEventListener('click', this.reapplyCurrentLayout)
    this.elements.railToggle.addEventListener('click', this.toggleRail)
    this.elements.drawerTabs.forEach(tab => tab.addEventListener('click', this.toggleDrawerPanel))
    this.elements.drawerResizeHandle.addEventListener('pointerdown', this.startDrawerResize)
    this.elements.drawerResizeHandle.addEventListener('pointermove', this.moveDrawerResize)
    this.elements.drawerResizeHandle.addEventListener('pointerup', this.endDrawerResize)
    this.elements.drawerResizeHandle.addEventListener('pointercancel', this.endDrawerResize)
    this.elements.drawerResizeHandle.addEventListener('keydown', this.resizeDrawerWithKeyboard)
    this.elements.zoomSlider.addEventListener('input', this.changeZoom)
    this.elements.stageFullscreen.addEventListener('click', this.toggleFullscreen)
    window.addEventListener('message', this.handleRevealNotesConnection)
    window.addEventListener('resize', this.syncResponsiveMode)
    window.addEventListener('keydown', this.handleWorkspaceKeydown, true)
    document.addEventListener('fullscreenchange', this.handleFullscreenChange)
    this.options.deck.on('slidechanged', this.handleWorkspaceSlideChanged)
    this.disposeNavigator = startStudioNavigator(this.options.root, this.options.deck, {
      deckId: this.options.deckId,
      document: this.options.documentStore.document,
      outline: structuredClone(this.options.documentStore.document.outline),
      locale: this.options.locale,
      onOutlineChange: this.updateOutline,
    })
    this.elements.notesWorkspace.removeAttribute('inert')
    this.resizeObserver.observe(this.elements.stage)
    this.syncResponsiveMode()
    this.renderWorkspaceState()
    this.renderLayoutInspector()
    const currentId = this.options.deck.getCurrentSlide()?.dataset.slideId
    const currentIndex = currentId ? this.options.authoredSlides.findIndex(slide => slide.dataset.slideId === currentId) : 0
    this.elements.slideCount.textContent = `${Math.max(1, currentIndex + 1)} / ${this.options.authoredSlides.length}`
    this.options.root.querySelectorAll<HTMLButtonElement>('#gallery-toggle, #audience-open, #speaker-open, #presentation-open').forEach(control => { control.disabled = false })
    document.documentElement.setAttribute('data-studio-ready', '')
  }

  participantReady(role: 'audience' | 'presenter') {
    if (role === 'audience') this.elements.audienceStatus.textContent = this.text.connectedShort
    else this.elements.presenterStatus.textContent = this.text.connectedShort
  }

  async flushPendingWrites() {
    this.notesEditor.flush()
    await this.options.documentStore.whenPersisted()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.audienceWindow?.close()
    this.audienceWindow = null
    if (!this.started) return
    this.elements.galleryToggle.removeEventListener('click', this.openDesignLibrary)
    this.elements.environmentPreset.removeEventListener('change', this.changeEnvironment)
    this.elements.fontTheme.removeEventListener('change', this.changeFont)
    this.elements.scale.removeEventListener('click', this.toggleScale)
    this.elements.motion.removeEventListener('click', this.toggleMotion)
    this.elements.play.removeEventListener('click', this.togglePlaying)
    this.elements.audienceOpen.removeEventListener('click', this.openAudience)
    this.elements.speakerOpen.removeEventListener('click', this.openSpeaker)
    this.elements.presentationOpen.removeEventListener('click', this.openPresentation)
    this.elements.presentationEnd.removeEventListener('click', this.endPresentation)
    this.elements.layoutSelect.removeEventListener('change', this.changeCurrentLayout)
    this.elements.placeholderList.removeEventListener('change', this.changePlaceholderVisibility)
    this.elements.reapplyLayoutButton.removeEventListener('click', this.reapplyCurrentLayout)
    this.elements.railToggle.removeEventListener('click', this.toggleRail)
    this.elements.drawerTabs.forEach(tab => tab.removeEventListener('click', this.toggleDrawerPanel))
    this.elements.drawerResizeHandle.removeEventListener('pointerdown', this.startDrawerResize)
    this.elements.drawerResizeHandle.removeEventListener('pointermove', this.moveDrawerResize)
    this.elements.drawerResizeHandle.removeEventListener('pointerup', this.endDrawerResize)
    this.elements.drawerResizeHandle.removeEventListener('pointercancel', this.endDrawerResize)
    this.elements.drawerResizeHandle.removeEventListener('keydown', this.resizeDrawerWithKeyboard)
    this.elements.zoomSlider.removeEventListener('input', this.changeZoom)
    this.elements.stageFullscreen.removeEventListener('click', this.toggleFullscreen)
    window.removeEventListener('message', this.handleRevealNotesConnection)
    window.removeEventListener('resize', this.syncResponsiveMode)
    window.removeEventListener('keydown', this.handleWorkspaceKeydown, true)
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange)
    this.options.deck.off('slidechanged', this.handleWorkspaceSlideChanged)
    this.resizeObserver.disconnect()
    this.disposeNavigator()
    this.notesEditor.dispose()
    this.inspectController.dispose()
  }

  private restorePreference() {
    try {
      const preference = JSON.parse(localStorage.getItem(this.preferenceKey) ?? '{}') as { drawerExtent?: number }
      if (typeof preference.drawerExtent === 'number') this.workspaceState = reduceStudioWorkspace(this.workspaceState, { type: 'drawer.resize', extent: preference.drawerExtent })
    } catch { localStorage.removeItem(this.preferenceKey) }
  }

  private savePreference = () => localStorage.setItem(this.preferenceKey, JSON.stringify({
    drawerExtent: this.workspaceState.drawerExtent,
  }))

  private openDesignLibrary = () => { window.open(this.options.designLibraryUrl, 'cadenza-design-library') }
  private changeEnvironment = () => {
    if (isEnvironmentPresetId(this.elements.environmentPreset.value)) this.options.applyBackground(this.elements.environmentPreset.value)
  }
  private changeFont = () => {
    if (isFontThemeId(this.elements.fontTheme.value)) this.options.applyFontTheme(this.elements.fontTheme.value)
  }
  private toggleScale = () => {
    this.elements.scale.textContent = `${this.text.dotPitch} ${this.options.runtime.toggleScale()} PX`
    this.options.updateMode()
  }
  private toggleMotion = () => {
    if (this.options.runtime.isReducedMotion) return
    this.options.runtime.toggleEnvironmentMode()
    this.options.updateMode()
  }
  private togglePlaying = () => {
    this.options.runtime.togglePlaying()
    this.elements.play.textContent = this.options.runtime.currentState.playing ? this.text.pauseEnvironment : this.text.playEnvironment
  }

  private activateSession() {
    this.options.session.activate()
    this.elements.sessionStatus.hidden = false
  }

  private openAudience = () => {
    this.activateSession()
    this.elements.audienceStatus.textContent = this.text.waitingConnection
    const url = new URL(this.options.audienceUrl)
    url.searchParams.set('session', this.options.sessionId)
    url.searchParams.set('deck', this.options.deckId)
    this.audienceWindow = window.open(url, 'cadenza-audience')
    if (!this.audienceWindow) {
      this.elements.audienceStatus.textContent = this.text.popupBlocked
      this.elements.workspaceStatus.textContent = this.text.audiencePopupBlocked
    } else this.setEditingLocked(true)
  }

  private openSpeaker = () => {
    this.activateSession()
    this.elements.presenterStatus.textContent = this.text.waitingConnection
    this.elements.workspaceStatus.textContent = this.text.openingPresenter
    const notesPlugin = this.options.deck.getPlugin('notes') as { open(): void } | undefined
    notesPlugin?.open()
  }

  private openPresentation = async () => {
    this.elements.presentationOpen.disabled = true
    this.elements.presentationOpen.setAttribute('aria-busy', 'true')
    try {
    const { verifyDeckValue } = await import('../verification/deck-verifier')
    const document = this.options.documentStore.document
    const report = verifyDeckValue(document)
    const brokenMedia = [...this.options.deckRoot.querySelectorAll<HTMLImageElement>('img')].filter(image => image.complete && image.naturalWidth === 0)
    if (!report.ok || document.status !== 'complete' || brokenMedia.length > 0) {
      this.elements.workspaceStatus.textContent = `${this.text.preflightFailed} · ${report.findings[0]?.ruleId ?? 'media.load'}`
      return
    }
    this.openAudience()
    } finally {
      this.elements.presentationOpen.removeAttribute('aria-busy')
      if (!document.documentElement.hasAttribute('data-presentation-active')) this.elements.presentationOpen.disabled = false
    }
  }

  private endPresentation = () => {
    this.options.session.end()
    this.audienceWindow?.close()
    this.audienceWindow = null
    this.elements.audienceStatus.textContent = this.text.ended
    this.elements.presenterStatus.textContent = this.text.ended
    this.setEditingLocked(false)
  }

  private setEditingLocked(locked: boolean) {
    document.documentElement.toggleAttribute('data-presentation-active', locked)
    this.elements.notesWorkspace.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input,textarea,button').forEach(element => { element.disabled = locked })
    this.options.root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('[data-panel="layout"] input, [data-panel="layout"] select, [data-panel="layout"] button').forEach(element => { element.disabled = locked })
    this.inspectController.setLocked(locked)
    this.options.root.querySelectorAll<HTMLElement>('[data-navigator-slide]').forEach(element => { element.draggable = !locked })
    this.elements.presentationOpen.hidden = locked
    this.elements.presentationOpen.disabled = locked
    this.elements.presentationEnd.hidden = !locked
    this.elements.presentationEnd.disabled = !locked
    ;(locked ? this.elements.presentationEnd : this.elements.presentationOpen).focus()
  }

  private handleRevealNotesConnection = (event: MessageEvent) => {
    if (event.origin !== location.origin || typeof event.data !== 'string') return
    try {
      const message = JSON.parse(event.data) as { namespace?: string, type?: string }
      if (message.namespace === 'reveal-notes' && message.type === 'connected') this.elements.presenterStatus.textContent = this.text.connectedShort
    } catch { /* Ignore unrelated window messages. */ }
  }

  private updateOutline = (outline: DeckOutlineItem[]) => {
    const currentId = this.options.deck.getCurrentSlide()?.dataset.slideId
    const slidesHost = this.options.deckRoot.querySelector<HTMLElement>('.slides')!
    flattenOutline(outline).forEach(id => {
      const slide = this.options.authoredSlides.find(element => element.dataset.slideId === id)
      if (slide) slidesHost.append(slide)
    })
    this.options.deck.sync()
    const currentIndex = currentId ? flattenOutline(outline).indexOf(currentId) : 0
    if (currentIndex >= 0) this.options.deck.slide(currentIndex)
    this.options.documentStore.update(document => ({ ...document, outline }))
  }

  private setWorkspaceState(next: StudioWorkspaceState) {
    this.workspaceState = next
    this.renderWorkspaceState()
  }

  private renderWorkspaceState() {
    const state = this.workspaceState
    this.options.root.dataset.railMode = state.railMode
    this.options.root.dataset.activePanel = state.activePanel ?? ''
    this.elements.drawer.dataset.open = String(state.activePanel !== null)
    this.elements.drawer.style.height = state.activePanel ? `${state.drawerExtent}px` : ''
    this.elements.drawerResizeHandle.setAttribute('aria-valuenow', String(state.drawerExtent))
    this.elements.rail.inert = state.railMode === 'collapsed'
    if (state.railMode === 'overlay') { this.elements.rail.setAttribute('role', 'dialog'); this.elements.rail.setAttribute('aria-modal', 'true'); this.elements.rail.setAttribute('aria-label', this.text.pageNavigation) }
    else { this.elements.rail.removeAttribute('role'); this.elements.rail.removeAttribute('aria-modal'); this.elements.rail.removeAttribute('aria-label') }
    const narrowDrawer = matchMedia('(max-width: 760px)').matches && state.activePanel !== null
    this.elements.drawer.toggleAttribute('role', narrowDrawer)
    if (narrowDrawer) { this.elements.drawer.setAttribute('aria-modal', 'true'); this.elements.drawer.setAttribute('aria-label', this.text.pageWorkspace) }
    else this.elements.drawer.removeAttribute('aria-modal')
    this.elements.drawerTabs.forEach(tab => tab.setAttribute('aria-expanded', String(tab.dataset.drawerPanel === state.activePanel)))
    this.elements.drawer.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== state.activePanel })
    this.applyStageScale()
  }

  private applyStageScale() {
    const rect = this.elements.stage.getBoundingClientRect()
    const stageStyle = getComputedStyle(this.elements.stage)
    const horizontalPadding = Number.parseFloat(stageStyle.paddingLeft) + Number.parseFloat(stageStyle.paddingRight)
    const scale = this.workspaceState.zoomMode === 'fit'
      ? computeFitScale({ width: 1280, height: 720 }, { width: Math.max(0, rect.width - horizontalPadding), height: Math.max(0, rect.height - 32) })
      : this.workspaceState.zoomPercent / 100
    this.elements.canvasViewport.style.width = `${1280 * scale}px`
    this.elements.canvasViewport.style.height = `${720 * scale}px`
    this.elements.canvasTransform.style.transform = `scale(${scale})`
    this.elements.canvasTransform.dataset.previewScale = String(scale)
    const percent = Math.round(scale * 100)
    this.elements.zoomSlider.value = String(percent)
    this.elements.zoomValue.value = `${percent}%`
  }

  private changeZoom = () => this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, { type: 'zoom.set', percent: Number(this.elements.zoomSlider.value) }))
  private zoomOut = () => this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, { type: 'zoom.set', percent: Number(this.elements.zoomSlider.value) - STUDIO_ZOOM_STEP }))
  private zoomIn = () => this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, { type: 'zoom.set', percent: Number(this.elements.zoomSlider.value) + STUDIO_ZOOM_STEP }))
  private zoomFit = () => this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, { type: 'zoom.fit' }))

  private startDrawerResize = (event: PointerEvent) => {
    if (!this.workspaceState.activePanel) return
    this.drawerResizeStart = { pointerId: event.pointerId, y: event.clientY, extent: this.workspaceState.drawerExtent }
    this.elements.drawerResizeHandle.setPointerCapture(event.pointerId)
    this.elements.drawerResizeHandle.toggleAttribute('data-resizing', true)
    event.preventDefault()
  }

  private moveDrawerResize = (event: PointerEvent) => {
    const start = this.drawerResizeStart
    if (!start || start.pointerId !== event.pointerId) return
    this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, { type: 'drawer.resize', extent: start.extent + start.y - event.clientY }))
  }

  private endDrawerResize = (event: PointerEvent) => {
    if (!this.drawerResizeStart || this.drawerResizeStart.pointerId !== event.pointerId) return
    this.drawerResizeStart = null
    this.elements.drawerResizeHandle.toggleAttribute('data-resizing', false)
    if (this.elements.drawerResizeHandle.hasPointerCapture(event.pointerId)) this.elements.drawerResizeHandle.releasePointerCapture(event.pointerId)
    this.savePreference()
  }

  private resizeDrawerWithKeyboard = (event: KeyboardEvent) => {
    if (!this.workspaceState.activePanel || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    const delta = event.key === 'ArrowUp' ? 16 : -16
    this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, { type: 'drawer.resize', extent: this.workspaceState.drawerExtent + delta }))
    this.savePreference()
  }

  private toggleDrawerPanel = (event: Event) => {
    const trigger = event.currentTarget as HTMLButtonElement
    const panel = trigger.dataset.drawerPanel as StudioPanel
    this.restoreFocusTo = trigger
    this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, this.workspaceState.activePanel === panel ? { type: 'panel.close' } : { type: 'panel.open', panel }))
    if (this.workspaceState.activePanel) requestAnimationFrame(() => this.elements.drawer.querySelector<HTMLElement>('[data-panel]:not([hidden]) textarea, [data-panel]:not([hidden]) button, [data-panel]:not([hidden]) [tabindex]')?.focus())
    else this.restoreFocusTo?.focus()
  }

  private toggleRail = () => {
    this.restoreFocusTo = this.elements.railToggle
    const narrow = matchMedia('(max-width: 760px)').matches
    const next = this.workspaceState.railMode === 'overlay' ? 'collapsed' : narrow ? 'overlay' : this.workspaceState.railMode === 'expanded' ? 'collapsed' : 'expanded'
    this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, { type: 'rail.set', mode: next }))
    if (next === 'overlay') requestAnimationFrame(() => this.elements.rail.querySelector<HTMLButtonElement>('button')?.focus())
    else this.elements.railToggle.focus()
  }

  private syncResponsiveMode = () => {
    const next = matchMedia('(max-width: 760px)').matches ? 'collapsed' : matchMedia('(max-width: 1080px)').matches ? 'collapsed' : 'expanded'
    if (this.workspaceState.railMode !== 'overlay') this.workspaceState = reduceStudioWorkspace(this.workspaceState, { type: 'rail.set', mode: next })
    this.renderWorkspaceState()
  }

  private toggleFullscreen = async () => {
    if (document.fullscreenElement === this.elements.stage) return document.exitFullscreen()
    try { await this.elements.stage.requestFullscreen() }
    catch {
      this.elements.fullscreenStatus.textContent = this.text.fullscreenRejected
      this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, { type: 'fullscreen.set', value: false }))
    }
  }

  private handleFullscreenChange = () => this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, { type: 'fullscreen.set', value: document.fullscreenElement === this.elements.stage }))

  private handleWorkspaceSlideChanged = (event: StudioSlideChangedEvent) => {
    const slideId = event.currentSlide?.dataset.slideId
    if (!slideId) return
    this.workspaceState = reduceStudioWorkspace(this.workspaceState, { type: 'slide.select', slideId })
    const index = this.options.authoredSlides.findIndex(slide => slide.dataset.slideId === slideId)
    this.elements.slideCount.textContent = `${Math.max(1, index + 1)} / ${this.options.authoredSlides.length}`
    this.renderLayoutInspector()
    this.inspectController.refreshTargets()
  }

  private changeCurrentLayout = () => {
    const slideId = this.currentSlideId()
    const target = this.elements.layoutSelect.value
    if (!slideId || !(coreLayoutIds as readonly string[]).includes(target)) return
    const current = this.options.documentStore.document.slides[slideId]
    if (current?.layout === target) return
    const result = changeSlideLayout(this.options.documentStore.document, slideId, target as CoreLayoutId)
    if (!result.document) {
      this.elements.layoutInspectorStatus.textContent = `${this.text.layoutSwitchFailed}: ${result.diagnostics.map(item => item.tag || item.sourceSlot).join(', ')} ${this.text.noTargetPosition}`
      this.elements.layoutSelect.value = current?.layout ?? ''
      return
    }
    this.commitSlideDocument(result.document, slideId, `${this.text.layoutSwitched} ${target}; ${this.text.contentPreserved}`)
  }

  private changePlaceholderVisibility = (event: Event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null
    const slideId = this.currentSlideId()
    const placeholderId = input?.dataset.placeholderVisibility
    if (!slideId || !placeholderId) return
    const next = setPlaceholderVisible(this.options.documentStore.document, slideId, placeholderId, input.checked)
    this.commitSlideDocument(next, slideId, input.checked ? `${this.text.shown} ${placeholderId}` : `${this.text.hidden} ${placeholderId}; ${this.text.contentStillPreserved}`)
  }

  private reapplyCurrentLayout = () => {
    const slideId = this.currentSlideId()
    if (!slideId) return
    this.commitSlideDocument(reapplySlideLayout(this.options.documentStore.document, slideId), slideId, this.text.layoutReapplied)
  }

  private currentSlideId() {
    return this.options.deck.getCurrentSlide()?.dataset.slideId ?? this.workspaceState.selectedSlideId
  }

  private commitSlideDocument(document: DeckDocument, slideId: string, message: string) {
    this.options.documentStore.update(() => document)
    this.refreshAuthoredSlide(slideId)
    this.renderLayoutInspector()
    this.elements.layoutInspectorStatus.textContent = message
  }

  private refreshAuthoredSlide(slideId: string) {
    const current = this.options.authoredSlides.find(slide => slide.dataset.slideId === slideId)
    const slide = this.options.documentStore.document.slides[slideId]
    if (!current || !slide) return
    const template = document.createElement('template')
    template.innerHTML = renderDeckSlides([slide], this.options.documentStore.document.master).trim()
    const rendered = template.content.firstElementChild as HTMLElement | null
    if (!rendered) return
    for (const attribute of [...rendered.attributes]) if (attribute.name.startsWith('data-')) current.setAttribute(attribute.name, attribute.value)
    current.innerHTML = rendered.innerHTML
    const previewHost = this.options.root.querySelector<HTMLElement>(`[data-navigator-select="${CSS.escape(slideId)}"] [data-gallery-slide-preview]`)
    const previewTemplate = previewHost?.querySelector<HTMLTemplateElement>('[data-gallery-preview-template]')
    if (previewHost && previewTemplate) {
      previewTemplate.innerHTML = rendered.outerHTML
      renderGallerySlidePreview(previewHost, current)
    }
    this.options.deck.sync()
    this.inspectController.refreshTargets()
  }

  private renderLayoutInspector() {
    const slideId = this.currentSlideId()
    if (!slideId) return
    try {
      const view = layoutInspectorView(this.options.documentStore.document, slideId)
      this.elements.layoutSelect.innerHTML = view.layouts.map(layout => `<option value="${layout}"${layout === view.layout ? ' selected' : ''}>${layout}</option>`).join('')
      this.elements.placeholderList.innerHTML = view.placeholders.map(item => `<label><input type="checkbox" data-placeholder-visibility="${escapeHtml(item.id)}" ${item.visible ? 'checked' : ''}><span><b>${escapeHtml(item.id)}</b><small>${escapeHtml(item.tag)} · ${item.hasContent ? this.text.hasContent : this.text.emptyHidden}</small></span></label>`).join('')
      this.elements.layoutInspectorStatus.textContent = `${view.layout} · ${this.text.optionalPositionCount(view.placeholders.length)}`
    } catch (error) {
      this.elements.layoutInspectorStatus.textContent = error instanceof Error ? error.message : String(error)
      this.elements.placeholderList.replaceChildren()
    }
  }

  private handleWorkspaceKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (event.key === 'Escape') {
      if (this.workspaceState.railMode === 'overlay') return this.toggleRail()
      if (this.workspaceState.activePanel) {
        this.setWorkspaceState(reduceStudioWorkspace(this.workspaceState, { type: 'panel.close' }))
        this.restoreFocusTo?.focus()
      }
      return
    }
    const trapped = this.workspaceState.railMode === 'overlay' ? this.elements.rail : matchMedia('(max-width: 760px)').matches && this.workspaceState.activePanel ? this.elements.drawer : null
    if (event.key === 'Tab' && trapped) {
      const focusable = [...trapped.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden && element.getClientRects().length > 0)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      return
    }
    if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
    if (event.key === '0') { event.preventDefault(); this.zoomFit() }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); this.zoomIn() }
    if (event.key === '-') { event.preventDefault(); this.zoomOut() }
  }
}

function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
