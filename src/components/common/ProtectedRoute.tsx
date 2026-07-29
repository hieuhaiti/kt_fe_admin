import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { toast } from 'react-toastify'
import { checkPermission, hasRole, type PermissionCheck, type Role } from '@/lib/permissions'

interface ProtectedRouteProps {
  /** Optional list of role codes allowed to access this route */
  roles?: Role[]
  /** Server RBAC check: `{ resource, action }` — action là string hoặc mảng (OR). */
  permission?: PermissionCheck
}

/**
 * Wraps routes that require authentication.
 * Redirects to /login if not authenticated, /403 if role/permission fails.
 */
export function ProtectedRoute({ roles, permission }: ProtectedRouteProps = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const loggedOut = useAuthStore((s) => s.loggedOut)
  const user = useAuthStore((s) => s.user)

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    if (!loggedOut) {
      toast.error('Bạn cần đăng nhập để truy cập trang này.', { autoClose: 3000 })
    }
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/403" replace />
  }

  if (roles && !hasRole(user, roles)) {
    return <Navigate to="/403" replace />
  }

  if (permission && !checkPermission(user, permission)) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
