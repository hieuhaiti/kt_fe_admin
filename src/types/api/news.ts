export type NewsStatus = 'draft' | 'published'

export interface NewsTranslation {
  title: string
  slug?: string
  summary?: string | null
  content: string
  createdAt?: string
  updatedAt?: string
}

export interface News {
  id: number | string
  slug?: string
  status: NewsStatus
  category?: string | null
  coverUrl?: string | null
  thumbnailUrl?: string | null
  authorId?: number | string | null
  authorName?: string | null
  publishedAt?: string | null
  viewCount?: number
  createdBy?: number | null
  updatedBy?: number | null
  createdAt: string
  updatedAt: string

  // resolved by ?lang= (single-language response)
  title?: string
  summary?: string | null
  content?: string

  // admin detail may include both languages
  translations?: {
    vi?: NewsTranslation
    en?: NewsTranslation
  }

  // legacy snake_case
  thumbnail_url?: string | null
  author_name?: string | null
  is_published?: boolean
  is_featured?: boolean
  published_at?: string | null
  tags?: string[]
  view_count?: number
  created_by?: number | null
  updated_by?: number | null
  created_at?: string
  updated_at?: string
}

/** Wrapper returned by GET /news/:slug or /admin/news/:newsId */
export interface NewsData {
  news: News
}

export interface NewsListData {
  news: News[]
  pagination: import('./index').Pagination
}

export interface NewsListParams {
  page?: number
  limit?: number
  status?: NewsStatus
  q?: string
  sortBy?: 'published_at' | 'created_at' | 'updated_at'
  sortOrder?: 'ASC' | 'DESC'

  // legacy
  is_active?: boolean
  is_featured?: boolean
}

export interface CreateNewsBody {
  title: string
  summary?: string
  content: string
  status?: NewsStatus
  slug?: string
  publishedAt?: string
  cover?: File
}

export interface PatchNewsStatusBody {
  status: NewsStatus
  expectedUpdatedAt: string
}

export interface UpdateNewsBody {
  status: NewsStatus
  expectedUpdatedAt: string
  translations: {
    vi?: NewsTranslation
    en?: NewsTranslation
  }
}

/** Kept for legacy dialog code that builds FormData */
export interface NewsFormData {
  title: string
  content: string
  slug?: string
  summary?: string
  thumbnail_url?: File
  is_published?: boolean
  is_featured?: boolean
  tags?: string[]
  published_at?: string
}
