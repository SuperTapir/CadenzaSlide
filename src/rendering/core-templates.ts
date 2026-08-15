import { coreLayoutIds, isCompositionSlideObject, mergeSlotStyle, type CompositionSlideObject, type CoreLayoutId, type DeckMaster, type Frame, type MediaKind, type MediaTreatment, type SlideObject, type SlotOverride, type SlotStyle } from '../core/deck-master.ts'
import { isCustomSlide, renderCustomSlide, type CustomSlide } from '../core/custom-layouts.ts'
import { assessCompositionFidelity, diagnoseComposition, resolveComposition } from '../authoring/component-diagnosis.ts'
import { renderComposition } from './component-renderer.ts'

export { coreLayoutIds }
export type { CoreLayoutId }

export type SlideRole = 'intro' | 'agenda' | 'section' | 'content' | 'recap' | 'summary' | 'qa' | 'thanks'

export interface SlideImage {
  src: string
  alt: string
  caption?: string
  fit?: 'cover' | 'contain'
  aspectRatio?: number
  focalPoint?: { x: number, y: number }
  kind?: MediaKind
  treatment?: MediaTreatment
  frameMode?: 'standard' | 'compact'
}

export interface SlideBase {
  id: string
  layout: CoreLayoutId
  role: SlideRole
  label: string
  notes?: string
  objects?: SlideObject[]
  hiddenPlaceholders?: string[]
  slotOverrides?: Record<string, SlotOverride>
}

interface TitledSlide extends SlideBase {
  title?: string[]
  subtitle?: string
  body?: string
  author?: string
  date?: string
}

export type TextListItem = string | { text: string }
export interface AgendaItem { number: string, title: string, description?: string, state?: 'complete' | 'active' | 'upcoming' }

export interface TitleSlide extends TitledSlide { layout: 'title' }
export interface TitlePhotoSlide extends TitledSlide { layout: 'title-photo', image?: SlideImage }
export interface TitlePhotoAltSlide extends TitledSlide { layout: 'title-photo-alt', image?: SlideImage }
export interface TitleBulletsSlide extends TitledSlide { layout: 'title-bullets', items?: TextListItem[] }
export interface TitleBulletsPhotoSlide extends TitledSlide { layout: 'title-bullets-photo', items?: TextListItem[], image?: SlideImage }
export interface SectionSlide extends TitledSlide { layout: 'section', sectionNumber?: string }
export interface TitleOnlySlide extends TitledSlide { layout: 'title-only' }
export interface AgendaSlide extends TitledSlide { layout: 'agenda', items?: AgendaItem[] }
export interface StatementSlide extends TitledSlide { layout: 'statement' }
export interface BigFactSlide extends SlideBase { layout: 'big-fact', value?: string, factLabel?: string }
export interface QuoteSlide extends SlideBase { layout: 'quote', quote?: string, attribution?: string, source?: string }
export interface GallerySlide extends TitledSlide { layout: 'gallery', images?: SlideImage[] }
export interface PhotoSlide extends SlideBase { layout: 'photo', image?: SlideImage }
export interface BlankSlide extends SlideBase { layout: 'blank', ariaLabel?: string }

export type CoreSlide =
  | TitleSlide | TitlePhotoSlide | TitlePhotoAltSlide | TitleBulletsSlide | TitleBulletsPhotoSlide
  | SectionSlide | TitleOnlySlide | AgendaSlide | StatementSlide | BigFactSlide | QuoteSlide
  | GallerySlide | PhotoSlide | BlankSlide

export type DeckSlide = CoreSlide | CustomSlide

export interface OutlineDraftSlide extends SlideBase {
  draft: true
  title: string[]
  purpose: string
}

export type RenderableDeckSlide = DeckSlide | OutlineDraftSlide

export type { SlideObject }

export function renderDeckSlides(slides: readonly RenderableDeckSlide[], master: Readonly<DeckMaster>) {
  assertStableIds(slides)
  return slides.map(slide => renderSlide(slide, master)).join('\n')
}

