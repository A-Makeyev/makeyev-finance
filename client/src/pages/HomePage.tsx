import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaRegStar, FaStar, FaStarHalfAlt } from 'react-icons/fa'
import { Reveal } from '@/components/layout/Reveal'
import { ActionFormModal } from '@/features/contact/ActionFormModal'

/**
 * Home page - content carried over verbatim from the legacy index.html
 * (including its placeholder filler copy, per product decision).
 */
export function HomePage() {
  const { t } = useTranslation()
  const [actionOpen, setActionOpen] = useState(false)

  const open = () => setActionOpen(true)

  return (
    <>
      <section className="header">
        <div className="text-box main-heading">
          <h1 className="gradient-text-no-hover">
            {t('home.heroTitleLine1')} <br /> {t('home.heroTitleLine2')}
          </h1>
          <p className="gradient-text-no-hover">{t('home.heroSubtitle')}</p>
          <button
            type="button"
            data-testid="hero-action-button"
            onClick={open}
            className="action-btn hero-btn btn-white remove-highlight"
          >
            {t('home.heroCta')}
          </button>
        </div>
      </section>

      {/* courses */}
      <section className="course">
        <h1>{t('home.coursesTitle')}</h1>
        <p>{t('home.sectionSubtitle')}</p>

        <div className="course-row">
          {(['courseIntermediate', 'courseDegree', 'coursePostGrad'] as const).map((key, index) => (
            <Reveal key={key} order={index} className="course-col">
              <h2>{t(`home.${key}`)}</h2>
              <p>{t('home.courseBody')}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* campus */}
      <section className="campus">
        <h1>{t('home.campusTitle')}</h1>
        <p>{t('home.sectionSubtitle')}</p>

        <div className="campus-row">
          {(
            [
              ['newyork', 'cityNewYork'],
              ['london', 'cityLondon'],
              ['washington', 'cityWashington'],
            ] as const
          ).map(([image, labelKey]) => (
            <div className="campus-col" key={image}>
              <img src={`/images/${image}.png`} alt="" />
              <div className="layer">
                <h2>{t(`home.${labelKey}`)}</h2>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* facilities */}
      <section className="fac">
        <h1>{t('home.facilitiesTitle')}</h1>
        <p>{t('home.sectionSubtitle')}</p>

        <div className="fac-row">
          {(
            [
              ['library', 'facilityLibrary'],
              ['basketball', 'facilityPlayground'],
              ['cafeteria', 'facilityCafeteria'],
            ] as const
          ).map(([image, labelKey]) => (
            <div className="fac-col" key={image}>
              <img src={`/images/${image}.png`} alt="" />
              <h2>{t(`home.${labelKey}`)}</h2>
              <p>{t('home.shortBody')}</p>
            </div>
          ))}
        </div>
      </section>

      {/* testimonials */}
      <section className="testi">
        <h1>testimonials</h1>
        <p>{t('home.sectionSubtitle')}</p>

        <div className="testi-row">
          <Testimonial
            image="/images/user1.jpg"
            name={t('home.testimonialKriso')}
            stars={5}
            body={t('home.shortBody')}
          />
          <Testimonial
            image="/images/user2.jpg"
            name={t('home.testimonialEsterbon')}
            stars={3.5}
            body={t('home.shortBody')}
          />
        </div>
      </section>

      {/* action */}
      <section className="action">
        <h1>{t('home.actionTitle')}</h1>
        <button
          type="button"
          data-testid="action-section-button"
          onClick={open}
          className="action-btn hero-btn btn-white remove-highlight"
        >
          {t('home.actionCta')}
        </button>
      </section>

      <ActionFormModal open={actionOpen} onOpenChange={setActionOpen} />
    </>
  )
}

function Testimonial({
  image,
  name,
  stars,
  body,
}: {
  image: string
  name: string
  stars: number
  body: string
}) {
  return (
    <div className="testi-col">
      <img src={image} alt="" />
      <div>
        <p>{body}</p>
        <h3>{name}</h3>
        {[1, 2, 3, 4, 5].map((index) => {
          if (stars >= index)
            return (
              <FaStar key={index} aria-hidden className="fas mt-[15px] text-soft-black inline" />
            )
          if (stars >= index - 0.5)
            return (
              <FaStarHalfAlt
                key={index}
                aria-hidden
                className="fas mt-[15px] text-soft-black inline"
              />
            )
          return (
            <FaRegStar key={index} aria-hidden className="far mt-[15px] text-soft-black inline" />
          )
        })}
      </div>
    </div>
  )
}
