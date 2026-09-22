import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageMeta } from '@/hooks/usePageMeta'
import { articleHeroBackground } from '@/lib/articles'
import { ScrollCue } from '@/components/layout/ScrollCue'

/**
 * Moving-checklist article (רשימת דברים להעביר בהעברת דירה). General
 * educational content, like the prepayment-penalty article: nothing on this
 * page is computed from the calculator, and the route is a hardcoded
 * `/articles/<slug>` handled the same way.
 *
 * The checklist sections read from `education.movingChecklist.sections.*` so
 * the content is fully in the i18n files (no hardcoded strings), and every
 * item is a plain <li> - no rich HTML is rendered from content, so nothing
 * needs sanitizing by construction.
 *
 * Like the other article, the body opts into the document language's
 * direction locally (the site-wide rule keeps non-calculator pages LTR).
 */
const SECTION_KEYS = ['municipalities', 'utilities', 'meters', 'logistics', 'deposits'] as const

export function MovingChecklistArticlePage() {
  const { t, i18n } = useTranslation()

  usePageMeta(t('articles.movingChecklist.title'), t('meta.articlesMovingChecklistDescription'))

  return (
    <>
      {/* The article's own picture is the hero banner here, not an image in the
          body: same dark overlay as the shared sub-header, different image. */}
      <section
        className="sub-header article-sub-header"
        style={articleHeroBackground('moving-checklist')}
      >
        <div className="text-box">
          <h1 className="gradient-text-no-hover">{t('articles.movingChecklist.title')}</h1>
        </div>
        <ScrollCue />
      </section>

      <article className="article-page" dir={i18n.dir()} data-testid="moving-checklist-article">
        <p className="article-paragraph">{t('education.movingChecklist.intro')}</p>

        <p className="article-paragraph">{t('education.movingChecklist.documentsLead')}</p>

        {SECTION_KEYS.map((section) => (
          <section key={section} className="article-section">
            <h2>{t(`education.movingChecklist.sections.${section}.title`)}</h2>
            <ul>
              {(
                t(`education.movingChecklist.sections.${section}.items`, {
                  returnObjects: true,
                }) as unknown as readonly string[]
              ).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {/* The owner-liability callout sits inside the meters section,
                where the dispute risk it warns about actually lives. */}
            {section === 'meters' && (
              <p className="article-callout">
                {t('education.movingChecklist.sections.meters.callout')}
              </p>
            )}
          </section>
        ))}

        <p className="article-paragraph">{t('education.movingChecklist.timing')}</p>

        <p className="article-disclaimer">{t('education.movingChecklist.disclaimer')}</p>
        <Link className="article-back" to="/articles">
          {t('education.movingChecklist.backToArticles')}
        </Link>
      </article>
    </>
  )
}
