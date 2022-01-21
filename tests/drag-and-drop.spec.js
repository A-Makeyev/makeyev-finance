// cd tests
// npx playwright test drag-and-drop.spec.js --project=chromium --headed


const { test, expect } = require('@playwright/test')

test('Drag N\' Drop', async ({ page }) => {
    test.setTimeout(240 * 1000)
    await page.goto('https://www.w3schools.com/html/html5_draganddrop.asp')
    // await page.dragAndDrop('#drag1', '#div2')

    const src = await page.$('#drag1')
    const dst = await page.$('#div2')

    if (src && dst) {
        const srcBound = await src.boundingBox()
        const dstBound = await dst.boundingBox()
        if (srcBound && dstBound) {
            await page.mouse.move(
                srcBound.x + srcBound.width / 2,
                srcBound.y + srcBound.height / 2
            )
            await page.mouse.down()

            await page.mouse.move(
                dstBound.x + dstBound.width / 2,
                dstBound.y + dstBound.height / 2
            )
            await page.mouse.down()
        } else {
            throw new Error('Unable to find elements')
        }
    }

    await expect(page.locator('//a[@onclick="gSearch(this)"]')).toBeVisible()
    await page.click('//a[@onclick="gSearch(this)"]')

    await expect(page.locator('//input[@name="search"]')).toBeVisible()
    await page.type('//input[@name="search"]', 'Dragged N\' Dropped Successfully')

})
