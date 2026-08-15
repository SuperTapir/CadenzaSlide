import Reveal from 'reveal.js'
import Highlight from 'reveal.js/plugin/highlight'
import Notes from 'reveal.js/plugin/notes'
import 'reveal.js/reveal.css'
import 'reveal.js/plugin/highlight/monokai.css'
import { audienceUrl, designLibraryUrl, resolveAppMode } from './app-mode'
import { renderAppShell } from './app-shell'
import { renderDeckSlides } from '../../rendering/core-templates'
import { hydrateOneBitImages } from '../../rendering/media-one-bit'
import { flattenOutline } from '../../core/deck-outline'
import { renderDeckMaster } from '../../rendering/deck-master-gallery'
import { environmentPresetIds, environmentPresets, type SceneId } from '../../engine/environment-presets'
import { CadenzaRuntime } from '../../engine/runtime'
import { sceneCopy } from '../../engine/types'
import { MediaLightbox, renderMediaLightbox } from '../../host/media-lightbox'
import { RevealHostController } from '../../host/reveal-controller'
import { revealHostOptions } from '../../host/reveal-options'
import { ElementMotionController } from '../../motion/element-controller'
import { MotionPreference } from '../../motion/motion-preference'
import { FullSlideTransition } from '../../motion/slide-transition'
import { PresentationSessionController, type PresentationSessionMode } from '../../presentation/presentation-session-controller'
import { StudioWorkspaceController, type StudioWorkspaceDeck } from '../../studio/studio-workspace-controller'
import { renderStudioNavigator } from '../../studio/studio-navigator'
import { fontThemeIds, fontThemes, type FontThemeId } from '../../typography/themes'
import { DeckDocumentStore } from '../../platform/browser/deck-document-store'
import { hydrateOneBitVisuals } from '../../visual-assets/one-bit-visual'
import { hydrateSmilVisuals } from '../../visual-assets/smil-visual'
import { openBrowserDeck } from './open-browser-deck'
import { buildStudioReloadUrl, clearStudioResume, isCurrentDeckFile, resolveStudioResume } from '../../studio/studio-deck-updates'
import { resolveUiLocale, uiText } from '../../i18n/ui-locale'

const appMode = resolveAppMode(location) as PresentationSessionMode
const locale = resolveUiLocale(new URL(location.href), navigator.language)
const ui = uiText(locale)
const isStudio = appMode === 'studio'
const repository = await openBrowserDeck(new URL(location.href))
const initialDocument = repository.document
const deckId = initialDocument.id
const sessionId = new URLSearchParams(location.search).get('session') ?? (isStudio ? crypto.randomUUID() : 'default')

document.documentElement.dataset.appMode = appMode
document.documentElement.lang = locale
document.documentElement.toggleAttribute('data-reveal-receiver', appMode === 'receiver')
document.querySelector<HTMLDivElement>('#app')!.innerHTML = renderAppShell({
  mode: appMode,
  fontTheme: initialDocument.master.typography,
  slidesHtml: renderDeckSlides(flattenOutline(initialDocument.outline).map(id => initialDocument.slides[id]), initialDocument.master),
  environmentOptions: environmentPresetIds.map(id => `<option value="${id}">${environmentPresets[id].label}</option>`).join(''),
  fontThemeOptions: fontThemeIds.map(id => `<option value="${id}">${fontThemes[id].label}</option>`).join(''),
  designLibraryHtml: isStudio ? renderDeckMaster(initialDocument.master, locale) : '',
  mediaLightboxHtml: renderMediaLightbox(locale),
  navigatorHtml: isStudio ? renderStudioNavigator(initialDocument, locale) : '',
  locale,
  currentHref: location.href,
})

const app = document.querySelector<HTMLElement>('.app-shell')!
const disposeOneBitImages = hydrateOneBitImages(app)
const disposeOneBitVisuals = hydrateOneBitVisuals(app)
const disposeSmilVisuals = hydrateSmilVisuals(app)
const frame = app.querySelector<HTMLElement>('.deck-frame')!
const environmentHost = app.querySelector<HTMLElement>('#environment')!
const deckRoot = app.querySelector<HTMLElement>('.reveal')!
const workspaceStatus = app.querySelector<HTMLElement>('#workspace-status')
const slideLabel = app.querySelector<HTMLElement>('#slide-label')
const environmentPreset = app.querySelector<HTMLSelectElement>('#environment-preset')
const motion = app.querySelector<HTMLButtonElement>('#motion')
const fontTheme = app.querySelector<HTMLSelectElement>('#font-theme')
const authoredSlides = [...app.querySelectorAll<HTMLElement>('[data-slide-id]')]

