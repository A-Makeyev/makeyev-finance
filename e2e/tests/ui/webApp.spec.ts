import { test, expect } from '../../fixtures'
import { HOVER_CLOSE_DELAY_MS } from '@/lib/timings'
import { WebAppPage } from '../../pages/WebAppPage'
import { mockGetSessionNull, mockGetSessionUser, mockSignOut } from '../../support/authMocks'

/**
 * UI contract for the static content routes. These tests run against the
 * production Next server through the single playwright.config.ts, and they
 * encode the behaviors the migration must preserve:
 *
 *  - Hebrew stays at the root, unprefixed; English lives under /en.
 *  - lang/dir are server-rendered per locale (RTL Hebrew, LTR English).
 *  - Per-page <title> + meta description (the SEO reason for the migration).
 *  - The theme toggle and its pre-paint mechanism keep working.
 *  - The chrome (navbar, footer, wishlist overlays) behaves like the
 *    current app's.
 */

const VIEWPORTS = [
  { width: 360, height: 800, tag: '360' },
  { width: 1280, height: 900, tag: '1280' },
]

test.describe('web app: locale routing + metadata', () => {
  test('home renders Hebrew with its metadata', async ({ page }) => {
    const app = new WebAppPage(page)
    await app.goto('/')
    expect(await app.documentLang()).toBe('he')
    // Direction follows the locale: the Hebrew segment is RTL (see
    // src/app/(he)/layout.tsx), and /en stays LTR.
    expect(await app.documentDir()).toBe('rtl')
    expect(await app.pageTitle()).toContain('Makeyev Finance')
    expect(await app.metaDescription()).toBeTruthy()
  })

  test('/en serves English LTR, and the language switch round-trips', async ({ page }) => {
    const app = new WebAppPage(page)
    await app.goto('/en')
    expect(await app.documentLang()).toBe('en')
    await expect(app.navbar).toBeVisible()

    // Switch → Hebrew home (we start on the English one).
    await app.switchLanguage()
    await expect(app.page).toHaveURL(/\/$/)
    expect(await app.documentLang()).toBe('he')

    // And forward again from a sub-page keeps the sub-page path.
    await app.goto('/services')
    await app.switchLanguage()
    await expect(app.page).toHaveURL(/\/en\/services$/)
    expect(await app.documentLang()).toBe('en')
    await app.switchLanguage()
    await expect(app.page).toHaveURL(/\/services$/)
  })

  for (const [path, titlePart] of [
    ['/services', 'השירות שלנו'],
    ['/articles', 'מאמרים'],
    ['/articles/prepayment-penalties', 'עמלות פירעון מוקדם'],
    ['/contact', 'צרו קשר'],
  ] as const) {
    test(`per-route metadata on ${path}`, async ({ page }) => {
      const app = new WebAppPage(page)
      await app.goto(path)
      expect(await app.pageTitle()).toContain(titlePart)
      // Every route ships a real description now (the SPA rewrote one shared
      // tag at runtime; crawlers see it inline here).
      expect(await app.metaDescription()).toBeTruthy()
    })
  }

  test('calculator route is the phase-1 stub, preserving the deep link intent', async ({
    page,
  }) => {
    const app = new WebAppPage(page)
    await app.goto('/calculators?preset=basket4')
    await expect(page.getByTestId('navbar')).toBeVisible()
    expect(await app.pageTitle()).toContain('מחשבון')
  })

  test('unknown URL renders the not-found page (404 status)', async ({ page }) => {
    const response = await page.goto('/no-such-page')
    expect(response?.status()).toBe(404)
  })
})

test.describe('web app: theme', () => {
  test('first visit follows the OS, the toggle persists, reload keeps it', async ({ page }) => {
    const app = new WebAppPage(page)
    await app.goto('/')
    // The only theme toggle lives in the account menu now.
    await app.openAccountMenu()
    await expect(app.navAccountTheme).toBeVisible()

    // Headless Chromium defaults to light; no stored choice yet.
    expect(await app.themeAttr()).toBe('light')
    expect(await app.storedTheme()).toBeNull()

    await app.toggleTheme()
    expect(await app.themeAttr()).toBe('dark')
    expect(await app.storedTheme()).toBe('dark')

    // The pre-paint script (injected inline by the root layout) re-applies
    // the stored choice before React paints on reload.
    await page.reload()
    expect(await app.themeAttr()).toBe('dark')

    await app.toggleTheme()
    expect(await app.themeAttr()).toBe('light')
    await page.reload()
    expect(await app.themeAttr()).toBe('light')
  })

  test('a dark-preferring visitor lands dark without touching the toggle', async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()
    const app = new WebAppPage(page)
    await app.goto('/')
    expect(await app.themeAttr()).toBe('dark')
    expect(await app.storedTheme()).toBeNull()
    await context.close()
  })

  test('theme persists across a locale switch (same storage, both locales)', async ({ page }) => {
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.toggleTheme()
    expect(await app.themeAttr()).toBe('dark')

    await app.switchLanguage()
    expect(await app.themeAttr()).toBe('dark')
    expect(await app.documentLang()).toBe('en')
  })
})

