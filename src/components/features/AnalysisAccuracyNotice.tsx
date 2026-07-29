import { useState } from 'react'
import { ChevronDown, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AnalysisAccuracyNotice({ resultLabel }: { resultLabel: string }) {
  const [open, setOpen] = useState(false)

  return (
    <aside
      role="note"
      aria-label="Lưu ý về độ chính xác của kết quả"
      className="border-warning/35 bg-warning/10 overflow-hidden rounded-lg border"
    >
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="hover:bg-warning/10 h-auto w-full justify-start rounded-none px-3 py-2.5 text-left sm:px-4"
      >
        <TriangleAlert className="text-warning h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Lưu ý về độ chính xác</span>
          <span className="text-muted-foreground block truncate text-xs font-normal">
            Độ chi tiết khoảng 150 m · có thể bị ảnh hưởng bởi mây
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </Button>
      {open && (
        <div className="border-warning/20 space-y-1.5 border-t px-3 py-3 sm:px-4">
          <p className="text-foreground/85 text-sm leading-relaxed">
            Số liệu được ước tính từ ảnh vệ tinh. Bản đồ tải xuống có độ phân giải khoảng 150 m,
            nghĩa là mỗi điểm ảnh đại diện cho một khu vực khoảng 150 × 150 m; ranh giới và diện
            tích có thể có sai số.
          </p>
          <p className="text-foreground/85 text-sm leading-relaxed">
            Mây, bóng mây, khói hoặc khu vực thiếu ảnh có thể làm {resultLabel} thay đổi đáng kể
            giữa các lần cập nhật. Nên đối chiếu với kiểm tra thực địa và các nguồn dữ liệu khác
            trước khi đưa ra quyết định.
          </p>
        </div>
      )}
    </aside>
  )
}
