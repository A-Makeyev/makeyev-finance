// https://playwright.dev/docs
// npx playwright install && npm i -D @playwright/test

// cd tests
// npx playwright test 
// npx playwright test --ui
// npx playwright test --headed
// npx playwright test forms.spec.js --headed 
// npx playwright test --project=chromium --headed --reporter=list


const { test, expect } = require('@playwright/test')

test.describe('Open Forms And Send Details', () => {
    test.setTimeout(25 * 1000)
    
    const logo = '#logo-image'
    const actionBtn = '.header .action-btn'
    const actionForm = '//div[@class="form-modal active"]'
    const messageModal = '//div[@class="modal active"]'
    const messageModalTitle = '#modal-title-text'
    const nameInput = '#name'
    const phoneInput = '#phone'
    const messageInput = '#message'
    const submitBtn = '#submit-form'

    test.beforeEach(async ({ page }) => {
        await page.goto('https://makeyev-finance.onrender.com/')
        await expect(page.locator(logo)).toBeVisible()
        await expect(page.locator(logo)).toHaveId('logo-image')
        await expect(page.locator(logo)).toHaveClass('logo-image-transparent')
    })

    test('Send Details By Action Form', async ({ page }) => {
        await expect(page.locator(actionBtn)).toBeVisible()
        await page.click(actionBtn)

        await expect(page.locator(actionForm)).toBeVisible()
        await page.type(nameInput, 'Estabon Vilallon', { delay: 50 })
        await page.type(phoneInput, '0505050505', { delay: 50 })
        await page.type(messageInput, 'Hello From Playwright')

        await page.click(submitBtn)
        await expect(page.locator(actionForm)).toBeVisible(messageModal)
        await expect(page.locator(messageModalTitle)).toHaveText('ההודעה נשלחה')
    })
})
