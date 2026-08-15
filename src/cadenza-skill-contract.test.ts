import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const skill = readFileSync('.agents/skills/cadenza-presentations/SKILL.md', 'utf8')
const workflow = readFileSync('.agents/skills/cadenza-presentations/references/authoring-workflow.md', 'utf8')
const visualReview = readFileSync('.agents/skills/cadenza-presentations/references/visual-review-contract.md', 'utf8')
const contract = `${skill}\n${workflow}`

describe('Cadenza authoring skill verification contract', () => {
  it('requires preflight, direct verification, repair and full-size review', () => {
    expect(contract).toContain('preflightCompositionCandidate')
    expect(contract).toContain('cadenza verify <deck-id> --browser')
    expect(contract).toContain('repairing')
    expect(contract).toContain('技术通过不等于视觉完成')
    expect(contract).toContain('Audience 与 Overview')
    expect(contract).not.toContain('verify-run')
    expect(contract).not.toContain('versioned finding')
  })

  it('locks recurring visual feedback into authoring rules', () => {
    expect(contract).toContain('信息文字不得低于 12px')
    expect(contract).toContain('title-photo')
    expect(contract).toContain('禁止图注')
    expect(contract).toContain('不得推断 active')
    expect(contract).toContain('半透明纸面')
    expect(contract).toContain('taxonomy')
    expect(contract).toContain('内容特例必须记录理由')
    expect(contract).toContain('deck.cadenza.json` 始终是唯一内容来源')
  })

  it('loads the visual review contract on the standard authoring path', () => {
    expect(skill).toContain('[visual-review-contract.md](references/visual-review-contract.md)')
    expect(workflow).toContain('[visual-review-contract.md](visual-review-contract.md)')
    expect(visualReview).toContain('自动拦截')
    expect(visualReview).toContain('Audience 人工审查')
    expect(visualReview).toContain('media.cross-slide-reuse')
    expect(visualReview).toContain('composition.silhouette-repetition')
    expect(visualReview).toContain('motion.environment-all-static')
    expect(visualReview).toContain('browser.horizontal-item-wrap')
  })
})
