import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { renderComposition } from '../../src/rendering/component-renderer'
import { generationRegressionCorpus } from '../fixtures/deck/generation-regression-corpus'
import { composeSlideCandidates, preflightCompositionCandidate } from '../../src/authoring/slide-composer'
import { inspectRenderedSlide } from '../../src/platform/node/browser-smoke'

const input = { profile: 'stage' as const, frame: { width: 84, height: 68 }, format: 'html' as const }

for (const item of generationRegressionCorpus) {
  test(`regenerates ${item.kind} from blank signals and passes real canvas gates`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/regression-assets/cadenza-hero-one-bit-source.png', route => route.fulfill({
      path: fileURLToPath(new URL('../../decks/cadenza-demo/assets/cadenza-hero-one-bit-source.png', import.meta.url)),
    }))
    const generated = composeSlideCandidates(item.signals, { ...input, seed: item.id })
    const candidate = generated.candidates[0]
    expect(candidate).toBeTruthy()
    expect(preflightCompositionCandidate(item.signals, candidate.tree, input)).toMatchObject({ ok: true, findings: [] })

    await page.goto('/?view=audience&deck=cadenza-demo#/16')
    await expect(page.locator('[data-slide-id="blank"].present')).toBeVisible()
    const content = `<div class="component-object cadenza-composition-object" data-component-kind="composition" data-corpus-case="${item.id}" style="position:absolute;left:8%;top:16%;width:84%;height:68%">${renderComposition(candidate.tree)}</div>`
    await page.locator('[data-slide-id="blank"]').evaluateAll((slides, html) => {
      slides.forEach(slide => { slide.innerHTML = `<div class="slide-chrome template-blank">${html}</div>` })
    }, content)
    await expect(page.locator('[data-slide-id="blank"].present')).toHaveScreenshot(`corpus-${item.kind}.png`)

    const audit = await page.evaluate(inspectRenderedSlide, 'blank')
    expect({
      clippedText: audit.clippedText,
      orphanLines: audit.orphanLines,
      emptySurfaces: audit.emptySurfaces,
      misalignedSplits: audit.misalignedSplits,
      misalignedPeers: audit.misalignedPeers,
      underfilledRegions: audit.underfilledRegions,
      unreadableRelationships: audit.unreadableRelationships,
      unreadableContent: audit.unreadableContent,
      overlappingContent: audit.overlappingContent,
      decorativeCollisions: audit.decorativeCollisions,
    }).toEqual({
      clippedText: [], orphanLines: [], emptySurfaces: [], misalignedSplits: [], misalignedPeers: [], underfilledRegions: [], unreadableRelationships: [], unreadableContent: [], overlappingContent: [], decorativeCollisions: [],
    })
    expect(audit.contentCoverage).toBeGreaterThanOrEqual(35)
    expect(audit.verticalCoverage).toBeGreaterThanOrEqual(60)
  })
}
