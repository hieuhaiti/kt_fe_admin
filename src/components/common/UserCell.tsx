import { useApiQuery, userService } from '@/service'
import type { ApiResponse, CitizenFeedback, User } from '@/types/api'

/** Hiện 1 dòng thông tin user theo độ ưu tiên: full_name > username > email > phone > id */
export function displayUser(u: User): string {
  return u.full_name || u.username || u.email || u.phone || String(u.id)
}

interface UserCellProps {
  userId?: number | string | null
  inlineUser?: CitizenFeedback['user'] | string | null
}

/**
 * Nếu đã có inlineUser (từ feedback.user) thì dùng luôn,
 * ngược lại fetch dựa vào userId.
 */
export function UserCell({ userId, inlineUser }: UserCellProps) {
  const q = useApiQuery(
    ['user', userId],
    () => userService.getById(userId!),
    { enabled: !!userId, staleTime: 5 * 60 * 1000 },
    false,
    false
  )

  // 1. userId fetch thành công → hiển thị user
  const _d = (q.data as ApiResponse<any>)?.data
  const fetched: User | undefined = _d ? ((_d.user ?? _d) as User) : undefined
  if (userId) {
    if (q.isLoading) return <span className="text-muted-foreground text-xs">...</span>
    if (fetched) {
      return (
        <div>
          <p className="text-sm font-medium">{displayUser(fetched)}</p>
          {fetched.username && fetched.full_name && (
            <p className="text-muted-foreground text-xs">@{fetched.username}</p>
          )}
        </div>
      )
    }
  }

  // 2. Fallback: inlineUser object
  if (inlineUser && typeof inlineUser !== 'string') {
    const display =
      inlineUser.full_name ||
      inlineUser.username ||
      inlineUser.email_registered ||
      String(inlineUser.id)
    return (
      <div>
        <p className="text-sm font-medium">{display}</p>
        {inlineUser.username && inlineUser.full_name && (
          <p className="text-muted-foreground text-xs">@{inlineUser.username}</p>
        )}
      </div>
    )
  }

  // 3. Fallback: inlineUser string
  if (typeof inlineUser === 'string' && inlineUser) {
    return (
      <div>
        <p className="text-sm font-medium">{inlineUser}</p>
      </div>
    )
  }

  return <span className="text-muted-foreground text-sm">Ẩn danh</span>
}
