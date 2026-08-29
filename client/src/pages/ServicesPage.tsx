import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** Services page — legacy services.html content carried over verbatim. */
export function ServicesPage() {
  const { t } = useTranslation()

  useEffect(() => {
    document.title = t('meta.servicesTitle')
  }, [t])

  return (
    <>
      <section className="sub-header">
        <div className="text-box">
          <h1 className="gradient-text-no-hover">{t('services.title')}</h1>
          <p className="gradient-text-no-hover">
            <b>{t('services.subtitle')}</b>
          </p>
        </div>
      </section>

      <section className="services">
        {[0, 1, 2].map((index) => (
          <div
            className="services-row"
            key={index}
            data-testid={`service-card-${index + 1}`}
          >
            <div className="services-col">
              <h1>{t('services.cardTitle')}</h1>
              <p>{t('services.cardBody')}</p>
              <a
                href="#"
                onClick={(event) => event.preventDefault()}
                className="hero-btn btn-blue remove-highlight"
              >
                {t('services.explore')}
              </a>
            </div>

            <div className="services-col">
              <img
                src={`/images/${['carry-house', 'shaking-hands', 'handing-home'][index]}.jpg`}
                alt=""
              />
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
