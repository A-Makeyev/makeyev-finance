import { expect, test, type Page } from '@playwright/test'
import { installExternalMocks } from '../../support/mocks'

/**
 * The calculator's inline "?" help tooltips: a toggle tip per tooltip must
 * open on click/tap AND from the keyboard (Enter/Space on the focused icon),
 * close on Escape, outside press and on navigation, announce themselves
 * (aria-expanded + aria-describedby) and never overflow the viewport at phone
 * width - the same clamp the chart tooltips get from useTooltipClamp. Checked
 * in both languages (the icon flips sides with the direction) and both themes
 * (the panel uses the calculator's theme-aware tokens).
 */

const VIEWPORTS = [
  { width: 360, height: 800, tag: '360' },
  { width: 1280, height: 900, tag: '1280' },
]

/** Each tooltip's icon and where its "read more" link should lead. */
const TOOLTIPS: Array<{ icon: string; linkHref: RegExp }> = [
  { icon: 'help-track-type-1', linkHref: /\/articles\/mortgage-track-types$/ },
  { icon: 'help-method-1', linkHref: /\/articles\/mortgage-decisions$/ },
  { icon: 'help-term', linkHref: /\/articles\/mortgage-track-types$/ },
  { icon: 'help-preset', linkHref: /\/articles\/mortgage-decisions$/ },
]

