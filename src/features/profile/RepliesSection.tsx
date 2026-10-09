'use client'

import { useTranslation } from 'react-i18next'
import { Link } from '@/router'
import { formatRelativeTime } from '@/lib/relativeTime'
import { articleTitleKey } from '@/lib/articles'
import { useReplies } from '@/features/comments/api'

/**
 * "Replies to you" on the profile page: comments that replied to one of the
 * caller's own, newest first.
 *
 * In-app only for now. The recipient is derived from the session server-side,
 * so this can only ever list the caller's own replies. There is no unread
 * state and no email delivery yet, and the query reports what is there rather
 * than claiming a notification count.
 */
export function RepliesSection() {
  const { t, i18n } = useTranslation()
  const { data, isPending, isError } = useReplies(true)
  const replies = data ?? []

  return (
    <section data-testid="replies">
      <h2 className="mb-4 text-lg font-semibold text-ink">{t('replies.title')}</h2>

      {isPending && (
        <p className="text-sm text-ink-muted" data-testid="replies-loading">
          {t('savedMixes.loading')}
        </p>
      )}
      {isError && (
        <p role="alert" data-testid="replies-error" className="text-sm text-danger">
          {t('replies.loadError')}
        </p>
      )}
      {!isPending && !isError && replies.length === 0 && (
        <p className="text-sm text-ink-muted" data-testid="replies-empty">
          {t('replies.empty')}
        </p>
      )}

      {/* auto-rows-fr keeps every row the height of the tallest card, so no
          reply card comes out taller than its neighbours. Applied from md,
          where the four-up grid sits on one screen row; the two-up mobile
          layout keeps each card's natural height instead of every row growing
          to the tallest. */}
      <ul className="grid grid-cols-2 gap-3 md:auto-rows-fr md:grid-cols-4">
        {replies.map((reply) => {
          // The card's heading: which article the reply is about. As a muted
          // footnote at the foot of the card it read as clutter instead.
          const titleKey = articleTitleKey(reply.articleSlug)
          return (
            <li
              key={reply.id}
              data-testid="reply-card"
              className="flex flex-col rounded-2xl border border-line-soft bg-surface-card p-4"
            >
              {titleKey && (
                <h3
                  className="text-[15px] font-semibold leading-snug text-ink"
                  data-testid="reply-article"
                >
                  {t(titleKey)}
                </h3>
              )}
              {/* Below the heading: which article matters more than who replied. */}
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="text-xs text-ink-muted" data-testid="reply-author">
                  {reply.userName}
                </span>
                {/* Same rule as the article thread: a reply from an account
                    that has since been deleted keeps its name and says so. */}
                {reply.authorDeleted && (
                  <span className="text-xs text-ink-muted" data-testid="reply-author-deleted">
                    ({t('replies.deletedAuthor')})
                  </span>
                )}
                <time className="text-xs text-ink-muted" dateTime={reply.createdAt}>
                  {formatRelativeTime(Date.parse(reply.createdAt), Date.now(), i18n.language)}
                </time>
              </div>
              <p
                className="comment-text mb-2 mt-2 whitespace-pre-wrap break-words text-sm text-ink"
                dir="auto"
              >
                {reply.body}
              </p>
              {/* mt-auto pins the link to the card's bottom edge, so links line up
                  across cards that stretch to the same row height. */}
              <Link
                // The hash names the comment, so the article page scrolls to it
                // once the thread has loaded (see CommentsSection).
                to={`/articles/${reply.articleSlug}#comment-${reply.id}`}
                className="mt-auto inline-block text-sm font-medium text-ink underline underline-offset-4 hover:text-ink-muted"
                data-testid="reply-link"
              >
                {t('replies.view')}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
