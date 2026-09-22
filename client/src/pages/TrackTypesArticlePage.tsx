import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageMeta } from '@/hooks/usePageMeta'
import { articleHeroBackground } from '@/lib/articles'
import { ScrollCue } from '@/components/layout/ScrollCue'

/**
 * Mortgage track types (מסלולי משכנתא) article. General educational content,
 * like the moving-checklist and prepayment-penalty articles: nothing on this
 * page is computed from the calculator, and the route is a hardcoded
 * `/articles/<slug>` handled the same way.
 *
 * The article explains the track types the calculator's own form offers, so
 * the numbers it quotes (the ~1.5% prime margin, the 66.66% variable-share
 * ceiling, at least 33.33% in a non-variable track) must stay in agreement
 * with `lib/amortization.ts`'s PRIME_MARGIN and VARIABLE_SHARE_LIMIT - the
 * content test pins them against those constants so the two cannot drift.
 *
 * All copy lives in `education.trackTypes.*` (no hardcoded strings), and the
 * body opts into the document language's direction locally (the site-wide
 * rule keeps non-calculator pages LTR).
 */
const BLOCK_KEYS = ['prime', 'fixed', 'variable', 'indexed'] as const

export function TrackTypesArticlePage() {
  const { t, i18n } = useTranslation()

  usePageMeta(t('articles.trackTypes.title'), t('meta.articlesTrackTypesDescription'))

  return (
    <>
      <section
        className="sub-header article-sub-header"
        style={articleHeroBackground('mortgage-track-types')}
      >
        <div className="text-box">
          <h1 className="gradient-text-no-hover">{t('articles.trackTypes.title')}</h1>
        </div>
        <ScrollCue />
      </section>

      <article className="article-page" dir={i18n.dir()} data-testid="track-types-article">
        <p className="article-paragraph">{t('education.trackTypes.intro')}</p>

        <section className="article-section">
          <h2>{t('education.trackTypes.blocks.title')}</h2>
          <ul className="article-facts">
            {BLOCK_KEYS.map((key) => (
              <li key={key}>
                <h4>{t(`education.trackTypes.blocks.${key}.title`)}</h4>
                <p>{t(`education.trackTypes.blocks.${key}.text`)}</p>
              </li>
            ))}
          </ul>
          {/* The prime block's penalty-free property is covered in depth by
              the prepayment-penalty article, so this links there instead of
              re-explaining it. */}
          <p className="article-paragraph">{t('education.trackTypes.primePenaltyNote')}</p>
          <Link className="article-link" to="/articles/prepayment-penalties">
            {t('education.trackTypes.prepaymentLink')}
          </Link>
        </section>

        <section className="article-section">
          <h2>{t('education.trackTypes.methods.title')}</h2>
          <p className="article-paragraph">{t('education.trackTypes.methods.spitzer')}</p>
          <p className="article-paragraph">{t('education.trackTypes.methods.equalPrincipal')}</p>
          <p className="article-paragraph">{t('education.trackTypes.methods.note')}</p>
          {/* The follow-up article covers the schedule choice as a borrower-level
              whole-loan decision plus the mix and prepayment-order topics, the
              same way the primePenaltyNote above links to the prepayment one. */}
          <p className="article-paragraph">{t('education.trackTypes.methods.deeperNote')}</p>
          <Link className="article-link" to="/articles/mortgage-decisions">
            {t('education.trackTypes.methods.deeperLink')}
          </Link>
        </section>

        <section className="article-section">
          <h2>{t('education.trackTypes.mix.title')}</h2>
          <p className="article-paragraph">{t('education.trackTypes.mix.body')}</p>
          <p className="article-paragraph">{t('education.trackTypes.mix.limit')}</p>
        </section>

        <section className="article-section">
          <h2>{t('education.trackTypes.choosing.title')}</h2>
          <p className="article-paragraph">{t('education.trackTypes.choosing.body')}</p>
          <p className="article-paragraph">{t('education.trackTypes.choosing.terms')}</p>
          <p className="article-paragraph">{t('education.trackTypes.choosing.calculatorLead')}</p>
          <Link className="article-link" to="/calculators">
            {t('education.trackTypes.choosing.calculatorLink')}
          </Link>
        </section>

        <p className="article-disclaimer">{t('education.trackTypes.disclaimer')}</p>
        <Link className="article-back" to="/articles">
          {t('education.trackTypes.backToArticles')}
        </Link>
      </article>
    </>
  )
}
