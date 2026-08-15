import { visualAssetById, visualGeometryFor, type VisualAssetDefinition } from '../visual-assets/catalog.ts'
import { productionComponentDefinitions, validateCompositionTree } from '../authoring/component-library.ts'
import type { CompositionNode } from '../authoring/component-contract.ts'

export function renderComposition(tree: CompositionNode) {
  const issues = validateCompositionTree(tree)
  if (issues.length) throw new Error(`Invalid Cadenza composition: ${issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`)
  return renderCompositionNode(tree)
}

function renderCompositionNode(node: CompositionNode): string {
  const definition = productionComponentDefinitions.find(item => item.id === node.component)!
  const axes = Object.entries(node.axes ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([axis, value]) => ` data-axis-${axis}="${escapeHtml(String(value))}"`).join('')
  const attributes = `class="cadenza-component cadenza-${definition.id}" data-cadenza-component="${definition.id}" data-component-category="${definition.category}" data-component-version="${definition.version}" data-component-renderer="html-native" data-node-id="${escapeHtml(node.nodeId)}" data-inspect-kind="${escapeHtml(definition.id)}" data-inspect-label="${escapeHtml(definition.label)}"${axes}`
  if (definition.children) return `<div ${attributes} role="group" aria-label="${escapeHtml(definition.label)}">${node.children!.map(renderCompositionNode).join('')}</div>`
  if (Object.keys(definition.slots).length) {
    const slots = Object.keys(definition.slots).map(slot => `<div class="cadenza-slot" data-slot="${slot}">${node.slots![slot]!.map(renderCompositionNode).join('')}</div>`).join('')
    return `<div ${attributes} role="group" aria-label="${escapeHtml(definition.label)}">${slots}</div>`
  }
  if (definition.category === 'content') return renderContentNode(node, attributes)
  if (definition.category === 'relationship') return renderRelationshipNode(node, attributes)
  return `<div ${attributes} role="group" aria-label="${escapeHtml(definition.label)}"></div>`
}

function renderContentNode(node: CompositionNode, attributes: string): string {
  const props = node.props ?? {}
  const text = (key: string) => escapeHtml(String(props[key] ?? ''))
  switch (node.component) {
    case 'heading':
      return `<header ${attributes}>${props.eyebrow ? `<span class="cadenza-eyebrow">${text('eyebrow')}</span>` : ''}<h3>${text('text')}</h3></header>`
    case 'copy':
      return `<p ${attributes}>${text('text')}</p>`
    case 'metric': {
      const label = text('label')
      const value = text('value')
      return `<article ${attributes} aria-label="${label} ${value}"><span>${label}</span><strong>${value}</strong>${props.trend ? `<em>${text('trend')}</em>` : ''}${props.source ? `<cite>${text('source')}</cite>` : ''}</article>`
    }
    case 'list': {
      const tag = props.ordered ? 'ol' : 'ul'
      return `<${tag} ${attributes}>${(props.items as string[]).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`
    }
    case 'card':
      return `<article ${attributes}>${props.meta ? `<small>${text('meta')}</small>` : ''}<h4>${text('title')}</h4>${props.body ? `<p>${text('body')}</p>` : ''}</article>`
    case 'quote':
      return `<blockquote ${attributes}><p>${text('text')}</p>${props.author || props.source ? `<footer>${props.author ? text('author') : ''}${props.source ? `<cite>${text('source')}</cite>` : ''}</footer>` : ''}</blockquote>`
    case 'media': {
      const kind = String(node.axes?.kind ?? 'photo')
      const treatment = String(node.axes?.treatment ?? (kind === 'screenshot' || kind === 'diagram' ? 'tonal' : 'one-bit'))
      return `<figure ${attributes} data-media-kind="${escapeHtml(kind)}"><img src="${text('src')}" alt="${text('alt')}" loading="lazy" data-media-kind="${escapeHtml(kind)}" data-media-treatment="${escapeHtml(treatment)}">${props.caption ? `<figcaption>${text('caption')}</figcaption>` : ''}</figure>`
    }
    case 'code':
      if (props.caption) return `<figure ${attributes} data-code-explained="true"><pre><code class="language-${text('language')}"${props.highlightLines ? ` data-line-numbers="${text('highlightLines')}"` : ''}>${text('code')}</code></pre><figcaption>${text('caption')}</figcaption></figure>`
      return `<pre ${attributes}><code class="language-${text('language')}"${props.highlightLines ? ` data-line-numbers="${text('highlightLines')}"` : ''}>${text('code')}</code></pre>`
    case 'visual': {
      const assetId = String(props.asset)
      const asset = visualAssetById[assetId]
      return renderVisualAssetFigure(asset, node, attributes)
    }
    case 'profile': {
      const name = text('name')
      const ariaLabel = `${name}${props.role ? `, ${text('role')}` : ''}`
      const portrait = props.avatar
        ? `<img src="${text('avatar')}" alt="" loading="lazy">`
        : `<span class="cadenza-avatar-fallback" aria-hidden="true">${escapeHtml(initials(String(props.name)))}</span>`
      return `<article ${attributes} aria-label="${ariaLabel}">${portrait}<h4>${name}</h4>${props.role ? `<strong>${text('role')}</strong>` : ''}${props.bio ? `<p>${text('bio')}</p>` : ''}</article>`
    }
    case 'logo':
      return `<figure ${attributes} aria-label="${text('name')}">${props.src ? `<img src="${text('src')}" alt="${text('alt') || text('name')}" loading="lazy">` : `<span class="cadenza-logo-wordmark">${text('name')}</span>`}</figure>`
    case 'caption':
      return `<aside ${attributes}><span>${text('text')}</span>${props.source ? `<cite>${text('source')}</cite>` : ''}</aside>`
    default:
      return `<div ${attributes} role="group" aria-label="${escapeHtml(node.component)}"></div>`
  }
}

