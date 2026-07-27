import { useEffect, useMemo } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ImageIcon,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { authService, useApiMutation } from '@/service'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { UpdateProfileBody } from '@/types/api'
import { parseLink } from '@/lib/utils'

const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
    .max(100, 'Họ và tên không được quá 100 ký tự')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{8,20}$/, 'Số điện thoại không hợp lệ')
    .optional()
    .or(z.literal('')),
  addressDetail: z
    .string()
    .trim()
    .max(1000, 'Địa chỉ không được quá 1000 ký tự')
    .optional()
    .or(z.literal('')),
  avatarUrl: z
    .string()
    .trim()
    .url('Đường dẫn ảnh không hợp lệ')
    .max(500, 'Đường dẫn ảnh không được quá 500 ký tự')
    .optional()
    .or(z.literal('')),
})

type ProfileFormData = z.infer<typeof profileSchema>

const roleLabels: Record<string, string> = {
  system_admin: 'Quản trị hệ thống',
  ubnd_tinh: 'UBND tỉnh',
  so_nnmt: 'Sở NN&MT',
  citizen: 'Người dân',
  admin: 'Quản trị viên',
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user)
  const fetchProfile = useAuthStore((state) => state.fetchProfile)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as never,
    defaultValues: {
      fullName: '',
      phone: '',
      addressDetail: '',
      avatarUrl: '',
    },
  })

  useEffect(() => {
    reset({
      fullName: user?.fullName ?? user?.full_name ?? '',
      phone: user?.phone ?? '',
      addressDetail: user?.addressDetail ?? user?.address_detail ?? '',
      avatarUrl: user?.avatarUrl ?? user?.avatar_url ?? '',
    })
  }, [reset, user])

  const displayName =
    user?.fullName || user?.full_name || user?.username || user?.email || 'Quản trị viên'
  const roleCode =
    (user?.roleCode as string | undefined) ||
    (user?.role?.code as string | undefined) ||
    user?.role?.name ||
    user?.role_name ||
    ''
  const roleLabel = roleLabels[roleCode.toLowerCase()] || roleCode || 'Quản trị viên'
  const watchedAvatar = watch('avatarUrl')
  const currentAvatar = user?.avatarUrl || user?.avatar_url || ''
  const avatarSource = watchedAvatar
    ? parseLink(watchedAvatar)
    : currentAvatar
      ? parseLink(currentAvatar)
      : ''
  const initials = useMemo(() => getInitials(displayName), [displayName])

  const updateMutation = useApiMutation(
    (data: UpdateProfileBody) => authService.updateProfile(data),
    {
      onSuccess: async () => {
        await fetchProfile()
      },
    },
    true
  )

  const handleFormSubmit: SubmitHandler<ProfileFormData> = (data) => {
    const payload: UpdateProfileBody = {}
    if (data.fullName?.trim()) payload.fullName = data.fullName.trim()
    if (data.phone?.trim()) payload.phone = data.phone.trim()
    if (data.addressDetail?.trim()) payload.addressDetail = data.addressDetail.trim()
    if (data.avatarUrl?.trim()) payload.avatarUrl = data.avatarUrl.trim()
    updateMutation.mutate(payload)
  }

  const handleReset = () => {
    reset({
      fullName: user?.fullName ?? user?.full_name ?? '',
      phone: user?.phone ?? '',
      addressDetail: user?.addressDetail ?? user?.address_detail ?? '',
      avatarUrl: user?.avatarUrl ?? user?.avatar_url ?? '',
    })
  }

  const isSaving = isSubmitting || updateMutation.isPending
  const lastLoginAt = user?.lastLoginAt ?? user?.last_login
  const createdAt = user?.createdAt ?? user?.created_at

  return (
    <PageLayout
      title="Hồ sơ cá nhân"
      description="Quản lý thông tin hiển thị và thông tin liên hệ của tài khoản"
    >
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-28 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--info)))]" />
            <CardContent className="-mt-14 px-6 pb-6">
              <div className="relative w-fit">
                <div className="ring-card bg-primary text-primary-foreground flex size-28 items-center justify-center overflow-hidden rounded-3xl text-3xl font-bold shadow-xl ring-4">
                  {avatarSource ? (
                    <img
                      src={avatarSource}
                      alt={`Ảnh đại diện của ${displayName}`}
                      className="size-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <span className="border-card bg-success text-success-foreground absolute -right-2 -bottom-2 grid size-9 place-items-center rounded-xl border-4">
                  <BadgeCheck className="size-4" />
                </span>
              </div>

              <div className="mt-5">
                <h2 className="text-foreground text-xl font-bold">{displayName}</h2>
                <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                  <Mail className="size-4" />
                  <span className="truncate">{user?.email || 'Chưa có email'}</span>
                </p>
                <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10 mt-3">
                  <ShieldCheck className="mr-1 size-3.5" />
                  {roleLabel}
                </Badge>
              </div>

              <div className="mt-6 grid gap-3 border-t pt-5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="text-success size-4" />
                    Trạng thái
                  </span>
                  <span className="text-foreground font-medium">
                    {(user?.isActive ?? user?.is_active) === false
                      ? 'Tạm khóa'
                      : 'Đang hoạt động'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="size-4" />
                    Ngày tạo
                  </span>
                  <span className="text-foreground text-right text-xs font-medium">
                    {formatDate(createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock3 className="size-4" />
                    Đăng nhập gần nhất
                  </span>
                  <span className="text-foreground text-right text-xs font-medium">
                    {formatDate(lastLoginAt)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="text-primary size-4" />
                Lưu ý bảo mật
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2 text-sm leading-6">
              <p>Không chia sẻ tài khoản quản trị hoặc mã xác thực cho người khác.</p>
              <p>Cập nhật thông tin liên hệ để nhận đúng cảnh báo nghiệp vụ.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit shadow-sm">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <UserRound className="text-primary size-5" />
                  Thông tin tài khoản
                </CardTitle>
                <CardDescription className="mt-2">
                  Email được quản lý bởi hệ thống và không thể tự thay đổi.
                </CardDescription>
              </div>
              {isDirty && (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                  Có thay đổi chưa lưu
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-7">
              <section>
                <div className="mb-4">
                  <h3 className="text-foreground text-sm font-semibold">Thông tin định danh</h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Email được dùng để xác thực tài khoản.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        id="email"
                        value={user?.email || ''}
                        className="bg-muted/60 pl-10"
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="border-t pt-6">
                <div className="mb-4">
                  <h3 className="text-foreground text-sm font-semibold">Thông tin liên hệ</h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Thông tin này được dùng khi phối hợp xử lý nghiệp vụ và cảnh báo.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="fullName">Họ và tên</Label>
                    <div className="relative">
                      <UserRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        id="fullName"
                        className="pl-10"
                        {...register('fullName')}
                        placeholder="Nhập họ và tên"
                        aria-invalid={Boolean(errors.fullName)}
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-destructive text-sm">{errors.fullName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Số điện thoại</Label>
                    <div className="relative">
                      <Phone className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        id="phone"
                        className="pl-10"
                        {...register('phone')}
                        placeholder="0905 123 456"
                        aria-invalid={Boolean(errors.phone)}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-destructive text-sm">{errors.phone.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Đơn vị công tác</Label>
                    <div className="relative">
                      <Building2 className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input value={roleLabel} className="bg-muted/60 pl-10" disabled />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="addressDetail">Địa chỉ chi tiết</Label>
                    <div className="relative">
                      <MapPin className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4" />
                      <Textarea
                        id="addressDetail"
                        className="min-h-24 resize-y pl-10"
                        {...register('addressDetail')}
                        placeholder="Nhập địa chỉ cơ quan hoặc nơi làm việc"
                        aria-invalid={Boolean(errors.addressDetail)}
                      />
                    </div>
                    {errors.addressDetail && (
                      <p className="text-destructive text-sm">{errors.addressDetail.message}</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="border-t pt-6">
                <div className="mb-4">
                  <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <ImageIcon className="text-primary size-4" />
                    Ảnh đại diện
                  </h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Nhập đường dẫn của ảnh đại diện đã được lưu trực tuyến.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avatarUrl">Đường dẫn ảnh đại diện</Label>
                  <Input
                    id="avatarUrl"
                    {...register('avatarUrl')}
                    placeholder="https://..."
                    aria-invalid={Boolean(errors.avatarUrl)}
                  />
                  {errors.avatarUrl && (
                    <p className="text-destructive text-sm">{errors.avatarUrl.message}</p>
                  )}
                </div>
              </section>

              <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isSaving || !isDirty}
                >
                  Hủy thay đổi
                </Button>
                <Button type="submit" disabled={isSaving || !isDirty}>
                  <Save />
                  {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
