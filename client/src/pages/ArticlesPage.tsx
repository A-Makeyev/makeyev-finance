import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Articles page - stub preserved from the live site (bare heading only,
 * exactly as the legacy articles.html rendered it - no fade-in).
 */
export function ArticlesPage() {
  const { t } = useTranslation()

  useEffect(() => {
    document.title = t('meta.articlesTitle')
  }, [t])

  return (
    <>
      <section className="sub-header">
        <div className="text-box">
          <h1 className="gradient-text-no-hover">{t('articles.title')}</h1>
          <p className="gradient-text-no-hover">
            <b>{t('articles.subtitle')}</b>
          </p>
        </div>
      </section>

      <h1 style={{ padding: '20px 10%' }}>{t('articles.heading')}</h1>
    </>
  )
}