function renderSlide(slide: RenderableDeckSlide, master: Readonly<DeckMaster>) {
  const layoutMaster = isCustomSlide(slide) ? master.layouts.blank : master.layouts[slide.layout]
  if (!layoutMaster) throw new Error(`Missing master layout: ${slide.layout}`)
  const content = isOutlineDraftSlide(slide) ? renderOutline(slide, layoutMaster) : isCustomSlide(slide) ? renderCustomSlide(slide) : renderLayout(slide, layoutMaster)
  return `<section data-slide-id="${slide.id}" data-layout="${slide.layout}" data-slide-role="${slide.role}" data-cadenza-scene="${layoutMaster.background}" data-environment-mode="${layoutMaster.environmentMode}" data-cadenza-motion="${master.slideTransition}" data-master-element-motion="${layoutMaster.elementMotion}" data-notes-id="${slide.id}" data-notes-label="${escapeHtml(slide.label)}" data-testid="slide-${slide.id}">
    ${renderObjects(layoutMaster.backgroundObjects, 'layout')}${renderVisualRegions(layoutMaster.visualRegions)}${content}${renderObjects('objects' in slide ? slide.objects ?? [] : [], 'page', slide.id)}
    <aside class="notes">${escapeHtml(slide.notes ?? '')}</aside>
  </section>`
}

function renderLayout(slide: CoreSlide, master: DeckMaster['layouts'][CoreLayoutId]) {
  switch (slide.layout) {
    case 'title': return `<div class="slide-chrome template-title">${heading(slide, master, 'hero')}${coverMeta(slide, master)}</div>`
    case 'title-photo': return `<div class="slide-chrome template-title-photo">${placeholder(slide, 'media', slide.image, () => imageArea(slide.image!, slot(slide, master, 'media'), 'hero-media', false, slide.id, 'image'))}${heading(slide, master, 'hero')}</div>`
    case 'title-photo-alt': return renderAdaptiveTitlePhotoAlt(slide, master)
    case 'title-bullets': return `<div class="slide-chrome template-title-bullets">${heading(slide, master, 'content')}${placeholder(slide, 'items', slide.items, () => list(slide.items!, slot(slide, master, 'items'), slide.id))}${copy(slide.body, 'body', slide, master)}</div>`
    case 'title-bullets-photo': return `<div class="slide-chrome template-title-bullets-photo">${heading(slide, master, 'content')}${placeholder(slide, 'items', slide.items, () => list(slide.items!, slot(slide, master, 'items'), slide.id))}${placeholder(slide, 'media', slide.image, () => imageArea(slide.image!, slot(slide, master, 'media'), '', true, slide.id, 'image'))}</div>`
    case 'section': return `<div class="slide-chrome template-section">${heading(slide, master, 'hero')}${placeholder(slide, 'number', slide.sectionNumber, () => `<span class="section-number master-slot" style="${slotCss(slot(slide, master, 'number'))}"${inspectAttributes(slide.id, 'sectionNumber', 'text', 'Section number')}>${escapeHtml(slide.sectionNumber!)}</span>`)}</div>`
    case 'title-only': return `<div class="slide-chrome template-title-only">${heading(slide, master, 'content')}</div>`
    case 'agenda': return renderAgenda(slide, master)
    case 'statement': return `<div class="slide-chrome template-statement">${heading(slide, master, 'content')}</div>`
    case 'big-fact': return `<div class="slide-chrome template-big-fact">${placeholder(slide, 'value', slide.value, () => `<strong class="big-fact-value master-slot" style="${slotCss(slot(slide, master, 'value'))}"${inspectAttributes(slide.id, 'value', 'text', 'Value')}>${escapeHtml(slide.value!)}</strong>`)}${copy(slide.factLabel, 'label', slide, master, 'component-body', 'factLabel')}</div>`
    case 'quote': return `<div class="slide-chrome template-quote">
      ${placeholder(slide, 'quote', slide.quote, () => `<blockquote class="component-quote master-slot" style="${slotCss(slot(slide, master, 'quote'))}"${inspectAttributes(slide.id, 'quote', 'quote', 'Quote')}><p>${escapeHtml(slide.quote!)}</p></blockquote>`)}
      ${placeholder(slide, 'attribution', slide.attribution || slide.source, () => `<footer class="quote-attribution master-slot" style="${slotCss(slot(slide, master, 'attribution'))}">${slide.attribution ? `<cite${inspectAttributes(slide.id, 'attribution', 'text', 'Attribution')}>${escapeHtml(slide.attribution)}</cite>` : ''}${slide.source ? `<span class="quote-source"${inspectAttributes(slide.id, 'source', 'text', 'Source')}>${escapeHtml(slide.source)}</span>` : ''}</footer>`)}</div>`
    case 'gallery': return renderGallery(slide, master)
    case 'photo': return `<div class="slide-chrome template-photo">${placeholder(slide, 'media', slide.image, () => imageArea(slide.image!, slot(slide, master, 'media'), 'photo-hero', true, slide.id, 'image'))}</div>`
    case 'blank': return `<div class="slide-chrome template-blank" aria-label="${escapeHtml(slide.ariaLabel ?? slide.label)}"></div>`
  }
}

