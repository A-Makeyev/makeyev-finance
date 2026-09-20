import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PRESET_IDS } from '@/lib/amortization'
import { usePageMeta } from '@/hooks/usePageMeta'
import { articleHeroBackground } from '@/lib/articles'

/**
 * Practical mortgage decisions article: the ready-made mixes (explaining each
 * of `lib/amortization.ts`'s PRESETS), which track to prepay first, and
 * Spitzer versus equal principal as a whole-loan decision. General educational
 * content like the other articles: nothing on this page is computed from the
 * calculator, and the route is a hardcoded `/articles/<slug>`.
 *
 * The preset explanations must stay in agreement with `PRESETS` (shares and
 * track types) - `tests/unit/mortgageDecisionsContent.test.ts` pins the text
 * against those definitions so the two cannot drift. Each preset block links
 * into the calculator with a `?preset=<id>` deep link that loads that mix into
 * the preset selector, so a reader can immediately try what is described.
 *
 * All copy lives in `education.mortgageDecisions.*` (no hardcoded strings),
 * and the body opts into the document language's direction locally (the
 * site-wide rule keeps non-calculator pages LTR).
 */
export function MortgageDecisionsArticlePage() {
  const { t, i18n } = useTranslation()

  usePageMeta(t('articles.mortgageDecisions.title'), t('meta.articlesMortgageDecisionsDescription'))

  return (
    <>
      <section
        className="sub-header article-sub-header"
        style={articleHeroBackground('mortgage-decisions')}
      >
        <div className="text-box">
          <h1 className="gradient-text-no-hover">{t('articles.mortgageDecisions.title')}</h1>
        </div>
      </section>

      <article className="article-page" dir={i18n.dir()} data-testid="mortgage-decisions-article">
        <p className="article-paragraph">{t('education.mortgageDecisions.intro')}</p>

        <section className="article-section">
          <h2>{t('education.mortgageDecisions.presets.title')}</h2>
          <p className="article-paragraph">{t('education.mortgageDecisions.presets.lead')}</p>
          <ul className="article-facts">
            {PRESET_IDS.map((presetId) => (
              <li key={presetId}>
                <h4>{t(`education.mortgageDecisions.presets.blocks.${presetId}.title`)}</h4>
                <p>{t(`education.mortgageDecisions.presets.blocks.${presetId}.text`)}</p>
                {/* Deep link loads this exact mix into the calculator's preset
                    selector, so the reader can try what is described above. */}
                <Link className="article-link" to={`/calculators?preset=${presetId}`}>
                  {t('education.mortgageDecisions.presets.tryLabel')}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="article-section">
          <h2>{t('education.mortgageDecisions.prepay.title')}</h2>
          <p className="article-paragraph">{t('education.mortgageDecisions.prepay.lead')}</p>
          <ul className="article-facts">
            <li>
              <h4>{t('education.mortgageDecisions.prepay.facts.rateFirst.title')}</h4>
              <p>{t('education.mortgageDecisions.prepay.facts.rateFirst.text')}</p>
            </li>
            <li>
              <h4>{t('education.mortgageDecisions.prepay.facts.penalty.title')}</h4>
              <p>{t('education.mortgageDecisions.prepay.facts.penalty.text')}</p>
            </li>
          </ul>
          {/* Rule-of-thumb framing, then the prepayment-penalty article covers
              the penalty mechanics in depth instead of re-explaining here. */}
          <p className="article-paragraph">{t('education.mortgageDecisions.prepay.ruleNote')}</p>
          <Link className="article-link" to="/articles/prepayment-penalties">
            {t('education.mortgageDecisions.prepay.prepaymentLink')}
          </Link>
        </section>

        <section className="article-section">
          <h2>{t('education.mortgageDecisions.methods.title')}</h2>
          <p className="article-paragraph">{t('education.mortgageDecisions.methods.framing')}</p>
          <p className="article-paragraph">{t('education.mortgageDecisions.methods.spitzer')}</p>
          <p className="article-paragraph">
            {t('education.mortgageDecisions.methods.equalPrincipal')}
          </p>
          <p className="article-paragraph">
            {t('education.mortgageDecisions.methods.availability')}
          </p>
          <p className="article-paragraph">
            {t('education.mortgageDecisions.methods.calculatorNote')}
          </p>
          <Link className="article-link" to="/articles/mortgage-track-types">
            {t('education.mortgageDecisions.methods.trackTypesLink')}
          </Link>
        </section>

        <p className="article-disclaimer">{t('education.mortgageDecisions.disclaimer')}</p>
        <Link className="article-back" to="/articles">
          {t('education.mortgageDecisions.backToArticles')}
        </Link>
      </article>
    </>
  )
}
