import { expect, type Locator, type Page } from '@playwright/test'

/** Page Object for the average mortgage-rate page (/rates, /en/rates). */
export class RatesPage {
  readonly page: Page
  readonly root: Locator
  readonly sourceLink: Locator
  readonly pageError: Locator
  readonly retryPage: Locator
  readonly footnotes: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.getByTestId('rates-page')
    this.sourceLink = page.getByTestId('rates-source-link')
    this.pageError = page.getByTestId('rates-error')
    this.retryPage = page.getByTestId('rates-retry')
    this.footnotes = this.root.locator('ul')
  }

  async goto(language: 'hebrew' | 'english' = 'hebrew'): Promise<void> {
    await this.page.goto(language === 'english' ? '/en/rates' : '/rates')
    await expect(this.root).toBeVisible()
  }

  section(kind: 'indexed' | 'nonIndexed'): Locator {
    return this.page.getByTestId(`rates-section-${kind}`)
  }

  table(kind: 'indexed' | 'nonIndexed'): Locator {
    return this.page.getByTestId(`rates-table-${kind}`)
  }

  tableWrap(kind: 'indexed' | 'nonIndexed'): Locator {
    return this.page.getByTestId(`rates-table-wrap-${kind}`)
  }

  current(kind: 'indexed' | 'nonIndexed'): Locator {
    return this.page.getByTestId(`rates-current-${kind}`)
  }

  currentRow(kind: 'indexed' | 'nonIndexed'): Locator {
    return this.page.getByTestId(`rates-current-row-${kind}`)
  }

  stale(kind: 'indexed' | 'nonIndexed'): Locator {
    return this.page.getByTestId(`rates-stale-${kind}`)
  }

  unavailable(kind: 'indexed' | 'nonIndexed'): Locator {
    return this.page.getByTestId(`rates-unavailable-${kind}`)
  }

  retryTable(kind: 'indexed' | 'nonIndexed'): Locator {
    return this.page.getByTestId(`rates-retry-${kind}`)
  }

  async documentDir(): Promise<string | null> {
    return this.page.evaluate('document.documentElement.getAttribute("dir")')
  }

  async documentLang(): Promise<string | null> {
    return this.page.evaluate('document.documentElement.getAttribute("lang")')
  }

  async pageTheme(): Promise<string | null> {
    return this.page.evaluate('document.documentElement.getAttribute("data-theme")')
  }

  async headers(kind: 'indexed' | 'nonIndexed'): Promise<string[]> {
    return this.table(kind).locator('thead th').allInnerTexts()
  }

  async rowCount(kind: 'indexed' | 'nonIndexed'): Promise<number> {
    return this.table(kind).locator('tbody tr').count()
  }

  async currentText(kind: 'indexed' | 'nonIndexed'): Promise<string> {
    return this.current(kind).innerText()
  }

  async currentRowText(kind: 'indexed' | 'nonIndexed'): Promise<string> {
    return this.currentRow(kind).innerText()
  }

  async wrapperOverflow(kind: 'indexed' | 'nonIndexed'): Promise<number> {
    return this.tableWrap(kind).evaluate((node) => node.scrollWidth - node.clientWidth)
  }

  async pageOverflow(): Promise<number> {
    return this.page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    ) as Promise<number>
  }

  async sectionBackground(kind: 'indexed' | 'nonIndexed'): Promise<string> {
    return this.section(kind).evaluate((node) => getComputedStyle(node).backgroundColor)
  }
}
