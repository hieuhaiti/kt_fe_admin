import apiClient from './common/apiClient'
import type {
  FieldUpdateBody,
  FieldUpdateResult,
  MobileSyncParams,
  MobileSyncData,
} from '@/types/api'
import { serviceMobilePath } from '@/constant/serviceConstant'

/**
 * Mobile field updates (Postman "Mobile Field Updates" module).
 * Roles: `so_nnmt` or `system_admin`.
 */
export default {
  /** POST /mobile/field-updates */
  submitFieldUpdate: (data: FieldUpdateBody) =>
    apiClient.post<FieldUpdateResult>(`${serviceMobilePath}/field-updates`, data),

  /** GET /mobile/sync?since= */
  sync: (params?: MobileSyncParams) =>
    apiClient.get<MobileSyncData>(`${serviceMobilePath}/sync`, { params }),
}
