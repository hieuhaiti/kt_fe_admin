import type { JSX } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useApiQuery, useApiMutation, citizenFeedbackService } from '@/service'
import type {
  ApiResponse,
  CitizenFeedback,
  FeedbackCategory,
  FeedbackFeatureCollection,
  FeedbackStatus,
  FeedbackPriority,
  UpdateFeedbackStatusBody,
  Pagination,
} from '@/types/api'
import { UserCell } from '@/components/common/UserCell'
import {
  PRIORITY_LABEL,
  PRIORITY_CLASS,
  PRIORITY_DOT,
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_CLASS,
  STATUS_DOT,
} from '@/constant/feedbackConstant'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ClipboardEdit, List, Map, MapPin } from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import FeedbackDetailDialog from './FeedbackDetailDialog'
import FeedbackUpdateDialog from './FeedbackUpdateDialog'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import { formatDate } from '@/lib/date'
import { can, getUserRole, ROLES } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'
import FeedbackMap from './FeedbackMap'

function locationTextOf(item: CitizenFeedback) {
  if (item.location_text) return item.location_text
  if (item.lng != null && item.lat != null) return `${item.lat}, ${item.lng}`
  return null
}

function createdAtOf(item: CitizenFeedback) {
  return item.createdAt ?? item.created_at
}

function userNameOf(item: CitizenFeedback) {
  return item.userName ?? item.createdByName ?? null
}

