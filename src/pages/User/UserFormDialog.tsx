import { useEffect } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { userService, useApiQuery } from '@/service'
import type { ApiResponse, CreateUserBody, User, UserRoleCode } from '@/types/api'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

const ROLE_OPTIONS: { value: UserRoleCode; label: string }[] = [
  { value: 'system_admin', label: 'Quản trị hệ thống' },
  { value: 'so_nnmt', label: 'Sở NN&MT' },
  { value: 'ubnd_tinh', label: 'UBND tỉnh' },
  { value: 'citizen', label: 'Người dân' },
]

// Đồng bộ Postman: POST /admin/users { email, password, fullName, phone?, roleCode }
const createUserSchema = z.object({
  email: z.string().email('Email không hợp lệ').max(100, 'Email không được quá 100 ký tự'),
  password: z
    .string()
    .min(6, 'Mật khẩu tối thiểu 6 ký tự')
    .max(128, 'Mật khẩu không được quá 128 ký tự'),
  fullName: z
    .string()
    .trim()
    .min(2, 'Họ tên phải có ít nhất 2 ký tự')
    .max(100, 'Họ tên không được quá 100 ký tự'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{8,20}$/, 'Số điện thoại không hợp lệ (8-20 ký tự)')
    .optional()
    .or(z.literal('')),
  roleCode: z.enum(['system_admin', 'so_nnmt', 'ubnd_tinh', 'citizen'] as const),
})

type CreateUserFormData = z.infer<typeof createUserSchema>

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number | string | null
  onSubmit: (data: CreateUserBody) => void
  isLoading?: boolean
}

function roleCodeOf(user?: User | null) {
  const role = user?.role
  if (typeof role === 'string') return role
  return user?.roleCode ?? role?.code ?? user?.role_name ?? null
}

function roleLabelOf(user?: User | null) {
  const code = roleCodeOf(user)
  return (
    user?.role_name_vi ?? ROLE_OPTIONS.find((role) => role.value === code)?.label ?? code ?? '-'
  )
}

export default function UserFormDialog({
  open,
  onOpenChange,
  userId,
  onSubmit,
  isLoading = false,
}: UserFormDialogProps) {
  const dbQuery = useApiQuery(
    ['user', userId],
    () => userService.getById(userId!),
    { enabled: !!userId && open, staleTime: 0 },
    false,
    false
  )
  const user = (() => {
    const d = (dbQuery.data as ApiResponse<any>)?.data
    if (!d) return null
    return (d.user ?? d) as User
  })()
  const isEdit = !!userId

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema) as any,
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      phone: '',
      roleCode: 'citizen',
    },
  })

  useEffect(() => {
    // Reset khi mở lại dialog
    reset({
      email: '',
      password: '',
      fullName: '',
      phone: '',
      roleCode: 'citizen',
    })
  }, [reset, open])

  const handleFormSubmit: SubmitHandler<CreateUserFormData> = (data) => {
    const payload: CreateUserBody = {
      email: data.email.trim(),
      password: data.password,
      fullName: data.fullName.trim(),
      roleCode: data.roleCode,
    }
    if (data.phone?.trim()) payload.phone = data.phone.trim()
    onSubmit(payload)
  }

  // Chế độ chỉnh sửa: API mới không có endpoint update chung.
  // Hiển thị thông tin hiện tại và hướng dẫn dùng các action riêng.
  if (isEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogTitle>Chỉnh sửa người dùng</DialogTitle>
          <DialogDescription>Vui lòng sử dụng các thao tác riêng bên dưới.</DialogDescription>

          <div className="mt-4 space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Email:</span>
              <span className="col-span-2">{user?.email || '-'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Họ tên:</span>
              <span className="col-span-2">{user?.fullName || user?.full_name || '-'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Điện thoại:</span>
              <span className="col-span-2">{user?.phone || '-'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Vai trò:</span>
              <span className="col-span-2">{roleLabelOf(user)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Trạng thái:</span>
              <span className="col-span-2">
                {(user?.isActive ?? user?.is_active) ? 'Hoạt động' : 'Vô hiệu'}
              </span>
            </div>

            <div className="text-muted-foreground mt-4 rounded-md border border-dashed p-3 text-xs leading-6">
              <p className="mb-1 font-medium">Sử dụng các thao tác trên danh sách để:</p>
              <ul className="list-disc pl-5">
                <li>Đổi vai trò (nút khiên)</li>
                <li>Đặt lại mật khẩu (nút chìa khóa)</li>
                <li>Kích hoạt / vô hiệu hóa (nút nguồn)</li>
                <li>Xóa tài khoản (nút thùng rác)</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Thêm người dùng mới</DialogTitle>
        <DialogDescription>Điền thông tin để tạo người dùng mới</DialogDescription>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input id="email" type="email" {...register('email')} placeholder="Nhập email" />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Mật khẩu <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
                placeholder="Nhập mật khẩu"
              />
              {errors.password && (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">
              Họ và tên <span className="text-destructive">*</span>
            </Label>
            <Input id="fullName" {...register('fullName')} placeholder="Nhập họ và tên" />
            {errors.fullName && (
              <p className="text-destructive text-sm">{errors.fullName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Điện thoại</Label>
              <Input id="phone" {...register('phone')} placeholder="Số điện thoại" />
              {errors.phone && <p className="text-destructive text-sm">{errors.phone.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleCode">
                Vai trò <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('roleCode')}
                onValueChange={(value) => setValue('roleCode', value as UserRoleCode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleCode && (
                <p className="text-destructive text-sm">{errors.roleCode.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting || isLoading ? 'Đang xử lý...' : 'Tạo mới'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