function renderOutline(slide: OutlineDraftSlide, master: DeckMaster['layouts'][CoreLayoutId]) {
  assertTitle(slide.title)
  return `<div class="slide-chrome outline-draft-slide"><h2 class="component-title content-title master-slot" style="${slotCss(slot(slide, master, 'title'))}"${inspectAttributes(slide.id, 'title', 'title', 'Title')}>${titleLines(slide.title)}</h2><p class="component-body"${inspectAttributes(slide.id, 'purpose', 'text', 'Purpose')}>${escapeHtml(slide.purpose)}</p><strong>OUTLINE / WAITING FOR CONFIRMATION</strong></div>`
}

function renderAgenda(slide: AgendaSlide, master: DeckMaster['layouts']['agenda']) {
  const items = slide.items?.map((item, index) => `<li data-agenda-state="${item.state ?? 'upcoming'}"${inspectAttributes(slide.id, `items[${index}]`, 'agenda-item', `Agenda item ${index + 1}`)}><span class="agenda-number">${escapeHtml(item.number)}</span><div><strong>${escapeHtml(item.title)}</strong>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}</div></li>`).join('') ?? ''
  return `<div class="slide-chrome template-agenda">${heading(slide, master, 'content')}${copy(slide.body, 'body', slide, master)}${placeholder(slide, 'items', slide.items, () => `<ol class="agenda-list master-slot" style="${slotCss(slot(slide, master, 'items'))}">${items}</ol>`)}</div>`
}

function renderGallery(slide: GallerySlide, master: DeckMaster['layouts']['gallery']) {
  const media = slide.images ?? []
  if (media.length > 4) throw new Error(`Gallery ${slide.id} must contain at most 4 images`)
  const pattern = media.length ? galleryPattern(media) : ''
  const images = media.map((image, index) => imageArea(image, undefined, 'gallery-item', true, slide.id, `images[${index}]`)).join('')
  const hasCopy = slide.title?.length || slide.subtitle || slide.body
  return `<div class="slide-chrome template-gallery${hasCopy ? ' has-gallery-copy' : ''}">${hasCopy ? heading(slide, master, 'content') + copy(slide.body, 'body', slide, master) : ''}${placeholder(slide, 'media', media, () => `<div class="gallery-grid master-slot" style="${slotCss(slot(slide, master, 'media'))}" data-gallery-count="${media.length}" data-gallery-pattern="${pattern}">${images}</div>`)}</div>`
}

