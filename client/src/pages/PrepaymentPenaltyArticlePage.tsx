import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageMeta } from '@/hooks/usePageMeta'
import { PrepaymentPenaltyFacts } from '@/components/education/PrepaymentPenaltyFacts'
import { articleHeroBackground } from '@/lib/articles'

/**
 * Prepayment-penalty (עמלת פירעון מוקדם) article. General educational content -
 * it is not tied to the calculator's numbers and nothing on this page is
 * computed from them.
 *
 * The four confirmed facts render from the same translation keys the
 * calculator's collapsible note reads, so the two surfaces cannot drift apart.
 * The personal market-risk framing that prompted this article is deliberately
 * not included: only the Bank of Israel rules and the loyalty discount
 * schedule, which are the parts that are verifiable.
 */
export function PrepaymentPenaltyArticlePage() {
  const { t, i18n } = useTranslation()

  usePageMeta(t('articles.prepayment.title'), t('meta.articlesPrepaymentDescription'))

  return (
    <>
      <section
        className="sub-header article-sub-header"
        style={articleHeroBackground('prepayment-penalties')}
      >
        <div className="text-box">
          <h1 className="gradient-text-no-hover">{t('articles.prepayment.title')}</h1>
        </div>
      </section>

      {/* The site's global rule keeps non-calculator pages LTR (legacy page
          parity), but a Hebrew article body read left-to-right is hard to
          follow. The container opts into the document language's direction
          locally - the rest of the site is untouched. */}
      <article className="article-page" dir={i18n.dir()} data-testid="prepayment-penalty-article">
        <p className="article-paragraph">{t('education.prepaymentPenalty.whyPrime')}</p>
        <PrepaymentPenaltyFacts className="article-facts" />
        <p className="article-paragraph">{t('education.prepaymentPenalty.timing')}</p>
        <p className="article-disclaimer">{t('education.prepaymentPenalty.disclaimer')}</p>
        <Link className="article-back" to="/articles">
          {t('education.prepaymentPenalty.backToArticles')}
        </Link>
      </article>
    </>
  )
}
