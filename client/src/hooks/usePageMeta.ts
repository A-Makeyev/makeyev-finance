import { useEffect } from 'react'

/**
 * Per-page document metadata: sets `document.title` (the pattern every page
 * already used) and the <meta name="description"> content in the same effect,
 * so a page cannot update one and forget the other.
 *
 * The static default description in client/index.html covers first paint and
 * no-JS crawlers; this hook rewrites that same tag (or creates it, if the
 * document somehow ships none) on every client-side navigation. SPA pages
 * cannot do better than this at runtime - real per-route tags for crawlers
 * need server/static rendering, which is the articles' open foundation task.
 */
function ensureDescriptionTag(): HTMLMetaElement | null {
  if (typeof document === 'undefined') return null
  let tag = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', 'description')
    document.head.appendChild(tag)
  }
  return tag
}

export function usePageMeta(title: string, description: string): void {
  useEffect(() => {
    document.title = title
    ensureDescriptionTag()?.setAttribute('content', description)
  }, [title, description])
}