async function assertPanelInsideViewport(page: Page): Promise<void> {
  const rect = (await page.evaluate(`(() => {
    const r = document.querySelector('.help-tooltip-panel').getBoundingClientRect();
    return { left: r.left, right: r.right, innerWidth: window.innerWidth };
  })()`)) as { left: number; right: number; innerWidth: number }
  expect(rect.left, 'panel left edge').toBeGreaterThanOrEqual(0)
  expect(rect.right, 'panel right edge').toBeLessThanOrEqual(rect.innerWidth)
  // The page clips root overflow-x, so horizontal overflow would be silent -
  // measure it instead of trusting the screenshot.
  const overflow = (await page.evaluate(
    'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  )) as number
  expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(1)
}

for (const language of ['hebrew', 'english'] as const) {
  for (const viewport of VIEWPORTS) {
    test(`calculator help tooltips - ${language} @ ${viewport.tag}px`, async ({ page }) => {
      await installExternalMocks(page)
      await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/calculators')

      for (const { icon, linkHref } of TOOLTIPS) {
        const trigger = page.getByTestId(icon)
        await expect(trigger).toBeVisible()
        await expect(trigger).toHaveAttribute('aria-expanded', 'false')

        // Click/tap opens the panel, wires the description to the icon and
        // shows the read-more link to the relevant article.
        await trigger.click()
        await expect(trigger).toHaveAttribute('aria-expanded', 'true')
        const panel = page.locator(`[data-testid="${icon}-panel"]`)
        await expect(panel).toBeVisible()
        await expect(trigger).toHaveAttribute('aria-describedby', /:r\d+:|r\d+/)
        const readMore = panel.locator('a')
        await expect(readMore).toBeVisible()
        expect(await readMore.getAttribute('href')).toMatch(linkHref)

        // The panel must fit the viewport while open (the binding case at
        // 360px, checked on every tooltip since they sit at different edges).
        await assertPanelInsideViewport(page)

        // Escape closes; the outside press closes too. The outside press
        // targets the panel's own heading, far from the tooltip at any
        // viewport width (a raw viewport-corner click can land on the open
        // panel itself on a phone, which correctly does NOT close it). The
        // panel stays mounted, so closed means hidden, not removed.
        await page.keyboard.press('Escape')
        await expect(trigger).toHaveAttribute('aria-expanded', 'false')
        await expect(panel).toBeHidden()
        await trigger.click()
        await expect(panel).toBeVisible()
        await page.locator('.panel-heading h2').click()
        await expect(trigger).toHaveAttribute('aria-expanded', 'false')

        // Keyboard: Enter toggles open (Space does the same via the native
        // button), so hover is never the only way in.
        await trigger.focus()
        await page.keyboard.press('Enter')
        await expect(trigger).toHaveAttribute('aria-expanded', 'true')
        await expect(panel).toBeVisible()
        await page.keyboard.press('Enter')
        await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      }
    })
  }
}

test('calculator help tooltip - hover opens, grace close, click pins', async ({ page }) => {
  await installExternalMocks(page)
  await page.addInitScript((lang) => localStorage.setItem('site_language', lang), 'hebrew')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/calculators')

  const trigger = page.getByTestId('help-method-1')
  const closedBorder = (await page.evaluate(
    `getComputedStyle(document.querySelector('[data-testid="help-method-1"]')).borderColor`,
  )) as string

  // Hovering the icon opens the panel.
  await trigger.hover()
  let panel = page.getByTestId('help-method-1-panel')
  await expect(panel).toBeVisible()

  // Walking the pointer onto the read-more link - across the gap - keeps it
  // open (grace close + bridge), and the link is really clickable.
  const link = panel.locator('a')
  const from = (await trigger.boundingBox())!
  const to = (await link.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  const steps = 14
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(
      from.x + ((to.x + to.width / 2 - from.x) * step) / steps,
      from.y + ((to.y + to.height / 2 - from.y) * step) / steps,
    )
  }
  await expect(panel).toBeVisible()
  await page.mouse.down()
  await page.mouse.up()
  await expect(page).toHaveURL(/\/articles\/mortgage-decisions$/)

  // Back on the calculator: leaving the widget closes the hover-open panel
  // after the grace period (not instantly - jitter must not flap it).
  await page.goBack()
  await expect(page).toHaveURL(/\/calculators$/)
  await trigger.hover()
  panel = page.getByTestId('help-method-1-panel')
  await expect(panel).toBeVisible()
  await page.mouse.move(20, 20)
  await page.waitForTimeout(120)
  await expect(panel, 'still open within the grace window').toBeVisible()
  const graceBorder = (await page.evaluate(
    `getComputedStyle(document.querySelector('[data-testid="help-method-1"]')).borderColor`,
  )) as string
  expect(graceBorder, 'trigger stays styled while the panel is closing').not.toBe(
    closedBorder,
  )
  await page.waitForTimeout(400)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(panel).toHaveCount(0)

  // Clicking pins the panel against hover-out: the pointer can go anywhere,
  // the panel stays; only another click closes it.
  await trigger.click()
  panel = page.getByTestId('help-method-1-panel')
  await expect(panel).toBeVisible()
  await page.mouse.move(20, 20)
  await page.waitForTimeout(450)
  await expect(panel, 'pinned panel survives hover-out').toBeVisible()
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(panel).toHaveCount(0)
})

test('calculator help tooltip - the "?" stays on the label line', async ({ page }) => {
  for (const viewport of [360, 1280] as const) {
    await installExternalMocks(page)
    await page.addInitScript((lang) => localStorage.setItem('site_language', lang), 'hebrew')
    await page.setViewportSize({ width: viewport, height: 800 })
    await page.goto('/calculators')

    // For every tooltip: the icon must vertically overlap its label text. If
    // the icon wrapped to its own line below the text (the narrow-grid
    // regression), the icon's top edge would sit at or below the text's
    // bottom edge. When the text itself wraps to two lines the icon sits
    // beside the block, which still overlaps - that is fine.
    const overlaps = (await page.evaluate(`(() => {
      const ids = ['help-track-type-1', 'help-method-1', 'help-term', 'help-preset'];
      return ids.map((id) => {
        const icon = document.querySelector('[data-testid="' + id + '"]');
        const text = icon.closest('.label-help-row').querySelector('.label-help-text');
        const i = icon.getBoundingClientRect();
        const t = text.getBoundingClientRect();
        return { id, overlap: i.top < t.bottom - 1 && i.bottom > t.top + 1 };
      });
    })()`)) as Array<{ id: string; overlap: boolean }>
    for (const { id, overlap } of overlaps) {
      expect(overlap, `${id} icon on the label line @ ${viewport}px`).toBe(true)
    }
  }
})

test('calculator help tooltip - near does nothing, over the icon opens and recolors', async ({
  page,
}) => {
  await installExternalMocks(page)
  await page.addInitScript((lang) => localStorage.setItem('site_language', lang), 'hebrew')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/calculators')

  const trigger = page.getByTestId('help-method-1')
  const labelText = trigger.evaluate((icon) =>
    icon.closest('.label-help-row').querySelector('.label-help-text').getBoundingClientRect(),
  )

  // Hover NEAR: over the neighbouring label text, right next to the icon.
  // Nothing opens and the icon's border stays gray.
  const textRect = await labelText
  await page.mouse.move(textRect.x + textRect.width - 4, textRect.y + textRect.height / 2)
  await page.waitForTimeout(200)
  await expect(page.getByTestId('help-method-1-panel')).toHaveCount(0)
  const nearBorder = (await page.evaluate(
    `getComputedStyle(document.querySelector('[data-testid="help-method-1"]')).borderColor`,
  )) as string

  // Hover OVER the icon: the text shows AND the border turns teal.
  await trigger.hover()
  const panel = page.getByTestId('help-method-1-panel')
  await expect(panel).toBeVisible()
  const overBorder = (await page.evaluate(
    `getComputedStyle(document.querySelector('[data-testid="help-method-1"]')).borderColor`,
  )) as string
  expect(overBorder, 'border recolors only over the icon').not.toBe(nearBorder)

  // Sweep across the label (near, not over) while open: the open panel and
  // the styling are untouched by proximity - gray returns only off the icon.
  await page.mouse.move(textRect.x + 4, textRect.y + textRect.height / 2)
  await expect(panel, 'panel survives passing near the icon').toBeVisible()
})

test('calculator help tooltip - the label never forwards hover/click to the "?" icon', async ({
  page,
}) => {
  // Regression: each tooltip sits inside a <label>. When the label's implicit
  // control was the tooltip's own "?" button (first labelable descendant),
  // Chrome extended the button's :hover and click activation across the whole
  // label text - the icon's border recolored teal with the cursor far from
  // it, and clicking the label text toggled the panel. Labels now bind to
  // their real control via htmlFor, so the phantom zone is gone.
  await installExternalMocks(page)
  await page.addInitScript((lang) => localStorage.setItem('site_language', lang), 'hebrew')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/calculators')
  // Wait for the app to mount before probing the DOM (a raw evaluate does
  // not auto-wait, and the loading screen delays the form).
  await page.waitForSelector('[data-testid="help-term"]')

  // Every label hosting a tooltip must point at a control that is NOT the
  // tooltip's own trigger button. Catches the bug structurally, at any
  // viewport or DOM order.
  const wrongControls = (await page.evaluate(`(() => {
    const bad = [];
    for (const row of document.querySelectorAll('.label-help-row')) {
      const label = row.closest('label');
      if (!label) continue;
      const trigger = row.querySelector('.help-tooltip-trigger');
      if (label.control && trigger && label.control === trigger) {
        bad.push(label.className);
      }
    }
    return bad;
  })()`)) as string[]
  expect(wrongControls, 'tooltip labels bound to their own "?" button').toEqual([])

  // Behavioral check on the term tooltip (the reported one): sweep the whole
  // label text - the icon must never :hover or recolor from a distance, and
  // clicking the text must not open the panel.
  const termText = page
    .locator('label.term-slider .label-help-row .label-help-text')
    .first()
  await termText.scrollIntoViewIfNeeded()
  const box = await termText.boundingBox()
  expect(box, 'term label text is visible').not.toBeNull()

  const sweep = async (yOffset: number) => {
    for (let step = 0; step <= 8; step++) {
      const x = box!.x + (box!.width * step) / 8
      const y = box!.y + box!.height / 2 + yOffset
      await page.mouse.move(x, y)
      await page.waitForTimeout(40)
      const state = (await page.evaluate(`(() => {
        const btn = document.querySelector('[data-testid="help-term"]');
        return { hover: btn.matches(':hover'), open: !!document.querySelector('[data-testid="help-term-panel"]') };
      })()`)) as { hover: boolean; open: boolean }
      expect(state.hover, `icon not :hover at ${Math.round((step / 8) * 100)}% of label width`).toBe(false)
      expect(state.open, `panel closed at ${Math.round((step / 8) * 100)}% of label width`).toBe(false)
    }
  }
  await sweep(0)

  // Clicks along the text must not toggle the tooltip either (they land on
  // the label, whose control is the slider - a no-op for value).
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.waitForTimeout(150)
  await expect(page.getByTestId('help-term-panel')).toHaveCount(0)

  // Just below the text row (still inside the label, over the slider area):
  // same assertions.
  await sweep(box!.height)

  // Sanity: the icon itself still works - hover recolors and opens.
  await page.getByTestId('help-term').hover()
  await expect(page.getByTestId('help-term-panel')).toBeVisible()
})

test('calculator help tooltip - the panel uses the theme tokens in dark mode', async ({ page }) => {
  await installExternalMocks(page)
  await page.addInitScript(() => {
    localStorage.setItem('site_language', 'hebrew')
    localStorage.setItem('site_theme', 'dark')
  })
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/calculators')

  const trigger = page.getByTestId('help-track-type-1')
  await trigger.click()
  const panel = page.getByTestId('help-track-type-1-panel')
  await expect(panel).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  const colors = (await page.evaluate(`(() => {
    const cs = getComputedStyle(document.querySelector('.help-tooltip-panel'));
    return { bg: cs.backgroundColor, ink: cs.color };
  })()`)) as { bg: string; ink: string }
  const channelsOf = (rgb: string) =>
    rgb
      .replace(/[^0-9,]/g, '')
      .split(',')
      .slice(0, 3)
      .map(Number)
  for (const channel of channelsOf(colors.bg)) expect(channel, 'panel fill').toBeLessThan(60)
  for (const channel of channelsOf(colors.ink)) expect(channel, 'panel ink').toBeGreaterThan(150)
})
