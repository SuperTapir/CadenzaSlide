import type { AppMode } from './app-mode'
import { localizeHref, renderUiLocaleSwitcher, type UiLocale, uiText } from '../../i18n/ui-locale'

export type AppShellOptions = {
  mode: AppMode
  fontTheme: string
  slidesHtml: string
  environmentOptions: string
  fontThemeOptions: string
  designLibraryHtml: string
  mediaLightboxHtml: string
  navigatorHtml: string
  locale?: UiLocale
  currentHref?: string
}

export function renderAppShell(options: AppShellOptions): string {
  const locale = options.locale ?? 'zh-CN'
  const text = uiText(locale)
  const studio = text.studio
  const decksHref = escapeAttribute(localizeHref('?view=decks', locale))
  const localeSwitcher = renderUiLocaleSwitcher(locale, options.currentHref ?? '?view=studio')
  const studioHeader = options.mode === 'studio'
    ? `<header class="app-header" data-testid="studio-topbar">
      <div class="studio-identity"><button id="rail-toggle" class="icon-control" type="button" aria-label="${studio.pageNavigation}" title="${studio.pageNavigation}"><span aria-hidden="true">☷</span></button><span class="studio-brand-copy"><b>CADENZA</b><small>SLIDE STUDIO</small></span></div>
      <output id="workspace-status" data-testid="render-mode" role="status">INITIALIZING</output>
      <nav class="project-actions" aria-label="${studio.projectActions}">
        ${localeSwitcher}
        <a class="project-link" href="${decksHref}">Decks</a>
        <button id="presentation-open" type="button">${studio.present}</button>
        <button id="presentation-end" type="button" hidden disabled>${studio.endPresentation}</button>
        <details class="project-overflow"><summary aria-label="${studio.moreActions}" title="${studio.moreActions}">•••</summary><div>
          <button id="gallery-toggle" type="button" disabled>${studio.designLibrary}</button>
          <button id="audience-open" type="button" disabled>${studio.openAudience}</button>
          <button id="speaker-open" type="button" disabled>${studio.openPresenter}</button>
        </div></details>
      </nav>
    </header>`
    : ''

  const studioWorkspace = options.mode === 'studio'
    ? `<div class="studio-runtime-controls" hidden aria-hidden="true">
      <span id="slide-label" data-testid="slide-label">01 / REVEAL</span>
      <span>${studio.keyboardHint}</span>
      <div class="deck-actions">
        <label class="typography-picker" hidden>${studio.font}
          <select id="font-theme" data-testid="font-theme" aria-label="${studio.typographyTheme}" disabled>${options.fontThemeOptions}</select>
        </label>
        <label class="environment-picker" hidden>${studio.background}
          <select id="environment-preset" data-testid="environment-preset" aria-label="${studio.backgroundEnvironment}" disabled>${options.environmentOptions}</select>
        </label>
        <button id="scale" type="button" hidden disabled>点距 3 PX</button>
        <button id="motion" type="button" hidden aria-pressed="false" disabled>${studio.environmentStill}</button>
        <button id="play" type="button" hidden disabled>${studio.pauseEnvironment}</button>
      </div>
      <output id="presentation-session-status" class="presentation-session-status" hidden>
        <span>SESSION <b data-session-id></b></span>
        <span>Audience · <b data-audience-status>${text.common.notStarted}</b></span>
        <span>Presenter · <b data-presenter-status>${text.common.notStarted}</b></span>
      </output>
    </div>

    ${options.designLibraryHtml}

    <section id="studio-inspect-editor" class="studio-inspect-editor" role="dialog" aria-labelledby="studio-inspect-editor-title" hidden>
      <header><div><b id="studio-inspect-editor-title">${studio.editSelected}</b><small id="studio-inspect-target"></small></div></header>
      <textarea id="studio-inspect-draft" rows="3" aria-label="${studio.editRequest}" placeholder="${studio.editPlaceholder}"></textarea>
      <div class="studio-inspect-suggestions" aria-label="${studio.quickEdits}">
        <button type="button" data-inspect-suggestion="polish">${studio.polish}</button>
        <button type="button" data-inspect-suggestion="longer">${studio.longer}</button>
        <button type="button" data-inspect-suggestion="shorter">${studio.shorter}</button>
        <button type="button" data-inspect-suggestion="verify">${studio.verify}</button>
      </div>
      <div class="studio-inspect-editor-actions"><button id="studio-inspect-cancel" type="button" aria-label="${studio.cancelEdit}">${studio.cancel}</button><button id="studio-inspect-confirm" type="button" aria-label="${studio.queueEdit}" disabled>${studio.confirm}</button></div>
    </section>

    <section class="studio-bottom-dock" aria-label="${studio.pageCanvasControls}">
    <section class="studio-drawer" data-testid="studio-drawer" data-open="false" aria-label="${studio.pageWorkspace}">
      <div class="drawer-resize-handle" data-drawer-resize-handle role="separator" tabindex="0" aria-label="${studio.resizeDrawer}" aria-orientation="horizontal" aria-valuemin="180" aria-valuemax="520" aria-valuenow="280"><span aria-hidden="true"></span></div>
      <section id="studio-layout-panel" class="layout-inspector drawer-panel" data-panel="layout" aria-label="${studio.pageLayout}" hidden>
        <header><div><p>SLIDE LAYOUT</p><h2>${studio.masterAndContent}</h2></div><output id="layout-inspector-status" role="status"></output></header>
        <div class="layout-inspector-grid">
          <label>Layout<select id="slide-layout-select" aria-label="${studio.currentLayout}"></select></label>
          <fieldset><legend>${studio.optionalPositions}</legend><div id="placeholder-visibility-list"></div></fieldset>
          <div class="layout-inspector-actions"><button id="reapply-layout" type="button">${studio.reapplyLayout}</button></div>
        </div>
      </section>
      <section id="studio-notes-panel" class="notes-workspace drawer-panel" data-panel="notes" aria-label="${studio.speakerNotes}" data-testid="speaker-notes-editor" inert hidden>
      <span id="notes-slide-label" class="sr-only"></span>
      <div class="notes-workspace-body">
        <textarea id="notes-textarea" placeholder="${studio.notesPlaceholder}" aria-label="${studio.currentNotes}"></textarea>
        <span id="notes-status" class="sr-only" role="status">${studio.waitingDeck}</span>
      </div>
      </section>
      <section id="studio-edits-panel" class="studio-edits drawer-panel" data-panel="edits" aria-label="${studio.agentQueue}" hidden>
        <header><div><p>INSPECT FEEDBACK</p><h2>${studio.agentQueue}</h2></div><output id="studio-edit-status" role="status">${studio.nothingSelected}</output></header>
        <div id="studio-edit-list" class="studio-edit-list"></div>
        <p id="studio-edit-empty">${studio.queueEmpty}</p>
        <div class="studio-edit-actions"><button id="clear-edit-queue" type="button" disabled>${studio.clear}</button><button id="copy-edit-prompt" type="button" disabled>${studio.copyToAgent}</button></div>
      </section>
    </section>
    <footer class="studio-view-controls" data-testid="studio-view-controls" aria-label="${studio.canvasControls}">
      <span data-testid="studio-slide-count">1 / 1</span>
      <button type="button" data-drawer-panel="layout" aria-controls="studio-layout-panel" aria-expanded="false">Layout</button>
      <button type="button" data-drawer-panel="notes" aria-controls="studio-notes-panel" aria-expanded="false">Notes</button>
      <button id="inspect-toggle" type="button" aria-pressed="false">Inspect</button>
      <button id="edit-queue-toggle" type="button" data-drawer-panel="edits" aria-controls="studio-edits-panel" aria-expanded="false">Edits <span id="studio-edit-count">0</span></button>
      <label class="studio-zoom-control" for="zoom-slider"><span class="sr-only">${studio.zoom}</span><input id="zoom-slider" type="range" min="25" max="200" step="1" value="100" aria-label="${studio.zoom}"><output id="zoom-value" for="zoom-slider">100%</output></label>
      <button id="stage-fullscreen" class="icon-control" type="button" aria-label="${studio.fullscreen}" title="${studio.fullscreen}">⛶</button>
      <span id="fullscreen-status" class="sr-only" role="status"></span>
    </footer>
    </section>`
    : ''

  const deckUpdateNotice = options.mode === 'studio'
    ? `<aside id="deck-update-notice" class="deck-update-notice" role="status" hidden><span><b>${studio.deckUpdated}</b><small>${studio.reloadReturns}</small></span><button id="reload-updated-deck" type="button">${studio.reload}</button></aside>`
    : ''

  const presentationSurface = `<div class="deck-frame" data-scene="field" data-environment-mode="static" data-font-theme="${options.fontTheme}" data-testid="deck-frame">
      <div class="environment-layer" id="environment"></div>
      <div class="floating-object" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="reveal" aria-label="${text.common.presentation}">
        <div class="slides">
          ${options.slidesHtml}
        </div>
      </div>
    </div>`

  if (options.mode !== 'studio') return `<main class="app-shell" data-app-mode="${options.mode}">${presentationSurface}${options.mediaLightboxHtml}</main>`

  return `<main class="app-shell" data-app-mode="${options.mode}">
    ${studioHeader}
    ${deckUpdateNotice}
    <div class="studio-layout">
      <div class="studio-rail" data-testid="studio-rail">${options.navigatorHtml}</div>
      <div class="studio-column"><section class="studio-stage" data-testid="studio-stage"><header class="studio-canvas-spec" data-testid="studio-canvas-spec"><span>CANVAS / 16:9</span><span>1280 × 720</span></header><div class="studio-canvas-viewport"><div class="studio-canvas-transform">${presentationSurface}</div></div></section>${studioWorkspace}</div>
    </div>
    ${options.mediaLightboxHtml}
  </main>`
}

function escapeAttribute(value: string) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;') }
