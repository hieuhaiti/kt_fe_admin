import { z } from 'zod'
import type { CreateMapLayerApiBody, UpdateMapLayerApiBody } from '@/types/api'

export const createMapLayerApiSchema = z.object({
  name: z.string().trim().min(3, 'Tên khóa cần ít nhất 3 ký tự').max(150, 'Tên khóa không được quá 150 ký tự'),
  layer_id: z.number({ error: 'Vui lòng chọn lớp bản đồ' }).int('Mã lớp phải là số nguyên').min(1, 'Vui lòng chọn lớp bản đồ'),
  scope: z
    .object({
      read: z.boolean().default(true),
      rate_per_min: z.number({ error: 'Nhập số yêu cầu mỗi phút' }).int('Số yêu cầu phải là số nguyên').min(1, 'Cần ít nhất 1 yêu cầu/phút').max(6000, 'Tối đa 6000 yêu cầu/phút').default(60),
      bbox_limit: z.number({ error: 'Nhập giới hạn vùng truy vấn bằng số' }).positive('Giới hạn phải lớn hơn 0').max(360, 'Giới hạn không được quá 360 độ vuông').optional(),
    })
    .default({ read: true, rate_per_min: 60 }),
  is_active: z.boolean().default(true),
  expires_at: z.string().datetime({ offset: true, message: 'Ngày hết hạn không hợp lệ' }).nullable().optional(),
})

/** Schema dùng cho form edit: `layer_id` không sửa được nên bỏ ràng buộc min(1) để tránh block submit khi API detail không trả layer_id. */
export const editMapLayerApiFormSchema = createMapLayerApiSchema.extend({
  layer_id: z.number().int().optional(),
})

export const updateMapLayerApiSchema = createMapLayerApiSchema.partial().refine(
  (value) => Object.values(value).some((field) => field !== undefined),
  { message: 'Chưa có thay đổi để lưu' }
)

export const listQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  layer_id: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
})

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePositiveNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeOptionalPositiveNumber(value: unknown): number | undefined {
  const parsed = normalizePositiveNumber(value)
  return parsed > 0 ? parsed : undefined
}

function normalizeIsoDate(value: unknown): string | null | undefined {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function normalizeMapLayerApiInput(
  values: Partial<CreateMapLayerApiBody>
): CreateMapLayerApiBody {
  return {
    name: normalizeTrimmedString(values.name),
    layer_id: normalizePositiveNumber(values.layer_id),
    scope: {
      read: values.scope?.read !== false,
      rate_per_min: Math.floor(normalizePositiveNumber(values.scope?.rate_per_min) || 60),
      ...(normalizeOptionalPositiveNumber(values.scope?.bbox_limit) != null
        ? { bbox_limit: normalizeOptionalPositiveNumber(values.scope?.bbox_limit) }
        : {}),
    },
    is_active: values.is_active !== false,
    expires_at: normalizeIsoDate(values.expires_at),
  } as CreateMapLayerApiBody
}

export function buildUpdatePayload(
  original: Partial<CreateMapLayerApiBody>,
  current: Partial<CreateMapLayerApiBody>
): UpdateMapLayerApiBody {
  const next = normalizeMapLayerApiInput(current)
  const prev = normalizeMapLayerApiInput(original)

  const payload: Partial<UpdateMapLayerApiBody> = {}

  ;(Object.keys(next) as (keyof CreateMapLayerApiBody)[]).forEach((key) => {
    const nextValue = next[key]
    const prevValue = prev[key]
    const changed =
      typeof nextValue === 'object' || typeof prevValue === 'object'
        ? JSON.stringify(nextValue ?? null) !== JSON.stringify(prevValue ?? null)
        : nextValue !== prevValue

    if (changed) {
      (payload as Record<string, unknown>)[key as string] = next[key]
    }
  })

  return payload as UpdateMapLayerApiBody
}

export function validateCreatePayload(values: CreateMapLayerApiBody) {
  return createMapLayerApiSchema.safeParse(normalizeMapLayerApiInput(values))
}

export function validateUpdatePayload(values: UpdateMapLayerApiBody) {
  return updateMapLayerApiSchema.safeParse(values)
}

export function getMappedErrorMessage(error: unknown, fallback: string) {
  const status = (error as { status?: number; body?: { status?: number } })?.status
  const bodyStatus = (error as { body?: { status?: number } })?.body?.status
  const code = status ?? bodyStatus
  const serverMessage = (error as { body?: { message?: string }; message?: string })?.body?.message

  if (serverMessage) return serverMessage

  if (code === 401) return 'Thông tin xác thực hoặc khóa API không hợp lệ, hoặc đã hết hạn.'
  if (code === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (code === 404) return 'Dữ liệu không tồn tại hoặc đã bị xóa.'
  if (code === 409) return 'Khóa API hoặc thiết lập chia sẻ đã tồn tại. Hãy kiểm tra lại.'
  if (code === 400) return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.'

  return fallback
}
