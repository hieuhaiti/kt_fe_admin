import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import type { AddPermissionBody, ApiPermission, ApiResponse, PrincipalType } from '@/types/api'
import {
  getMappedErrorMessage,
  validatePermissionPayload,
} from '@/validators/mapLayerApiValidators'
import { formatDateTime } from '@/lib/date'

interface PermissionsTabProps {
  apiId: number
}

function normalizePermissions(data: unknown): ApiPermission[] {
  if (Array.isArray(data)) return data as ApiPermission[]
  if (data && typeof data === 'object') {
    const record = data as { permissions?: ApiPermission[]; items?: ApiPermission[] }
    if (Array.isArray(record.permissions)) return record.permissions
    if (Array.isArray(record.items)) return record.items
  }
  return []
}

export default function PermissionsTab({ apiId }: PermissionsTabProps) {
  const [principalType, setPrincipalType] = useState<PrincipalType>('public')
  const [userId, setUserId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [canView, setCanView] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ApiPermission | null>(null)

  const permissionsQuery = useApiQuery(
    ['mapLayerApiPermissions', apiId],
    () => mapLayerApiService.getPermissions(apiId),
    { enabled: !!apiId },
    false,
    false
  )

  const permissions = useMemo(() => {
    const data = (permissionsQuery.data as ApiResponse<unknown> | undefined)?.data
    return normalizePermissions(data)
  }, [permissionsQuery.data])

  const addMutation = useApiMutation(
    (payload: AddPermissionBody) => mapLayerApiService.addPermission(apiId, payload),
    {
      onSuccess: () => {
        permissionsQuery.refetch()
        setPrincipalType('public')
        setUserId('')
        setRoleId('')
        setCanView(true)
        setCanEdit(false)
        setCanDelete(false)
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể thêm quyền.'))
      },
    },
    false
  )

  const deleteMutation = useApiMutation(
    (permissionId: number) => mapLayerApiService.deletePermission(apiId, permissionId),
    {
      onSuccess: () => {
        permissionsQuery.refetch()
        setDeleteTarget(null)
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể xóa quyền.'))
      },
    },
    false
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const payload: AddPermissionBody = {
      principal_type: principalType,
      can_view: canView,
      can_edit: canEdit,
      can_delete: canDelete,
      user_id: principalType === 'user' ? Number(userId) : null,
      role_id: principalType === 'role' ? Number(roleId) : null,
    }

    if (principalType === 'user' && (!userId.trim() || Number(userId) < 1)) {
      toast.error('user_id phải là số nguyên >= 1')
      return
    }

    if (principalType === 'role' && (!roleId.trim() || Number(roleId) < 1)) {
      toast.error('role_id phải là số nguyên >= 1')
      return
    }

    const parsed = validatePermissionPayload(payload)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Payload quyền không hợp lệ')
      return
    }

    addMutation.mutate(parsed.data)
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4 rounded-lg border p-4" onSubmit={handleSubmit}>
        <h3 className="font-semibold">Thêm quyền</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Principal Type</Label>
            <Select
              value={principalType}
              onValueChange={(v) => setPrincipalType(v as PrincipalType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">public</SelectItem>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="role">role</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {principalType === 'user' && (
            <div className="space-y-2">
              <Label htmlFor="permission-user-id">User ID</Label>
              <Input
                id="permission-user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Nhập user_id"
              />
            </div>
          )}

          {principalType === 'role' && (
            <div className="space-y-2">
              <Label htmlFor="permission-role-id">Role ID</Label>
              <Input
                id="permission-role-id"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                placeholder="Nhập role_id"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={canView} onCheckedChange={(v) => setCanView(Boolean(v))} /> can_view
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={canEdit} onCheckedChange={(v) => setCanEdit(Boolean(v))} /> can_edit
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={canDelete} onCheckedChange={(v) => setCanDelete(Boolean(v))} />{' '}
            can_delete
          </label>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={addMutation.isPending}>
            {addMutation.isPending ? 'Đang thêm...' : 'Thêm quyền'}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead>Can View</TableHead>
              <TableHead>Can Edit</TableHead>
              <TableHead>Can Delete</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  Chưa có permission nào
                </TableCell>
              </TableRow>
            )}

            {permissions.map((permission) => (
              <TableRow key={permission.id}>
                <TableCell>{permission.id}</TableCell>
                <TableCell>
                  {permission.principal_type}
                  {permission.user_id ? ` (user:${permission.user_id})` : ''}
                  {permission.role_id ? ` (role:${permission.role_id})` : ''}
                </TableCell>
                <TableCell>{String(permission.can_view)}</TableCell>
                <TableCell>{String(permission.can_edit)}</TableCell>
                <TableCell>{String(permission.can_delete)}</TableCell>
                <TableCell>{formatDateTime(permission.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(permission)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa permission</AlertDialogTitle>
            <AlertDialogDescription>
              Xác nhận xóa permission #{deleteTarget?.id}? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
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
