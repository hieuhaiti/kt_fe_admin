import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { toast } from 'react-toastify'
import { can, hasRole, type Role } from '@/lib/permissions'

interface ProtectedRouteProps {
  /** Optional list of role codes allowed to access this route */
  roles?: Role[]
  /** Optional permission key from lib/permissions#MODULE_PERMISSIONS */
  permission?: string
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

  if (permission && !can(user, permission)) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
