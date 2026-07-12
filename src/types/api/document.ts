export type DocumentType = 'bao_cao' | string
export type DocumentStatus = 'active' | 'archived' | 'revoked' | 'replaced'

export interface DocumentTranslation {
  title: string
  description?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Document {
  id: number | string
  docType: DocumentType
  fileUrl?: string
  fileName?: string | null
  mimeType?: string | null
  fileSize?: number | string | null
  fileType?: string | null
  isPublic?: boolean
  uploadedBy?: number | string | null
  uploadedByName?: string | null
  viewCount?: number
  downloadCount?: number
  publishedAt?: string | null
  createdBy?: number | null
  updatedBy?: number | null
  createdAt?: string
  updatedAt?: string

  // resolved by ?lang=
  title?: string
  description?: string | null

  // admin detail includes vi+en
  translations?: {
    vi?: DocumentTranslation
    en?: DocumentTranslation
  }

  // legacy snake_case
  document_number?: string
  document_type?: DocumentType
  file_url?: string
  file_name?: string
  file_size?: number | string
  mime_type?: string | null
  file_type?: string
  issued_date?: string
  effective_date?: string
  expiry_date?: string
  issuer?: string
  signer?: string
  status?: DocumentStatus
  view_count?: number
  download_count?: number
  is_public?: boolean
  tags?: string[]
  metadata?: Record<string, any>
  created_by?: number
  updated_by?: number
  created_at?: string
  updated_at?: string
}

export interface DocumentListData {
  documents: Document[]
  pagination: import('./index').Pagination
}

export interface DocumentListParams {
  page?: number
  limit?: number
  /** Server accepts docType ∈ 'bao_cao' | 'van_ban' | 'pdf_map' */
  docType?: DocumentType
  /** Server filter: only public / only private */
  isPublic?: boolean
  /** Server full-text search field (title/description) */
  q?: string
  /** Server sortBy ∈ id | created_at | updated_at | title | doc_type */
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'

  // Legacy aliases kept for callers not yet migrated
  status?: DocumentStatus
  document_type?: DocumentType
  is_public?: boolean
  search?: string
}

/** Kept for legacy dialog code */
export interface DocumentFormData {
  document_number: string
  title: string
  description?: string
  file_url?: File
  document_type: DocumentType
  is_public?: boolean
  issued_date?: string
  effective_date?: string
  expiry_date?: string
  issuer?: string
  signer?: string
  status?: DocumentStatus
}

export interface PatchDocumentBody {
  isPublic?: boolean
  docType?: DocumentType
  expectedUpdatedAt: string
}

export interface UpdateDocumentBody {
  docType: DocumentType
  isPublic?: boolean
  expectedUpdatedAt: string
  translations: {
    vi?: DocumentTranslation
    en?: DocumentTranslation
  }
}
