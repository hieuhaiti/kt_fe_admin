export interface NewsCommentUser {
  id: number
  fullName?: string | null
  avatarUrl?: string | null

  // legacy
  full_name?: string | null
  avatar_url?: string | null
}

export interface NewsComment {
  id: number
  newsId?: number
  userId?: number | null
  user?: NewsCommentUser | null
  content: string
  isApproved?: boolean
  parentCommentId?: number | null
  replies?: NewsComment[]
  createdAt?: string
  updatedAt?: string

  // legacy snake_case
  news_id?: number
  user_id?: number | null
  user_name?: string
  user_email?: string
  is_approved?: boolean
  parent_comment_id?: number | null
  created_at?: string
  updated_at?: string
}

/** Wrapper returned by GET /news-comments/:id */
export interface NewsCommentData {
  comment: NewsComment
}

export interface NewsCommentListData {
  comments: NewsComment[]
  pagination: import('./index').Pagination
}

export type NewsCommentPublicList = NewsComment[]

export interface NewsCommentPublicListData {
  comments: NewsComment[]
}

export interface NewsCommentAdminListParams {
  page?: number
  limit?: number
  targetType?: 'news' | string
  targetId?: number
  isApproved?: boolean
  sortBy?: 'created_at' | 'updated_at'
  sortOrder?: 'ASC' | 'DESC'

  // legacy
  news_id?: number
  is_approved?: boolean
}

export interface CreatePublicCommentBody {
  content: string
}

export interface ApproveCommentBody {
  isApproved: boolean
}
