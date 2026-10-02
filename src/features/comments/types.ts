/**
 * The client-facing shapes of the comment API. Dates arrive as ISO strings
 * (JSON has no Date), which is why these are declared separately from the
 * server's document types.
 */

export interface CommentDto {
  id: string
  parentId: string | null
  userName: string
  userImage: string | null
  /** Empty string once the comment has been soft-deleted. */
  body: string
  createdAt: string
  editedAt: string | null
  deleted: boolean
  /** The caller wrote it. */
  mine: boolean
  /** The caller may delete it (their own, or any as an admin). */
  canDelete: boolean
}

export interface ReplyDto {
  id: string
  articleSlug: string
  parentId: string | null
  userName: string
  body: string
  createdAt: string
}
