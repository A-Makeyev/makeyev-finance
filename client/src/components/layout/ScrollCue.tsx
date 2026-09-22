import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FaChevronDown } from 'react-icons/fa'

/**
 * Scroll-down cue: a small round chevron button pinned near the bottom edge
 * of a hero banner (.header / .sub-header). Clicking it smooth-scrolls the
 * hero's next sibling (the first content section) into view. Shared by all
 * hero pages, so a wording or behavior tweak happens in one place.
 *
 * The Indexes strip, Markets strip and navbar all stay fixed at the top, so
 * the target is NOT scrolled flush with the viewport top: the stop point is
 * the hero's bottom edge at the chrome's bottom edge, measured at click
 * time (the strips' heights change per breakpoint). Everything below the
 * fixed chrome is then content, with the section's own heading visible.
 *
 * Keyboard parity: pressing ArrowDown while the hero still fills the
 * viewport triggers the same scroll, like clicking the cue. The guards keep
 * it from stealing the key where it means something else: no hijack while
 * focus sits in a form field or editable region (the calculator page's
 * inputs use arrows natively), while a modal is open, or with modifier keys
 * (OS / screen-reader shortcuts). Past the hero the handler no-ops and the
 * arrow resumes native scrolling. Reduced motion is honored inside the
 * scroll itself.
 *
 * Vertical alignment only (translateY), so the document direction (RTL /
 * LTR) is irrelevant to it: the centering is inherited from .text-box's
 * column flex. On short viewports the cue tucks under the text-box.
 */
export function ScrollCue() {
  const { t } = useTranslation()

  const scrollPastHero = useCallback(() => {
    const hero = document.querySelector<HTMLElement>('.header, .sub-header')
    const target = hero?.nextElementSibling
    if (!hero || !target) return

    const chromeHeight = [
      'nav#navbar',
      '.indexes',
      '.markets',
    ].reduce<number>(
      (sum, selector) => sum + (document.querySelector<HTMLElement>(selector)?.offsetHeight ?? 0),
      0,
    )
    const targetTop = target.getBoundingClientRect().top + window.scrollY
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    window.scrollTo({
      top: targetTop - chromeHeight,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown') return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (target?.isContentEditable ?? false)
      ) {
        return
      }

      // A modal owns the keyboard while open (Radix dialogs render with
      // role="dialog"; native <dialog> too).
      if (document.querySelector('[role="dialog"], dialog[open]')) return

      // Only while the hero is still the dominant thing on screen: its
      // bottom edge below the viewport's midline. After the scroll (or any
      // manual scroll past it) the arrow goes back to native scrolling.
      const hero = document.querySelector<HTMLElement>('.header, .sub-header')
      if (!hero) return
      if (hero.getBoundingClientRect().bottom < window.innerHeight / 2) return

      event.preventDefault()
      scrollPastHero()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [scrollPastHero])

  return (
    <button
      type="button"
      className="scroll-cue remove-highlight"
      data-testid="hero-scroll-cue"
      aria-label={t('heroScrollCue.aria')}
      onClick={scrollPastHero}
    >
      <FaChevronDown aria-hidden className="mt-1" />
    </button>
  )
}
