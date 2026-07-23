import { z } from 'zod'
import type { CreateMapLayerApiBody, UpdateMapLayerApiBody } from '@/types/api'

export const createMapLayerApiSchema = z.object({
  name: z.string().trim().min(3).max(150),
  layer_id: z.number().int().min(1),
  scope: z
    .object({
      read: z.boolean().default(true),
      rate_per_min: z.number().int().min(1).max(6000).default(60),
      bbox_limit: z.number().positive().max(360).optional(),
    })
    .default({ read: true, rate_per_min: 60 }),
  is_active: z.boolean().default(true),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
})

export const updateMapLayerApiSchema = createMapLayerApiSchema.partial().refine(
  (value) => Object.values(value).some((field) => field !== undefined),
  { message: 'Cần ít nhất 1 trường thay đổi' }
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

  const payload: Record<string, any> = {}

  ;(Object.keys(next) as (keyof CreateMapLayerApiBody)[]).forEach((key) => {
    const nextValue = (next as any)[key]
    const prevValue = (prev as any)[key]
    const changed =
      typeof nextValue === 'object' || typeof prevValue === 'object'
        ? JSON.stringify(nextValue ?? null) !== JSON.stringify(prevValue ?? null)
        : nextValue !== prevValue

    if (changed) {
      payload[key as string] = (next as any)[key]
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

  if (code === 401) return 'Token/apikey không hợp lệ hoặc đã hết hạn.'
  if (code === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (code === 404) return 'Dữ liệu không tồn tại hoặc đã bị xóa.'
  if (code === 409) return 'API key hoặc cấu hình chia sẻ đã tồn tại. Vui lòng kiểm tra lại.'
  if (code === 400) return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.'

  return fallback
}
