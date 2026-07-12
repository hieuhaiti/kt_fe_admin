import { memo } from 'react'
import { HashLoader } from 'react-spinners'

function LoadingOverlay() {
  return (
    <div className="bg-background/60 fixed inset-0 z-10000 flex items-center justify-center backdrop-blur-sm transition-all duration-300">
      <HashLoader color="#14b8a5" />
    </div>
  )
}

export default memo(LoadingOverlay)
