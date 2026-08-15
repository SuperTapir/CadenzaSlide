import { expect, test } from '@playwright/test'
import type { CompositionNode } from '../../src/authoring/component-contract'
import { renderComposition } from '../../src/rendering/component-renderer'
import { preflightCompositionCandidate, type SlideContentSignals } from '../../src/authoring/slide-composer'
import { inspectRenderedSlide } from '../../src/platform/node/browser-smoke'

const signals: SlideContentSignals = {
  id: 'calibration-grid',
  evidence: Array.from({ length: 6 }, (_, index) => ({ id: `fact-${index + 1}`, text: `证据 ${index + 1}` })),
}
const tree: CompositionNode = {
  nodeId: 'calibration-root', component: 'grid', version: 1, axes: { columns: '3', gap: 'normal', density: 'open' },
  children: signals.evidence!.map(item => ({ nodeId: item.id, component: 'card', version: 1, props: { title: item.text } })),
}
const input = { profile: 'stage' as const, frame: { width: 84, height: 72 }, format: 'html' as const }

test('structured preflight calibrates with browser evidence without pretending to know paint', async ({ page }) => {
  const preflight = preflightCompositionCandidate(signals, tree, input)
  expect(preflight).toMatchObject({ ok: true, findings: [], requiredPostWriteChannels: ['document', 'render', 'geometry'] })

  await page.goto('/?view=audience&deck=cadenza-demo#/16')
  const slide = page.locator('[data-slide-id="blank"].present')
  await expect(slide).toBeVisible()
  const html = `<div class="component-object cadenza-composition-object" data-component-kind="composition" style="position:absolute;left:8%;top:14%;width:84%;height:72%">${renderComposition(tree)}</div>`
  await page.locator('[data-slide-id="blank"]').evaluateAll((slides, content) => {
    slides.forEach(slide => { slide.innerHTML = `<div class="slide-chrome template-blank">${content}</div>` })
  }, html)

  const rendered = await page.evaluate(inspectRenderedSlide, 'blank')
  expect(rendered.contentCoverage).toBeGreaterThanOrEqual(35)
  expect(rendered.clippedText).toEqual([])
  expect(rendered.unreadableContent).toEqual([])

  await page.locator('[data-slide-id="blank"]').evaluateAll(slides => {
    slides.forEach(slide => { slide.innerHTML = '<div class="slide-chrome template-blank"><div data-component-kind="composition"></div></div>' })
  })
  const paintFailure = await page.evaluate(inspectRenderedSlide, 'blank')
  expect(preflight.ok).toBe(true)
  expect(paintFailure.contentCoverage).toBeLessThan(35)
})

test('preflight underfill recommendation degrades to a semantic statement layout', async ({ page }) => {
  const sparseSignals: SlideContentSignals = { id: 'sparse-claim', claim: { id: 'claim', text: '唯一主张' } }
  const sparseTree: CompositionNode = { nodeId: 'sparse-root', component: 'heading', version: 1, props: { text: '唯一主张' } }
  expect(preflightCompositionCandidate(sparseSignals, sparseTree, input)).toMatchObject({
    ok: false,
    findings: [expect.objectContaining({ ruleId: 'layout.content-coverage' })],
    recommendation: { action: 'simplify' },
  })

  await page.goto('/?view=audience&deck=cadenza-demo#/8')
  await expect(page.locator('[data-slide-id="statement"].present')).toBeVisible()
  const audit = await page.evaluate(inspectRenderedSlide, 'statement')
  expect(audit.clippedText).toEqual([])
  expect(audit.unreadableContent).toEqual([])
})