export function renderVisualAssetPreview(asset: VisualAssetDefinition, node: CompositionNode) {
  const axes = Object.entries(node.axes ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([axis, value]) => ` data-axis-${axis}="${escapeHtml(String(value))}"`).join('')
  const attributes = `class="cadenza-component cadenza-visual" data-cadenza-component="visual" data-component-category="content" data-component-version="1" data-component-renderer="html-native" data-node-id="${escapeHtml(node.nodeId)}"${axes}`
  return renderVisualAssetFigure(asset, node, attributes)
}

function renderVisualAssetFigure(asset: VisualAssetDefinition, node: CompositionNode, attributes: string) {
  const props = node.props ?? {}
  const text = (key: string) => escapeHtml(String(props[key] ?? ''))
  const geometry = visualGeometryFor(asset.id)
  const family = escapeHtml(asset.family ?? asset.id)
  const graphic = geometry
    ? `<svg viewBox="${escapeHtml(geometry.viewBox)}" role="img" aria-label="${text('alt')}" focusable="false">${geometry.partAddressed ? geometry.body : `<g data-visual-part="body" data-visual-geometry>${geometry.body}</g>`}</svg>`
    : `<span class="cadenza-visual-poster" role="img" aria-label="${text('alt')}"></span>`
  return `<figure ${attributes} data-visual-asset="${escapeHtml(asset.id)}" data-visual-family="${family}"><span class="cadenza-visual-stage">${graphic}</span>${props.caption ? `<figcaption>${text('caption')}</figcaption>` : ''}</figure>`
}

function renderRelationshipNode(node: CompositionNode, attributes: string): string {
  const props = node.props ?? {}
  const text = (key: string) => escapeHtml(String(props[key] ?? ''))
  switch (node.component) {
    case 'divider':
      return `<div ${attributes} role="separator">${props.label ? `<span>${text('label')}</span>` : ''}</div>`
    case 'connector':
      return `<div ${attributes} role="img" aria-label="${text('from')} to ${text('to')}" data-from="${text('from')}" data-to="${text('to')}"><span class="cadenza-connector-stroke" aria-hidden="true"></span>${props.label ? `<small>${text('label')}</small>` : ''}</div>`
    case 'progress':
      return `<div ${attributes}>${props.label ? `<span>${text('label')}</span>` : ''}<progress max="100" value="${text('value')}">${text('value')}%</progress><strong>${text('value')}%</strong>${props.target ? `<small>${text('target')}</small>` : ''}</div>`
    default:
      return `<div ${attributes} role="group"></div>`
  }
}

function initials(value: string) {
  return value.trim().split(/\s+/).map(part => [...part][0] ?? '').join('').slice(0, 2).toUpperCase()
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!) }
