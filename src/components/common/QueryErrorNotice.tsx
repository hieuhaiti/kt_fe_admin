import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ApiErrorLike } from '@/service/common/useApi'

interface QueryErrorNoticeProps {
  title: string
  error: ApiErrorLike | null
  onRetry: () => void
  isFetching?: boolean
}

export function QueryErrorNotice({
  title,
  error,
  onRetry,
  isFetching = false,
}: QueryErrorNoticeProps) {
  const status = error?.status ?? error?.body?.status ?? error?.body?.statusCode
  const forbidden = status === 403

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-6">
        <div role="alert" className="space-y-1">
          <h2 className="text-foreground font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">
            {forbidden
              ? 'Bạn không có quyền xem nội dung này.'
              : 'Không tải được dữ liệu. Vui lòng thử lại.'}
          </p>
        </div>
        {!forbidden && (
          <Button variant="outline" onClick={onRetry} disabled={isFetching}>
            {isFetching ? 'Đang tải...' : 'Thử lại'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
