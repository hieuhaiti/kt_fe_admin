import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authService } from '@/service'
import { useAuthStore } from '@/stores/common/useAuthStore'

export function UserMenu() {
  const user = useAuthStore((s) => s.user)
  const storeLogout = useAuthStore((s) => s.logout)
  const displayName = user?.full_name?.trim() || user?.username || user?.email || user?.phone || ''
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await authService.logout()
      storeLogout()
      navigate('/login', { replace: true })
    } catch {
      // API call failed – still clear tokens and redirect for security
      storeLogout()
      navigate('/login', { replace: true })
    }
  }

  if (!displayName) return null

  return (
    <div>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-muted h-8 max-w-60 px-2 text-sm"
            onClick={() => setOpen((v) => !v)}
          >
            {displayName}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Tài khoản</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/profile')}>
            <User className="mr-2 h-4 w-4" />
            Cập nhật thông tin
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/change-password')}>
            <KeyRound className="mr-2 h-4 w-4" />
            Đổi mật khẩu
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default UserMenu
