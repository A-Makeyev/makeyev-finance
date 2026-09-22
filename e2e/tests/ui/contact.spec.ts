import { test, expect } from '../../fixtures'
import { EMAILJS_MARKERS, VALID_CONTACT } from '../../data/contactForm'

test.describe('contact form - validation states', () => {
  test('submit starts disabled and stays disabled while invalid', async ({ contact }) => {
    await contact.goto()
    await expect(contact.submitButton).toBeDisabled()
    await contact.fill({ name: 'ab', email: 'not-an-email' })
    await contact.blurField('name')
    // Phone still missing → invalid.
    await contact.fill({ name: 'ab', phone: 'x', email: 'a@b.co' })
    await expect(contact.submitButton).toBeDisabled()
  })

  test('invalid fields show red feedback, valid ones blue', async ({ contact }) => {
    await contact.goto()
    await contact.field('name').fill('123!!')
    await expect(contact.fieldWrapper('name')).toHaveAttribute('data-status', 'invalid')

    await contact.fill({ name: VALID_CONTACT.name, phone: '050-1234567' })
    await expect(contact.fieldWrapper('name')).toHaveAttribute('data-status', 'valid')
    await expect(contact.fieldWrapper('phone')).toHaveAttribute('data-status', 'valid')

    await contact.fill({ email: 'nope' })
    await expect(contact.fieldWrapper('email')).toHaveAttribute('data-status', 'invalid')

    await contact.fill({ email: VALID_CONTACT.email })
    await expect(contact.fieldWrapper('email')).toHaveAttribute('data-status', 'valid')
  })

  test('the send button border turns blue only once every field is valid', async ({ contact }) => {
    await contact.goto()
    await expect(contact.submitButton).toBeDisabled()
    await expect(contact.submitButton).not.toHaveClass(/border-soft-blue/)

    await contact.fill(VALID_CONTACT)
    await expect(contact.submitButton).toBeEnabled()
    await expect(contact.submitButton).toHaveClass(/border-soft-blue/)
  })

  test('valid submission opens the success modal with first-name greeting', async ({ contact }) => {
    await contact.goto()
    await contact.fill(VALID_CONTACT)
    await expect(contact.submitButton).toBeEnabled()
    await contact.submitButton.click()

    await expect(contact.modal).toBeVisible()
    await expect(contact.modalTitle).toHaveText('ההודעה נשלחה')
    await expect(contact.page.getByTestId('modal-user')).toHaveText('תודה על פנייתך Esteban')
    await expect(contact.modalBody).toHaveText('נדאג שיחזרו אליך בהקדם')
  })

  test('Escape closes the modal', async ({ contact }) => {
    await contact.goto()
    await contact.fill(VALID_CONTACT)
    await contact.submitButton.click()
    await expect(contact.modal).toBeVisible()
    await contact.page.keyboard.press('Escape')
    await expect(contact.modal).toBeHidden()
  })

  test('EmailJS failure surfaces the failure modal with the API text', async ({ contact }) => {
    await contact.goto()
    await contact.fill({ ...VALID_CONTACT, message: EMAILJS_MARKERS.forceFailure + ' please' })
    await contact.submitButton.click()

    await expect(contact.modal).toBeVisible()
    await expect(contact.modalTitle).toHaveText('ההודעה לא נשלחה')
    await expect(contact.modalDetail).toHaveText('smtp relay unavailable')
  })

  test('deadlock-victim responses are retried transparently', async ({
    contact,
    emailjsRequests,
  }) => {
    await contact.goto()
    await contact.fill({ ...VALID_CONTACT, message: EMAILJS_MARKERS.deadlockOnce + ' trigger' })
    await contact.submitButton.click()

    await expect(contact.modal).toBeVisible()
    await expect(contact.modalTitle).toHaveText('ההודעה נשלחה')
    expect(emailjsRequests.length).toBe(2)
  })

  test('offline submission shows the failure modal without network calls', async ({
    contact,
    context,
    emailjsRequests,
  }) => {
    await contact.goto()

    await context.setOffline(true)
    await contact.fill(VALID_CONTACT)
    await contact.submitButton.click()

    await expect(contact.modal).toBeVisible()
    await expect(contact.modalDetail).toHaveText('אין חיבור לרשת')
    expect(emailjsRequests.length).toBe(0)
  })
})

test.describe('action form modal (home CTAs)', () => {
  test('the form modal wears the blue accent border', async ({ actionModal }) => {
    await actionModal.openViaHero()
    await expect(actionModal.dialog).toHaveClass(/border-soft-blue/)
  })

  test('opens from the hero CTA and omits the email field', async ({ actionModal }) => {
    await actionModal.openViaHero()
    await expect(actionModal.nameField).toBeVisible()
    await expect(actionModal.phoneField).toBeVisible()
    await expect(actionModal.dialog.locator('#action-email')).toHaveCount(0)
  })

  test('ported legacy flow: fill → submit → success modal (ההודעה נשלחה)', async ({
    actionModal,
    page,
  }) => {
    await actionModal.openViaHero()
    await actionModal.nameField.fill('Estabon Vilallon')
    await actionModal.phoneField.fill('0505050505')
    await actionModal.messageField.fill('Hello From Playwright')
    await actionModal.submit.click()

    await expect(page.getByTestId('message-modal')).toBeVisible()
    await expect(page.getByTestId('modal-title')).toHaveText('ההודעה נשלחה')
  })
})