function renderAdaptiveTitlePhotoAlt(slide: TitlePhotoAltSlide, master: DeckMaster['layouts']['title-photo-alt']) {
  const variant = mediaVariant(slide.image?.aspectRatio)
  const compact = slide.image?.frameMode === 'compact'
  const resolvedMaster = variant === 'portrait' ? withSlots(master, {
    title: { frame: { x: 6, y: 17, width: 48, height: 39 }, fontSize: 60 },
    subtitle: { frame: { x: 6, y: 61, width: 46, height: 13 } },
    media: { frame: compact ? { x: 65, y: 16, width: 26, height: 68 } : { x: 62, y: 9, width: 32, height: 82 } },
  }) : variant === 'landscape' ? withSlots(master, {
    title: { frame: { x: 6, y: 5, width: 88, height: 20 }, fontSize: 52 },
    subtitle: { frame: { x: 6, y: 27, width: 64, height: 8 } },
    media: { frame: compact ? { x: 20, y: 39, width: 60, height: 54 } : { x: 6, y: 39, width: 88, height: 54 } },
  }) : compact ? withSlots(master, {
    title: { frame: { x: 6, y: 24, width: 42, height: 40 }, fontSize: 62 },
    subtitle: { frame: { x: 6, y: 69, width: 40, height: 12 } },
    media: { frame: { x: 57, y: 27, width: 37, height: 48 } },
  }) : master
  return `<div class="slide-chrome template-title-photo-alt" data-media-variant="${variant}">${heading(slide, resolvedMaster, 'hero')}${placeholder(slide, 'media', slide.image, () => imageArea(slide.image!, slot(slide, resolvedMaster, 'media'), '', true, slide.id, 'image'))}</div>`
}

function withSlots<T extends DeckMaster['layouts'][CoreLayoutId]>(master: T, updates: Record<string, { frame: Frame, fontSize?: number }>): T {
  const slots = { ...master.slots }
  for (const [name, update] of Object.entries(updates)) slots[name] = { ...slots[name], ...update }
  return { ...master, slots } as T
}

function galleryPattern(images: readonly SlideImage[]) {
  if (images.length === 1) return (images[0].aspectRatio ?? 1) > 3.5 ? 'single-ultrawide' : `single-${mediaVariant(images[0].aspectRatio)}`
  if (images.length === 2) {
    const first = images[0].aspectRatio ?? 1
    const second = images[1].aspectRatio ?? 1
    if (first < .85 && second < .85) return 'pair-portraits'
    return Math.abs(first - second) > .8 ? (first >= second ? 'pair-main-left' : 'pair-main-right') : 'pair-equal'
  }
  if (images.length === 3) return (images[0].aspectRatio ?? 1) >= 1 ? 'trio-main-left' : 'trio-main-top'
  return 'quad'
}

function mediaVariant(aspectRatio: number | undefined): 'portrait' | 'balanced' | 'landscape' {
  if (aspectRatio !== undefined && aspectRatio < .85) return 'portrait'
  if (aspectRatio !== undefined && aspectRatio > 1.35) return 'landscape'
  return 'balanced'
}

function heading(slide: TitledSlide, master: DeckMaster['layouts'][CoreLayoutId], strength: 'hero' | 'content', showSubtitle = true) {
  if (slide.title) assertTitle(slide.title)
  return `${placeholder(slide, 'title', slide.title, () => `<h2 class="component-title ${strength}-title master-slot" style="${slotCss(slot(slide, master, 'title'))}"${inspectAttributes(slide.id, 'title', 'title', 'Title')}><span class="title-box">${titleLines(slide.title!)}</span></h2>`)}${showSubtitle ? copy(slide.subtitle, 'subtitle', slide, master, 'component-subtitle') : ''}`
}

