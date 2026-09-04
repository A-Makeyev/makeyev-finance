import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { FaPaperPlane, FaTimes } from 'react-icons/fa'
import { EMAIL_REGEX, NAME_REGEX, PHONE_REGEX } from './validation'
import { isEmailjsAvailable, sendContactEmail, type EmailSendResult } from './emailjsClient'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { useQuestionWishlist } from '@/stores/questionWishlistStore'
import { useLocalizedResultsTopics } from '@/features/calculator/resultsTopics'
import { useMediaQuery } from '@/hooks/useScrolled'
import { cn } from '@/lib/cn'
import { FloatingLabelField } from './FloatingLabelField'
import type { TrackState } from '@/stores/calculatorStore'

/**
 * Plain-text "calculator scenario" block appended to the email alongside the
 * saved-question rows - the numbers behind the topics (loan, term, purpose
 * and every entered track), so whoever answers doesn't have to ask back.
 */
function buildCalculatorSnapshot(t: TFunction): string | null {
  const store = useCalculatorStore.getState()
  const entered: TrackState[] = store.tracks.filter((track) => track.amountText.trim() !== '')
  const loanText = store.startingAmountText.trim()
  if (!loanText && entered.length === 0) return null

  const purposeKey = {
    first: 'calculator.purposeFirst',
    upgrade: 'calculator.purposeUpgrade',
    investment: 'calculator.purposeInvestment',
  }[store.purpose]
  // The row label (wishlist.emailSnapshotTitle) heads this block in the
  // email table, so the text itself starts with the amounts.
  const lines = [
    `${t('calculator.startingAmountLabel')}: ₪${loanText || '0'}`,
    `${t('calculator.termLabel')}: ${store.termYears} ${t('calculator.track.yearsSuffix')}`,
    `${t('calculator.purposeLabel')}: ${t(purposeKey)}`,
    t('calculator.track.typeLabel'),
  ]
  entered.forEach((track) => {
    const parts = [
      `₪${track.amountText.trim()}`,
      track.rateText.trim() !== '' ? `${track.rateText.trim()}%` : '',
      t(
        track.method === 'spitzer'
          ? 'calculator.track.methodSpitzer'
          : 'calculator.track.methodEqualPrincipal',
      ),
    ].filter((part) => part !== '')
    lines.push(`${t(`calculator.trackTypes.${track.type}`)} ~ ${parts.join(' · ')}`)
  })
  return lines.join('\n')
}

export interface ContactSubmitOutcome {
  status: 'success' | 'failure'
  name?: string
  detail?: string
}

export interface ContactFormProps {
  variant: 'main' | 'action'
  onOutcome: (outcome: ContactSubmitOutcome) => void
  registerReset?: (reset: () => void) => void
}

type FieldName = 'name' | 'phone' | 'email' | 'message'
type Status = 'valid' | 'invalid' | 'neutral'

/** Preferred callback windows - optional multi-select under the message. */
type CallbackTime = 'morning' | 'noon' | 'evening'
const CALLBACK_TIMES: CallbackTime[] = ['morning', 'noon', 'evening']

const FIELD_DEFS: Array<{ name: FieldName; required: boolean }> = [
  { name: 'name', required: true },
  { name: 'phone', required: true },
  { name: 'email', required: true },
  { name: 'message', required: false },
]

