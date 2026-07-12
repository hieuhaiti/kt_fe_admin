import { useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { PaginationCustom } from '@/components/features/PaginationCustom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { mapLayerApiService, useApiMutation, useApiQuery } from '@/service'
import type { ApiKey, ApiResponse, CreateApiKeyBody, MapLayerApi, Pagination } from '@/types/api'
import { getMappedErrorMessage, validateApiKeyPayload } from '@/validators/mapLayerApiValidators'
import { formatDateTime } from '@/lib/date'

interface ApiKeysTabProps {
  availableApis: MapLayerApi[]
  currentApiId?: number
}

function toValidId(value: unknown): number | null {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

function normalizeApiKeys(data: unknown): ApiKey[] {
  const mapList = (list: unknown[]) =>
    list.map((item) => normalizeApiKeyItem(item)).filter((item): item is ApiKey => item !== null)

  if (Array.isArray(data)) return mapList(data)
  if (data && typeof data === 'object') {
    const record = data as { api_keys?: unknown[]; items?: unknown[]; keys?: unknown[] }
    if (Array.isArray(record.api_keys)) return mapList(record.api_keys)
    if (Array.isArray(record.items)) return mapList(record.items)
    if (Array.isArray(record.keys)) return mapList(record.keys)
  }
  return []
}

function normalizeStatus(value: unknown): ApiKey['status'] {
  if (typeof value !== 'string') return undefined
  const normalized = value.toLowerCase()
  if (normalized === 'active' || normalized === 'revoked' || normalized === 'expired') {
    return normalized
  }
  return undefined
}

function normalizeApiKeyItem(raw: unknown): ApiKey | null {
  if (!raw || typeof raw !== 'object') return null

  const record = raw as {
    id?: unknown
    name?: unknown
    status?: unknown
    computed_status?: unknown
    is_active?: unknown
    masked_key?: unknown
    key_masked?: unknown
    key_value?: unknown
    api_key?: unknown
    plain_key?: unknown
    expires_at?: unknown
    created_at?: unknown
    updated_at?: unknown
    map_layer_api_ids?: unknown
  }

  const id = toValidId(record.id)
  if (!id) return null

  const status = normalizeStatus(record.status) ?? normalizeStatus(record.computed_status)
  const keyValue =
    typeof record.key_value === 'string'
      ? record.key_value
      : typeof record.api_key === 'string'
        ? record.api_key
        : typeof record.plain_key === 'string'
          ? record.plain_key
          : ''

  const keyText = keyValue || (typeof record.masked_key === 'string' ? record.masked_key : '-')

  return {
    id,
    name: typeof record.name === 'string' ? record.name : `Key #${id}`,
    status,
    is_active: typeof record.is_active === 'boolean' ? record.is_active : status === 'active',
    masked_key: keyText,
    key_masked: keyText,
    api_key:
      typeof record.api_key === 'string'
        ? record.api_key
        : typeof record.key_value === 'string'
          ? record.key_value
          : undefined,
    plain_key: typeof record.plain_key === 'string' ? record.plain_key : undefined,
    expires_at: typeof record.expires_at === 'string' ? record.expires_at : null,
    created_at:
      typeof record.created_at === 'string' ? record.created_at : new Date().toISOString(),
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : undefined,
    map_layer_api_ids: Array.isArray(record.map_layer_api_ids)
      ? record.map_layer_api_ids
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item))
      : undefined,
  }
}

function getGeneratedPlainKey(data: unknown): string {
  if (!data || typeof data !== 'object') return ''

  const record = data as {
    api_key?: ApiKey | string
    key?: ApiKey | string
    share_key?: ApiKey | string
    plain_key?: string
    token?: string
    key_value?: string
  }

  const objectKey =
    (typeof record.api_key === 'object' && record.api_key) ||
    (typeof record.key === 'object' && record.key) ||
    (typeof record.share_key === 'object' && record.share_key) ||
    null

  if (typeof record.api_key === 'string') return record.api_key
  if (typeof record.key_value === 'string') return record.key_value
  if (typeof record.plain_key === 'string') return record.plain_key
  if (typeof record.token === 'string') return record.token
  if (objectKey?.api_key) return objectKey.api_key
  if (objectKey?.plain_key) return objectKey.plain_key

  return ''
}

function isApiKeyActive(item: ApiKey): boolean {
  if (typeof item.is_active === 'boolean') return item.is_active
  if (item.status) return item.status === 'active'
  return true
}

function getApiKeyStatus(item: ApiKey): string {
  if (item.status) return item.status
  return isApiKeyActive(item) ? 'active' : 'revoked'
}

function getMaskedKey(item: ApiKey): string {
  if (typeof item.api_key === 'string' && item.api_key.trim()) return item.api_key
  if (typeof item.plain_key === 'string' && item.plain_key.trim()) return item.plain_key
  return item.masked_key ?? item.key_masked ?? '-'
}

function getCopyableKey(item: ApiKey): string {
  if (typeof item.api_key === 'string' && item.api_key.trim()) return item.api_key
  if (typeof item.plain_key === 'string' && item.plain_key.trim()) return item.plain_key
  return ''
}

