import { expect, serveQuotes, test } from '../../fixtures'
import { CommentsPage } from '../../pages/CommentsPage'
import { mockGetSessionUser } from '../../support/authMocks'

/**
 * The comment thread's signed-out surface and the server-side refusals.
 *
 * The authorization tests deliberately hit the API without a session: the
 * point is that the server refuses, not that the UI hides the control. A
 * hidden button is not access control.
 */

const VALID_ID = '507f1f77bcf86cd799439011'

test.describe('article comments', () => {
  test.beforeEach(async ({ mockedPage }) => {
    await serveQuotes(mockedPage, [])
  })

  for (const viewport of [
    { width: 360, height: 800, tag: '360' },
    { width: 1280, height: 900, tag: '1280' },
  ]) {
    // Both directions: alignment comes from logical properties, and an LTR
    // pass is the only thing that catches a left/right that did not flip.
    for (const locale of [
      { prefix: '', tag: 'hebrew' },
      { prefix: '/en', tag: 'english' },
    ]) {
      test(`the thread is aligned under the article, not full width - ${locale.tag} @ ${viewport.tag}px`, async ({
        mockedPage,
      }) => {
        const comments = new CommentsPage(mockedPage)
        await mockedPage.setViewportSize({ width: viewport.width, height: viewport.height })
        await comments.goto(`${locale.prefix}/articles/mortgage-decisions`)

        const article = await comments.article.boundingBox()
        const thread = await comments.section.boundingBox()
        expect(article).not.toBeNull()
        expect(thread).not.toBeNull()

        // The thread lives OUTSIDE <article> on purpose (page furniture, not
        // prose), so only the CSS gives it the article's measure. Without it
        // the thread spans the whole page.
        expect(Math.round(thread!.width)).toBeLessThanOrEqual(Math.round(article!.width))
        // Same inline start, so it reads as part of the column.
        expect(Math.round(thread!.x)).toBe(Math.round(article!.x))
        expect(thread!.y).toBeGreaterThan(article!.y + article!.height - 1)
      })
    }
  }

  test('a signed-out reader gets the sign-in prompt instead of a form', async ({ mockedPage }) => {
    const comments = new CommentsPage(mockedPage)
    await comments.goto('/articles/mortgage-decisions')

    await expect(comments.heading).toBeVisible()
    await expect(comments.signIn).toBeVisible()
    // No textarea at all, rather than a disabled one that explains nothing.
    await expect(comments.input).toHaveCount(0)
  })

  test('the English article carries the English heading', async ({ mockedPage }) => {
    const comments = new CommentsPage(mockedPage)
    await comments.goto('/en/articles/mortgage-decisions')

    await expect(comments.heading).toHaveText('Comments')
    await expect(comments.signIn).toHaveText('Sign in to comment')
  })

  test('the prompt leads to the login page with the article as the target', async ({
    mockedPage,
  }) => {
    const comments = new CommentsPage(mockedPage)
    await comments.goto('/articles/mortgage-decisions')

    await comments.signIn.click()
    await expect(mockedPage).toHaveURL(
      /\/login\?next=(%2F|\/)articles(%2F|\/)mortgage-decisions$/,
    )
  })

  test('posting is refused server-side without a session', async ({ mockedPage }) => {
    const response = await mockedPage.request.post('/api/articles/mortgage-decisions/comments', {
      data: { body: 'hello' },
    })
    expect(response.status()).toBe(401)
  })

  test('editing and deleting are refused server-side without a session', async ({ mockedPage }) => {
    const del = await mockedPage.request.delete(`/api/comments/${VALID_ID}`)
    expect(del.status()).toBe(401)

    const patch = await mockedPage.request.patch(`/api/comments/${VALID_ID}`, {
      data: { body: 'edited' },
    })
    expect(patch.status()).toBe(401)
  })

  test('an unknown article slug is refused before any of that', async ({ mockedPage }) => {
    const read = await mockedPage.request.get('/api/articles/not-an-article/comments')
    expect(read.status()).toBe(404)

    const write = await mockedPage.request.post('/api/articles/not-an-article/comments', {
      data: { body: 'hello' },
    })
    expect(write.status()).toBe(404)
  })

  test('the replies feed is refused without a session', async ({ mockedPage }) => {
    const response = await mockedPage.request.get('/api/replies')
    expect(response.status()).toBe(401)
  })

  test('deleting a comment asks for confirmation, then confirms with a toast', async ({
    mockedPage,
  }) => {
    // Deletion is a server-authorized write this suite has no session for, so
    // the comment feed and the delete call are mocked here: the subject is the
    // confirm-then-toast UI, not authorization (the refusal tests above cover
    // that side).
    const comment = {
      id: VALID_ID,
      parentId: null,
      userName: 'Dana',
      userImage: null,
      body: 'תגובה לבדיקה',
      createdAt: new Date().toISOString(),
      editedAt: null,
      deleted: false,
      mine: true,
      canDelete: true,
    }
    let deleteCalls = 0
    await mockedPage.route('**/api/articles/mortgage-decisions/comments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: [comment] }),
      }),
    )
    await mockedPage.route('**/api/comments/*', (route) => {
      deleteCalls += 1
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })

    const comments = new CommentsPage(mockedPage)
    await comments.goto('/articles/mortgage-decisions')
    await expect(comments.comments).toHaveCount(1)

    // A mis-tap must not delete: the click only opens the confirm.
    await comments.deleteButtons.first().click()
    await expect(comments.deleteModal).toBeVisible()
    expect(deleteCalls).toBe(0)

    // Cancelling leaves the comment alone.
    await comments.deleteCancel.click()
    await expect(comments.deleteModal).toBeHidden()
    expect(deleteCalls).toBe(0)

    // Confirming deletes and reports it with a toast.
    await comments.deleteButtons.first().click()
    await comments.deleteConfirm.click()
    await expect(comments.deleteModal).toBeHidden()
    await expect(comments.toast).toBeVisible()
    expect(deleteCalls).toBe(1)
  })

  test('the reply, edit and delete actions each carry an icon', async ({ mockedPage }) => {
    // Reply needs a session, so one is mocked here (the server-side refusals
    // the other specs cover still hold regardless).
    await mockGetSessionUser(mockedPage)
    const comment = {
      id: VALID_ID,
      parentId: null,
      userName: 'Dana',
      userImage: null,
      body: 'hi',
      createdAt: new Date().toISOString(),
      editedAt: null,
      deleted: false,
      mine: true,
      canDelete: true,
    }
    await mockedPage.route('**/api/articles/mortgage-decisions/comments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: [comment] }),
      }),
    )

    const comments = new CommentsPage(mockedPage)
    await comments.goto('/en/articles/mortgage-decisions')
    await expect(comments.comments).toHaveCount(1)

    for (const action of [comments.replyButtons, comments.editButtons, comments.deleteButtons]) {
      await expect(action).toHaveCount(1)
      await expect(action.locator('svg')).toHaveCount(1)
    }
  })

  test('comment text follows the PAGE direction, not the language it was typed in', async ({
    mockedPage,
  }) => {
    // The real comment body needs a signed-in session this suite does not
    // create, so this pins the stylesheet contract directly: the alignment has
    // to come from the document direction. With text-align: start (the obvious
    // implementation) a Hebrew comment on the English page would align to the
    // element's own dir="auto" and jump to the far edge of the card, which is
    // the bug this replaced.
    const probe = `(() => {
      const el = document.createElement('p');
      el.className = 'comment-text';
      el.setAttribute('dir', 'auto');
      el.textContent = 'שלום';
      document.body.appendChild(el);
      const align = getComputedStyle(el).textAlign;
      el.remove();
      return align;
    })()`

    await mockedPage.goto('/en/articles/mortgage-decisions')
    expect(await mockedPage.evaluate(probe)).toBe('left')

    await mockedPage.goto('/articles/mortgage-decisions')
    expect(await mockedPage.evaluate(probe)).toBe('right')
  })

  test('the thread connector is a rail from the top comment with a rounded elbow per reply', async ({
    mockedPage,
  }) => {
    // The connector is a stylesheet contract (its box is drawn by pseudo-
    // elements), so this pins the rules AND that they render on a real nested
    // thread. The feed is mocked because posting needs a session, but reading
    // does not, so the real markup renders here.
    const base = {
      parentId: null,
      userImage: null,
      editedAt: null,
      deleted: false,
      mine: false,
      canDelete: false,
      createdAt: new Date().toISOString(),
    }
    const feed = [
      { ...base, id: 'p1', userName: 'Dana', body: 'parent' },
      { ...base, id: 'r1', parentId: 'p1', userName: 'Noa', body: 'reply' },
    ]
    await mockedPage.route('**/api/articles/mortgage-decisions/comments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: feed }),
      }),
    )

    const comments = new CommentsPage(mockedPage)
    await comments.goto('/en/articles/mortgage-decisions')
    await expect(comments.comments).toHaveCount(2)

    const probe = `(() => {
      const parent = document.querySelector('.comment-node.has-children');
      const row = parent ? parent.querySelector('.comment-row') : null;
      const ul = parent ? parent.querySelector('[data-testid="comment-children"]') : null;
      const li = ul ? ul.querySelector(':scope > li') : null;
      const railPseudo = row ? getComputedStyle(row, '::after') : null;
      const elbowPseudo = li ? getComputedStyle(li, '::before') : null;
      let endsAtLast = false;
      for (const sheet of document.styleSheets) {
        let list;
        try { list = sheet.cssRules } catch { continue }
        for (const r of list) {
          if (r.selectorText && r.selectorText.indexOf(':not(:last-child)::after') !== -1) {
            endsAtLast = true;
          }
        }
      }
      return {
        railWidth: railPseudo ? railPseudo.width : null,
        railRadius: railPseudo ? railPseudo.borderTopLeftRadius : null,
        railTop: railPseudo ? railPseudo.top : null,
        elbowStart: elbowPseudo ? elbowPseudo.borderInlineStartWidth : null,
        elbowEnd: elbowPseudo ? elbowPseudo.borderBlockEndWidth : null,
        elbowRadius: elbowPseudo ? elbowPseudo.borderEndStartRadius : null,
        endsAtLast,
      };
    })()`
    const connector = (await mockedPage.evaluate(probe)) as {
      railWidth: string | null
      railRadius: string | null
      railTop: string | null
      elbowStart: string | null
      elbowEnd: string | null
      elbowRadius: string | null
      endsAtLast: boolean
    }

    // A 2px rounded rail descending from the top comment's own avatar (its top
    // is the 32px avatar's bottom edge) and a 2px rounded elbow curving into
    // each reply at the avatar's mid-line. The downward segment exists only on
    // non-last replies, which is what ends the line at the last comment.
    expect(connector.railWidth, JSON.stringify(connector)).toBe('2px')
    expect(parseFloat(connector.railRadius ?? '0')).toBeGreaterThanOrEqual(999)
    expect(connector.railTop).toBe('32px')
    expect(connector.elbowStart).toBe('2px')
    expect(connector.elbowEnd).toBe('2px')
    expect(connector.elbowRadius).toBe('13px')
    expect(connector.endsAtLast).toBe(true)
  })

  test('the rail carries a collapse toggle that folds and restores the replies', async ({
    mockedPage,
  }) => {
    // Reading needs no session, so the real markup renders; the feed is mocked
    // for the same reason as the connector test above.
    const base = {
      parentId: null,
      userImage: null,
      editedAt: null,
      deleted: false,
      mine: false,
      canDelete: false,
      createdAt: new Date().toISOString(),
    }
    const feed = [
      { ...base, id: 'p1', userName: 'Dana', body: 'parent' },
      { ...base, id: 'r1', parentId: 'p1', userName: 'Noa', body: 'first' },
      { ...base, id: 'r2', parentId: 'p1', userName: 'Gil', body: 'second' },
    ]
    await mockedPage.route('**/api/articles/mortgage-decisions/comments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: feed }),
      }),
    )

    const comments = new CommentsPage(mockedPage)
    await comments.goto('/en/articles/mortgage-decisions')
    await expect(comments.comments).toHaveCount(3)

    const toggle = comments.collapseToggles
    await expect(toggle).toHaveCount(1)
    // Expanded state is exposed to assistive tech, not just drawn as a glyph.
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle).toHaveAttribute('aria-label', 'Collapse replies')
    await expect(comments.children).toHaveCount(1)

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toHaveAttribute('aria-label', 'Expand replies')
    await expect(comments.children).toHaveCount(0)
    // The replies fold away, leaving the parent comment itself.
    await expect(comments.comments).toHaveCount(1)

    // Keyboard-operable: the same native button restores them.
    await toggle.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(comments.children).toHaveCount(1)
    await expect(comments.comments).toHaveCount(3)
  })

  test('a #comment- deep link scrolls the target comment into view', async ({ mockedPage }) => {
    // The profile's reply cards link to /articles/<slug>#comment-<id>; the
    // comments load asynchronously, so the scroll has to happen once the
    // target exists, not on mount.
    const base = {
      parentId: null,
      userImage: null,
      editedAt: null,
      deleted: false,
      mine: false,
      canDelete: false,
    }
    // Oldest first in the source, so c1 is rendered LAST (top-level comments
    // are newest-first) and sits well below the fold.
    const feed = Array.from({ length: 12 }, (_, index) => ({
      ...base,
      id: `c${index + 1}`,
      userName: `User ${index + 1}`,
      body: `comment number ${index + 1}`,
      createdAt: new Date(Date.now() + index * 60_000).toISOString(),
    }))
    await mockedPage.route('**/api/articles/mortgage-decisions/comments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: feed }),
      }),
    )

    const comments = new CommentsPage(mockedPage)
    await comments.goto('/articles/mortgage-decisions#comment-c1')

    // The landing comment is flashed, so the jump has a visible destination.
    // Checked before the viewport assertion because the flash is on a timer.
    await expect(comments.commentById('c1')).toHaveClass(/is-target/)
    // Retrying assertion: the scroll is smooth, so the target arrives over a
    // few frames rather than instantly.
    await expect(comments.commentById('c1')).toBeInViewport()
    await expect(comments.commentById('c1')).toContainText('comment number 1')
  })

  test('replies past the visual-depth cap can still be folded', async ({ mockedPage }) => {
    // A chain deeper than MAX_VISUAL_DEPTH renders its innermost replies flat
    // (no indent, no rail), but the comment that owns them keeps the toggle, so
    // a deep thread stays collapsible.
    const base = {
      userImage: null,
      editedAt: null,
      deleted: false,
      mine: false,
      canDelete: false,
      createdAt: new Date().toISOString(),
    }
    const feed = [
      { ...base, id: 'c1', parentId: null, userName: 'A', body: 'one' },
      { ...base, id: 'c2', parentId: 'c1', userName: 'B', body: 'two' },
      { ...base, id: 'c3', parentId: 'c2', userName: 'C', body: 'three' },
      { ...base, id: 'c4', parentId: 'c3', userName: 'D', body: 'four' },
      { ...base, id: 'c5', parentId: 'c4', userName: 'E', body: 'five' },
    ]
    await mockedPage.route('**/api/articles/mortgage-decisions/comments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: feed }),
      }),
    )

    const comments = new CommentsPage(mockedPage)
    await comments.goto('/en/articles/mortgage-decisions')
    await expect(comments.comments).toHaveCount(5)

    // One toggle per comment that has replies: c1 through c4.
    await expect(comments.collapseToggles).toHaveCount(4)

    // The innermost owner (c4) has flat replies, so it draws no rail but still
    // offers the toggle.
    await expect(comments.toggleWithNoRail).toHaveCount(1)
    await expect(comments.toggleWithNoRailButton).toHaveCount(1)

    await comments.toggleWithNoRailButton.click()
    await expect(comments.comments).toHaveCount(4)
  })

  test('a comment from a deleted account keeps its name and says so', async ({ mockedPage }) => {
    // The thread is a public record other people replied to, so deleting the
    // person keeps the comment under the name it was posted with and marks it
    // (user-requested). The server sets `authorDeleted`; here the feed is
    // mocked, so this pins the rendering of both states.
    const base = {
      parentId: null,
      userImage: null,
      editedAt: null,
      deleted: false,
      mine: false,
      canDelete: false,
      createdAt: new Date().toISOString(),
    }
    const feed = [
      { ...base, id: 'c1', userName: 'Dana', body: 'from a live account', authorDeleted: false },
      { ...base, id: 'c2', userName: 'Gil', body: 'from a deleted account', authorDeleted: true },
    ]
    await mockedPage.route('**/api/articles/mortgage-decisions/comments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: feed }),
      }),
    )

    const comments = new CommentsPage(mockedPage)
    await comments.goto('/articles/mortgage-decisions')
    await expect(comments.comments).toHaveCount(2)

    // Name intact, marker on the deleted author only.
    await expect(comments.authors).toHaveText(['Dana', 'Gil'])
    await expect(comments.deletedAuthorMarks).toHaveCount(1)
    await expect(comments.deletedAuthorMarks).toHaveText('(חשבון שנמחק)')
    await expect(comments.commentById('c2')).toContainText('Gil')

    // English keeps the same structure with its own copy.
    await comments.goto('/en/articles/mortgage-decisions')
    await expect(comments.deletedAuthorMarks).toHaveCount(1)
    await expect(comments.deletedAuthorMarks).toHaveText('(deleted account)')
  })
})
