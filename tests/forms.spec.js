// https://playwright.dev/docs
// npm i -D @playwright/test
// npx playwright install
// cd tests
// npx playwright test 
// npx playwright test --project=chromium --headed

const { test, expect } = require('@playwright/test')

test.describe('Open Forms And Send Details', () => {
    const logo = '#logo-image'
    const actionBtn = '#action'
    const actionForm = '//div[@class="form-modal active"]'
    const messageModal = '//div[@class="modal active"]'
    const messageModalTitle = '#modal-title-text'
    const nameInput = '#name'
    const phoneInput = '#phone'
    const messageInput = '#message'
    const submitBtn = '#submit-form'

    test.beforeEach(async ({ page }) => {
        await page.goto('https://makeyev-finance.netlify.app/')
        await expect(page.locator(logo)).toBeVisible()
        await expect(page.locator(logo)).toHaveId('logo-image')
        await expect(page.locator(logo)).toHaveClass('logo-image-transparent')
    })

    test('Send Details By Action Form', async ({ page }) => {
        await expect(page.locator(actionBtn)).toBeVisible()
        await page.click(actionBtn)

        await expect(page.locator(actionForm)).toBeVisible()
        await page.type(nameInput, 'Estabon Vilallon')
        await page.type(phoneInput, '0505050505')
        await page.type(messageInput, 'Hello From Playwright')

        await page.click(submitBtn)
        await expect(page.locator(actionForm)).toBeVisible(messageModal)
        await expect(page.locator(messageModalTitle)).toHaveText('ההודעה נשלחה')
    })
})
