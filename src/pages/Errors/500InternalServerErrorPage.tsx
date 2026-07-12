import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'

export default function InternalServerErrorPage(): JSX.Element {
  const navigate = useNavigate()

  return (
    <main className="bg-background grid min-h-screen place-items-center px-6 py-24 transition-colors duration-400 sm:py-32 lg:px-8">
      <div className="text-center">
        <p className="text-4xl text-(--error-500-bg-color)">500</p>
        <h1 className="text-foreground mt-4 text-5xl tracking-tight sm:text-7xl">
          {'Lỗi máy chủ nội bộ'}
        </h1>
        <p className="text-foreground mt-6 text-lg font-medium sm:text-xl">
          {'Đã xảy ra lỗi trên phía máy chủ.'}
        </p>
        <div className="mt-10 flex items-center justify-center">
          <button
            onClick={() => navigate('/')}
            className="rounded-md bg-(--error-500-bg-color) px-4 py-2 text-sm text-white shadow-(--shadow-md) transition hover:brightness-90"
          >
            {'Quay lại trang chủ'}
          </button>
        </div>
      </div>
    </main>
  )
}