export default function FeedbackPage(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const canHandle = can(user, 'feedback:handle')
  const canOverrideTransitions = getUserRole(user) === ROLES.SYSTEM_ADMIN
  const showActions = canHandle
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchValue, setSearchValue] = useState('')
  const [view, setView] = useState<'table' | 'map'>('table')
  const [filterCategory, setFilterCategory] = useState<FeedbackCategory | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<FeedbackPriority | 'all'>('all')

  const queryParams = {
    page: currentPage,
    limit,
    ...(searchValue && { q: searchValue }),
    ...(filterCategory !== 'all' && { category: filterCategory }),
    ...(filterStatus !== 'all' && { status: filterStatus }),
    ...(filterPriority !== 'all' && { priority: filterPriority }),
  }

  const dbQuery = useApiQuery(
    ['feedbacks', queryParams],
    () => citizenFeedbackService.getAll(queryParams),
    {},
    false,
    false
  )

  const mapParams = {
    ...(filterCategory !== 'all' && { category: filterCategory }),
    ...(filterStatus !== 'all' && { status: filterStatus }),
    ...(filterPriority !== 'all' && { priority: filterPriority }),
  }
  const mapQuery = useApiQuery(
    ['feedback-map', mapParams],
    () => citizenFeedbackService.getMap(mapParams),
    { enabled: view === 'map' },
    false,
    false
  )

  const raw = dbQuery.data as ApiResponse<any> | undefined
  const data = raw?.data as any
  const feedbacks: CitizenFeedback[] = data?.items ?? data?.feedbacks ?? []
  const pagination = (raw?.metadata ?? data?.pagination ?? {}) as Partial<Pagination>

  const lastTotalPagesRef = useRef(1)
  if (pagination.totalPages !== undefined) {
    lastTotalPagesRef.current = Math.max(1, pagination.totalPages)
  }
  const totalPages = lastTotalPagesRef.current
  const total = pagination?.total ?? 0
  const mapData = ((mapQuery.data as ApiResponse<FeedbackFeatureCollection> | undefined)?.data ??
    null) as FeedbackFeatureCollection | null

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  // Dialog states
  const [selectedFeedback, setSelectedFeedback] = useState<CitizenFeedback | null>(null)
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<number | string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)

  const statusMutation = useApiMutation(
    (args: { id: number | string; data: UpdateFeedbackStatusBody }) =>
      citizenFeedbackService.updateStatus(args.id, args.data),
    {
      onSuccess: () => {
        dbQuery.refetch()
        if (view === 'map') mapQuery.refetch()
        setUpdateDialogOpen(false)
        setSelectedFeedback(null)
      },
    },
    true
  )

  function openDetails(item: CitizenFeedback) {
    setSelectedFeedback(item)
    setSelectedFeedbackId(item.id)
    setDetailDialogOpen(true)
  }

  function openMapDetails(id: number | string) {
    setSelectedFeedback(null)
    setSelectedFeedbackId(id)
    setDetailDialogOpen(true)
  }

  function openUpdateDialog(item: CitizenFeedback) {
    setSelectedFeedback(item)
    setUpdateDialogOpen(true)
  }

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filterCategory}
        onValueChange={(value) => {
          setFilterCategory(value as FeedbackCategory | 'all')
          setCurrentPage(1)
        }}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Loại phản ánh" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả loại</SelectItem>
          <SelectItem value="chay_rung">Cháy rừng</SelectItem>
          <SelectItem value="vi_pham">Vi phạm</SelectItem>
          <SelectItem value="hien_trang">Hiện trạng</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filterStatus}
        onValueChange={(value) => {
          setFilterStatus(value as FeedbackStatus | 'all')
          setCurrentPage(1)
        }}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả TT</SelectItem>
          <SelectItem value="new">Mới tiếp nhận</SelectItem>
          <SelectItem value="in_progress">Đang xử lý</SelectItem>
          <SelectItem value="resolved">Đã xử lý</SelectItem>
          <SelectItem value="rejected">Từ chối</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filterPriority}
        onValueChange={(value) => {
          setFilterPriority(value as FeedbackPriority | 'all')
          setCurrentPage(1)
        }}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Ưu tiên" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả UT</SelectItem>
          <SelectItem value="low">Thấp</SelectItem>
          <SelectItem value="normal">Bình thường</SelectItem>
          <SelectItem value="high">Cao</SelectItem>
          <SelectItem value="urgent">Khẩn cấp</SelectItem>
        </SelectContent>
      </Select>

      {view === 'table' && (
        <Select
          value={`${limit}`}
          onValueChange={(value) => {
            setLimit(parseInt(value, 10))
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
      )}
    </div>
  )

  return (
    <PageLayout
      title="Phản ánh hiện trường"
      description="Tiếp nhận và xử lý phản ánh gửi từ WebGIS, MobileGIS"
    >
      <Tabs value={view} onValueChange={(value) => setView(value as 'table' | 'map')}>
        <TabsList className="mb-3">
          <TabsTrigger value="table" className="gap-2">
            <List className="size-4" />
            Bảng
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2">
            <Map className="size-4" />
            Bản đồ
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'table' ? (
        <ToolTableCustom
          searchValue={searchValue}
          setSearchValue={(value) => {
            setSearchValue(value)
            setCurrentPage(1)
          }}
          filter={filters}
          total={total}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: (page: number) => setCurrentPage(page),
          }}
        >
          <Table className="relative">
            <TableHeader className="sticky top-0 z-20">
              <TableRow>
                <TableHead className="w-12">ID</TableHead>
                <TableHead>Tiêu đề</TableHead>
                <TableHead className="w-28">Loại</TableHead>
                <TableHead className="w-24">Ưu tiên</TableHead>
                <TableHead className="w-28">Trạng thái</TableHead>
                <TableHead className="w-36">Người gửi</TableHead>
                <TableHead className="w-32">Ngày tạo</TableHead>
                {showActions && <TableHead className="w-24 text-right">Hành động</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={showActions ? 8 : 7} className="text-center">
                    Đang tải phản ánh...
                  </TableCell>
                </TableRow>
              ) : dbQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={showActions ? 8 : 7} className="text-destructive text-center">
                    Không thể tải danh sách phản ánh.
                  </TableCell>
                </TableRow>
              ) : feedbacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showActions ? 8 : 7} className="text-center">
                    Không có phản ánh phù hợp bộ lọc.
                  </TableCell>
                </TableRow>
              ) : (
                feedbacks.map((item: CitizenFeedback) => {
                  const locationText = locationTextOf(item)
                  return (
                    <TableRow
                      key={item.id}
                      className="hover:cursor-pointer"
                      onClick={() => openDetails(item)}
                    >
                      <TableCell>{item.id}</TableCell>
                      <TableCell>
                        <div className="max-w-64">
                          <p className="line-clamp-2 font-medium">{item.title}</p>
                          {locationText && (
                            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                              <MapPin className="size-3" />
                              <span className="line-clamp-1">{locationText}</span>
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {CATEGORY_LABEL[item.category ?? ''] ?? item.category ?? '-'}
                      </TableCell>
                      <TableCell>
                        <StatusDotBadge
                          label={PRIORITY_LABEL[item.priority] ?? item.priority}
                          badgeClass={
                            PRIORITY_CLASS[item.priority] ??
                            'bg-gray-100 text-gray-600 border-gray-200'
                          }
                          dotClass={PRIORITY_DOT[item.priority] ?? 'bg-gray-400'}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusDotBadge
                          label={STATUS_LABEL[item.status] ?? item.status}
                          badgeClass={
                            STATUS_CLASS[item.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                          }
                          dotClass={STATUS_DOT[item.status] ?? 'bg-gray-400'}
                        />
                      </TableCell>
                      <TableCell>
                        <UserCell
                          userId={item.userId ?? item.user_id}
                          inlineUser={item.user ?? userNameOf(item)}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {createdAtOf(item) ? formatDate(createdAtOf(item)) : '-'}
                      </TableCell>
                      {showActions && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openUpdateDialog(item)
                              }}
                              title="Cập nhật xử lý"
                              disabled={
                                !canOverrideTransitions &&
                                item.status !== 'new' &&
                                item.status !== 'in_progress'
                              }
                            >
                              <ClipboardEdit className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </ToolTableCustom>
      ) : (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {mapData?.features.length ?? 0} điểm phản ánh
            </p>
            {filters}
          </div>
          <FeedbackMap
            data={mapData}
            isLoading={mapQuery.isLoading || mapQuery.isFetching}
            isError={mapQuery.isError}
            onSelect={openMapDetails}
          />
        </Card>
      )}

      <FeedbackDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        feedbackId={selectedFeedbackId}
      />

      <FeedbackUpdateDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        feedback={selectedFeedback}
        onUpdateStatus={(data) => {
          if (selectedFeedback) {
            statusMutation.mutate({
              id: selectedFeedback.id,
              data: {
                toStatus: data.status,
                note: data.note,
              },
            })
          }
        }}
        isLoading={statusMutation.isPending}
        canOverrideTransitions={canOverrideTransitions}
      />
    </PageLayout>
  )
}
