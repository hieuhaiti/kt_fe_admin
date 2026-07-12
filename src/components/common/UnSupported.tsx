import { memo } from 'react'
import { Monitor } from 'lucide-react'

const UnSupported: React.FC = () => {
  return (
    <div className="bg-background fixed inset-0 z-10000 flex items-center justify-center backdrop-blur-sm transition-all duration-300">
      <div className="px-6 text-center">
        <div className="mb-6 flex justify-center">
          <Monitor className="h-20 w-20 text-teal-500" />
        </div>
        <h2 className="text-foreground mb-4 text-2xl font-semibold">Thiết bị không được hỗ trợ</h2>
        <p className="text-foreground/70 mx-auto mb-6 max-w-md">
          Vui lòng sử dụng thiết bị có màn hình lớn hơn (từ 1024px trở lên) để trải nghiệm tốt nhất
          ứng dụng.
        </p>
      </div>
    </div>
  )
}

export default memo(UnSupported)
