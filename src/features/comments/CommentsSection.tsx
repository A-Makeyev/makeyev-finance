'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FaCheck,
  FaMinus,
  FaPlus,
  FaRegComment,
  FaRegEdit,
  FaRegTrashAlt,
  FaReply,
  FaSpinner,
} from 'react-icons/fa'
import { AppModal } from '@/components/ui/AppModal'
import { authClient } from '@/lib/auth-client'
import { useRouter } from '@/router'
import { initialsFor } from '@/lib/avatar'
import { formatRelativeTime } from '@/lib/relativeTime'
import { buildCommentTree, MAX_VISUAL_DEPTH, visualDepth, type CommentNode } from './tree'
import { useComments, useDeleteComment, useEditComment, usePostComment } from './api'
import type { CommentDto } from './types'

/**
 * The comment thread under an article.
 *
 * Reads are public; posting, replying and editing need a session, and the
 * moderation check runs on the server before anything is stored. A signed-out
 * visitor gets a sign-in prompt in place of the form (never a disabled
 * textarea, which would explain nothing and offer no way forward).
 *
 * Rendering: the flat list becomes a tree (see ./tree), indented up to
 * MAX_VISUAL_DEPTH levels and flattened beyond that so a long chain stays
 * readable on a phone. Indentation uses marginInlineStart, so it flips with
 * the document direction instead of needing a per-language override.
 */

/** Mirrors the server's limit (server/comments/schema.ts); the server re-checks. */
const MAX_COMMENT_LENGTH = 600

/** Top-level comments rendered before the "show more" control. */
const COMMENT_PAGE_SIZE = 8

/** How long the delete confirmation toast stays up. */
const TOAST_MS = 1800

/** How long a jumped-to comment stays highlighted, matching the CSS flash. */
const TARGET_FLASH_MS = 2400

/**
 * The id of the top-level comment whose subtree contains `id`, or null. Used to
 * make sure a linked-to comment is actually rendered (the list shows the first
 * COMMENT_PAGE_SIZE top-level comments) before scrolling to it.
 */
function findRootId(nodes: CommentNode[], id: string): string | null {
  const contains = (node: CommentNode): boolean =>
    node.comment.id === id || node.children.some(contains)
  for (const root of nodes) {
    if (contains(root)) return root.comment.id
  }
  return null
}

const inputClass =
  'w-full rounded-lg border border-line-strong bg-surface-page px-3 py-2 text-ink outline-none transition-colors hover:border-ink focus:border-ink'

const smallButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink'

