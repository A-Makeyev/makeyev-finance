import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FaPaperPlane } from 'react-icons/fa'
import { EMAIL_REGEX, NAME_REGEX, PHONE_REGEX } from './validation'
import { isEmailjsAvailable, sendContactEmail, type EmailSendResult } from './emailjsClient'
import { useMediaQuery } from '@/hooks/useScrolled'
import { cn } from '@/lib/cn'
import { FloatingLabelField } from './FloatingLabelField'

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
      result = await sendContactEmail({
        name: values.name,
        phone: values.phone,
        email:
          variant === 'main' && values.email.trim() !== ''
            ? values.email
            : t('contact.modal.emailNotProvided'),
        message:
          values.message.trim() === ''
            ? t('contact.modal.defaultAdviceMessage')
            : values.message,
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
    setValues({ name: '', phone: '', email: '', message: '' })
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
            {variant === 'action' && name !== 'message' && <span className="asterisk" aria-hidden="true" />}
          </Fragment>
        )
      })}

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
            <FaPaperPlane aria-hidden="true" className="spin text-[18px] mx-auto block text-soft-blue" />
          </span>
        ) : (
          <span className="flex w-full items-center justify-center text-center">{t('contact.submit')}</span>
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