export function ContactForm({ variant, onOutcome, registerReset }: ContactFormProps) {
  const { t, i18n } = useTranslation()
  const isHebrew = i18n.language.startsWith('he')
  const isLarge = useMediaQuery('(min-width: 1101px)')
  const isSmall500 = useMediaQuery('(max-width: 500px)')
  void isLarge
  void isSmall500
  const fields = FIELD_DEFS.filter((f) => variant === 'main' || f.name !== 'email')

  const [values, setValues] = useState<Record<FieldName, string>>({
    name: '',
    phone: '',
    email: '',
    message: '',
  })
  const [selectedTimes, setSelectedTimes] = useState<CallbackTime[]>([])
  const wishlistItems = useQuestionWishlist((s) => s.items)
  // Titles and summaries follow the live language, so a saved question is
  // re-translated when the site switches Hebrew ⇄ English.
  const wishlistTopics = useLocalizedResultsTopics(wishlistItems)
  const removeWishlistItem = useQuestionWishlist((s) => s.remove)
  const clearWishlist = useQuestionWishlist((s) => s.clear)
  const [sending, setSending] = useState(false)
  const [dots, setDots] = useState(0)
  const [plane, setPlane] = useState(false)
  void dots
  void plane
  const timers = useRef<number[]>([])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const fieldValid = (name: FieldName): boolean => {
    switch (name) {
      case 'name':
        return NAME_REGEX.test(values.name)
      case 'phone':
        return PHONE_REGEX.test(values.phone)
      case 'email':
        return EMAIL_REGEX.test(values.email)
      case 'message':
        return true
    }
  }

  const allValid = fields.every((f) => !f.required || fieldValid(f.name))

  const resetLabels = () => undefined

  const resetForm = () => {
    clearTimers()
    setValues({ name: '', phone: '', email: '', message: '' })
    setSelectedTimes([])
    resetLabels()
    setSending(false)
    setDots(0)
    setPlane(false)
  }

  useEffect(() => {
    registerReset?.(resetForm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startSendingAnimation = () => {
    if (isHebrew) {
      setPlane(true)
      return
    }
    ;[0, 1, 2].forEach((x) => {
      later(() => {
        setDots(x + 1)
        if (x === 2) setPlane(true)
      }, x * 250)
    })
  }

  const resetFormOnError = () => {
    setSending(false)
    setDots(0)
    setPlane(false)
  }

  const sendEmail = async () => {
    if (!isEmailjsAvailable()) {
      onOutcome({ status: 'failure', detail: t('contact.modal.blockedDevice') })
      resetFormOnError()
      return
    }
    let result: EmailSendResult
    try {
      // The Message cell holds only the user's own text (its <pre> keeps the
      // newlines). The callback windows, the calculator scenario and the
      // saved questions travel as separate template params - callback /
      // calculator / topic_N - one table row each in the EmailJS template
      // (all with static English labels), so they keep a clean layout and
      // stay hidden when absent.
      const selectedTimesList = CALLBACK_TIMES.filter((id) => selectedTimes.includes(id))
      const baseMessage =
        values.message.trim() === '' ? t('contact.modal.defaultAdviceMessage') : values.message
      const questionParams: Record<string, string> = {}
      if (selectedTimesList.length > 0) {
        questionParams.callback = selectedTimesList
          .map((id) => `${t(`contact.callback.${id}`)} (${t(`contact.callback.${id}Hours`)})`)
          .join(', ')
      }
      wishlistTopics.forEach(({ title, summary }, index) => {
        // Plain-text rows: a '~' separator (matching the calculator
        // snapshot lines) and a trailing '.' is dropped, so the rows read
        // cleanly inside the email's <pre> cells.
        questionParams[`topic_${index + 1}`] = `${title} ~ ${summary}`
          .replace(/\.$/, '')
      })
      const snapshot = buildCalculatorSnapshot(t)
      if (snapshot) {
        // The calculator scenario gets its own table row in the template
        // (label "Calculator details"), so only the lines travel here - no
        // bullet markers, one line per data point.
        questionParams.calculator = snapshot
      }
      result = await sendContactEmail({
        name: values.name,
        phone: values.phone,
        email:
          variant === 'main' && values.email.trim() !== ''
            ? values.email
            : t('contact.modal.emailNotProvided'),
        message: baseMessage,
        questions: questionParams,
      })
    } catch (error) {
      onOutcome({ status: 'failure', detail: String(error) })
      resetFormOnError()
      return
    }
    if (!result.ok) {
      onOutcome({ status: 'failure', detail: result.text })
      resetFormOnError()
      return
    }
    resetLabels()
    onOutcome({ status: 'success', name: values.name.split(' ')[0] })
    // The saved questions were "used" - clear them so stale topics don't
    // ride along on the next message.
    clearWishlist()
    setValues({ name: '', phone: '', email: '', message: '' })
    setSelectedTimes([])
    later(() => {
      setSending(false)
      setDots(0)
      setPlane(false)
    }, 1000)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    document.body.style.cursor = 'progress'
    setSending(true)
    if (!window.navigator.onLine) {
      startSendingAnimation()
      onOutcome({ status: 'failure', detail: t('offlineBanner') })
      resetFormOnError()
      document.body.style.cursor = ''
      return
    }
    startSendingAnimation()
    void sendEmail()
  }

  const showSendingUi = sending

  return (
    <form
      method="POST"
      autoComplete="on"
      id="contact-form"
      onSubmit={onSubmit}
      noValidate
      dir={isHebrew ? 'rtl' : 'ltr'}
      className={cn('w-full mx-auto pb-4', variant === 'action' ? 'max-w-full' : 'max-w-[640px]')}
    >
      {fields.map((field) => {
        const name = field.name
        const status: Status = !values[name] ? 'neutral' : fieldValid(name) ? 'valid' : 'invalid'
        const isLtrField = name === 'phone' || name === 'email'
        return (
          <Fragment key={name}>
            <FloatingLabelField
              id={`${variant}-${name}`}
              label={t(`contact.${name}Label`)}
              status={status}
              testId={`${variant}-${name}-field`}
              textarea={name === 'message'}
              rows={variant === 'action' ? 3 : 5}
              maxLength={name === 'message' ? 999 : 99}
              formDir={isHebrew ? 'rtl' : 'ltr'}
              inputDir={isLtrField ? 'ltr' : isHebrew ? 'rtl' : 'ltr'}
              registration={{
                name,
                value: values[name],
                onChange: (event) => {
                  setValues((v) => ({ ...v, [name]: event.target.value }))
                  return Promise.resolve()
                },
                onBlur: () => Promise.resolve(),
                ref: () => undefined,
              }}
            />
            {variant === 'action' && name !== 'message' && (
              <span className="asterisk" aria-hidden="true" />
            )}
          </Fragment>
        )
      })}

      {/* Preferred callback time: optional multi-select chips below the
          message - morning / noon / evening with their hour ranges. The
          picked windows are appended to the email on send. */}
      <div className="mb-5" data-testid={`${variant}-callback-times`}>
        <span
          id={`${variant}-callback-label`}
          className="mb-2 block text-[15px] font-semibold text-soft-dark-grey"
        >
          {t('contact.callback.label')}
        </span>
        <div
          role="group"
          aria-labelledby={`${variant}-callback-label`}
          className="grid grid-cols-3 gap-2"
        >
          {CALLBACK_TIMES.map((id) => {
            const selected = selectedTimes.includes(id)
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                data-testid={`${variant}-callback-${id}`}
                onClick={() =>
                  setSelectedTimes((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                  )
                }
                className={cn(
                  'group flex flex-col items-start rounded-[5px] border px-3 py-2 text-left shadow-black outline-none transition-colors duration-200',
                  'focus-visible:ring-2 focus-visible:ring-soft-blue/40',
                  selected
                    ? 'border-soft-blue bg-soft-blue text-white'
                    : 'border-[rgb(70,70,70)] bg-white text-soft-black hover:border-soft-blue hover:bg-soft-blue hover:text-white',
                )}
              >
                <span className="text-[15px] font-bold leading-tight">
                  {t(`contact.callback.${id}`)}
                </span>
                <span
                  className={cn(
                    'text-[12px] font-semibold leading-tight transition-colors duration-200',
                    selected ? 'text-white/80' : 'text-soft-dark-grey group-hover:text-white/80',
                  )}
                >
                  {t(`contact.callback.${id}Hours`)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Saved questions from the calculator - pre-attached to the message.
          Shown as topic chips; only the ✕ is a button (so the pointer and
          the click target are the X, not the whole chip). Hidden entirely
          when the list is empty. */}
      {wishlistTopics.length > 0 && (
        <div className="mb-5" data-testid={`${variant}-wishlist`}>
          <span className="mb-2 block text-[15px] font-semibold text-soft-dark-grey">
            {t('wishlist.formTitle')}
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {wishlistTopics.map(({ item, title }) => (
              <li
                key={item.id}
                className="flex items-center gap-1 rounded-[5px] border border-[rgb(70,70,70)] bg-white py-1 pe-2.5 ps-1 text-[15px] font-bold leading-tight text-soft-black shadow-black"
              >
                <button
                  type="button"
                  aria-label={t('wishlist.removeAria', { title })}
                  data-testid={`${variant}-wishlist-remove-${item.id}`}
                  onClick={() => removeWishlistItem(item.id)}
                  className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-soft-blue/40"
                >
                  <FaTimes
                    aria-hidden="true"
                    className="translate-y-[1px] ml-1 text-[11px] text-soft-dark-grey transition-colors hover:text-soft-red"
                  />
                </button>
                {title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="submit"
        id="submit-form"
        data-testid={`${variant}-submit`}
        disabled={!allValid || sending}
        className={cn(
          'mt-6 flex h-[50px] w-full items-center justify-center rounded-[5px] border text-[16px] font-bold transition-all duration-300',
          // Same border as the inputs in both states (white fill, soft-black
          // border); disabled only softens the text color.
          sending || !allValid
            ? 'pointer-events-none cursor-not-allowed border-soft-black bg-white text-soft-dark-grey shadow-black'
            : 'border-soft-black bg-white text-soft-black shadow-black hover:bg-soft-black hover:text-white',
        )}
      >
        {showSendingUi ? (
          <span className="flex w-full items-center justify-center text-center">
            <FaPaperPlane
              aria-hidden="true"
              className="spin text-[18px] mx-auto block text-soft-blue"
            />
          </span>
        ) : (
          <span className="flex w-full items-center justify-center text-center">
            {t('contact.submit')}
          </span>
        )}
      </button>

      {import.meta.env.DEV && variant === 'main' && (
        <DevAutofillButton
          onFill={() =>
            setValues({
              name: isHebrew ? 'דני כהן' : 'John Doe',
              phone: `052${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`,
              email: `${Math.random().toString(36).slice(2, 10)}@gmail.com`,
              message: 'Hello, I need advice '.repeat(3),
            })
          }
          isHebrew={isHebrew}
        />
      )}
    </form>
  )
}

function DevAutofillButton({ onFill, isHebrew }: { onFill: () => void; isHebrew: boolean }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1601px)')
    const align = () => setVisible(media.matches)
    align()
    media.addEventListener('change', align)
    return () => media.removeEventListener('change', align)
  }, [])
  if (!visible) return null
  return (
    <button
      type="button"
      id="dev-btn"
      data-testid="dev-autofill"
      onClick={onFill}
      className="hero-btn btn-orange remove-highlight !mx-auto !flex !h-[50px] !w-full !items-center !justify-center !rounded-[5px] !p-0 !text-[16px] !font-bold"
      style={{
        boxShadow: 'var(--orange-shadow)',
        margin: '12px auto 0',
      }}
      dir={isHebrew ? 'rtl' : 'ltr'}
    >
      add details
    </button>
  )
}
