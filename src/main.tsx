import { createRoot } from 'react-dom/client'
import '@/theme/index.css'
import App from '@/App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { LoadingProvider } from '@/provider/loadingProvider.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { initTheme } from './lib/themeInit'
import { TooltipProvider } from './components/ui/tooltip'
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import 'maplibre-gl/dist/maplibre-gl.css'

initTheme()

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}
createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <LoadingProvider>
        <TooltipProvider delayDuration={100}>
          <App />
        </TooltipProvider>
      </LoadingProvider>
    </BrowserRouter>
    {/* <ReactQueryDevtools initialIsOpen={false} /> */}
  </QueryClientProvider>
)
