import { describe, expect, it } from 'vitest'
import { demoDeckDocument } from '../examples/demo-deck'
import { verifyDeckValue, visualMotionCatalogFindings } from './deck-verifier'

describe('deck file smoke verifier', () => {
  it('blocks animated icons without a registered local Lottie source and poster', () => {
    const findings = visualMotionCatalogFindings(
      [{ asset: 'icon:fake', intent: 'create', verb: 'land', mode: 'morph', format: 'lottie', animation: { path: 'https://example.com/fake.json', frameRate: 0, inFrame: 0, outFrame: 0 } }],
      [{ id: 'icon:fake', kind: 'icon' }],
      { 'icon:fake': { body: '<g/>' } },
    )
    expect(findings.map(finding => finding.ruleId)).toEqual(expect.arrayContaining([
      'visual.motion-poster', 'visual.motion-source', 'visual.motion-timing',
    ]))
  })
  it('enforces one visual focus, animation budget and semantic reuse across slides', () => {
    const deck = structuredClone(demoDeckDocument) as any
    const visual = (nodeId: string, asset: string, alt: string, behavior: string) => ({
      nodeId, component: 'visual', version: 1, props: { asset, alt },
      axes: { role: 'icon', prominence: 'support', treatment: 'outline', state: 'default', behavior },
    })
    deck.slides.blank.objects = [{
      kind: 'composition', compositionId: 'visual-budget', frame: { x: 8, y: 12, width: 84, height: 70 },
      tree: { nodeId: 'visual-budget-stack', component: 'stack', version: 1, children: [
        visual('loop-a', 'icon:line-md-bell-loop', '通知', 'loop'),
        visual('loop-b', 'icon:line-md-phone-call-loop', '来电', 'loop'),
      ] },
    }]
    deck.slides.agenda.objects = [{
      kind: 'composition', compositionId: 'semantic-reuse', frame: { x: 8, y: 12, width: 84, height: 70 },
      tree: visual('reuse-bell', 'icon:line-md-bell-loop', '风险告警', 'loop'),
    }]
    const findings = verifyDeckValue(deck).findings
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'visual.focus-budget', severity: 'error' }),
      expect.objectContaining({ ruleId: 'visual.animation-budget', severity: 'error' }),
      expect.objectContaining({ ruleId: 'visual.semantic-reuse', severity: 'warning' }),
    ]))
  })
  it('verifies the complete demo deck', () => expect(verifyDeckValue(demoDeckDocument)).toMatchObject({ ok: true, checkedSlides: Object.keys(demoDeckDocument.slides).length }))
  it('blocks old visual fields and executable payloads', () => {
    const legacy = structuredClone(demoDeckDocument) as any
    legacy.slides.intro.scene = 'field'
    expect(verifyDeckValue(legacy).findings).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'schema.slide.legacy-field', severity: 'error' })]))
    const executable = structuredClone(demoDeckDocument) as any
    executable.slides.intro.html = '<script>alert(1)</script>'
    expect(verifyDeckValue(executable).findings).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'schema.slide.executable-content', severity: 'error' })]))
  })
  it('blocks invalid media references and render contracts', () => {
    const media = structuredClone(demoDeckDocument) as any
    media.slides.photo.image.src = ''
    expect(verifyDeckValue(media).findings).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'media.reference' })]))
    const gallery = structuredClone(demoDeckDocument) as any
    gallery.slides.gallery1.images = Array.from({ length: 5 }, () => ({ src: '/hero.png', alt: 'Too many' }))
    expect(verifyDeckValue(gallery).ok).toBe(false)
  })
  it('warns when the same media source is reused across different slides', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.photo.image.src = '/shared-evidence.png'
    deck.slides.gallery1.images[0].src = '/shared-evidence.png'
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'media.cross-slide-reuse',
      severity: 'warning',
      path: '$.slides',
      message: expect.stringMatching(/photo.*gallery1|gallery1.*photo/),
    }))
  })
  it('warns when a remote raster source cannot reliably enter the One Bit canvas pipeline', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.photo.image.src = 'https://cdn.example.com/evidence.png'
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'media.remote-one-bit-risk',
      path: '$.slides.photo.image.src',
      message: expect.stringContaining('本地化'),
    }))
  })

  it('rejects cover cropping and one-bit treatment for information-dense screenshots', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.photo.image = { src: '/dense-ui.png', alt: '订单与工艺信息界面', kind: 'screenshot', fit: 'cover', treatment: 'one-bit' }
    expect(verifyDeckValue(deck).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'media.screenshot-cover', severity: 'error', path: '$.slides.photo.image.fit' }),
      expect.objectContaining({ ruleId: 'media.screenshot-one-bit', severity: 'error', path: '$.slides.photo.image.treatment' }),
    ]))
  })
  it('warns when readable copy is overlaid on evidence media', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.blank.objects = [{
      kind: 'composition', compositionId: 'obscured-evidence', frame: { x: 6, y: 8, width: 88, height: 84 },
      tree: {
        nodeId: 'evidence-overlay', component: 'overlay', version: 1,
        slots: {
          base: [{ nodeId: 'evidence-image', component: 'media', version: 1, props: { src: '/dense.png', alt: '高信息量流程截图' } }],
          overlay: [{ nodeId: 'covering-copy', component: 'quote', version: 1, props: { text: '这段话挡住了图片' } }],
        },
      },
    }]
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'media.text-overlay-review', severity: 'warning', path: expect.stringContaining('obscured-evidence'),
    }))
  })
  it('rejects captions on full-bleed title-photo while preserving caption-capable media layouts', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides['title-photo'].image.caption = '这条图注不应出现在整页视觉环境上'
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'layout.title-photo-caption',
      severity: 'error',
      path: '$.slides.title-photo.image.caption',
    }))
    deck.slides['title-photo'].layout = 'title-photo-alt'
    expect(verifyDeckValue(deck).findings).not.toContainEqual(expect.objectContaining({ ruleId: 'layout.title-photo-caption' }))
  })
  it('reports composition diagnosis by stable composition ID', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.intro.objects = [{
      kind: 'composition', compositionId: 'tiny-proof', frame: { x: 2, y: 2, width: 5, height: 4 },
      tree: { nodeId: 'tiny-heading', component: 'heading', version: 1, props: { text: 'A valid tree in an impossible frame' } },
    }]
    expect(verifyDeckValue(deck).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'composition.intrinsic.split', path: expect.stringContaining('composition:tiny-proof') }),
    ]))
  })
  it('warns when code is shown without explaining what runs and what the result means', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.blank.objects = [{
      kind: 'composition', compositionId: 'unexplained-code', frame: { x: 6, y: 8, width: 88, height: 84 },
      tree: { nodeId: 'cli', component: 'code', version: 1, props: { language: 'bash', code: '$ npm test' } },
    }]
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'code.explanation',
      severity: 'warning',
      path: expect.stringContaining('unexplained-code'),
    }))
    deck.slides.blank.objects[0].tree.props.caption = '运行项目测试；退出码为 0 才表示该门禁通过。'
    expect(verifyDeckValue(deck).findings).not.toContainEqual(expect.objectContaining({ ruleId: 'code.explanation' }))
  })
  it('warns when a content slide leaves most of the usable canvas empty', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.blank.objects = [{ kind: 'text', frame: { x: 6, y: 8, width: 12, height: 8 }, text: 'Too small' }]
    expect(verifyDeckValue(deck).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: 'layout.content-coverage',
        severity: 'warning',
        path: '$.slides.blank',
        message: expect.stringMatching(/覆盖率.*建议/),
      }),
    ]))
  })
  it('requires section slides to carry their hierarchy in the title slot', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.section.title = []
    deck.slides.section.subtitle = '被误当成章节主标题的副标题'
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'layout.section-title',
      severity: 'error',
      path: '$.slides.section.title',
    }))
  })
  it('asks source-backed speaker notes to include a speakable original excerpt', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.statement.notes = '## 证据来源\n- `/article.md`\n\n## 演讲提示\n解释这一页'
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'notes.source-excerpt',
      severity: 'warning',
      path: '$.slides.statement.notes',
    }))
    deck.slides.statement.notes += '\n\n## 原文摘录\n> 这是可以直接讲出的原话'
    expect(verifyDeckValue(deck).findings).not.toContainEqual(expect.objectContaining({ ruleId: 'notes.source-excerpt' }))
  })
  it('warns when one original excerpt is reused as group-level speaker-note filler', () => {
    const deck = structuredClone(demoDeckDocument) as any
    for (const id of ['statement', 'big-fact', 'quote', 'photo']) deck.slides[id].notes = [
      '## 证据来源', '- `/article.md`', '', '## 原文摘录', '> 同一句原文被整章重复使用', '', '## 演讲提示', '讲这一页',
    ].join('\n')
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'notes.source-excerpt-reuse',
      severity: 'warning',
      path: '$.slides',
      message: expect.stringContaining('4 页'),
    }))
  })
  it('warns when a complete deck overuses the simple title-and-list layout', () => {
    const deck = structuredClone(demoDeckDocument) as any
    for (const slide of Object.values(deck.slides) as any[]) if (slide.role === 'content') {
      slide.layout = 'title-bullets'
      slide.title = ['同一种表达']
      slide.items = ['只有文字不同', '视觉结构没有变化']
    }
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'layout.simple-list-overuse',
      severity: 'warning',
      path: '$.slides',
    }))
  })
  it('warns when a blank composition only repackages a heading and list', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.blank.objects = [{
      kind: 'composition', compositionId: 'heading-list-only', frame: { x: 6, y: 7, width: 88, height: 86 },
      tree: { nodeId: 'root', component: 'stack', version: 1, children: [
        { nodeId: 'title', component: 'heading', version: 1, props: { text: '看似自定义' } },
        { nodeId: 'items', component: 'list', version: 1, props: { items: ['只有文字', '没有证据', '没有关系'] } },
      ] },
    }]
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'composition.text-list-only', severity: 'warning', path: '$.slides.blank',
    }))
  })
  it('warns when the same composition silhouette is repeated across several slides', () => {
    const deck = structuredClone(demoDeckDocument) as any
    const ids = ['blank', 'statement', 'quote']
    for (const id of ids) {
      deck.slides[id].role = 'content'
      deck.slides[id].objects = [{
        kind: 'composition', compositionId: `repeated-${id}`, frame: { x: 6, y: 7, width: 88, height: 86 },
        tree: { nodeId: `root-${id}`, component: 'stack', version: 1, axes: { density: 'open' }, children: [
          { nodeId: `title-${id}`, component: 'heading', version: 1, props: { text: id } },
          { nodeId: `grid-${id}`, component: 'grid', version: 1, axes: { columns: '2' }, children: [
            { nodeId: `card-a-${id}`, component: 'card', version: 1, props: { title: 'A', body: id } },
            { nodeId: `card-b-${id}`, component: 'card', version: 1, props: { title: 'B', body: id } },
          ] },
        ] },
      }]
    }
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'composition.silhouette-repetition', severity: 'warning', path: '$.slides',
      message: expect.stringContaining('blank'),
    }))
  })
  it('warns when a complete Cadenza deck disables every animated environment', () => {
    const deck = structuredClone(demoDeckDocument) as any
    for (const layout of Object.values(deck.master.layouts) as any[]) layout.environmentMode = 'static'
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'motion.environment-all-static', severity: 'warning', path: '$.master.layouts',
    }))
  })
  it('rejects core masters whose focal and supporting slots collapse onto one unsupported visual axis', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.master.layouts['big-fact'].slots.value.frame = { x: 18, y: 11, width: 64, height: 54 }
    deck.master.layouts['big-fact'].slots.label.frame = { x: 30, y: 70, width: 40, height: 12 }
    deck.master.layouts.quote.slots.quote.frame = { x: 7, y: 13, width: 72, height: 53 }
    deck.master.layouts.quote.slots.attribution.frame = { x: 10, y: 72, width: 56, height: 14 }

    expect(verifyDeckValue(deck).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'master.visual-balance', path: '$.master.layouts.big-fact.slots' }),
      expect.objectContaining({ ruleId: 'master.visual-balance', path: '$.master.layouts.quote.slots' }),
    ]))
  })
  it('rejects statement slots that let the TRACK background cut through readable copy', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.master.layouts.statement.background = 'track'
    deck.master.layouts.statement.visualRegions = [{ tag: 'track-path', frame: { x: 0, y: 25, width: 100, height: 55 } }]
    deck.master.layouts.statement.slots.title.frame = { x: 8, y: 22, width: 66, height: 50 }
    deck.master.layouts.statement.slots.subtitle.frame = { x: 8, y: 76, width: 44, height: 8 }
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'master.visual-balance',
      path: '$.master.layouts.statement.slots',
      message: expect.stringContaining('TRACK'),
    }))
  })
  it('rejects numbered-series content that enters the fixed header safe area', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.blank = {
      id: 'blank', role: 'content', layout: 'custom:numbered-series', label: 'Series',
      title: ['先研究'], subtitle: '建立可信起点', seriesNumber: '02', seriesLabel: 'AI 协作方法',
      objects: [{ kind: 'text', frame: { x: 6, y: 12, width: 80, height: 30 }, text: '侵入标题区域' }],
    }
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'layout.numbered-series-safe-area', severity: 'error', path: '$.slides.blank.objects[0].frame',
    }))
  })
  it('rejects numbered-series content that enters the fixed progress navigation', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.blank = {
      id: 'blank', role: 'content', layout: 'custom:numbered-series', label: 'Series',
      title: ['里程碑'], subtitle: '按顺序推进', seriesNumber: '04', seriesLabel: 'AI 协作方法',
      objects: [{ kind: 'text', frame: { x: 6, y: 84, width: 80, height: 8 }, text: '侵入底部导航' }],
    }
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'layout.numbered-series-safe-area', severity: 'error', path: '$.slides.blank.objects[0].frame',
    }))
  })
  it('counts an explicit master visual region only when real content already establishes the page', () => {
    const deck = structuredClone(demoDeckDocument) as any
    const agendaPath = '$.slides.agenda'
    expect(verifyDeckValue(deck).findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'layout.content-coverage', path: agendaPath }),
    ]))

    delete deck.master.layouts.agenda.visualRegions
    expect(verifyDeckValue(deck).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'layout.content-coverage', path: agendaPath }),
    ]))

    deck.master.layouts.blank.background = 'grid'
    deck.master.layouts.blank.visualRegions = [{ tag: 'supporting-scene', frame: { x: 68, y: 0, width: 32, height: 100 } }]
    deck.slides.blank.objects = []
    expect(verifyDeckValue(deck).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'layout.content-coverage', path: '$.slides.blank' }),
    ]))
  })
  it('does not let a large but sparse composition masquerade as a filled page', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.blank.objects = [{
      kind: 'composition', compositionId: 'sparse-card', frame: { x: 4, y: 4, width: 92, height: 92 },
      tree: {
        nodeId: 'sparse-grid', component: 'grid', version: 1, axes: { columns: '3' },
        children: [0, 1, 2].map(index => ({
          nodeId: `sparse-card-${index}`, component: 'card', version: 1,
          props: { title: ['结构', '内容', '关系'][index] },
        })),
      },
    }]
    expect(verifyDeckValue(deck).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'layout.content-coverage', path: '$.slides.blank' }),
    ]))
  })
  it('allows intentional negative space on Cover and Section slides', () => {
    const deck = structuredClone(demoDeckDocument) as any
    for (const id of ['intro', 'section']) {
      delete deck.slides[id].title
      delete deck.slides[id].subtitle
      delete deck.slides[id].author
      delete deck.slides[id].date
      delete deck.slides[id].sectionNumber
      deck.slides[id].objects = [{ kind: 'text', frame: { x: 6, y: 8, width: 4, height: 4 }, text: 'Quiet' }]
    }
    const coveragePaths = verifyDeckValue(deck).findings
      .filter(finding => finding.ruleId === 'layout.content-coverage')
      .map(finding => finding.path)
    expect(coveragePaths).not.toContain('$.slides.intro')
    expect(coveragePaths).not.toContain('$.slides.section')
  })
  it('flags terminal periods in display copy while preserving authored quotations', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.blank.objects = [{
      kind: 'composition', compositionId: 'punctuation-proof', frame: { x: 6, y: 8, width: 88, height: 84 },
      tree: {
        nodeId: 'punctuation-stack', component: 'stack', version: 1, children: [
          { nodeId: 'period-card', component: 'card', version: 1, props: { title: '系统契约', body: '默认不保留句号。' } },
          { nodeId: 'period-quote', component: 'quote', version: 1, props: { text: '引言可以保留句号。', author: 'Cadenza' } },
        ],
      },
    }]
    const findings = verifyDeckValue(deck).findings.filter(finding => finding.ruleId === 'copy.terminal-period')
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ path: expect.stringContaining('props.body'), message: expect.stringContaining('引言') })
  })
  it('flags banned AI-style rhetorical frames in display copy but not speaker notes', () => {
    const deck = structuredClone(demoDeckDocument) as any
    deck.slides.statement.subtitle = '这不是流程问题，而是判断力问题'
    deck.slides.statement.notes = '演讲时可以解释：这不是失败，而是一次校准'
    expect(verifyDeckValue(deck).findings).toContainEqual(expect.objectContaining({
      ruleId: 'copy.forbidden-rhetorical-frame',
      path: '$.slides.statement.subtitle',
      message: expect.stringContaining('不是……而是……'),
    }))
    expect(verifyDeckValue(deck).findings.filter(finding => finding.ruleId === 'copy.forbidden-rhetorical-frame')).toHaveLength(1)
  })
})
