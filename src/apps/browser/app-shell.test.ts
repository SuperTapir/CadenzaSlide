import { describe, expect, it } from 'vitest'
import { renderAppShell, type AppShellOptions } from './app-shell'

const options: Omit<AppShellOptions, 'mode'> = {
  fontTheme: 'editorial',
  slidesHtml: '<section>Slide</section>',
  environmentOptions: '<option value="field">Field</option>',
  fontThemeOptions: '<option value="editorial">Editorial</option>',
  designLibraryHtml: '<section id="system-gallery">Library</section>',
  mediaLightboxHtml: '<dialog data-testid="media-lightbox"></dialog>',
  navigatorHtml: '<aside class="studio-navigator">Navigator</aside>',
}

describe('renderAppShell', () => {
  it.each(['studio', 'audience', 'receiver'] as const)('renders the shared presentation surface in %s mode', (mode) => {
    const html = renderAppShell({ ...options, mode })

    expect(html).toContain(`<main class="app-shell" data-app-mode="${mode}">`)
    expect(html).toContain('data-font-theme="editorial"')
    expect(html).toContain('id="environment"')
    expect(html).toContain('aria-label="CadenzaSlide presentation"')
    expect(html).toContain('<section>Slide</section>')
    expect(html).toContain(options.mediaLightboxHtml)
  })

  it('renders the complete Studio workspace', () => {
    const html = renderAppShell({ ...options, mode: 'studio' })

    expect(html).toContain('class="app-header"')
    expect(html).toContain('href="?view=decks"')
    expect(html).toContain('>Decks</a>')
    expect(html).toContain('id="workspace-status"')
    expect(html).toContain('id="deck-update-notice"')
    expect(html).toContain('Agent 已更新这份 deck')
    expect(html).toContain('id="reload-updated-deck"')
    expect(html).toContain('class="studio-runtime-controls"')
    expect(html).toContain('id="gallery-toggle"')
    expect(html).toContain('id="audience-open"')
    expect(html).toContain('id="speaker-open"')
    expect(html).toContain('id="presentation-session-status"')
    expect(html).toContain('id="font-theme"')
    expect(html).toContain(options.fontThemeOptions)
    expect(html).toContain('id="environment-preset"')
    expect(html).toContain(options.environmentOptions)
    expect(html).toContain(options.designLibraryHtml)
    expect(html).toContain('data-testid="speaker-notes-editor"')
    expect(html).toContain(options.navigatorHtml)
    expect(html).toContain('data-testid="studio-topbar"')
    expect(html).toContain('data-testid="studio-rail"')
    expect(html).toContain('data-testid="studio-stage"')
    expect(html).toContain('data-testid="studio-drawer"')
    expect(html).toContain('data-panel="layout"')
    expect(html).toContain('data-panel="edits"')
    expect(html).toContain('id="inspect-toggle"')
    expect(html).toContain('id="copy-edit-prompt"')
    expect(html).toContain('复制给 Agent')
    expect(html).toContain('id="studio-inspect-editor"')
    expect(html).toContain('id="studio-inspect-draft"')
    expect(html).toContain('data-inspect-suggestion="shorter"')
    expect(html).toContain('id="slide-layout-select"')
    expect(html).toContain('id="placeholder-visibility-list"')
    expect(html).toContain('id="reapply-layout"')
    expect(html).not.toContain('id="add-slide-object"')
    expect(html).toContain('data-testid="studio-view-controls"')
    expect(html).not.toContain('data-testid="studio-agent-summary"')
    expect(html).not.toContain('data-testid="studio-agent-queue"')
    expect(html).not.toContain('id="export-open"')
    expect(html).not.toContain('id="history-open"')
    expect(html).toContain('id="zoom-slider"')
    expect(html).toContain('type="range"')
    expect(html).not.toContain('id="zoom-out"')
    expect(html).not.toContain('id="zoom-in"')
    expect(html).not.toContain('data-drawer-panel="outline"')
    expect(html).toContain('data-drawer-resize-handle')
    expect(html).toContain('role="separator"')
    expect(html).not.toContain('id="save-notes"')
    expect(html).toContain('id="notes-status" class="sr-only"')
    const controlBar = html.slice(html.indexOf('<footer class="studio-view-controls"'), html.indexOf('</footer>') + '</footer>'.length)
    expect(controlBar).toContain('data-drawer-panel="notes"')
    expect(controlBar).toContain('data-drawer-panel="layout"')
    expect(controlBar).toContain('data-drawer-panel="edits"')
    expect(controlBar).not.toContain('data-drawer-panel="verify"')
    expect(controlBar).toContain('data-testid="studio-slide-count"')
    expect(controlBar).toContain('id="zoom-slider"')
    expect(html).not.toContain('class="drawer-tabs"')
    expect(html).not.toContain('class="studio-brand-mark"')
    expect(html).toContain('data-testid="studio-canvas-spec"')
    expect(html).toContain('CANVAS / 16:9')
    expect(html).toContain('1280 × 720')
  })

  it.each(['audience', 'receiver'] as const)('keeps Studio-only controls out of %s mode', (mode) => {
    const html = renderAppShell({ ...options, mode })

    expect(html).not.toContain('class="app-header"')
    expect(html).not.toContain('class="studio-runtime-controls"')
    expect(html).not.toContain('id="gallery-toggle"')
    expect(html).not.toContain('id="system-gallery"')
    expect(html).not.toContain('data-testid="speaker-notes-editor"')
    expect(html).not.toContain('id="font-theme"')
    expect(html).not.toContain('id="environment-preset"')
    expect(html).not.toContain(options.environmentOptions)
    expect(html).not.toContain(options.fontThemeOptions)
  })
})
