import { useForm, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import PageLayout from '@/layout/pageLayout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authService, useApiMutation } from '@/service'

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/

const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Mật khẩu hiện tại không được để trống'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
      .max(128, 'Mật khẩu mới không được quá 128 ký tự')
      .regex(
        PASSWORD_REGEX,
        'Mật khẩu mới phải chứa ít nhất: 1 chữ thường, 1 chữ hoa, 1 số và 1 ký tự đặc biệt'
      ),
    confirmPassword: z
      .string()
      .min(1, 'Xác nhận mật khẩu mới không được để trống'),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Xác nhận mật khẩu mới không khớp',
    path: ['confirmPassword'],
  })

type ChangePasswordForm = z.infer<typeof passwordSchema>

export default function ChangePasswordPage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(passwordSchema) as any,
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const mutation = useApiMutation(
    (data: ChangePasswordForm) =>
      authService.changePassword({
        oldPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    {
      onSuccess: () => {
        reset()
      },
    },
    true
  )

  const onSubmit: SubmitHandler<ChangePasswordForm> = (data) => {
    mutation.mutate(data)
  }

  return (
    <PageLayout title="Đổi mật khẩu" description="Cập nhật mật khẩu đăng nhập của bạn">
      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...register('currentPassword')}
              placeholder="Nhập mật khẩu hiện tại"
            />
            {errors.currentPassword && (
              <p className="text-destructive text-sm">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
              placeholder="Nhập mật khẩu mới"
            />
            {errors.newPassword && (
              <p className="text-destructive text-sm">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              placeholder="Nhập lại mật khẩu mới"
            />
            {errors.confirmPassword && (
              <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  )
}