test.describe('web app: navigation + chrome parity', () => {
  for (const viewport of VIEWPORTS) {
    test(`navbar links reach every phase-1 route - ${viewport.tag}px`, async ({ page }) => {
      const app = new WebAppPage(page)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await app.goto('/')

      // Desktop: click the visible links. Mobile: the panel opens first.
      if (viewport.tag === '360') {
        await app.openMobileMenu()
      }
      await page.getByTestId('nav-link-services').click()
      await expect(app.page).toHaveURL(/\/services$/)
      await expect(page.getByTestId('service-card-1')).toBeVisible()

      if (viewport.tag === '360') await app.openMobileMenu()
      await page.getByTestId('nav-link-articles').click()
      await expect(app.page).toHaveURL(/\/articles$/)
      await expect(page.locator('.article-card').first()).toBeVisible()

      if (viewport.tag === '360') await app.openMobileMenu()
      await page.getByTestId('nav-link-contact').click()
      await expect(app.page).toHaveURL(/\/contact$/)
      await expect(page.getByTestId('main-phone')).toBeVisible()
    })
  }

  test('footer home link is active-aware (same legacy behavior)', async ({ page }) => {
    const app = new WebAppPage(page)
    await app.goto('/services')
    await expect(page.getByTestId('footer-link-services')).toBeVisible()
    await page.getByTestId('footer-link-home').click()
    await expect(app.page).toHaveURL(/\/$/)
  })

  test('articles cross-links and back-links work', async ({ page }) => {
    const app = new WebAppPage(page)
    await app.goto('/articles')
    await page.locator('.article-card[href$="/articles/prepayment-penalties"]').click()
    await expect(app.page).toHaveURL(/\/articles\/prepayment-penalties$/)
    await expect(page.getByTestId('prepayment-penalty-article')).toHaveAttribute('dir', 'rtl')
    await page.getByRole('link', { name: /מאמרים|לכל המאמרים|back/i }).first().click()
    await expect(app.page).toHaveURL(/\/articles$/)
  })

  test('article preset deep link reaches the calculator stub', async ({ page }) => {
    const app = new WebAppPage(page)
    await app.goto('/articles/mortgage-decisions')
    await expect(page.getByTestId('mortgage-decisions-article')).toBeVisible()
    const firstTry = page.locator('a[href*="/calculators?preset="]').first()
    await expect(firstTry).toBeVisible()
    await firstTry.click()
    await expect(app.page).toHaveURL(/\/calculators/)
  })

  test('no horizontal overflow on any phase-1 page at 360px', async ({ page }) => {
    const app = new WebAppPage(page)
    await page.setViewportSize({ width: 360, height: 800 })
    for (const path of [
      '/',
      '/services',
      '/articles',
      '/articles/moving-checklist',
      '/contact',
      '/login',
    ]) {
      await app.goto(path)
      const overflow = (await page.evaluate(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      )) as number
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1)
    }
  })

  test('the Markets strip publishes its height for the navbar offset', async ({ page }) => {
    const app = new WebAppPage(page)
    await app.goto('/services')
    await app.expectMarketsHeightSettled()
  })

  test('hamburger tier: hamburger left, logo centred, account on the bar right', async ({
    page,
  }) => {
    await mockGetSessionNull(page)
    const app = new WebAppPage(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await app.goto('/')

    const box = async (testId: string) => (await page.getByTestId(testId).boundingBox())!
    const hamburger = await box('hamburger')
    const controls = await box('nav-bar-controls')
    const logoOf = async () => (await page.locator('[data-testid="logo"] img').boundingBox())!
    const logo = await logoOf()

    // Hamburger in the left third, controls in the right third.
    expect(hamburger.x).toBeLessThan(390 / 3)
    expect(controls.x).toBeGreaterThan((390 * 2) / 3)
    // The logo is centred in the bar (its midpoint sits at the viewport middle).
    expect(Math.abs(logo.x + logo.width / 2 - 195)).toBeLessThan(6)

    // The controls live on the bar, NOT inside the slide-down sheet.
    expect(
      await page.evaluate(
        `!!document.querySelector('[data-testid="nav-bar-controls"]').closest('#nav-list')`,
      ),
    ).toBe(false)

    // Opening the sheet turns the hamburger into the close button in the SAME
    // spot, keeps the logo centred and keeps the controls on the bar.
    await page.getByTestId('hamburger').click()
    await expect(app.navbar).toHaveAttribute('data-menu-open', 'true')
    const openHamburger = await box('hamburger')
    const openLogo = await logoOf()
    const openControls = await box('nav-bar-controls')
    expect(Math.abs(openHamburger.x - hamburger.x)).toBeLessThan(2)
    expect(Math.abs(openLogo.x - logo.x)).toBeLessThan(2)
    expect(Math.abs(openControls.x - controls.x)).toBeLessThan(2)
    await expect(page.getByTestId('nav-bar-controls')).toBeVisible()

    // Desktop: the hamburger is gone and the controls stay in the centred row
    // right after the socials, NOT pinned to the bar's right edge.
    await page.setViewportSize({ width: 1280, height: 900 })
    await app.goto('/')
    await app.waitForHydration()
    await expect(page.getByTestId('hamburger')).toBeHidden()
    const navList = (await page.locator('#nav-list').boundingBox())!
    const desktopControls = await box('nav-bar-controls')
    const gap = desktopControls.x - (navList.x + navList.width)
    expect(gap).toBeGreaterThan(0)
    expect(gap, 'controls follow the socials instead of hugging the right edge').toBeLessThan(30)
  })

  test('the mobile login icon is visible on the dark bar and opens the menu on tap', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      colorScheme: 'light',
    })
    const page = await context.newPage()
    await mockGetSessionNull(page)
    await page.goto('/')

    // Light theme + the dark glass bar at the top of the page: the signed-out
    // glyph must be the light nav colour, NOT the ink the mobile 'links-dark'
    // tier paints for the (light) slide-down sheet.
    await expect(page.getByTestId('nav-avatar-empty')).toBeVisible()
    const glyphColour = () =>
      page.evaluate(
        `getComputedStyle(document.querySelector('[data-testid="nav-avatar-empty"] svg')).color`,
      ) as Promise<string>
    expect(await glyphColour()).toBe('rgb(240, 248, 255)')

    // A real touch tap opens the account menu - there is no hover on touch,
    // and the tap must not open-then-close it through the compatibility mouse
    // events.
    await page.getByTestId('nav-avatar').tap()
    const menu = page.getByTestId('nav-account-menu')
    await expect(menu).toBeVisible()

    // It stays open: a touch fires pointerleave right after the tap, and that
    // must NOT schedule a close (only the mouse hover-out closes the menu).
    await page.waitForTimeout(HOVER_CLOSE_DELAY_MS + 100)
    await expect(menu).toBeVisible()

    // The dropdown is a themed card: its rows keep the card's ink, NOT the
    // bar's white (the bar-colour fix above must not leak into the menu).
    const menuColors = (await page.evaluate(`(() => {
      const row = document.querySelector('[data-testid="nav-account-theme"]')
      const card = row.closest('.nav-account-menu')
      return {
        text: getComputedStyle(row.querySelector('span')).color,
        icon: getComputedStyle(row.querySelector('svg')).color,
        card: getComputedStyle(card).backgroundColor,
      }
    })()`)) as { text: string; icon: string; card: string }
    expect(menuColors.text).toBe('rgb(15, 15, 15)')
    expect(menuColors.icon).not.toBe(menuColors.card)
    expect(menuColors.text).not.toBe(menuColors.card)

    // Once the solid light bar scrolls in the glyph flips to ink, like the
    // links do.
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
    await expect(page.getByTestId('navbar')).toHaveClass(/navbar-scrolling/, { timeout: 5000 })
    expect(await glyphColour()).toBe('rgb(15, 15, 15)')

    await context.close()
  })

  test('the signed-out account control is the circular trigger with a sign-in menu', async ({
    page,
  }) => {
    await mockGetSessionNull(page)
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.waitForHydration()

    // Same circular trigger as the signed-in avatar (no bare icon link): the
    // person glyph sits in the avatar circle, with the menu label on the
    // button (operable by keyboard and screen reader).
    await expect(app.navAccount).toBeVisible()
    await expect(app.navLogin).toHaveCount(0)
    await expect(app.navAvatarEmpty).toBeVisible()
    await expect(app.navAvatar).toHaveAttribute('aria-label', 'החשבון')
    const box = await app.navAvatar.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThan(60)

    // The menu opens on hover with the preferences rows on top (language,
    // then color mode) and the sign-in entry below them (no identity line
    // while signed out).
    await app.navAvatar.hover()
    await expect(app.navAccountMenu).toBeVisible()
    await expect(app.navAccountTheme).toBeVisible()
    await expect(app.navAccountSignin).toBeVisible()
    await expect(app.navAccountSignin).toHaveText('התחברות')
    await expect(app.navAccountSignout).toHaveCount(0)

    // The bar is pinned LTR on every locale, but the menu itself follows the
    // page direction: on this Hebrew page it is RTL, so each row's icon sits
    // BEFORE its text (to the right) rather than trailing it.
    expect(await app.documentDir()).toBe('rtl')
    const iconBeforeText = (await page.evaluate(`(() => {
      const row = document.querySelector('[data-testid="nav-account-theme"]')
      const icon = row.querySelector('svg').getBoundingClientRect()
      const text = row.querySelector('span').getBoundingClientRect()
      return icon.left > text.left
    })()`)) as boolean
    expect(iconBeforeText, 'icon before the text in the Hebrew (RTL) menu').toBe(true)

    // The theme row is the live toggle, not a label: clicking it flips the
    // site and the menu stays open.
    const before = await app.themeAttr()
    await app.navAccountTheme.click()
    expect(await app.themeAttr()).toBe(before === 'dark' ? 'light' : 'dark')
    await expect(app.navAccountMenu).toBeVisible()
  })

  test('the account menu carries the language row above the color mode row', async ({ page }) => {
    await mockGetSessionNull(page)
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.waitForHydration()

    await app.openAccountMenu()
    await expect(app.navAccountTheme).toBeVisible()
    await expect(app.navAccountLanguage).toBeVisible()
    // The label names the OTHER language, the same thing the flag's tooltip
    // used to say.
    await expect(app.navAccountLanguage).toHaveText('English')

    // The menu follows the page direction, so on this Hebrew page (RTL) the
    // flag sits BEFORE its label - the same icon-then-text reading as the
    // color mode row below it.
    const flagBeforeText = (await page.evaluate(`(() => {
      const row = document.querySelector('[data-testid="nav-account-language"]')
      const flag = row.querySelector('img').getBoundingClientRect()
      const text = row.querySelector('span').getBoundingClientRect()
      return flag.left > text.left
    })()`)) as boolean
    expect(flagBeforeText, 'flag before the text in the Hebrew (RTL) menu').toBe(true)

    // Language is the first row, color mode the second.
    const menuText = (await app.navAccountMenu.textContent()) ?? ''
    expect(menuText.indexOf('English')).toBeLessThan(menuText.indexOf('מצב'))

    // The two rows share one card surface: same card ink for the labels, both
    // rows in the preferences group, and ONE hairline under the group (the
    // rows are not their own divided sections).
    const rowStyles = (await page.evaluate(`(() => {
      const theme = document.querySelector('[data-testid="nav-account-theme"]')
      const lang = document.querySelector('[data-testid="nav-account-language"]')
      const flag = lang.querySelector('img').getBoundingClientRect()
      return {
        themeText: getComputedStyle(theme.querySelector('span')).color,
        langText: getComputedStyle(lang.querySelector('span')).color,
        themeBorderBottom: getComputedStyle(theme).borderBottomWidth,
        groupBorderBottom: getComputedStyle(theme.parentElement).borderBottomWidth,
        flagWidth: flag.width,
        flagHeight: flag.height,
      }
    })()`)) as Record<string, string | number>
    expect(rowStyles.langText).toBe(rowStyles.themeText)
    expect(rowStyles.themeBorderBottom).toBe('0px')
    expect(rowStyles.groupBorderBottom).toBe('1px')
    // The flag takes the icon slot rather than the full row height.
    expect(rowStyles.flagWidth).toBe(18)
    expect(rowStyles.flagHeight).toBe(12)

    // The row is a live switch: it lands on the same page in the other locale
    // and persists the choice.
    await app.navAccountLanguage.click()
    await expect(app.page).toHaveURL(/\/en$/)
    expect(await app.documentLang()).toBe('en')
    expect(await page.evaluate(`localStorage.getItem('site_language')`)).toBe('english')
    await page.mouse.move(10, 400)
    await expect(app.navAccountMenu).toBeHidden()

    // On the English page the row offers the way back in Hebrew, and LTR
    // also reads the flag before its label.
    await app.waitForHydration()
    await app.openAccountMenu()
    await expect(app.navAccountLanguage).toHaveText('עברית')
    const enFlagBeforeText = (await page.evaluate(`(() => {
      const row = document.querySelector('[data-testid="nav-account-language"]')
      const flag = row.querySelector('img').getBoundingClientRect()
      const text = row.querySelector('span').getBoundingClientRect()
      return flag.left < text.left
    })()`)) as boolean
    expect(enFlagBeforeText, 'flag before the text in the English (LTR) menu').toBe(true)

    // Narrowest supported width: the extra menu row must not spill past the
    // viewport edge (the bar is pinned LTR, so the card grows leftwards).
    await page.setViewportSize({ width: 360, height: 800 })
    await page.mouse.move(10, 400)
    await expect(app.navAccountMenu).toBeHidden()
    await app.navAvatar.click()
    await expect(app.navAccountLanguage).toBeVisible()
    const card = (await app.navAccountMenu.boundingBox())!
    expect(card.x).toBeGreaterThanOrEqual(0)
    expect(card.x + card.width).toBeLessThanOrEqual(360)
  })

  test('the signed-in account menu carries both preference rows above the identity line', async ({ page }) => {
    await mockGetSessionUser(page)
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.waitForHydration()

    await expect(app.navAvatar).toBeVisible()
    await app.navAvatar.hover()
    await expect(app.navAccountMenu).toBeVisible()

    // Both preference rows precede the identity line, language first, and
    // toggling from the menu flips the theme and keeps the menu open.
    const menuText = (await app.navAccountMenu.textContent()) ?? ''
    // The Hebrew menu's language row offers 'English' (the target language).
    const languageIndex = menuText.indexOf('English')
    const themeIndex = menuText.indexOf('מצב')
    const identityIndex = menuText.indexOf('Test User')
    expect(languageIndex).toBeGreaterThanOrEqual(0)
    expect(themeIndex).toBeGreaterThan(languageIndex)
    expect(identityIndex).toBeGreaterThan(themeIndex)

    const before = await app.themeAttr()
    await app.navAccountTheme.click()
    expect(await app.themeAttr()).toBe(before === 'dark' ? 'light' : 'dark')
    await expect(app.navAccountMenu).toBeVisible()
  })

  test('the signed-in account control is an avatar with a hover menu', async ({ page }) => {
    await mockGetSessionUser(page)
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.waitForHydration()

    // The avatar replaces the sign-in icon entirely once the session lands (no
    // wrong-state flash), and the menu is closed until it is hovered/clicked.
    await expect(app.navAvatar).toBeVisible()
    await expect(app.navAccountMenu).toBeHidden()

    // Hover opens the menu (click toggles it too; hover is the observable
    // path a desktop visitor takes first).
    await app.navAvatar.hover()
    await expect(app.navAccountMenu).toBeVisible()
    await expect(app.navAccountSignout).toBeVisible()
    await expect(app.navAccountSignout).toHaveText('התנתקות')

    // Hover-OUT closes it again, after the grace that lets the pointer cross
    // the gap to the panel.
    await page.mouse.move(10, 400)
    await expect(app.navAccountMenu).toBeHidden()

    // Escape closes it too. The menu is also kept visible by CSS :hover while
    // the pointer sits on the control, so move away before expecting hidden.
    await app.navAvatar.hover()
    await expect(app.navAccountMenu).toBeVisible()
    await page.keyboard.press('Escape')
    await page.mouse.move(10, 400)
    await expect(app.navAccountMenu).toBeHidden()

    // Same visual role as the other icon controls: white text/icon colour on
    // the dark bar, not the UA button colour.
    const colours = (await page.evaluate(`(() => {
      const avatar = document.querySelector('[data-testid="nav-avatar"]')
      const link = document.querySelector('#nav-list a.nav-link')
      return { avatar: getComputedStyle(avatar).color, link: getComputedStyle(link).color }
    })()`)) as { avatar: string; link: string }
    expect(colours.avatar).toBe(colours.link)
    // Aliceblue, the nav-link role: not the UA button colour.
    expect(colours.avatar).toBe('rgb(240, 248, 255)')
  })

  test('the avatar stays visible on the scrolled (light) bar', async ({ page }) => {
    await mockGetSessionUser(page, { image: null, name: 'Anatoly Makeyev' })
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.waitForHydration()
    await expect(app.navAvatar).toBeVisible()

    // Scroll far enough that the bar turns into its solid light state
    // (links-dark + navbar-scrolling), then read the initials' colour.
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
    await expect(app.navbar).toHaveClass(/navbar-scrolling/, { timeout: 5000 })

    // The initials must NOT stay white (rgb(255,255,255) = invisible on the
    // aliceblue bar); they flip to the ink role like the links do.
    const initialsColour = (await page.evaluate(`(() => {
      const el = document.querySelector('[data-testid="nav-avatar"] .nav-avatar-fallback')
      return getComputedStyle(el).color
    })()`)) as string
    expect(initialsColour).not.toBe('rgb(255, 255, 255)')
    expect(initialsColour).toBe('rgb(15, 15, 15)')
  })

  test('a quiet skeleton holds the account slot while the session loads', async ({ page }) => {
    // Never resolve get-session: the pending state is observable for as long
    // as the test needs it.
    await page.route('**/api/auth/get-session*', () => new Promise(() => undefined))
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.waitForHydration()

    // While pending: the skeleton occupies the trigger's slot; neither the
    // circular trigger nor its menu is rendered yet.
    const pending = page.getByTestId('nav-auth-pending')
    await expect(pending).toBeVisible()
    await expect(app.navAccount).toHaveCount(0)
    await expect(app.navAvatar).toHaveCount(0)
  })

  test('the signed-in avatar shows the provider photo when the session has one', async ({
    page,
  }) => {
    await mockGetSessionUser(page, {
      image: 'https://lh3.googleusercontent.com/a/test-photo',
    })
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.waitForHydration()

    // The photo renders inside the avatar button (no initials/glyph fallback).
    await expect(app.navAvatarImg).toBeVisible()
    await expect(app.navAvatarImg).toHaveAttribute('src', 'https://lh3.googleusercontent.com/a/test-photo')
    await expect(app.navAvatarEmpty).toHaveCount(0)
  })

  test('signing out returns the visitor to the home page', async ({ page }) => {
    await mockGetSessionUser(page)
    await mockSignOut(page)
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.waitForHydration()

    await app.navAvatar.hover()
    await expect(app.navAccountMenu).toBeVisible()
    await app.navAccountSignout.click()

    // The URL lands on the locale's home (the user is on `/`, Hebrew home).
    await expect(app.page).toHaveURL(/\/$/)
    // And the nav falls back to the circular trigger with the sign-in entry.
    await expect(app.navAccount).toBeVisible()
    await expect(app.navAvatarEmpty).toBeVisible()
    await app.navAvatar.hover()
    await expect(app.navAccountSignin).toBeVisible()
  })

  test('the offline banner follows the active language, not the path', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const app = new WebAppPage(page)

    // Hebrew is RTL and it is the document's own direction too.
    await app.goto('/')
    await context.setOffline(true)
    await expect(app.offlineBanner).toHaveClass(/visible/)
    await expect(app.offlineContent).toHaveAttribute('dir', 'rtl')

    // /en is LTR. The router's pathname is locale-STRIPPED, so reading it here
    // used to force RTL onto the English banner as well.
    await context.setOffline(false)
    await app.goto('/en')
    await context.setOffline(true)
    await expect(app.offlineBanner).toHaveClass(/visible/)
    await expect(app.offlineContent).toHaveAttribute('dir', 'ltr')

    await context.close()
  })

  test('the offline banner stays hidden while the browser is online', async ({ page }) => {
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.waitForHydration()

    // The connection state is unknown server-side, so the banner is
    // server-rendered hidden; reading navigator during the first render used
    // to render it visible here and React does not patch that mismatch, which
    // left "no internet connection" stuck on an online visit.
    await expect(app.offlineBanner).toBeHidden()
  })

  test('language choice survives navigation (persisted on switch)', async ({ page }) => {
    const app = new WebAppPage(page)
    await app.goto('/')
    await app.switchLanguage()
    await expect(app.page).toHaveURL(/\/en$/)
    expect(await app.documentLang()).toBe('en')
    // The choice is stored so a later direct visit can be honored.
    const stored = await page.evaluate(`localStorage.getItem('site_language')`)
    expect(stored).toBe('english')
  })
})
