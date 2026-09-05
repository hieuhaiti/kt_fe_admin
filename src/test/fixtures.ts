import type { User } from '@/types/api'

export const auditTestUser: User = {
  id: 'audit-user-1',
  email: 'audit.user@example.test',
  fullName: 'Nguyễn Văn Audit',
  phone: '0260123456',
  roleCode: 'so_nnmt',
  isActive: true,
}

export const auditListResponse = {
  message: 'OK',
  status: 200,
  data: {
    users: [auditTestUser],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
  },
}
