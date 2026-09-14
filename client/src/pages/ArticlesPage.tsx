import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageMeta } from '@/hooks/usePageMeta'

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
      <section className="sub-header">
        <div className="text-box">
          <h1 className="gradient-text-no-hover">{t('articles.title')}</h1>
        </div>
      </section>

      {/* The list follows the document language's direction, like the article
          body it leads to (the site-wide LTR rule for non-calculator pages
          stays as it is). */}
      <section className="articles-list" dir={i18n.dir()} aria-label={t('articles.listHeading')}>
        <h2>{t('articles.listHeading')}</h2>
        <ul>
          <li>
            <Link className="article-card" to="/articles/prepayment-penalties">
              <h3>{t('articles.prepayment.title')}</h3>
              <p>{t('articles.prepayment.summary')}</p>
              <span>{t('articles.prepayment.cta')}</span>
            </Link>
          </li>
          <li>
            <Link className="article-card" to="/articles/moving-checklist">
              <h3>{t('articles.movingChecklist.title')}</h3>
              <p>{t('articles.movingChecklist.summary')}</p>
              <span>{t('articles.movingChecklist.cta')}</span>
            </Link>
          </li>
        </ul>
      </section>
    </>
  )
}
