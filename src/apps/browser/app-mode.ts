export type AppMode = 'studio' | 'audience' | 'receiver' | 'overview' | 'library' | 'decks'

type SearchLocation = Pick<Location, 'search'>
type HrefLocation = Pick<Location, 'href'>

export function resolveAppMode(location: SearchLocation): AppMode {
  const params = new URLSearchParams(location.search)
  if (params.has('receiver')) return 'receiver'
  if (params.get('view') === 'overview') return 'overview'
  if (params.get('view') === 'library') return 'library'
  if (params.get('view') === 'decks' || (!params.has('view') && !params.has('deck') && !params.has('source'))) return 'decks'
  return params.get('view') === 'audience' ? 'audience' : 'studio'
}

export function audienceUrl(current: string | HrefLocation): string {
  const url = new URL(typeof current === 'string' ? current : current.href)
  url.searchParams.set('view', 'audience')
  url.searchParams.delete('receiver')
  return url.href
}

export function studioUrl(current: string | HrefLocation): string {
  const href = typeof current === 'string' ? current : current.href
  const absolute = /^[a-z]+:/i.test(href)
  const url = new URL(href, 'https://cadenza.local/')
  url.searchParams.set('view', 'studio')
  url.searchParams.delete('receiver')
  if (absolute) return url.href
  return `${url.pathname === '/' && href.startsWith('?') ? '' : url.pathname}${url.search}${url.hash}`
}

export function designLibraryUrl(current: string | HrefLocation): string {
  const url = new URL(typeof current === 'string' ? current : current.href)
  url.searchParams.set('view', 'library')
  url.searchParams.delete('receiver')
  url.hash = ''
  return url.href
}
