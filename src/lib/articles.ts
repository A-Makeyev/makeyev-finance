/**
 * The article surfaces share one image each. Keeping the mapping here means
 * the listing card and the article's own hero cannot end up pointing at
 * different pictures, and adding an article is one entry plus its route.
 *
 * Images are served as-is from `/public/images` (the legacy assets already in
 * the repo) rather than imported through the bundler, matching how the rest of
 * the site references them.
 */
export const ARTICLE_IMAGES = {
  'prepayment-penalties': '/images/mortgage-13.jpeg',
  'moving-checklist': '/images/mortgage-10.jpeg',
  'mortgage-track-types': '/images/mortgage-11.jpeg',
  'mortgage-decisions': '/images/mortgage-12.jpeg',
} as const

export type ArticleSlug = keyof typeof ARTICLE_IMAGES

/**
 * The hero banner background for an article page: the same dark overlay and
 * image pairing `.sub-header` uses in globals.css, but with the article's own
 * picture. Applied inline so the per-article image stays driven by the map
 * above rather than needing a matching CSS class per article.
 */
export function articleHeroBackground(slug: ArticleSlug): { backgroundImage: string } {
  return {
    backgroundImage: `linear-gradient(var(--soft-black-background), var(--soft-black-background)), url(${ARTICLE_IMAGES[slug]})`,
  }
}

/**
 * Listing order for /articles, plus the `articles.*` i18n key each entry reads
 * its title, summary and cta from.
 */
export const ARTICLE_LIST: readonly { slug: ArticleSlug; key: string }[] = [
  { slug: 'prepayment-penalties', key: 'prepayment' },
  { slug: 'moving-checklist', key: 'movingChecklist' },
  { slug: 'mortgage-track-types', key: 'trackTypes' },
  { slug: 'mortgage-decisions', key: 'mortgageDecisions' },
]
