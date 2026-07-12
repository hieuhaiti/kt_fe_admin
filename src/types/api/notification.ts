export type NotificationChannel = 'system' | 'fire' | string
export type NotificationType = 'announcement' | 'fire_warning' | string
export type NotificationPlatform = 'web' | 'android' | 'ios'
export type NotificationTarget = 'user' | 'all' | 'role'

export interface Notification {
  id: number
  userId?: number | null
  channel?: NotificationChannel
  type: NotificationType
  title?: string | null
  body?: string | null
  data?: Record<string, any> | null
  isRead?: boolean
  readAt?: string | null
  createdAt?: string

  // legacy snake_case fallbacks
  user_id?: number | null
  message?: string | null
  payload?: Record<string, any> | null
  is_read?: boolean
  read_at?: string | null
  created_at?: string
}

export interface NotificationListData {
  notifications: Notification[]
  pagination: import('./index').Pagination
  unreadCount?: number
  unread_count?: number
}

export interface NotificationListParams {
  page?: number
  limit?: number
  onlyUnread?: boolean
  isRead?: boolean

  // legacy
  unread_only?: boolean
  user_id?: number
}

export interface RegisterDeviceBody {
  token: string
  platform: NotificationPlatform
  deviceInfo?: { model?: string; os?: string; [key: string]: any }
}

export interface UnregisterDeviceBody {
  token: string
}

export type SendNotificationBody =
  | {
      target: 'user'
      userId: number
      channel: NotificationChannel
      type: NotificationType
      title: string
      body: string
      data?: Record<string, any>
    }
  | {
      target: 'all'
      channel: NotificationChannel
      type: NotificationType
      title: string
      body: string
      data?: Record<string, any>
    }
  | {
      target: 'role'
      roleCode: string
      channel: NotificationChannel
      type: NotificationType
      title: string
      body: string
      data?: Record<string, any>
    }