if (workspaceStatus) workspaceStatus.textContent = repository.isConnected ? ui.studio.connected : ui.studio.disconnected

const documentStore = new DeckDocumentStore(initialDocument, document => repository.save(document), status => {
  if (!workspaceStatus) return
  if (status.kind === 'persisted') workspaceStatus.textContent = ui.studio.persisted
  else if (status.kind === 'memory') workspaceStatus.textContent = ui.studio.memoryOnly
  else workspaceStatus.textContent = status.message
})

const runtime = new CadenzaRuntime(environmentHost, frame, app.querySelector<HTMLElement>('.floating-object')!, {
  preferWebGl: new URLSearchParams(location.search).get('renderer') !== 'canvas2d',
})
const motionPreference = new MotionPreference()
runtime.setReducedMotion(motionPreference.reduced)

const deck = new Reveal(deckRoot, {
  ...revealHostOptions,
  ...(appMode === 'audience' ? { keyboard: true, touch: true, controls: true, progress: false } : {}),
  plugins: [Highlight, Notes],
})
const elementMotionController = new ElementMotionController({
  on: (event, listener) => deck.on(event, listener as EventListener),
  off: (event, listener) => deck.off(event, listener as EventListener),
}, motionPreference.reduced)
const slideTransition = new FullSlideTransition({
  stage: frame,
  revealRoot: deckRoot,
  getGridScale: () => runtime.currentState.ditherScale,
  captureEnvironment: () => runtime.captureFrame(),
  reducedMotion: motionPreference.reduced,
})

function updateMode() {
  const state = runtime.currentState
  if (environmentPreset) environmentPreset.value = state.scene
  if (motion) {
    motion.textContent = state.environmentMode === 'loop' ? ui.studio.environmentMoving : ui.studio.environmentStill
    motion.setAttribute('aria-pressed', String(state.environmentMode === 'loop'))
    motion.disabled = runtime.isReducedMotion
    motion.title = runtime.isReducedMotion ? ui.studio.reducedMotion : ''
  }
}

function applyFontTheme(id: FontThemeId) {
  frame.dataset.fontTheme = id
  if (fontTheme) fontTheme.value = id
  requestAnimationFrame(() => { void document.fonts.ready.then(() => deck.layout()) })
}

function applyBackground(id: SceneId) {
  const slide = deck.getCurrentSlide()
  if (slide?.dataset.slideId) slide.dataset.cadenzaScene = id
  runtime.setScene(id, runtime.currentState.environmentMode)
  updateMode()
}

const revealHostController = new RevealHostController({
  getCurrentSlide: () => deck.getCurrentSlide(),
  on: (event, listener) => deck.on(event, listener as EventListener),
  off: (event, listener) => deck.off(event, listener as EventListener),
}, runtime, (scene, slide) => {
  if (slideLabel) slideLabel.textContent = slide?.dataset.notesLabel ?? sceneCopy[scene].label
  updateMode()
}, slideTransition)

const sessionDeck = {
  getState: () => deck.getState() as unknown as Record<string, unknown>,
  setState: (state: Record<string, unknown>) => deck.setState(state as unknown as ReturnType<typeof deck.getState>),
  on: (event: 'slidechanged' | 'fragmentshown' | 'fragmenthidden', listener: () => void) => deck.on(event, listener),
  off: (event: 'slidechanged' | 'fragmentshown' | 'fragmenthidden', listener: () => void) => deck.off(event, listener),
}
let studioController: StudioWorkspaceController | null = null
const sessionController = new PresentationSessionController({
  mode: appMode,
  deckId,
  sessionId,
  deck: sessionDeck,
  onParticipantReady: role => studioController?.participantReady(role),
  onEnded: () => document.documentElement.setAttribute('data-presentation-ended', ''),
})