function coverMeta(slide: TitleSlide, master: DeckMaster['layouts']['title']) {
  return placeholder(slide, 'meta', slide.author || slide.date, () => `<div class="component-cover-meta master-slot" style="${slotCss(slot(slide, master, 'meta'))}"><p class="cover-meta-box">${slide.author ? `<span class="component-cover-author"${inspectAttributes(slide.id, 'author', 'text', 'Author')}>${escapeHtml(slide.author)}</span>` : ''}${slide.author && slide.date ? '<span aria-hidden="true">·</span>' : ''}${slide.date ? `<span class="component-cover-date"${inspectAttributes(slide.id, 'date', 'text', 'Date')}>${escapeHtml(slide.date)}</span>` : ''}</p></div>`)
}

function copy(value: string | undefined, slotName: string, slide: SlideBase, master: DeckMaster['layouts'][CoreLayoutId], className = 'component-body', fieldName = slotName) {
  return placeholder(slide, slotName, value, () => {
    const content = className === 'component-subtitle' ? `<span>${escapeHtml(value!)}</span>` : escapeHtml(value!)
    return `<p class="${className} master-slot" style="${slotCss(slot(slide, master, slotName))}"${inspectAttributes(slide.id, fieldName, 'text', inspectFieldLabel(fieldName))}>${content}</p>`
  })
}

function list(items: readonly TextListItem[], style: SlotStyle | undefined, slideId: string) {
  const content = items.map((item, index) => `<li${inspectAttributes(slideId, `items[${index}]`, 'list-item', `List item ${index + 1}`)}><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(typeof item === 'string' ? item : item.text)}</p></li>`).join('')
  return `<ol class="component-list master-slot" style="${slotCss(style)}">${content}</ol>`
}

function imageArea(image: SlideImage, style?: SlotStyle, extraClass = '', showCaption = true, slideId?: string, path = 'image') {
  const fit = image.fit ?? style?.fit ?? (image.kind === 'screenshot' || image.kind === 'diagram' ? 'contain' : 'cover')
  const treatment = image.treatment ?? (image.kind === 'screenshot' || image.kind === 'diagram' ? 'tonal' : 'one-bit')
  const focal = image.focalPoint ?? { x: 50, y: 50 }
  return `<figure class="${extraClass ? `${extraClass} ` : ''}component-image-area master-slot" style="${slotCss(style)}" data-image-fit="${fit}"${image.aspectRatio ? ` data-aspect-ratio="${image.aspectRatio}"` : ''}${image.frameMode ? ` data-image-frame="${image.frameMode}"` : ''}${image.kind ? ` data-media-kind="${image.kind}"` : ''}${slideId ? inspectAttributes(slideId, path, 'image', image.alt || 'Image') : ''}><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy" data-media-treatment="${treatment}"${image.kind ? ` data-media-kind="${image.kind}"` : ''} style="object-position:${focal.x}% ${focal.y}%">${showCaption && image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ''}</figure>`
}

function renderObjects(objects: readonly SlideObject[], layer: 'layout' | 'page', slideId?: string) {
  const content = objects.map((object, index) => renderObject(object, layer, slideId, index)).join('')
  return layer === 'layout' ? `<div class="layout-object-layer" data-master-layer="fixed" aria-hidden="true">${content}</div>` : content
}

function renderVisualRegions(regions: Readonly<DeckMaster['layouts'][CoreLayoutId]['visualRegions']>) {
  if (!regions?.length) return ''
  return `<div class="layout-visual-region-layer" aria-hidden="true">${regions.map(region => `<span class="layout-visual-region" data-layout-visual-region="${escapeHtml(region.tag)}" style="${frameCss(region.frame)}"></span>`).join('')}</div>`
}

