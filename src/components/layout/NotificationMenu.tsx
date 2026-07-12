import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { notificationService, useApiMutation, useApiQuery } from '@/service'
import type {
  ApiResponse,
  Notification,
  NotificationListData,
  NotificationListParams,
} from '@/types/api'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/date'
import { useNotificationWebSocket } from '@/hooks/useNotificationWebSocket'

const defaultParams: NotificationListParams = {
  page: 1,
  limit: 10,
}

function getPrimaryText(n: Notification) {
  return n.title || n.body || n.message || 'Thông báo'
}

function getSecondaryText(n: Notification) {
  const secondary = n.body || n.message
  if (n.title && secondary) return secondary
  return ''
}

function isReadFlag(n: Notification) {
  return n.isRead ?? n.is_read ?? false
}

function createdAtOf(n: Notification) {
  return n.createdAt ?? n.created_at ?? ''
}

export function NotificationMenu() {
  const [open, setOpen] = useState(false)

  const params = defaultParams
  const query = useApiQuery(
    ['notifications', 'me', params.page, params.limit],
    () => notificationService.getMy(params),
    { refetchOnWindowFocus: false },
    false,
    false
  )

  const handleWsMessage = useCallback(() => {
    query.refetch()
  }, [query.refetch])

  useNotificationWebSocket({
    onMessage: handleWsMessage,
  })

  useEffect(() => {
    if (open) query.refetch()
  }, [open, query.refetch])

  const raw = query.data as ApiResponse<NotificationListData> | undefined
  const data = raw?.data as any
  const notifications: Notification[] =
    data?.items ?? data?.notifications ?? []
  const unreadCountRaw = data?.unreadCount ?? data?.unread_count
  const unreadCount = Number.isFinite(Number(unreadCountRaw))
    ? Math.max(0, Number(unreadCountRaw))
    : Math.max(0, notifications.filter((n) => !isReadFlag(n)).length)
  const showBadge = true

  const markAsReadMutation = useApiMutation(
    (id: number) => notificationService.markAsRead(id),
    {
      onSuccess: () => {
        query.refetch()
      },
    },
    false
  )

  const markAllAsReadMutation = useApiMutation(
    (_: void) => notificationService.markAllAsRead(),
    {
      onSuccess: () => {
        query.refetch()
      },
    },
    false
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Thông báo"
          className="hover:bg-muted relative h-8 w-8 p-0 shadow-sm"
        >
          <Bell className="text-foreground h-4 w-4" />
          {showBadge && (
            <Badge
              className="bg-destructive text-destructive-foreground absolute -top-1 -left-1 h-4 min-w-4 justify-center px-1"
              aria-label={`${unreadCount} thông báo chưa đọc`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-2">
          <DropdownMenuLabel>Thông báo</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={markAllAsReadMutation.isPending}
              onClick={() => markAllAsReadMutation.mutate(undefined)}
            >
              Đánh dấu đã đọc tất cả
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {query.isFetching && notifications.length === 0 && (
          <div className="text-muted-foreground px-3 py-6 text-center text-xs">
            Đang tải thông báo...
          </div>
        )}

        {!query.isFetching && notifications.length === 0 && (
          <div className="text-muted-foreground px-3 py-6 text-center text-xs">
            Không có thông báo
          </div>
        )}

        {notifications.length > 0 && (
          <div className="max-h-96 overflow-auto py-1">
            {notifications.map((n) => {
              const primary = getPrimaryText(n)
              const secondary = getSecondaryText(n)
              const read = isReadFlag(n)
              return (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(
                    'flex cursor-pointer flex-col items-start gap-1 whitespace-normal',
                    !read && 'bg-muted/60'
                  )}
                  onSelect={() => {
                    if (!read && !markAsReadMutation.isPending) {
                      markAsReadMutation.mutate(n.id)
                    }
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className={cn('text-sm', !read && 'font-medium')}>{primary}</span>
                    {!read && <span className="bg-primary h-2 w-2 rounded-full" />}
                  </div>
                  {secondary && <span className="text-muted-foreground text-xs">{secondary}</span>}
                  <span className="text-muted-foreground text-[11px]">
                    {formatDateTime(createdAtOf(n))}
                  </span>
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationMenu
