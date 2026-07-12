import { useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { notificationService, useApiMutation, useApiQuery, userService } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Check, ChevronDown, Search } from 'lucide-react'
import type {
  ApiResponse,
  NotificationTarget,
  SendNotificationBody,
  User,
  UserListData,
} from '@/types/api'

/**
 * Enum lấy từ server:
 *  - validators/notification.validator.js: channel (mặc định 'system'), type (bắt buộc)
 *  - seeds/002_dev_data.seed.js + services/feedback.service.js: các type thực tế đã dùng
 */
const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'system', label: 'Hệ thống' },
  { value: 'fire', label: 'Cháy rừng' },
  { value: 'feedback', label: 'Phản ánh' },
]

const TYPE_GROUPS: { group: string; items: { value: string; label: string }[] }[] = [
  {
    group: 'Hệ thống',
    items: [
      { value: 'announcement', label: 'Thông báo chung (announcement)' },
      { value: 'system_alert', label: 'Cảnh báo hệ thống (system_alert)' },
      { value: 'backup_success', label: 'Sao lưu thành công (backup_success)' },
      { value: 'maintenance', label: 'Bảo trì (maintenance)' },
    ],
  },
  {
    group: 'Cháy rừng',
    items: [
      { value: 'fire_danger_alert', label: 'Cảnh báo nguy cơ cháy (fire_danger_alert)' },
      { value: 'fire_warning', label: 'Cảnh báo cháy (fire_warning)' },
    ],
  },
  {
    group: 'Phản ánh',
    items: [
      { value: 'feedback_fire_report', label: 'Phản ánh cháy rừng (feedback_fire_report)' },
      {
        value: 'feedback_status_changed',
        label: 'Đổi trạng thái phản ánh (feedback_status_changed)',
      },
      { value: 'feedback_resolved', label: 'Phản ánh đã xử lý (feedback_resolved)' },
    ],
  },
]

const ROLE_OPTIONS = [
  { value: 'citizen', label: 'Người dân' },
  { value: 'so_nnmt', label: 'Sở NN&MT' },
  { value: 'ubnd_tinh', label: 'UBND tỉnh' },
  { value: 'system_admin', label: 'Quản trị hệ thống' },
]

function userNameOf(user: User) {
  return user.fullName ?? user.full_name ?? user.username ?? user.email ?? `User #${user.id}`
}

function userRoleOf(user: User) {
  const roleCode = user.roleCode ?? user.role?.code ?? user.role_name
  return ROLE_OPTIONS.find((role) => role.value === roleCode)?.label ?? roleCode ?? '-'
}

export default function NotificationSendPage() {
  const [target, setTarget] = useState<NotificationTarget>('all')
  const [userId, setUserId] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userPickerOpen, setUserPickerOpen] = useState(false)
  const [roleCode, setRoleCode] = useState('citizen')
  const [channel, setChannel] = useState('system')
  const [type, setType] = useState('announcement')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const sendMutation = useApiMutation((payload: SendNotificationBody) =>
    notificationService.send(payload)
  )

  const userQueryParams = {
    page: 1,
    limit: 50,
    sortBy: 'id',
    sortOrder: 'ASC' as const,
    ...(userSearch.trim() && { search: userSearch.trim(), email: userSearch.trim() }),
  }

  const usersQuery = useApiQuery(
    ['notification-send-users', userQueryParams],
    () => userService.getAll(userQueryParams),
    { enabled: target === 'user', staleTime: 60 * 1000 },
    false,
    false
  )

  const userData = (usersQuery.data as ApiResponse<UserListData> | undefined)?.data
  const users = userData?.users ?? userData?.items ?? []

  const typeLabel = useMemo(() => {
    for (const g of TYPE_GROUPS) {
      const it = g.items.find((i) => i.value === type)
      if (it) return it.label
    }
    return type
  }, [type])

  const channelLabel = useMemo(
    () => CHANNEL_OPTIONS.find((c) => c.value === channel)?.label ?? channel,
    [channel]
  )

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase()
    if (!keyword) return users

    return users.filter((user) => {
      const searchable = [
        String(user.id),
        userNameOf(user),
        user.email,
        user.phone,
        user.username,
        userRoleOf(user),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(keyword)
    })
  }, [userSearch, users])

  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === userId) ?? null,
    [userId, users]
  )

  const onSend = () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Nhập tiêu đề và nội dung')
      return
    }
    if (!type.trim()) {
      toast.error('Chọn loại thông báo')
      return
    }

    let payload: SendNotificationBody
    if (target === 'user') {
      const id = Number(userId)
      if (!id) {
        toast.error('Chọn người dùng nhận thông báo')
        return
      }
      payload = { target: 'user', userId: id, channel, type, title, body }
    } else if (target === 'role') {
      payload = { target: 'role', roleCode, channel, type, title, body }
    } else {
      payload = { target: 'all', channel, type, title, body }
    }

    sendMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Đã gửi thông báo')
        setTitle('')
        setBody('')
      },
    })
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Gửi thông báo</h1>
        <p className="text-muted-foreground text-sm">
          Gửi thông báo hệ thống hoặc cảnh báo cháy tới người dùng cụ thể, theo vai trò hoặc tất cả.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Đối tượng</label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'role', 'user'] as NotificationTarget[]).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={target === t ? 'default' : 'outline'}
                  onClick={() => setTarget(t)}
                >
                  {t === 'all' ? 'Tất cả' : t === 'role' ? 'Theo vai trò' : 'Theo người dùng'}
                </Button>
              ))}
            </div>
          </div>

          {target === 'user' && (
            <div>
              <label className="mb-1 block text-sm">Người dùng</label>
              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate text-left">
                      {selectedUser
                        ? `#${selectedUser.id} - ${userNameOf(selectedUser)}`
                        : 'Chọn người dùng'}
                    </span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
                  <div className="border-b p-2">
                    <div className="relative">
                      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
                      <Input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Tìm theo ID, tên, email..."
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-1">
                    {usersQuery.isLoading ? (
                      <div className="text-muted-foreground px-3 py-2 text-sm">
                        Đang tải người dùng...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="text-muted-foreground px-3 py-2 text-sm">
                        Không tìm thấy người dùng
                      </div>
                    ) : (
                      filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="hover:bg-accent focus-visible:ring-ring flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-left text-sm outline-none focus-visible:ring-2"
                          onClick={() => {
                            setUserId(String(user.id))
                            setUserPickerOpen(false)
                          }}
                        >
                          <Check
                            className={
                              String(user.id) === userId ? 'size-4 opacity-100' : 'size-4 opacity-0'
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">#{user.id}</span>
                              <span className="truncate">{userNameOf(user)}</span>
                            </div>
                            <div className="text-muted-foreground truncate text-xs">
                              {user.email}
                              {user.phone ? ` · ${user.phone}` : ''}
                              {' · '}
                              {userRoleOf(user)}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {target === 'role' && (
            <div>
              <label className="mb-1 block text-sm">Vai trò</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>{ROLE_OPTIONS.find((r) => r.value === roleCode)?.label ?? roleCode}</span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                  {ROLE_OPTIONS.map((r) => (
                    <DropdownMenuItem key={r.value} onSelect={() => setRoleCode(r.value)}>
                      {r.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">Kênh</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>{channelLabel}</span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                  {CHANNEL_OPTIONS.map((c) => (
                    <DropdownMenuItem key={c.value} onSelect={() => setChannel(c.value)}>
                      {c.label}
                      <span className="text-muted-foreground ml-auto text-xs">{c.value}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div>
              <label className="mb-1 block text-sm">Loại</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">{typeLabel}</span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-80 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto">
                  {TYPE_GROUPS.map((g, gi) => (
                    <div key={g.group}>
                      {gi > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel>{g.group}</DropdownMenuLabel>
                      {g.items.map((it) => (
                        <DropdownMenuItem
                          key={it.value}
                          onSelect={() => setType(it.value)}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>{it.label.replace(/\s*\(.*\)$/, '')}</span>
                          <code className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[10px]">
                            {it.value}
                          </code>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm">Tiêu đề</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Nội dung</label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          <Button onClick={onSend} disabled={sendMutation.isPending}>
            {sendMutation.isPending ? 'Đang gửi...' : 'Gửi thông báo'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
