import apiClient from './common/apiClient'
import { normalizeList } from './common/normalize'
import type {
  ApiResponse,
  User,
  UserListData,
  UserListParams,
  CreateUserBody,
  UpdateUserRoleBody,
  UpdateUserActiveBody,
  ResetUserPasswordBody,
} from '@/types/api'
import { serviceAdminUserPath } from '@/constant/serviceConstant'

export default {
  /** GET /admin/users */
  getAll: (params?: UserListParams) =>
    apiClient
      .get<UserListData>(serviceAdminUserPath, { params })
      .then((res) => normalizeList<User>(res, 'users') as ApiResponse<UserListData>),

  /** GET /admin/users/:userId */
  getById: (userId: number | string) =>
    apiClient.get<User>(`${serviceAdminUserPath}/${userId}`),

  /** POST /admin/users */
  create: (data: CreateUserBody) => apiClient.post<User>(serviceAdminUserPath, data),

  /** PATCH /admin/users/:userId/role */
  updateRole: (userId: number | string, data: UpdateUserRoleBody) =>
    apiClient.patch<User>(`${serviceAdminUserPath}/${userId}/role`, data),

  /** PATCH /admin/users/:userId/active */
  updateActive: (userId: number | string, data: UpdateUserActiveBody) =>
    apiClient.patch<User>(`${serviceAdminUserPath}/${userId}/active`, data),

  /** POST /admin/users/:userId/reset-password */
  resetPassword: (userId: number | string, data: ResetUserPasswordBody) =>
    apiClient.post<ApiResponse<{}>>(`${serviceAdminUserPath}/${userId}/reset-password`, data),

  /** DELETE /admin/users/:userId */
  delete: (userId: number | string) =>
    apiClient.del<ApiResponse<{}>>(`${serviceAdminUserPath}/${userId}`),
}
