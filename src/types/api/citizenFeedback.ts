export type FeedbackCategory = 'chay_rung' | 'vi_pham' | 'hien_trang'
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'rejected'
export type FeedbackPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface FeedbackAttachment {
  id: number | string
  fileName?: string
  filePath?: string
  fileUrl?: string
  mimeType?: string
  fileSize?: number | null
  uploadedAt?: string

  // legacy snake_case
  file_name?: string
  file_path?: string
  file_url?: string
  mime_type?: string
  file_size?: number | null
  uploaded_at?: string
}

export interface FeedbackStatusLog {
  id: number | string
  fromStatus?: FeedbackStatus | null
  toStatus: FeedbackStatus
  note?: string | null
  changedBy?: number | string | null
  changedByName?: string | null
  changedAt?: string
  createdAt?: string
}

export interface CitizenFeedback {
  id: number | string
  userId?: number | string | null
  anonymousId?: string | null
  clientUuid?: string | null
  category?: FeedbackCategory
  title: string
  description?: string | null
  content?: string
  priority: FeedbackPriority
  status: FeedbackStatus
  lng?: number | null
  lat?: number | null
  mediaUrls?: string[]
  media?: FeedbackAttachment[]
  attachments?: FeedbackAttachment[]
  statusLogs?: FeedbackStatusLog[]
  userName?: string | null
  createdBy?: number | string | null
  createdByName?: string | null
  updatedBy?: number | string | null
  updatedByName?: string | null
  resolvedAt?: string | null
  createdAt?: string
  updatedAt?: string

  // legacy
  user_id?: number
  location_coordinates?: string | null
  location_text?: string | null
  is_location_verified?: boolean
  location_verified_at?: string | null
  location_verified_by?: number | null
  admin_response?: string
  responded_by?: number
  responded_at?: string
  resolution_note?: string
  resolved_at?: string
  forest_loss_area_estimate_m2?: number
  ip_address?: string
  created_at?: string
  updated_at?: string
  user?: {
    id: number
    username?: string
    full_name?: string
    fullName?: string
    email_registered?: string
    email?: string
    avatar_url?: string
    avatarUrl?: string
  }
  responder?: {
    id: number
    full_name?: string
    fullName?: string
  }
}

export interface CitizenFeedbackListData {
  items: CitizenFeedback[]
}

export interface FeedbackStatistics {
  total: number
  byStatus?: Record<FeedbackStatus, number>
  byCategory?: Record<FeedbackCategory, number>
  byPriority?: Record<FeedbackPriority, number>

  // legacy
  by_status?: Record<FeedbackStatus, number>
  by_priority?: Record<FeedbackPriority, number>
  resolved_avg_hours?: number
}

export interface UpdateFeedbackStatusBody {
  toStatus: FeedbackStatus
  note?: string

  // legacy
  status?: FeedbackStatus
  admin_response?: string
  resolution_note?: string
  is_location_verified?: boolean
}

export interface FeedbackListParams {
  page?: number
  limit?: number
  status?: FeedbackStatus
  category?: FeedbackCategory
  priority?: FeedbackPriority
  q?: string
  from?: string
  to?: string
  bbox?: string

  // legacy
  user_id?: number
  start_date?: string
  end_date?: string
}

export interface FeedbackFeatureCollection {
  type: 'FeatureCollection'
  features: Array<
    GeoJSON.Feature<
      GeoJSON.Point,
      {
        id: number | string
        category: FeedbackCategory
        title: string
        status: FeedbackStatus
        priority: FeedbackPriority
        createdAt?: string
      }
    >
  >
}
