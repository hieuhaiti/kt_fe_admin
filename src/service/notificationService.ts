import apiClient from './common/apiClient'
import type {
  Notification,
  NotificationListData,
  NotificationListParams,
  RegisterDeviceBody,
  UnregisterDeviceBody,
  SendNotificationBody,
} from '@/types/api'
import {
  serviceNotificationPath,
  serviceNotificationDevicesPath,
} from '@/constant/serviceConstant'

export default {
  /** GET /notifications */
  getAll: (params?: NotificationListParams) =>
    apiClient.get<NotificationListData>(serviceNotificationPath, { params }),

  /** Legacy alias - same as getAll */
  getMy: (params?: NotificationListParams) =>
    apiClient.get<NotificationListData>(serviceNotificationPath, { params }),

  /** GET /notifications/unread-count */
  getUnreadCount: () =>
    apiClient.get<{ unread: number }>(`${serviceNotificationPath}/unread-count`),

  /** PATCH /notifications/read-all */
  markAllAsRead: () =>
    apiClient.patch<{ updatedCount: number }>(`${serviceNotificationPath}/read-all`),

  /** PATCH /notifications/:notificationId/read */
  markAsRead: (notificationId: number | string) =>
    apiClient.patch<Notification>(`${serviceNotificationPath}/${notificationId}/read`),

  /** DELETE /notifications/:notificationId */
  delete: (notificationId: number | string) =>
    apiClient.del<Record<string, never>>(`${serviceNotificationPath}/${notificationId}`),

  /** POST /notifications/devices  (FCM device registration) */
  registerDevice: (data: RegisterDeviceBody) =>
    apiClient.post<Record<string, never>>(serviceNotificationDevicesPath, data),

  /** DELETE /notifications/devices */
  unregisterDevice: (data: UnregisterDeviceBody) =>
    apiClient.del<Record<string, never>>(serviceNotificationDevicesPath, data),

  /** POST /notifications/send (admin/so_nnmt) */
  send: (data: SendNotificationBody) =>
    apiClient.post<{ id: number }>(`${serviceNotificationPath}/send`, data),
}
