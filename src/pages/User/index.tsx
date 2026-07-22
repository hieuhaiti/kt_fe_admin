import type { JSX } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useApiQuery, useApiMutation, userService, authService } from '@/service'
import type {
  ApiResponse,
  AuthMeData,
  Pagination,
  User,
  UserListData,
  UserRoleCode,
} from '@/types/api'
import { useQueryClient } from '@tanstack/react-query'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { KeyRound, Pen, Power, ShieldCheck, Trash2 } from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import { toast } from 'react-toastify'
import UserDetailDialog from './UserDetailDialog'
import UserFormDialog from './UserFormDialog'

const ROLE_OPTIONS: { value: UserRoleCode; label: string }[] = [
  { value: 'system_admin', label: 'Quản trị hệ thống' },
  { value: 'so_nnmt', label: 'Sở NN&MT' },
  { value: 'ubnd_tinh', label: 'UBND tỉnh' },
  { value: 'citizen', label: 'Người dân' },
]

function roleCodeOf(user: User | any) {
  const role = user?.role
  if (typeof role === 'string') return role
  return user?.roleCode ?? role?.code ?? user?.role_name ?? null
}

function roleLabel(code?: string | null, fallback?: string | null) {
  if (!code) return fallback || '-'
  const found = ROLE_OPTIONS.find((r) => r.value === code)
  return fallback || found?.label || code
}