if (isStudio) {
  const studioDeck: StudioWorkspaceDeck = {
    getCurrentSlide: () => deck.getCurrentSlide(),
    getPlugin: id => deck.getPlugin(id),
    on: (event, listener) => deck.on(event, listener as EventListener),
    off: (event, listener) => deck.off(event, listener as EventListener),
    slide: (index, fragment = -1) => { deck.slide(index, 0, fragment) },
    sync: () => { deck.sync() },
  }
  studioController = new StudioWorkspaceController({
    root: app,
    deckRoot,
    authoredSlides,
    deckId,
    sessionId,
    audienceUrl: audienceUrl(location),
    designLibraryUrl: designLibraryUrl(location),
    deck: studioDeck,
    runtime,
    documentStore,
    session: sessionController,
    applyFontTheme,
    applyBackground,
    updateMode,
    locale,
  })
}

const mediaLightbox = appMode === 'receiver'
  ? null
  : new MediaLightbox(deckRoot, app.querySelector<HTMLDialogElement>('[data-testid="media-lightbox"]')!)

environmentHost.addEventListener('onebitbackendchange', updateMode)
await deck.initialize()
const resume = isStudio ? resolveStudioResume(documentStore.document, new URL(location.href)) : null
if (resume) {
  deck.slide(resume.outlineIndex, 0, resume.fragment)
  history.replaceState(history.state, '', clearStudioResume(new URL(location.href)))
}
applyFontTheme(documentStore.document.master.typography)
mediaLightbox?.start()
revealHostController.start()
elementMotionController.start()
sessionController.start()
studioController?.start()
let deckEvents: EventSource | null = null
let checkingDeckUpdate = false
const deckUpdateNotice = app.querySelector<HTMLElement>('#deck-update-notice')
const reloadUpdatedDeck = app.querySelector<HTMLButtonElement>('#reload-updated-deck')
const handleWorkspaceChange = async (event: Event) => {
  if (checkingDeckUpdate || !deckUpdateNotice?.hidden) return
  const value = JSON.parse((event as MessageEvent).data) as { path?: string }
  if (!value.path || !isCurrentDeckFile(value.path, deckId)) return
  checkingDeckUpdate = true
  try { if (await repository.hasExternalChange()) deckUpdateNotice.hidden = false }
  catch { if (workspaceStatus) workspaceStatus.textContent = ui.studio.updateUnknown }
  finally { checkingDeckUpdate = false }
}
const reloadDeck = async () => {
  if (!studioController || !reloadUpdatedDeck) return
  reloadUpdatedDeck.disabled = true
  reloadUpdatedDeck.setAttribute('aria-busy', 'true')
  try {
    await studioController.flushPendingWrites()
    const currentSlide = deck.getCurrentSlide()
    const outlineIndex = Math.max(0, authoredSlides.indexOf(currentSlide!))
    const fragment = deck.getIndices().f ?? -1
    location.href = buildStudioReloadUrl(new URL(location.href), { slideId: currentSlide?.dataset.slideId ?? '', outlineIndex, fragment }).href
  } catch (error) {
    reloadUpdatedDeck.disabled = false
    reloadUpdatedDeck.removeAttribute('aria-busy')
    if (workspaceStatus) workspaceStatus.textContent = `${ui.studio.reloadCancelled} · ${error instanceof Error ? error.message : String(error)}`
  }
}
if (isStudio && repository.isConnected && deckUpdateNotice && reloadUpdatedDeck) {
  deckEvents = new EventSource('/api/events')
  deckEvents.addEventListener('workspace-change', handleWorkspaceChange)
  reloadUpdatedDeck.addEventListener('click', reloadDeck)
}
updateMode()

const unsubscribeMotionPreference = motionPreference.subscribe(reduced => {
  runtime.setReducedMotion(reduced)
  slideTransition.setReducedMotion(reduced)
  elementMotionController.setReducedMotion(reduced)
  updateMode()
})

window.addEventListener('beforeunload', () => {
  disposeOneBitImages()
  disposeOneBitVisuals()
  disposeSmilVisuals()
  unsubscribeMotionPreference()
  motionPreference.dispose()
  studioController?.dispose()
  deckEvents?.close()
  reloadUpdatedDeck?.removeEventListener('click', reloadDeck)
  sessionController.dispose()
  mediaLightbox?.dispose()
  elementMotionController.dispose()
  revealHostController.dispose()
  environmentHost.removeEventListener('onebitbackendchange', updateMode)
  deck.destroy()
}, { once: true })

if (import.meta.env.DEV && new URLSearchParams(location.search).has('test-context-loss')) {
  setTimeout(() => runtime.simulateContextLossForDiagnostics(), 250)
}
