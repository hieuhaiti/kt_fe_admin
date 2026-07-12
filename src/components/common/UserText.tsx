import { useApiQuery, userService } from '@/service'
import type { ApiResponse, CitizenFeedback, User } from '@/types/api'

interface UserTextProps {
  /** User ID to fetch */
  userId?: number | string | null
  /** Inline user object or display string as fallback */
  inlineUser?: CitizenFeedback['user'] | string | null
  /** Fallback text when all sources are null/undefined */
  fallback?: string
}

/**
 * Renders a single line of user info.
 * Priority: userId (fetch) → inlineUser object → inlineUser string → fallback
 */
export function UserText({ userId, inlineUser, fallback = '-' }: UserTextProps) {
  const q = useApiQuery(
    ['user', userId],
    () => userService.getById(userId!),
    { enabled: !!userId, staleTime: 5 * 60 * 1000 },
    false,
    false
  )

  // 1. userId fetch
  if (userId) {
    if (q.isLoading) return <span className="text-muted-foreground text-xs">...</span>
    const _d = (q.data as ApiResponse<any>)?.data
    const user: User | undefined = _d ? ((_d.user ?? _d) as User) : undefined
    if (user) {
      const display = user.full_name || user.username || user.email || user.phone || String(user.id)
      return (
        <span>
          {display}
          {user.username && user.full_name && (
            <span className="text-muted-foreground ml-1 text-xs">(@{user.username})</span>
          )}
        </span>
      )
    }
  }

  // 2. inlineUser object
  if (inlineUser && typeof inlineUser !== 'string') {
    const display =
      inlineUser.full_name ||
      inlineUser.username ||
      inlineUser.email_registered ||
      String(inlineUser.id)
    return (
      <span>
        {display}
        {inlineUser.username && inlineUser.full_name && (
          <span className="text-muted-foreground ml-1 text-xs">(@{inlineUser.username})</span>
        )}
      </span>
    )
  }

  // 3. inlineUser string
  if (typeof inlineUser === 'string' && inlineUser) {
    return <span>{inlineUser}</span>
  }

  return <span>{fallback}</span>
}
