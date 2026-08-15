import type { AppMode } from './app-mode'

export type AppShellOptions = {
  mode: AppMode
  fontTheme: string
  slidesHtml: string
  environmentOptions: string
  fontThemeOptions: string
  designLibraryHtml: string
  mediaLightboxHtml: string
  navigatorHtml: string
}

export function renderAppShell(options: AppShellOptions): string {
  const studioHeader = options.mode === 'studio'
    ? `<header class="app-header" data-testid="studio-topbar">
      <div class="studio-identity"><button id="rail-toggle" class="icon-control" type="button" aria-label="打开页面导航" title="页面导航"><span aria-hidden="true">☷</span></button><span class="studio-brand-copy"><b>CADENZA</b><small>SLIDE STUDIO</small></span></div>
      <output id="workspace-status" data-testid="render-mode" role="status">INITIALIZING</output>
      <nav class="project-actions" aria-label="项目操作">
        <a class="project-link" href="?view=decks">Decks</a>
        <button id="presentation-open" type="button">Present</button>
        <button id="presentation-end" type="button" hidden disabled>结束放映</button>
        <details class="project-overflow"><summary aria-label="更多项目操作" title="更多项目操作">•••</summary><div>
          <button id="gallery-toggle" type="button" disabled>Design Library</button>
          <button id="audience-open" type="button" disabled>打开观众视图</button>
          <button id="speaker-open" type="button" disabled>打开演讲者视图</button>
        </div></details>
      </nav>
    </header>`
    : ''

  const studioWorkspace = options.mode === 'studio'
    ? `<div class="studio-runtime-controls" hidden aria-hidden="true">
      <span id="slide-label" data-testid="slide-label">01 / REVEAL</span>
      <span>方向键 / SPACE 翻页 · S 演讲者视图 · ESC 总览</span>
      <div class="deck-actions">
        <label class="typography-picker" hidden>字体
          <select id="font-theme" data-testid="font-theme" aria-label="中英文字体主题" disabled>${options.fontThemeOptions}</select>
        </label>
        <label class="environment-picker" hidden>背景
          <select id="environment-preset" data-testid="environment-preset" aria-label="背景环境" disabled>${options.environmentOptions}</select>
        </label>
        <button id="scale" type="button" hidden disabled>点距 3 PX</button>
        <button id="motion" type="button" hidden aria-pressed="false" disabled>环境 静止</button>
        <button id="play" type="button" hidden disabled>暂停环境</button>
      </div>
      <output id="presentation-session-status" class="presentation-session-status" hidden>
        <span>SESSION <b data-session-id></b></span>
        <span>Audience · <b data-audience-status>未开始</b></span>
        <span>Presenter · <b data-presenter-status>未开始</b></span>
      </output>
    </div>

    ${options.designLibraryHtml}

    <section id="studio-inspect-editor" class="studio-inspect-editor" role="dialog" aria-labelledby="studio-inspect-editor-title" hidden>
      <header><div><b id="studio-inspect-editor-title">修改所选元素</b><small id="studio-inspect-target"></small></div></header>
      <textarea id="studio-inspect-draft" rows="3" aria-label="元素修改要求" placeholder="这个元素需要怎么改？"></textarea>
      <div class="studio-inspect-suggestions" aria-label="快捷修改指令">
        <button type="button" data-inspect-suggestion="polish">润色</button>
        <button type="button" data-inspect-suggestion="longer">更详细</button>
        <button type="button" data-inspect-suggestion="shorter">更精简</button>
        <button type="button" data-inspect-suggestion="verify">核实</button>
      </div>
      <div class="studio-inspect-editor-actions"><button id="studio-inspect-cancel" type="button" aria-label="取消修改">取消</button><button id="studio-inspect-confirm" type="button" aria-label="加入修改队列" disabled>确认</button></div>
    </section>

    <section class="studio-bottom-dock" aria-label="页面与画布控制">
    <section class="studio-drawer" data-testid="studio-drawer" data-open="false" aria-label="页面工作区">
      <div class="drawer-resize-handle" data-drawer-resize-handle role="separator" tabindex="0" aria-label="调整下栏高度" aria-orientation="horizontal" aria-valuemin="180" aria-valuemax="520" aria-valuenow="280"><span aria-hidden="true"></span></div>
      <section id="studio-layout-panel" class="layout-inspector drawer-panel" data-panel="layout" aria-label="页面 Layout" hidden>
        <header><div><p>SLIDE LAYOUT</p><h2>母板与页面内容</h2></div><output id="layout-inspector-status" role="status"></output></header>
        <div class="layout-inspector-grid">
          <label>Layout<select id="slide-layout-select" aria-label="当前页面 Layout"></select></label>
          <fieldset><legend>可选内容位置</legend><div id="placeholder-visibility-list"></div></fieldset>
          <div class="layout-inspector-actions"><button id="reapply-layout" type="button">重新应用 Layout</button></div>
        </div>
      </section>
      <section id="studio-notes-panel" class="notes-workspace drawer-panel" data-panel="notes" aria-label="演讲者注释" data-testid="speaker-notes-editor" inert hidden>
      <span id="notes-slide-label" class="sr-only"></span>
      <div class="notes-workspace-body">
        <textarea id="notes-textarea" placeholder="输入只在演讲者视图中显示的提示……" aria-label="当前页面的演讲者注释"></textarea>
        <span id="notes-status" class="sr-only" role="status">等待载入 deck 文件</span>
      </div>
      </section>
      <section id="studio-edits-panel" class="studio-edits drawer-panel" data-panel="edits" aria-label="Agent 修改队列" hidden>
        <header><div><p>INSPECT FEEDBACK</p><h2>Agent 修改队列</h2></div><output id="studio-edit-status" role="status">尚未选择元素</output></header>
        <div id="studio-edit-list" class="studio-edit-list"></div>
        <p id="studio-edit-empty">开启 Inspect 后点击画布元素，在这里记录希望 Agent 完成的调整。</p>
        <div class="studio-edit-actions"><button id="clear-edit-queue" type="button" disabled>清空</button><button id="copy-edit-prompt" type="button" disabled>复制给 Agent</button></div>
      </section>
    </section>
    <footer class="studio-view-controls" data-testid="studio-view-controls" aria-label="画布视图控制">
      <span data-testid="studio-slide-count">1 / 1</span>
      <button type="button" data-drawer-panel="layout" aria-controls="studio-layout-panel" aria-expanded="false">Layout</button>
      <button type="button" data-drawer-panel="notes" aria-controls="studio-notes-panel" aria-expanded="false">Notes</button>
      <button id="inspect-toggle" type="button" aria-pressed="false">Inspect</button>
      <button id="edit-queue-toggle" type="button" data-drawer-panel="edits" aria-controls="studio-edits-panel" aria-expanded="false">Edits <span id="studio-edit-count">0</span></button>
      <label class="studio-zoom-control" for="zoom-slider"><span class="sr-only">画布缩放</span><input id="zoom-slider" type="range" min="25" max="200" step="1" value="100" aria-label="画布缩放"><output id="zoom-value" for="zoom-slider">100%</output></label>
      <button id="stage-fullscreen" class="icon-control" type="button" aria-label="全屏查看画布" title="全屏查看画布">⛶</button>
      <span id="fullscreen-status" class="sr-only" role="status"></span>
    </footer>
    </section>`
    : ''

  const deckUpdateNotice = options.mode === 'studio'
    ? `<aside id="deck-update-notice" class="deck-update-notice" role="status" hidden><span><b>Agent 已更新这份 deck</b><small>重新载入后回到当前页面</small></span><button id="reload-updated-deck" type="button">重新载入</button></aside>`
    : ''

  const presentationSurface = `<div class="deck-frame" data-scene="field" data-environment-mode="static" data-font-theme="${options.fontTheme}" data-testid="deck-frame">
      <div class="environment-layer" id="environment"></div>
      <div class="floating-object" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="reveal" aria-label="CadenzaSlide presentation">
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
