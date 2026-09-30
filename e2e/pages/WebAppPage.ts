import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Page object for the Next app's phase-1 UI suite. Selectors and chrome
 * probes live here (never inline in the spec), so a markup change means
 * fixing one file. The Next app boots with no localStorage seeding: language
 * is a URL property (/ = Hebrew, /en/... = English), so navigation replaces
 * the old seedLanguage flow.
 */
export class WebAppPage {
  readonly page: Page
  readonly navbar: Locator
  readonly offlineBanner: Locator
  readonly offlineContent: Locator
  readonly navLogin: Locator
  readonly navAuthPending: Locator
  readonly navAccount: Locator
  readonly navAvatar: Locator
  readonly navAvatarImg: Locator
  readonly navAvatarEmpty: Locator
  readonly navAccountMenu: Locator
  readonly navAccountTheme: Locator
  readonly navAccountLanguage: Locator
  readonly navAccountSignin: Locator
  readonly navAccountSignout: Locator

  constructor(page: Page) {
    this.page = page
    this.navbar = page.getByTestId('navbar')
    this.offlineBanner = page.getByTestId('offline-banner')
    this.offlineContent = this.offlineBanner.locator('.offline-content')
    this.navLogin = page.getByTestId('nav-login')
    this.navAuthPending = page.getByTestId('nav-auth-pending')
    this.navAccount = page.getByTestId('nav-account')
    this.navAvatar = page.getByTestId('nav-avatar')
    this.navAvatarImg = page.getByTestId('nav-avatar-img')
    this.navAvatarEmpty = page.getByTestId('nav-avatar-empty')
    this.navAccountMenu = page.getByTestId('nav-account-menu')
    this.navAccountTheme = page.getByTestId('nav-account-theme')
    this.navAccountLanguage = page.getByTestId('nav-account-language')
    this.navAccountSignin = page.getByTestId('nav-account-signin')
    this.navAccountSignout = page.getByTestId('nav-account-signout')
  }

  /** The app-space path of the CURRENT page ("/services", "/en/services"). */
  path(): string {
    return new URL(this.page.url()).pathname
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path)
    await expect(this.navbar).toBeVisible()
  }

  /** document lang/dir as rendered (the layout sets them server-side). */
  async documentLang(): Promise<string | null> {
    return this.page.evaluate(`document.documentElement.getAttribute('lang')`)
  }

  async documentDir(): Promise<string | null> {
    return this.page.evaluate(`document.documentElement.getAttribute('dir')`)
  }

  /** <title> and meta description for the current page. */
  async pageTitle(): Promise<string> {
    return this.page.title()
  }

  async metaDescription(): Promise<string | null> {
    return this.page.evaluate(
      `document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null`,
    )
  }

  /** The pre-paint theme mechanism's single source of truth. */
  async themeAttr(): Promise<string | null> {
    return this.page.evaluate(`document.documentElement.getAttribute('data-theme')`)
  }

  async storedTheme(): Promise<string | null> {
    return this.page.evaluate(`localStorage.getItem('site_theme')`)
  }

  /** Opens the account menu (hover is the desktop visitor's first move; the
      trigger also toggles on click and focus). */
  async openAccountMenu(): Promise<void> {
    await this.navAvatar.hover()
    await expect(this.navAccountMenu).toBeVisible()
  }

  /**
   * Flips the site theme. The standalone nav crescent/sun was removed, so the
   * only toggle is the account menu's color-mode row: open the menu, click it.
   * The menu deliberately stays open afterwards.
   */
  async toggleTheme(): Promise<void> {
    await this.openAccountMenu()
    await this.navAccountTheme.click()
  }

  /**
   * Navigates to the same page in the other language. The switch is a row in
   * the account menu now (the bar flag was removed), so this opens the menu
   * first - the hover path a desktop visitor takes.
   *
   * The switch is a client-side (soft) navigation, so `load` may already have
   * fired for the current document and waiting on it alone can return while
   * the new document is still being swapped in. The next `page.evaluate` then
   * dies with "Execution context was destroyed". Wait for the URL to actually
   * change first, which is what a user observes anyway.
   */
  async switchLanguage(): Promise<void> {
    const before = new URL(this.page.url()).pathname
    await this.openAccountMenu()
    await this.navAccountLanguage.click()
    await expect.poll(() => new URL(this.page.url()).pathname).not.toBe(before)
    await this.page.waitForLoadState('load')
  }

  /** The hamburger label that toggles the mobile nav panel. */
  hamburger(): Locator {
    return this.page.getByTestId('hamburger')
  }

  /**
   * Keyboard-only focus: Tab until the locator holds focus. Bounded, so a
   * control that is not in the tab order fails the follow-up assertion
   * instead of looping forever. Used where a mouse click would also hover the
   * control in, which masks the focus behaviour under test.
   */
  async tabTo(locator: Locator): Promise<void> {
    for (let step = 0; step < 20; step++) {
      if (await locator.evaluate((el) => el === el.ownerDocument.activeElement)) return
      await this.page.keyboard.press('Tab')
    }
  }

  async openMobileMenu(): Promise<void> {
    await this.hamburger().click()
    await expect(this.navbar).toHaveAttribute('data-menu-open', 'true')
  }

  /**
   * Waits until React has attached to the server HTML (SiteChrome sets
   * data-hydrated on <html> once its mount effect runs). Tests that assert on
   * state React is expected to CORRECT after hydration must wait for this,
   * otherwise they race the pre-hydration paint of the SSR markup.
   */
  async waitForHydration(): Promise<void> {
    await expect(this.page.locator('html')).toHaveAttribute('data-hydrated', 'true')
  }

  /** Wait until the Markets strip's published height variable settles. */
  async expectMarketsHeightSettled(): Promise<void> {
    await expect
      .poll(async () =>
        this.page.evaluate(`document.documentElement.style.getPropertyValue('--markets-height')`),
      )
      .not.toBe('')
  }
}
