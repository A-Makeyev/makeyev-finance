import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ARTICLE_IMAGES, ARTICLE_LIST } from '../../src/lib/articles'
import { he } from '../../src/i18n/he'

/**
 * The /articles listing and each article's own hero read the same image map, so
 * the two surfaces cannot point at different pictures without failing here.
 * The paths are hand-written strings into /public, where a typo fails silently
 * as a broken image in the browser - so the test checks the files exist too.
 */
const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../public')

describe('article images', () => {
  it('lists every article exactly once, each with an image', () => {
    const slugs = ARTICLE_LIST.map((article) => article.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const { slug } of ARTICLE_LIST) {
      expect(ARTICLE_IMAGES[slug]?.trim(), `image for ${slug}`).toBeTruthy()
    }
  })

  it('points every entry at a file that exists under /public', () => {
    for (const [slug, path] of Object.entries(ARTICLE_IMAGES)) {
      expect(path.startsWith('/images/'), `${slug} path`).toBe(true)
      const onDisk = resolve(PUBLIC_DIR, path.replace(/^\//, ''))
      expect(existsSync(onDisk), `${slug} -> ${path}`).toBe(true)
    }
  })

  it('ships the articles index banner referenced from globals.css', () => {
    // `.articles-sub-header` points at this path by literal, so a rename would
    // silently leave the listing hero blank rather than failing a build.
    expect(existsSync(resolve(PUBLIC_DIR, 'images/articles-cover.jpg'))).toBe(true)
  })

  it('has a matching articles.* i18n key for every listed article', () => {
    // The listing renders `articles.<key>.title/summary/cta`; renaming a key
    // without updating the list would leave a blank card at runtime.
    const articles = he.translation.articles as Record<string, unknown>
    for (const { key } of ARTICLE_LIST) {
      expect(articles[key], `articles.${key}`).toBeTruthy()
    }
  })
})
