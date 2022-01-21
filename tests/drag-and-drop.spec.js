// cd tests
// npx playwright test drag-and-drop.spec.js --project=chromium --headed

const { test, expect } = require('@playwright/test')

test('Drag N\' Drop', async ({ page }) => {
    test.setTimeout(240 * 1000)
    await page.goto('https://letcode.in/dropable')

    // await page.dragAndDrop('#draggable', '#droppable')

    const src = await page.$('#draggable')
    const dst = await page.$('#droppable')

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
            await page.mouse.up()
        } else {
            throw new Error('Unable to find elements')
        }
    }

    await expect(page.locator('#droppable')).toHaveText('Dropped!')

})
