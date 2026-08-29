import { test, expect, type Page } from '@playwright/test'
import { installExternalMocks, type InstallExternalMocksOptions } from '../../support/mocks'
import { ContactFormPage, ActionFormModalPage } from '../../pom/ContactPages'

const VALID = {
  name: 'Esteban Villalon',
  phone: '050-5050505',
  email: 'esteban@example.com',
}

function setup(page: Page, options?: InstallExternalMocksOptions) {
  const emailjsPosts: URL[] = []
  const install = async () => {
    await installExternalMocks(page, {
      ...options,
      onRequest: (url: URL) => {
        if (url.host.includes('emailjs')) emailjsPosts.push(url)
      },
    })
  }
  return { install, emailjsPosts }
}

test.describe('contact form — validation states', () => {
  let contact: ContactFormPage

  test.beforeEach(async ({ page }) => {
    const { install } = setup(page)
    await install()
    contact = new ContactFormPage(page)
    await contact.goto()
  })

  test('submit starts disabled and stays disabled while invalid', async () => {
    await expect(contact.submitButton).toBeDisabled()
    await contact.fill({ name: 'ab', email: 'not-an-email' })
    await contact.blurField('name')
    // Phone still missing → invalid.
    await contact.fill({ name: 'ab', phone: 'x', email: 'a@b.co' })
    await expect(contact.submitButton).toBeDisabled()
  })

  test('invalid fields show red feedback, valid ones blue', async () => {
    await contact.field('name').fill('123!!')
    await expect(contact.fieldWrapper('name')).toHaveAttribute('data-status', 'invalid')

    await contact.fill({ name: VALID.name, phone: '050-1234567' })
    await expect(contact.fieldWrapper('name')).toHaveAttribute('data-status', 'valid')
    await expect(contact.fieldWrapper('phone')).toHaveAttribute('data-status', 'valid')

    await contact.fill({ email: 'nope' })
    await expect(contact.fieldWrapper('email')).toHaveAttribute('data-status', 'invalid')

    await contact.fill({ email: VALID.email })
    await expect(contact.fieldWrapper('email')).toHaveAttribute('data-status', 'valid')
  })

  test('valid submission opens the success modal with first-name greeting', async () => {
    await contact.fill(VALID)
    await expect(contact.submitButton).toBeEnabled()
    await contact.submitButton.click()

    await expect(contact.modal).toBeVisible()
    await expect(contact.modalTitle).toHaveText('ההודעה נשלחה')
    await expect(contact.page.getByTestId('modal-user')).toHaveText('תודה על פנייתך Esteban')
    await expect(contact.modalBody).toHaveText('נדאג שיחזרו אליך בהקדם')
  })

  test('Escape closes the modal', async () => {
    await contact.fill(VALID)
    await contact.submitButton.click()
    await expect(contact.modal).toBeVisible()
    await contact.page.keyboard.press('Escape')
    await expect(contact.modal).toBeHidden()
  })

  test('EmailJS failure surfaces the failure modal with the API text', async () => {
    const page = contact.page
    const fresh = new ContactFormPage(page)
    await fresh.fill({ ...VALID, message: 'FORCE_FAILURE please' })
    await fresh.submitButton.click()

    await expect(fresh.modal).toBeVisible()
    await expect(fresh.modalTitle).toHaveText('ההודעה לא נשלחה')
    await expect(fresh.modalDetail).toHaveText('smtp relay unavailable')
  })

  test('deadlock-victim responses are retried transparently', async ({ page }) => {
    const { install, emailjsPosts } = setup(page)
    await install()
    const fresh = new ContactFormPage(page)
    await fresh.goto()
    await fresh.fill({ ...VALID, message: 'DEADLOCK_ONCE trigger' })
    await fresh.submitButton.click()

    await expect(fresh.modal).toBeVisible()
    await expect(fresh.modalTitle).toHaveText('ההודעה נשלחה')
    expect(emailjsPosts.length).toBe(2)
  })

  test('offline submission shows the failure modal without network calls', async ({
    page,
    context,
  }) => {
    const { install, emailjsPosts } = setup(page)
    await install()
    const fresh = new ContactFormPage(page)
    await fresh.goto()

    await context.setOffline(true)
    await fresh.fill(VALID)
    await fresh.submitButton.click()

    await expect(fresh.modal).toBeVisible()
    await expect(fresh.modalDetail).toHaveText('אין חיבור לרשת')
    expect(emailjsPosts.length).toBe(0)
  })
})

test.describe('action form modal (home CTAs)', () => {
  let action: ActionFormModalPage

  test.beforeEach(async ({ page }) => {
    const { install } = setup(page)
    await install()
    action = new ActionFormModalPage(page)
  })

  test('opens from the hero CTA and omits the email field', async () => {
    await action.openViaHero()
    await expect(action.nameField).toBeVisible()
    await expect(action.phoneField).toBeVisible()
    await expect(action.dialog.locator('#action-email')).toHaveCount(0)
  })

  test('ported legacy flow: fill → submit → success modal (ההודעה נשלחה)', async ({ page }) => {
    await action.openViaHero()
    await action.nameField.fill('Estabon Vilallon')
    await action.phoneField.fill('0505050505')
    await action.messageField.fill('Hello From Playwright')
    await action.submit.click()

    await expect(page.getByTestId('message-modal')).toBeVisible()
    await expect(page.getByTestId('modal-title')).toHaveText('ההודעה נשלחה')
  })
})
