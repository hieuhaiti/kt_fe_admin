import type { User } from '@/types/api'
import { hasPerm } from '@/lib/permissions'

export type MapLayerApiPermissionAction = 'create' | 'update' | 'delete'

// Delegate về hasPerm — server-authoritative. Trước đây file này hardcode
// `so_nnmt` được create/update, không khớp seed backend (map_apis chỉ mở cho
// system_admin trong migration 016). Bỏ hardcode để tránh drift; nếu cần mở
// thêm role thì cập nhật permissions JSONB trong DB, không sửa client.
export function hasMapLayerApiPermission(
  user: User | null,
  action: MapLayerApiPermissionAction
) {
  return hasPerm(user, 'map_apis', action)
}