export function CommentsSection({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const signedIn = Boolean(session)

  const commentsQuery = useComments(slug)
  const postComment = usePostComment(slug)
  const editComment = useEditComment(slug)
  const deleteComment = useDeleteComment(slug)

  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [error, setError] = useState<'blocked' | 'rate_limited' | 'generic' | null>(null)
  // Deletion is confirmed in a modal rather than fired on click - a mis-tap on
  // a small touch target should not remove someone's comment - and the success
  // is reported by a toast that outlives the modal.
  const [pendingDelete, setPendingDelete] = useState<CommentDto | null>(null)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [visibleCount, setVisibleCount] = useState(COMMENT_PAGE_SIZE)
  // Comments whose replies are folded away. Collapsing is per-comment and keeps
  // its state across replies to that comment being posted, so it is keyed by
  // comment id rather than by position in the tree.
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [toastAt, setToastAt] = useState(0)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<number | null>(null)
  // A reply link from the profile arrives as #comment-<id>. The hash is tracked
  // as state (and re-read on hashchange) rather than sampled once, so a second
  // in-page jump works too; the comments load asynchronously, so the scroll
  // waits until the target actually exists.
  const [hashTarget, setHashTarget] = useState<string | null>(null)
  // The comment to flash briefly once the visitor lands on it, so the jump has
  // a visible destination rather than just a scroll position.
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const scrolledToHash = useRef<string | null>(null)

  const comments = commentsQuery.data ?? []
  const tree = buildCommentTree(comments)
  const visibleTree = tree.slice(0, visibleCount)
  const locale = i18n.language

  useEffect(() => {
    if (!toastAt) return
    setToastVisible(true)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastVisible(false), TOAST_MS)
  }, [toastAt])

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash
      setHashTarget(hash.startsWith('#comment-') ? hash.slice('#comment-'.length) : null)
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [])

  useEffect(() => {
    if (!hashTarget) return
    if (scrolledToHash.current === hashTarget) return
    const target = document.getElementById(`comment-${hashTarget}`)
    if (!target) {
      // The target is real but its top-level comment is still beyond the
      // rendered page: raise the page size to include it, then let this effect
      // run again and scroll.
      const roots = buildCommentTree(commentsQuery.data ?? [])
      const rootId = findRootId(roots, hashTarget)
      if (!rootId) return
      const rootIndex = roots.findIndex((node) => node.comment.id === rootId)
      if (rootIndex >= visibleCount) setVisibleCount(rootIndex + 1)
      return
    }
    scrolledToHash.current = hashTarget
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlightedId(hashTarget)
    const timer = window.setTimeout(() => setHighlightedId(null), TARGET_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [hashTarget, commentsQuery.data, visibleCount])

  /** Maps the server's error token to the message the author should see. */
  function describeError(thrown: unknown): 'blocked' | 'rate_limited' | 'generic' {
    const token = thrown instanceof Error ? thrown.message : ''
    if (token === 'blocked') return 'blocked'
    if (token === 'rate_limited') return 'rate_limited'
    return 'generic'
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      await postComment.mutateAsync({ body, parentId: replyTo?.id ?? null })
      setBody('')
      setReplyTo(null)
    } catch (thrown) {
      setError(describeError(thrown))
    }
  }

  async function saveEdit(comment: CommentDto) {
    setError(null)
    try {
      await editComment.mutateAsync({ id: comment.id, body: editBody })
      setEditingId(null)
      setEditBody('')
    } catch (thrown) {
      setError(describeError(thrown))
    }
  }

  function requestDelete(comment: CommentDto) {
    setDeleteFailed(false)
    setPendingDelete(comment)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleteFailed(false)
    try {
      await deleteComment.mutateAsync(pendingDelete.id)
      setPendingDelete(null)
      setToastAt(Date.now())
    } catch {
      setDeleteFailed(true)
    }
  }

  function toggleCollapsed(id: string) {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startReply(node: CommentNode) {
    setReplyTo({ id: node.comment.id, name: node.comment.userName })
    setEditingId(null)
    setError(null)
  }

  /** A comment's avatar: the provider photo, else initials, else a glyph. */
  function avatar(comment: CommentDto): ReactNode {
    const initials = initialsFor(comment.userName)
    if (comment.userImage) {
      return (
        <img
          src={comment.userImage}
          alt=""
          referrerPolicy="no-referrer"
          className="h-8 w-8 shrink-0 rounded-full object-cover"
        />
      )
    }
    return (
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-soft text-xs font-semibold text-ink"
      >
        {initials || <FaRegComment />}
      </span>
    )
  }

  function renderNode(node: CommentNode): ReactNode {
    const comment = node.comment
    const isEditing = editingId === comment.id
    // Indentation lives on the children container (see comment-children), one
    // step per level, so nesting cannot compound it; the capped depth is
    // exposed for tests rather than as a style.
    const hasChildren = node.children.length > 0
    const childrenFlat = node.depth + 1 >= MAX_VISUAL_DEPTH
    // Past MAX_VISUAL_DEPTH the replies are no longer indented, so there is no
    // rail to draw; the collapse toggle still renders, just without the line.
    const hasRail = hasChildren && !childrenFlat
    const collapsed = hasChildren && collapsedIds.has(comment.id)
    const childrenId = `comment-children-${comment.id}`
    return (
      <li
        key={comment.id}
        id={`comment-${comment.id}`}
        data-testid="comment"
        data-comment-id={comment.id}
        data-visual-depth={visualDepth(node.depth)}
        // scroll-mt keeps the target clear of the sticky header when a reply
        // link jumps to it from the profile.
        className={`comment-node mt-4 scroll-mt-28${hasRail ? ' has-children' : ''}${
          hasChildren ? ' has-collapse' : ''
        }${collapsed ? ' is-collapsed' : ''}${
          comment.id === highlightedId ? ' is-target' : ''
        }`}
      >
        <div className="comment-row flex items-start gap-3">
          {avatar(comment)}
          {hasChildren && (
            // Sits ON the rail where it leaves the avatar. aria-expanded carries
            // the state; the minus/plus glyph is decorative. A native button, so
            // it is keyboard-operable and works on touch without hover.
            <button
              type="button"
              data-testid="comment-collapse"
              className="comment-collapse"
              aria-expanded={!collapsed}
              aria-controls={childrenId}
              aria-label={t(collapsed ? 'comments.expandReplies' : 'comments.collapseReplies')}
              onClick={() => toggleCollapsed(comment.id)}
            >
              {collapsed ? <FaPlus aria-hidden="true" /> : <FaMinus aria-hidden="true" />}
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-semibold text-ink" data-testid="comment-author">
                {comment.userName}
              </span>
              <time
                className="text-xs text-ink-muted"
                dateTime={comment.createdAt}
                data-testid="comment-time"
              >
                {formatRelativeTime(Date.parse(comment.createdAt), Date.now(), locale)}
              </time>
              {comment.editedAt && !comment.deleted && (
                <span className="text-xs text-ink-muted" data-testid="comment-edited">
                  ({t('comments.edited')})
                </span>
              )}
            </div>

            {comment.deleted ? (
              <p className="mt-1 text-sm italic text-ink-muted" data-testid="comment-deleted">
                {t('comments.deleted')}
              </p>
            ) : isEditing ? (
              <div className="mt-2">
                <textarea
                  className={`${inputClass} comment-text`}
                  rows={3}
                  maxLength={MAX_COMMENT_LENGTH}
                  name="comment-body"
                  data-testid="comment-edit-input"
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                />
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    data-testid="comment-edit-save"
                    className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-surface-page transition-colors hover:bg-ink/85"
                    onClick={() => void saveEdit(comment)}
                  >
                    {t('comments.saveEdit')}
                  </button>
                  <button
                    type="button"
                    data-testid="comment-edit-cancel"
                    className={smallButtonClass}
                    onClick={() => {
                      setEditingId(null)
                      setEditBody('')
                    }}
                  >
                    {t('comments.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              // dir="auto" gives the text its own bidi base so Hebrew reads
              // correctly on the English page; comment-text then aligns it to
              // the PAGE direction, so it stays by the author's name instead
              // of jumping to the far edge of the card.
              <p
                className="comment-text mt-1 whitespace-pre-wrap break-words text-sm text-ink"
                dir="auto"
                data-testid="comment-body"
              >
                {comment.body}
              </p>
            )}

            {!comment.deleted && !isEditing && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {signedIn && (
                  <button
                    type="button"
                    data-testid="comment-reply"
                    className={smallButtonClass}
                    onClick={() => startReply(node)}
                  >
                    <FaReply aria-hidden="true" className="comment-reply-icon" />
                    {t('comments.reply')}
                  </button>
                )}
                {comment.mine && (
                  <button
                    type="button"
                    data-testid="comment-edit"
                    className={smallButtonClass}
                    onClick={() => {
                      setEditingId(comment.id)
                      setEditBody(comment.body)
                      setReplyTo(null)
                    }}
                  >
                    <FaRegEdit aria-hidden="true" />
                    {t('comments.edit')}
                  </button>
                )}
                {comment.canDelete && (
                  <button
                    type="button"
                    data-testid="comment-delete"
                    className={`${smallButtonClass} hover:text-danger`}
                    onClick={() => requestDelete(comment)}
                  >
                    <FaRegTrashAlt aria-hidden="true" />
                    {t('comments.delete')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {node.children.length > 0 && !collapsed && (
          // Past MAX_VISUAL_DEPTH the container stops indenting and only keeps
          // the thread rule, so a deep chain flattens instead of marching off
          // the side of a phone screen.
          <ul
            id={childrenId}
            className={`comment-children${childrenFlat ? ' is-flat' : ''}`}
            data-testid="comment-children"
          >
            {node.children.map((child) => renderNode(child))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <section className="article-comments" data-testid="comments">
      {/* Heading and sign-in prompt share one line. The prompt is a plain
          text action, not a bordered button, separated from the heading by a
          middot (decorative, so it is hidden from assistive tech). */}
      <div className="comments-heading">
        <h2>{t('comments.title')}</h2>
        {!signedIn && (
          <>
            <span aria-hidden="true" className="comments-heading-sep">
              ·
            </span>
            <button
              type="button"
              data-testid="comment-sign-in"
              onClick={() => router.push(`/login?next=/articles/${slug}`)}
              className="comment-sign-in-link"
            >
              {t('comments.signInPrompt')}
            </button>
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          data-testid="comment-error"
          className="mt-3 rounded-lg border border-danger px-3 py-2 text-sm text-danger"
        >
          {error === 'blocked'
            ? t('comments.blocked')
            : error === 'rate_limited'
              ? t('comments.rateLimited')
              : t('comments.genericError')}
        </p>
      )}

      {signedIn && (
        <form className="mt-4" onSubmit={submit}>
          {replyTo && (
            <p className="mb-2 text-xs text-ink-muted" data-testid="comment-reply-target">
              {t('comments.replyTo', { name: replyTo.name })}
            </p>
          )}
          <textarea
            className={`${inputClass} comment-text`}
            rows={3}
            maxLength={MAX_COMMENT_LENGTH}
            required
            name="comment"
            data-testid="comment-input"
            placeholder={t('comments.placeholder')}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={postComment.isPending}
              data-testid="comment-submit"
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface-page transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {t('comments.submit')}
            </button>
            {replyTo && (
              <button
                type="button"
                data-testid="comment-reply-cancel"
                className={smallButtonClass}
                onClick={() => setReplyTo(null)}
              >
                {t('comments.cancel')}
              </button>
            )}
          </div>
        </form>
      )}

      {commentsQuery.isPending && (
        <p className="mt-4 text-sm text-ink-muted" data-testid="comments-loading">
          {t('savedMixes.loading')}
        </p>
      )}
      {commentsQuery.isError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {t('comments.loadError')}
        </p>
      )}
      {!commentsQuery.isPending && !commentsQuery.isError && tree.length === 0 && (
        <p className="mt-4 text-sm text-ink-muted" data-testid="comments-empty">
          {t('comments.empty')}
        </p>
      )}

      <ul className="comment-thread mt-2">
        {visibleTree.map((node) => renderNode(node))}
      </ul>
      {tree.length > visibleCount && (
        <button
          type="button"
          data-testid="comments-show-more"
          className={`${smallButtonClass} mt-4`}
          onClick={() => setVisibleCount((count) => count + COMMENT_PAGE_SIZE)}
        >
          {t('comments.showMore')}
        </button>
      )}

      <AppModal
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        testId="comment-delete-modal"
        dir={i18n.dir()}
        tone="red"
        contentClassName="max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="mb-3 text-[20px] font-bold leading-tight text-ink">
            {t('comments.deleteConfirmTitle')}
          </h3>
          <p className="text-[15px] leading-relaxed text-ink">
            {t('comments.deleteConfirmBody')}
          </p>
          {deleteFailed && (
            <p role="alert" data-testid="comment-delete-error" className="mt-3 text-sm text-danger">
              {t('comments.deleteFailed')}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              data-testid="comment-delete-cancel"
              className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
              onClick={() => setPendingDelete(null)}
            >
              {t('comments.cancel')}
            </button>
            <button
              type="button"
              data-testid="comment-delete-confirm"
              disabled={deleteComment.isPending}
              aria-busy={deleteComment.isPending}
              className="inline-flex items-center gap-2 rounded-[5px] bg-soft-red px-5 py-2 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={() => void confirmDelete()}
            >
              {deleteComment.isPending && (
                <FaSpinner aria-hidden="true" className="animate-spin" />
              )}
              {t('comments.delete')}
            </button>
          </div>
        </div>
      </AppModal>

      {toastAt > 0 && (
        <div
          aria-live="polite"
          data-testid="comment-toast"
          className={`pointer-events-none fixed bottom-24 left-1/2 z-[1100] -translate-x-1/2 transition-opacity duration-300 ${
            toastVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            dir="auto"
            className="flex max-w-[min(92vw,26rem)] items-center gap-2.5 whitespace-nowrap rounded-full bg-ink/90 px-5 py-2.5 text-[14px] font-semibold text-surface-card shadow-[0_4px_14px_0_rgba(15,15,15,0.35)] backdrop-blur-sm"
          >
            <FaCheck aria-hidden="true" className="text-[13px] text-soft-blue" />
            <span className="min-w-0 truncate">{t('comments.deletedToast')}</span>
          </div>
        </div>
      )}
    </section>
  )
}
