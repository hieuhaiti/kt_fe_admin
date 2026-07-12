import type { ReactNode } from 'react'
import { useLoadingStore } from '@/stores/common/useLoadingStore'
import LoadingOverlay from '@/components/common/LoadingOverlay'

export function LoadingProvider({ children }: { children: ReactNode }) {
  const { loading } = useLoadingStore() as { loading: boolean }

  return (
    <>
      {loading && <LoadingOverlay />}
      {children}
    </>
  )
}
