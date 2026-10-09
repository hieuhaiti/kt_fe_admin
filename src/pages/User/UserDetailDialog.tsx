import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { userService, useApiQuery } from '@/service'
import type { ApiResponse, User } from '@/types/api'
import { parseLink } from '@/lib/utils'
import { formatDateTime } from '@/lib/date'

const ROLE_LABELS: Record<string, string> = {
  system_admin: 'Quản trị hệ thống',
  so_nnmt: 'Sở NN&MT',
  ubnd_tinh: 'UBND tỉnh',
  citizen: 'Người dân',
}

interface UserDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number | string | null
}

function getUserDetail(response?: ApiResponse<User | { user?: User }>) {
  const data = response?.data
  if (!data) return null
  if ('user' in data && data.user) return data.user
  return data as User
}

function roleCodeOf(user?: User | null) {
  const role = user?.role
  if (typeof role === 'string') return role
  return user?.roleCode ?? role?.code ?? user?.role_name ?? null
}

function roleLabel(user?: User | null) {
  const code = roleCodeOf(user)
  return (
    user?.role_name_vi ?? (code ? ROLE_LABELS[code] : undefined) ?? user?.role_name ?? code ?? '-'
  )
}

function PermissionList({ permissions }: { permissions: User['role_permissions'] }) {
  if (!permissions) return null

  return (
    <div className="col-span-2 flex flex-col gap-2">
      {Object.entries(permissions).map(([resource, actions]) => {
        const enabledActions = Array.isArray(actions)
          ? actions
          : Object.entries(actions)
              .filter(([, enabled]) => Boolean(enabled))
              .map(([action]) => action)

        if (enabledActions.length === 0) return null

        return (
          <div key={resource} className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground shrink-0 text-xs font-medium">{resource}:</span>
            {enabledActions.map((action) => (
              <Badge key={action} variant="outline" className="text-xs">
                {action}
              </Badge>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="font-semibold">{label}:</span>
      <div className="col-span-2">{children}</div>
    </div>
  )
}

export default function UserDetailDialog({ open, onOpenChange, userId }: UserDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['user', userId],
    () => userService.getById(userId!),
    { enabled: !!userId && open, staleTime: 0 },
    false,
    false
  )
  const user = getUserDetail(dbQuery.data as ApiResponse<User | { user?: User }> | undefined)

  const fullName = user?.fullName ?? user?.full_name ?? null
  const avatarUrl = user?.avatarUrl ?? user?.avatar_url ?? null
  const addressDetail = user?.addressDetail ?? user?.address_detail ?? null
  const isActive = user?.isActive ?? user?.is_active ?? null
  const isEmailVerified = user?.isEmailVerified ?? user?.email_verified ?? false
  const hasPassword = user?.hasPassword ?? user?.has_password ?? null
  const mustChangePassword = user?.must_change_password ?? null
  const lastLoginAt = user?.lastLoginAt ?? user?.last_login_at ?? user?.last_login ?? null
  const createdAt = user?.createdAt ?? user?.created_at ?? null
  const updatedAt = user?.updatedAt ?? user?.updated_at ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Chi tiết người dùng</DialogTitle>
        <DialogDescription>Thông tin tài khoản và quyền truy cập.</DialogDescription>

        {dbQuery.isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Đang tải dữ liệu...</div>
        ) : dbQuery.isError ? (
          <div className="text-destructive py-8 text-center">
            Không thể tải thông tin người dùng.
          </div>
        ) : user ? (
          <div className="mt-4 space-y-3">
            <DetailRow label="ID">{user.id}</DetailRow>
            <DetailRow label="Email">{user.email}</DetailRow>
            <DetailRow label="Email đã xác thực">
              {isEmailVerified ? (
                <Badge variant="default">Đã xác thực</Badge>
              ) : (
                <Badge variant="secondary">Chưa xác thực</Badge>
              )}
            </DetailRow>
            {user.email_verified_at && (
              <DetailRow label="Xác thực lúc">{formatDateTime(user.email_verified_at)}</DetailRow>
            )}
            <DetailRow label="Họ và tên">{fullName || '-'}</DetailRow>
            <DetailRow label="Số điện thoại">{user.phone || '-'}</DetailRow>
            <DetailRow label="Địa chỉ">{addressDetail || '-'}</DetailRow>
            <DetailRow label="Ảnh đại diện">
              {avatarUrl ? (
                <img
                  src={parseLink(avatarUrl)}
                  alt={fullName || 'Ảnh đại diện'}
                  className="h-20 w-20 rounded-full border object-cover"
                />
              ) : (
                '-'
              )}
            </DetailRow>
            <DetailRow label="Vai trò">{roleLabel(user)}</DetailRow>
            {user.role_permissions && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Quyền:</span>
                <PermissionList permissions={user.role_permissions} />
              </div>
            )}
            <DetailRow label="Trạng thái hoạt động">
              {isActive ? (
                <Badge variant="default">Đang hoạt động</Badge>
              ) : (
                <Badge variant="secondary">Đã vô hiệu hóa</Badge>
              )}
            </DetailRow>
            <DetailRow label="Cách đăng nhập">{user.provider || '-'}</DetailRow>
            <DetailRow label="Có mật khẩu">
              {hasPassword === true ? (
                <Badge variant="default">Có</Badge>
              ) : hasPassword === false ? (
                <Badge variant="secondary">Chưa đặt mật khẩu</Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </DetailRow>
            {mustChangePassword !== null && (
              <DetailRow label="Yêu cầu đổi mật khẩu">
                {mustChangePassword ? (
                  <Badge variant="destructive">Cần đổi mật khẩu</Badge>
                ) : (
                  <Badge variant="outline">Bình thường</Badge>
                )}
              </DetailRow>
            )}
            {user.password_changed_at && (
              <DetailRow label="Đổi mật khẩu lúc">{formatDateTime(user.password_changed_at)}</DetailRow>
            )}
            <DetailRow label="Đăng nhập lần cuối">{lastLoginAt ? formatDateTime(lastLoginAt) : '-'}</DetailRow>
            {user.last_login_ip && <DetailRow label="IP đăng nhập cuối">{user.last_login_ip}</DetailRow>}
            <DetailRow label="Ngày tạo">{createdAt ? formatDateTime(createdAt) : '-'}</DetailRow>
            <DetailRow label="Cập nhật">{updatedAt ? formatDateTime(updatedAt) : '-'}</DetailRow>
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">Không có dữ liệu</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