function renderObject(object: SlideObject, layer: 'layout' | 'page', slideId?: string, index = 0) {
  if (isCompositionSlideObject(object)) return renderCompositionObject(object, layer, slideId, index)
  const style = `${frameCss(object.frame)}${object.zIndex === undefined ? '' : `z-index:${object.zIndex};`}`
  const marker = layer === 'layout' ? 'data-layout-object' : `data-page-object${slideId ? inspectAttributes(slideId, `objects[${index}]`, object.kind, `${object.kind} object ${index + 1}`) : ''}`
  switch (object.kind) {
    case 'text': return `<p class="slide-object ${layer}-object component-object-text" ${marker} data-component-kind="text" style="${style}">${escapeHtml(object.text)}</p>`
    case 'image': {
      const focal = object.focalPoint ?? { x: 50, y: 50 }
      const treatment = object.treatment ?? (object.mediaKind === 'screenshot' || object.mediaKind === 'diagram' ? 'tonal' : 'one-bit')
      const fit = object.fit ?? (object.mediaKind === 'screenshot' || object.mediaKind === 'diagram' ? 'contain' : 'cover')
      return `<figure class="slide-object ${layer}-object component-object-image" ${marker} data-component-kind="image" style="${style}"><img src="${escapeHtml(object.src)}" alt="${escapeHtml(object.alt)}" loading="lazy" data-media-treatment="${treatment}"${object.mediaKind ? ` data-media-kind="${object.mediaKind}"` : ''} style="object-fit:${fit};object-position:${focal.x}% ${focal.y}%"></figure>`
    }
    case 'shape': return `<span class="slide-object ${layer}-object component-shape component-shape-${object.shape}" ${marker} data-component-kind="shape" style="${style}" aria-hidden="true"></span>`
    case 'table': {
      object.rows.forEach((row, index) => { if (row.length !== object.columns.length) throw new Error(`Table object row ${index + 1} must have ${object.columns.length} columns`) })
      return `<div class="slide-object ${layer}-object component-object-table" ${marker} data-component-kind="table" style="${style}"><table><thead><tr>${object.columns.map(cell => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${object.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    }
    case 'code': {
      const code = `<code class="language-${escapeHtml(object.language)}"${object.highlightLines ? ` data-line-numbers="${escapeHtml(object.highlightLines)}"` : ''}>${escapeHtml(object.code)}</code>`
      if (object.caption) return `<figure class="slide-object ${layer}-object component-object-code component-object-code-explained" ${marker} data-component-kind="code" style="${style}"><pre>${code}</pre><figcaption>${escapeHtml(object.caption)}</figcaption></figure>`
      return `<pre class="slide-object ${layer}-object component-object-code" ${marker} data-component-kind="code" style="${style}">${code}</pre>`
    }
    case 'video': return `<video class="slide-object ${layer}-object component-object-video" ${marker} data-component-kind="video" style="${style}" data-src="${escapeHtml(object.src)}" aria-label="${escapeHtml(object.alt)}"${object.poster ? ` poster="${escapeHtml(object.poster)}"` : ''}${object.controls === false ? '' : ' controls'} playsinline></video>`
    case 'chart': return renderChart(object, style, marker, layer)
    case 'html': {
      const external = object.external === true
      const permissions = external ? ' allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"' : ''
      const source = external ? `data-src="${escapeHtml(object.src)}"` : `src="${escapeHtml(object.src)}"`
      return `<iframe class="slide-object ${layer}-object component-object-html" ${marker} data-component-kind="html" style="${style}" ${source} sandbox="${external ? 'allow-scripts allow-same-origin allow-presentation' : ''}"${permissions} loading="lazy" title="${escapeHtml(object.title ?? 'Custom HTML component')}"></iframe>`
    }
  }
}

function renderCompositionObject(object: CompositionSlideObject, layer: 'layout' | 'page', slideId?: string, index = 0) {
  const diagnosis = diagnoseComposition(object.tree, { profile: 'stage', frame: { width: object.frame.width, height: object.frame.height } })
  if (diagnosis.status === 'split' || diagnosis.status === 'fallback' || diagnosis.status === 'reject') throw new Error(`Composition ${object.compositionId} cannot render: ${diagnosis.reasons.join('; ')}`)
  const resolved = resolveComposition(object.tree, { profile: 'stage', frame: { width: object.frame.width, height: object.frame.height } })
  const fidelity = assessCompositionFidelity(resolved.tree)
  const marker = layer === 'layout' ? 'data-layout-object' : `data-page-object${slideId ? inspectAttributes(slideId, `objects[${index}].tree`, 'composition', object.compositionId) : ''}`
  const style = `${frameCss(object.frame)}${object.zIndex === undefined ? '' : `z-index:${object.zIndex};`}`
  return `<div class="slide-object ${layer}-object cadenza-composition-object" ${marker} data-component-kind="composition" data-composition-id="${escapeHtml(object.compositionId)}" data-composition-diagnosis="${diagnosis.status}" data-composition-density="${diagnosis.density}" data-composition-cost="${diagnosis.cost}" data-fidelity-html="${fidelity.html}" data-fidelity-pptx="${fidelity.pptx}" data-rasterized="false" style="${style}">${renderComposition(resolved.tree)}</div>`
}

function inspectAttributes(slideId: string, fieldPath: string, kind: string, label: string) {
  return ` data-inspect-path="$.slides.${escapeHtml(slideId)}.${escapeHtml(fieldPath)}" data-inspect-kind="${escapeHtml(kind)}" data-inspect-label="${escapeHtml(label)}"`
}

function inspectFieldLabel(fieldName: string) {
  return ({ subtitle: 'Subtitle', body: 'Body', factLabel: 'Fact label' } as Record<string, string>)[fieldName] ?? fieldName
}

function renderChart(object: Extract<SlideObject, { kind: 'chart' }>, style: string, marker: string, layer: 'layout' | 'page') {
  const max = Math.max(1, ...object.values.map(item => item.value))
  const width = 90 / Math.max(1, object.values.length)
  const bars = object.values.map((item, index) => {
    const height = Math.max(0, item.value) / max * 68
    const x = 5 + index * width
    return `<g><rect x="${x}" y="${75 - height}" width="${Math.max(4, width - 4)}" height="${height}"></rect><text x="${x}" y="91">${escapeHtml(item.label)}</text></g>`
  }).join('')
  return `<div class="slide-object ${layer}-object component-object-chart" ${marker} data-component-kind="chart" data-chart-kind="${object.chart}" style="${style}"><svg viewBox="0 0 100 100" role="img">${bars}</svg></div>`
}

function placeholder(slide: SlideBase, name: string, value: unknown, render: () => string) {
  if (slide.hiddenPlaceholders?.includes(name)) return ''
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return ''
  return render()
}

function slot(slide: SlideBase, master: DeckMaster['layouts'][CoreLayoutId], name: string) {
  return mergeSlotStyle(master.slots[name], slide.slotOverrides?.[name])
}

function slotCss(style: SlotStyle | undefined) {
  if (!style) return ''
  return `${frameCss(style.frame)}${style.fontSize ? `font-size:${style.fontSize}px;` : ''}${style.align ? `text-align:${style.align};` : ''}`
}

function frameCss(value: Frame) {
  return `left:${value.x}%;top:${value.y}%;width:${value.width}%;height:${value.height}%;`
}

function titleLines(lines: readonly string[]) {
  assertTitle(lines)
  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
  return lines.map(line => `<span class="title-line">${Array.from(segmenter.segment(line), ({ segment }) => `<span class="title-phrase">${escapeHtml(segment)}</span>`).join('')}</span>`).join('')
}

function assertTitle(lines: readonly string[]) {
  if (lines.length > 3) throw new Error('Titles are limited to three lines')
  if (lines.some(line => !line.trim())) throw new Error('Title lines must be non-empty')
}

function isOutlineDraftSlide(slide: RenderableDeckSlide): slide is OutlineDraftSlide {
  return 'draft' in slide && slide.draft === true
}

function assertStableIds(slides: readonly RenderableDeckSlide[]) {
  const ids = new Set<string>()
  for (const slide of slides) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slide.id)) throw new Error(`Invalid slide id: ${slide.id}`)
    if (ids.has(slide.id)) throw new Error(`Duplicate slide id: ${slide.id}`)
    ids.add(slide.id)
  }
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}
