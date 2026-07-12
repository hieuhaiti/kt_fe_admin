export type PdfMapTheme = 'lop_phu_nhiet' | 'chay_rung' | 'lop_phu_rung' | 'khac' | string

export interface PdfMapTranslation {
  title: string
  description?: string | null
}

export interface PdfMap {
  id: number
  themeCode: PdfMapTheme
  year?: number | null
  scale?: string | null
  region?: string | null
  fileUrl?: string
  thumbnailUrl?: string | null
  isPublic?: boolean
  fileSize?: number | null
  createdBy?: number | null
  updatedBy?: number | null
  createdAt?: string
  updatedAt?: string

  // resolved by ?lang=
  title?: string
  description?: string | null

  // admin detail may include both languages
  translations?: {
    vi?: PdfMapTranslation
    en?: PdfMapTranslation
  }

  // legacy snake_case (kept for legacy code)
  name?: string
  image_url?: string | null
  is_active?: boolean
  created_by?: number
  created_at?: string
  updated_at?: string
}

/** Alias so existing pages/dialogs typed against `MapImage` keep compiling. */
export type MapImage = PdfMap

export interface PdfMapListData {
  pdfMaps: PdfMap[]
  pagination: import('./index').Pagination
}

/** Legacy alias */
export interface MapImageListData {
  mapImages: MapImage[]
  pagination: import('./index').Pagination
}

export interface PdfMapListParams {
  page?: number
  limit?: number
  theme?: PdfMapTheme
  isPublic?: boolean
  yearFrom?: number
  yearTo?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  q?: string

  // legacy
  is_active?: boolean
  search?: string
}

export type MapImageListParams = PdfMapListParams

/** Kept for legacy multipart-based dialogs */
export interface MapImageFormData {
  name: string
  description?: string
  image_url?: File
  is_active?: boolean
}

export interface UpdatePdfMapBody {
  themeCode?: PdfMapTheme
  year?: number
  scale?: string
  region?: string
  thumbnailUrl?: string
  isPublic?: boolean
  expectedUpdatedAt: string
  translations?: {
    vi?: PdfMapTranslation
    en?: PdfMapTranslation
  }
}
