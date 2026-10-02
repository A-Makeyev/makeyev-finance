import { type Locator, type Page } from '@playwright/test'

/**
 * Page object for an article's comment thread. Selectors live here, never
 * inline in a spec, so a markup change is one fix.
 *
 * The signed-in posting flow needs a real session in the database, which this
 * suite deliberately does not create, so the specs here cover the signed-out
 * surface and the server-side refusals; the remaining selectors are ready for
 * a seeded-session fixture.
 */
export class CommentsPage {
  readonly page: Page
  readonly section: Locator
  readonly heading: Locator
  readonly signIn: Locator
  readonly input: Locator
  readonly submit: Locator
  readonly empty: Locator
  readonly loadError: Locator
  readonly error: Locator
  readonly comments: Locator
  readonly bodies: Locator
  readonly authors: Locator
  readonly replyButtons: Locator
  readonly editButtons: Locator
  readonly deleteButtons: Locator
  readonly deletedNotices: Locator
  readonly editedMarkers: Locator
  readonly deleteModal: Locator
  readonly deleteCancel: Locator
  readonly deleteConfirm: Locator
  readonly deleteError: Locator
  readonly toast: Locator
  readonly showMore: Locator
  readonly collapseToggles: Locator
  readonly children: Locator
  /** Comments past the visual-depth cap: they have a toggle but no rail. */
  readonly toggleWithNoRail: Locator
  /** The collapse toggle inside such a comment. */
  readonly toggleWithNoRailButton: Locator
  /** The article's prose block: the reference for width and alignment checks. */
  readonly article: Locator

  constructor(page: Page) {
    this.page = page
    this.section = page.getByTestId('comments')
    this.heading = this.section.getByRole('heading', { level: 2 })
    this.signIn = page.getByTestId('comment-sign-in')
    this.input = page.getByTestId('comment-input')
    this.submit = page.getByTestId('comment-submit')
    this.empty = page.getByTestId('comments-empty')
    this.loadError = this.section.getByRole('alert')
    this.error = page.getByTestId('comment-error')
    this.comments = page.getByTestId('comment')
    this.bodies = page.getByTestId('comment-body')
    this.authors = page.getByTestId('comment-author')
    this.replyButtons = page.getByTestId('comment-reply')
    this.editButtons = page.getByTestId('comment-edit')
    this.deleteButtons = page.getByTestId('comment-delete')
    this.deletedNotices = page.getByTestId('comment-deleted')
    this.editedMarkers = page.getByTestId('comment-edited')
    this.deleteModal = page.getByTestId('comment-delete-modal')
    this.deleteCancel = page.getByTestId('comment-delete-cancel')
    this.deleteConfirm = page.getByTestId('comment-delete-confirm')
    this.deleteError = page.getByTestId('comment-delete-error')
    this.toast = page.getByTestId('comment-toast')
    this.showMore = page.getByTestId('comments-show-more')
    this.collapseToggles = page.getByTestId('comment-collapse')
    this.children = page.getByTestId('comment-children')
    this.toggleWithNoRail = page.locator('.comment-node.has-collapse:not(.has-children)')
    this.toggleWithNoRailButton = page.locator(
      '.comment-node.has-collapse:not(.has-children) [data-testid="comment-collapse"]',
    )
    this.article = page.locator('article.article-page')
  }

  /** A single comment by its data id (the element carries #comment-<id>). */
  commentById(id: string): Locator {
    return this.page.locator(`#comment-${id}`)
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path)
  }
}