export default function User(): JSX.Element {
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [searchValue, setSearchValue] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const queryParams = {
    page: currentPage,
    limit,
    sortBy: 'id',
    sortOrder: 'ASC' as const,
    ...(searchValue && { q: searchValue }),
    ...(roleFilter !== 'all' && { roleCode: roleFilter }),
    ...(activeFilter !== 'all' && { isActive: activeFilter === 'active' }),
  }

  const dbQuery = useApiQuery(
    ['users', queryParams],
    () => userService.getAll(queryParams),
    {},
    false,
    false
  )

  const raw = dbQuery.data as ApiResponse<UserListData> | undefined
  const data = raw?.data
  const users = data?.users ?? data?.items ?? []
  const pagination = (raw?.metadata ?? data?.pagination ?? {}) as Partial<Pagination>
  const lastTotalPagesRef = useRef<number | null>(null)
  if (pagination?.totalPages) lastTotalPagesRef.current = pagination.totalPages
  const totalPages = pagination?.totalPages ?? lastTotalPagesRef.current ?? 1
  const total = pagination?.total ?? 0

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  // Dialog states
  const [selectedUserId, setSelectedUserId] = useState<number | string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<any | null>(null)
  const [activeDialogOpen, setActiveDialogOpen] = useState(false)
  const [userToToggle, setUserToToggle] = useState<any | null>(null)
  const [resetPwdDialogOpen, setResetPwdDialogOpen] = useState(false)
  const [userToResetPwd, setUserToResetPwd] = useState<any | null>(null)
  const [newPasswordValue, setNewPasswordValue] = useState('')
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [userToChangeRole, setUserToChangeRole] = useState<any | null>(null)
  const [newRoleValue, setNewRoleValue] = useState<UserRoleCode>('citizen')

  // Get current user
  const currentUserQuery = useApiQuery(
    ['currentUser'],
    () => authService.getProfile(),
    {},
    false,
    false
  )
  const currentUser = (currentUserQuery.data as ApiResponse<AuthMeData>)?.data?.user ?? null

  const queryClient = useQueryClient()

  // Create mutation
  const createMutation = useApiMutation(
    (data: any) => userService.create(data),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setFormDialogOpen(false)
        setSelectedUserId(null)
      },
    },
    true
  )

  // Toggle active mutation
  const activeMutation = useApiMutation(
    (data: { id: number | string; isActive: boolean }) =>
      userService.updateActive(data.id, { isActive: data.isActive }),
    {
      onSuccess: (data, variables) => {
        const vars = variables as { id: number | string; isActive: boolean }
        const updatedUser = (data as ApiResponse)?.data?.user
        if (updatedUser) {
          queryClient.setQueryData(['user', vars.id], { data: { user: updatedUser } })
        }
        dbQuery.refetch()
        setActiveDialogOpen(false)
        setUserToToggle(null)
      },
    },
    true
  )

  // Reset password mutation
  const resetPasswordMutation = useApiMutation(
    (data: { id: number | string; newPassword: string }) =>
      userService.resetPassword(data.id, { newPassword: data.newPassword }),
    {
      onSuccess: () => {
        setResetPwdDialogOpen(false)
        setUserToResetPwd(null)
        setNewPasswordValue('')
      },
    },
    true
  )

  // Change role mutation
  const roleMutation = useApiMutation(
    (data: { id: number | string; roleCode: UserRoleCode }) =>
      userService.updateRole(data.id, { roleCode: data.roleCode }),
    {
      onSuccess: (data, variables) => {
        const vars = variables as { id: number | string; roleCode: UserRoleCode }
        const updatedUser = (data as ApiResponse)?.data?.user
        if (updatedUser) {
          queryClient.setQueryData(['user', vars.id], { data: { user: updatedUser } })
        }
        dbQuery.refetch()
        setRoleDialogOpen(false)
        setUserToChangeRole(null)
      },
    },
    true
  )

  // Delete mutation
  const deleteMutation = useApiMutation((id: number | string) => userService.delete(id), {
    onSuccess: () => {
      dbQuery.refetch()
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    },
  })

  function openDetails(u: any) {
    if (u?.id) {
      setSelectedUserId(u.id)
      setDetailDialogOpen(true)
    }
  }

  function openAddDialog() {
    setSelectedUserId(null)
    setFormDialogOpen(true)
  }

  function openEditDialog(u: any) {
    setSelectedUserId(u.id)
    setFormDialogOpen(true)
  }

  function openActiveDialog(u: any) {
    if (currentUser && String(u.id) === String(currentUser.id)) {
      toast.warning('Bạn không thể thay đổi trạng thái của tài khoản mình')
      return
    }
    setUserToToggle(u)
    setActiveDialogOpen(true)
  }

  function openResetPasswordDialog(u: any) {
    if (currentUser && String(u.id) === String(currentUser.id)) {
      toast.warning('Vui lòng dùng chức năng Đổi mật khẩu cho tài khoản của mình')
      return
    }
    setUserToResetPwd(u)
    setNewPasswordValue('')
    setResetPwdDialogOpen(true)
  }

  function openChangeRoleDialog(u: any) {
    if (currentUser && String(u.id) === String(currentUser.id)) {
      toast.warning('Bạn không thể tự đổi vai trò của mình')
      return
    }
    setUserToChangeRole(u)
    const currentRole = roleCodeOf(u) ?? 'citizen'
    setNewRoleValue(currentRole as UserRoleCode)
    setRoleDialogOpen(true)
  }

  function openDeleteDialog(u: any) {
    if (currentUser && String(u.id) === String(currentUser.id)) {
      toast.warning('Bạn không thể xóa tài khoản của bạn')
      return
    }
    setUserToDelete(u)
    setDeleteDialogOpen(true)
  }

  function handleFormSubmit(data: any) {
    if (selectedUserId) {
      // In new API: no unified update endpoint. Nothing to submit from the form.
      toast.info('Vui lòng dùng các thao tác Vai trò / Kích hoạt / Đặt lại mật khẩu để cập nhật')
      return
    }
    createMutation.mutate(data)
  }

  function handleToggleActive() {
    if (!userToToggle) return
    const nextValue = !(userToToggle.isActive ?? userToToggle.is_active ?? true)
    activeMutation.mutate({ id: userToToggle.id, isActive: nextValue })
  }

  function handleResetPassword() {
    if (userToResetPwd && newPasswordValue.trim().length >= 6) {
      resetPasswordMutation.mutate({ id: userToResetPwd.id, newPassword: newPasswordValue })
    }
  }

  function handleChangeRole() {
    if (userToChangeRole && newRoleValue) {
      roleMutation.mutate({ id: userToChangeRole.id, roleCode: newRoleValue })
    }
  }

  function handleDelete() {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id)
    }
  }

  return (
    <PageLayout title="Người dùng" description="Quản lý người dùng hệ thống">
      <ToolTableCustom
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        filter={
          <div className="flex items-center gap-2">
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setRoleFilter(v)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả vai trò</SelectItem>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={activeFilter}
              onValueChange={(v) => {
                setActiveFilter(v)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="active">Đang hoạt động</SelectItem>
                <SelectItem value="inactive">Đã vô hiệu</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={`${limit}`}
              onValueChange={(v) => {
                setLimit(parseInt(v, 10))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="default" onClick={openAddDialog}>
              Thêm người dùng
            </Button>
          </div>
        }
        total={total}
        pagination={{
          currentPage: currentPage,
          totalPages,
          onPageChange: (page: number) => setCurrentPage(page),
        }}
      >
        <Table className="relative">
          <TableHeader className="sticky top-0 z-20">
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Họ và tên</TableHead>
              <TableHead>Điện thoại</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              users.map((u: any) => {
                const isActive = u.isActive ?? u.is_active ?? true
                const roleCode = roleCodeOf(u)
                const roleName = u.role_name_vi ?? u.role?.name ?? u.role_name
                return (
                  <TableRow
                    className="hover:cursor-pointer"
                    key={u.id}
                    onClick={() => openDetails(u)}
                  >
                    <TableCell>{u.id}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.fullName || u.full_name || '-'}</TableCell>
                    <TableCell>{u.phone || '-'}</TableCell>
                    <TableCell>{roleLabel(roleCode, roleName)}</TableCell>
                    <TableCell>
                      {isActive ? (
                        <Badge variant="default">Hoạt động</Badge>
                      ) : (
                        <Badge variant="secondary">Vô hiệu</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditDialog(u)
                          }}
                          title="Chỉnh sửa"
                        >
                          <Pen className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openChangeRoleDialog(u)
                          }}
                          title="Đổi vai trò"
                        >
                          <ShieldCheck className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openResetPasswordDialog(u)
                          }}
                          title="Đặt lại mật khẩu"
                        >
                          <KeyRound className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openActiveDialog(u)
                          }}
                          title={isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                        >
                          <Power
                            className={
                              isActive ? 'text-success size-4' : 'text-muted-foreground size-4'
                            }
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeleteDialog(u)
                          }}
                          title="Xóa"
                        >
                          <Trash2 className="text-destructive size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </ToolTableCustom>

      {/* Dialog chi tiết */}
      <UserDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        userId={selectedUserId}
      />

      {/* Dialog thêm/sửa (chỉ tạo mới hoặc xem-cấu-hình) */}
      <UserFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        userId={selectedUserId}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending}
      />

      {/* Dialog xác nhận đổi trạng thái kích hoạt */}
      <AlertDialog open={activeDialogOpen} onOpenChange={setActiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userToToggle && (userToToggle.isActive ?? userToToggle.is_active ?? true)
                ? 'Vô hiệu hóa tài khoản'
                : 'Kích hoạt tài khoản'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn{' '}
              {userToToggle && (userToToggle.isActive ?? userToToggle.is_active ?? true)
                ? 'vô hiệu hóa'
                : 'kích hoạt'}{' '}
              tài khoản &quot;
              {userToToggle?.fullName || userToToggle?.full_name || userToToggle?.email}
              &quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={activeMutation.isPending}>
              {activeMutation.isPending ? 'Đang cập nhật...' : 'Xác nhận'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog đặt lại mật khẩu */}
      <AlertDialog open={resetPwdDialogOpen} onOpenChange={setResetPwdDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đặt lại mật khẩu</AlertDialogTitle>
            <AlertDialogDescription>
              Đặt mật khẩu mới cho tài khoản &quot;
              {userToResetPwd?.fullName || userToResetPwd?.full_name || userToResetPwd?.email}
              &quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Input
              type="password"
              placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
              value={newPasswordValue}
              onChange={(e) => setNewPasswordValue(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPassword}
              disabled={newPasswordValue.trim().length < 6 || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? 'Đang cập nhật...' : 'Xác nhận'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog đổi vai trò */}
      <AlertDialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đổi vai trò</AlertDialogTitle>
            <AlertDialogDescription>
              Chọn vai trò mới cho tài khoản &quot;
              {userToChangeRole?.fullName || userToChangeRole?.full_name || userToChangeRole?.email}
              &quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={newRoleValue} onValueChange={(v) => setNewRoleValue(v as UserRoleCode)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleChangeRole} disabled={roleMutation.isPending}>
              {roleMutation.isPending ? 'Đang cập nhật...' : 'Xác nhận'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog xác nhận xóa */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa người dùng &quot;
              {userToDelete?.fullName || userToDelete?.full_name || userToDelete?.email}
              &quot;? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
