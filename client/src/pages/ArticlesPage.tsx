import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageMeta } from '@/hooks/usePageMeta'
import { ScrollCue } from '@/components/layout/ScrollCue'
import { ARTICLE_IMAGES, ARTICLE_LIST } from '@/lib/articles'

/**
 * Articles page - the legacy heading was a stub; it now lists the real
 * articles. Entries carry a stable link each, so adding one is a route plus a
 * card here, not a redesign.
 */
export function ArticlesPage() {
  const { t, i18n } = useTranslation()

  usePageMeta(t('meta.articlesTitle'), t('meta.articlesDescription'))

  return (
    <>
      <section className="sub-header articles-sub-header">
        <div className="text-box">
          <h1 className="gradient-text-no-hover">{t('articles.title')}</h1>
        </div>
        <ScrollCue />
      </section>

      {/* The list follows the document language's direction, like the article
          body it leads to (the site-wide LTR rule for non-calculator pages
          stays as it is). */}
      <section className="articles-list" dir={i18n.dir()} aria-label={t('articles.listHeading')}>
        <h2>{t('articles.listHeading')}</h2>
        <ul>
          {ARTICLE_LIST.map(({ slug, key }) => (
            <li key={slug}>
              <Link className="article-card" to={`/articles/${slug}`}>
                {/* Decorative: the card's own heading names the article, so an
                    empty alt keeps screen readers from hearing it twice. */}
                <img
                  className="article-card-media"
                  src={ARTICLE_IMAGES[slug]}
                  alt=""
                  loading="lazy"
                />
                <div className="article-card-body">
                  <h3>{t(`articles.${key}.title`)}</h3>
                  <p>{t(`articles.${key}.summary`)}</p>
                  <span>{t(`articles.${key}.cta`)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
