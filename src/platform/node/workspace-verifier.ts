import { existsSync, realpathSync, statSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { verifyDeckValue, type VerificationFinding, type VerificationReport } from '../../verification/deck-verifier.ts'

export function verifyWorkspaceDeck(value: unknown, deckDir: string): VerificationReport {
  const report = verifyDeckValue(value)
  if (!report.ok && report.checkedSlides === 0) return report
  const findings = [...report.findings, ...mediaFindings(value, deckDir)]
  return { ...report, ok: findings.every(finding => finding.severity !== 'error'), findings }
}

function mediaFindings(value: unknown, deckDir: string) {
  const findings: VerificationFinding[] = []
  for (const [path, source] of sources(value)) {
    if (typeof source !== 'string' || !source.trim()) continue
    if (/^(?:https?:|data:|cadenza:asset\/)/.test(source)) continue
    if (!source.startsWith('assets/') || source.split('/').some(part => part === '..' || part === '.')) {
      findings.push({ ruleId: 'media.deck-local-path', severity: 'error', path, message: `本地媒体必须使用 assets/<path>，当前为 ${source}` })
      continue
    }
    const assetsRoot = resolve(deckDir, 'assets')
    const file = resolve(deckDir, source)
    if (!inside(assetsRoot, file)) {
      findings.push({ ruleId: 'media.path-escape', severity: 'error', path, message: `媒体路径逃逸 deck assets：${source}` })
      continue
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      findings.push({ ruleId: 'media.not-found', severity: 'error', path, message: `媒体文件不存在：${source}` })
      continue
    }
    if (!inside(realpathSync(assetsRoot), realpathSync(file))) findings.push({ ruleId: 'media.path-escape', severity: 'error', path, message: `媒体软链接逃逸 deck assets：${source}` })
  }
  return findings
}

function sources(value: unknown, path = '$'): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.flatMap((entry, index) => sources(entry, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => key === 'src'
    ? [[`${path}.${key}`, entry] as [string, unknown]]
    : sources(entry, `${path}.${key}`))
}

function inside(root: string, path: string) {
  const child = relative(root, path)
  return child !== '..' && !child.startsWith(`..${sep}`) && child !== ''
}