export default function ApiKeysTab({ availableApis, currentApiId }: ApiKeysTabProps) {
  const [name, setName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [selectedIds, setSelectedIds] = useState<number[]>(currentApiId ? [currentApiId] : [])
  const [generatedKey, setGeneratedKey] = useState<string>('')
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null)
  const normalizedAvailableApis = useMemo(
    () =>
      availableApis
        .map((api) => ({ ...api, id: toValidId(api.id) }))
        .filter((api): api is MapLayerApi & { id: number } => api.id !== null),
    [availableApis]
  )

  useEffect(() => {
    const nextId = toValidId(currentApiId)
    if (nextId) {
      setSelectedIds([nextId])
    }
  }, [currentApiId])

  const apiKeysQuery = useApiQuery(
    ['mapLayerApiKeys', currentPage, limit],
    () => mapLayerApiService.getApiKeys({ page: currentPage, limit }),
    {},
    false,
    false
  )

  const apiKeysData = (apiKeysQuery.data as ApiResponse<unknown> | undefined)?.data

  const apiKeys = useMemo(() => {
    return normalizeApiKeys(apiKeysData)
  }, [apiKeysData])

  const pagination = useMemo(() => {
    if (!apiKeysData || typeof apiKeysData !== 'object') return null
    const record = apiKeysData as {
      pagination?: Partial<Pagination>
      totalPages?: number
      page?: number
      total?: number
    }

    if (record.pagination && typeof record.pagination === 'object') {
      return {
        page: Number(record.pagination.page || currentPage),
        totalPages: Number(record.pagination.totalPages || 1),
      }
    }

    if (record.totalPages) {
      return {
        page: Number(record.page || currentPage),
        totalPages: Number(record.totalPages || 1),
      }
    }

    return null
  }, [apiKeysData, currentPage])

  const totalPages = pagination?.totalPages ?? 1

  const createMutation = useApiMutation(
    (payload: CreateApiKeyBody) => mapLayerApiService.createApiKey(payload),
    {
      onSuccess: (response) => {
        apiKeysQuery.refetch()
        setName('')
        setExpiresAt('')
        setSelectedIds(currentApiId ? [currentApiId] : [])
        const typed = response as ApiResponse<unknown>
        setGeneratedKey(getGeneratedPlainKey(typed.data))
        toast.success('Tạo API key thành công')
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể tạo API key.'))
      },
    },
    false
  )

  const revokeMutation = useApiMutation(
    (apiKeyId: number) => mapLayerApiService.revokeApiKey(apiKeyId),
    {
      onSuccess: () => {
        apiKeysQuery.refetch()
        setRevokeTarget(null)
        toast.success('Thu hồi API key thành công')
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể revoke API key.'))
      },
    },
    false
  )

  const deleteMutation = useApiMutation(
    (apiKeyId: number) => mapLayerApiService.deleteApiKey(apiKeyId),
    {
      onSuccess: () => {
        apiKeysQuery.refetch()
        setDeleteTarget(null)
        toast.success('Xóa API key thành công')
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể xóa API key.'))
      },
    },
    false
  )

  function toggleApiId(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  function handleCreateKey(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const normalizedIds = Array.from(
      new Set(selectedIds.map((id) => toValidId(id)).filter(Boolean))
    ) as number[]

    const payload: CreateApiKeyBody = {
      name,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      map_layer_api_ids: normalizedIds,
    }

    const parsed = validateApiKeyPayload(payload)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Payload API key không hợp lệ')
      return
    }

    createMutation.mutate(parsed.data)
  }

  async function handleCopyKey(item: ApiKey) {
    const value = getCopyableKey(item)
    if (!value) {
      toast.error('Không có key_value để copy')
      return
    }

    if (!navigator?.clipboard?.writeText) {
      toast.error('Trình duyệt không hỗ trợ copy clipboard')
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      toast.success(`Đã copy key #${item.id}`)
    } catch {
      toast.error('Copy key thất bại')
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4 rounded-lg border p-4" onSubmit={handleCreateKey}>
        <h3 className="font-semibold">Tạo API Key</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên API key"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="key-expires-at">Expires At</Label>
            <Input
              id="key-expires-at"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Map Layer APIs</Label>
          <div className="grid max-h-40 grid-cols-1 gap-2 overflow-auto rounded border p-3 md:grid-cols-2">
            {normalizedAvailableApis.map((api) => (
              <label key={api.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedIds.includes(api.id)}
                  onCheckedChange={() => toggleApiId(api.id)}
                />
                <span>
                  #{api.id} - {api.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={createMutation.isPending}>
            <KeyRound className="mr-2 h-4 w-4" />
            {createMutation.isPending ? 'Đang tạo...' : 'Tạo API Key'}
          </Button>
        </div>

        {generatedKey && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            API key mới: <span className="font-mono">{generatedKey}</span>
          </div>
        )}
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Key Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  Chưa có API key nào
                </TableCell>
              </TableRow>
            )}

            {apiKeys.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.id}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{getMaskedKey(item)}</TableCell>
                <TableCell className="uppercase">{getApiKeyStatus(item)}</TableCell>
                <TableCell>{item.expires_at ? formatDateTime(item.expires_at) : '-'}</TableCell>
                <TableCell>{formatDateTime(item.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopyKey(item)}
                      disabled={!getCopyableKey(item)}
                      title="Copy key_value"
                    >
                      <Copy className="mr-1 h-4 w-4" />
                      Copy key
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRevokeTarget(item)}
                      disabled={revokeMutation.isPending || !isApiKeyActive(item)}
                      title="Thu hồi API key"
                    >
                      Thu hồi
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(item)}
                      disabled={deleteMutation.isPending}
                      title="Xóa API key"
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Xóa
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-center">
        <PaginationCustom
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key</AlertDialogTitle>
            <AlertDialogDescription>
              Xác nhận revoke key #{revokeTarget?.id}? Key sẽ không dùng được nữa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revokeTarget) revokeMutation.mutate(revokeTarget.id)
              }}
            >
              {revokeMutation.isPending ? 'Đang revoke...' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa API key</AlertDialogTitle>
            <AlertDialogDescription>
              Xác nhận xóa key #{deleteTarget?.id}? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
              }}
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
