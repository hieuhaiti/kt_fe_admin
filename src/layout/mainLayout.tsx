import React from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { SideBar } from '@/components/layout/SideBar'
import { useSidebarStore } from '@/stores/common/useSidebarStore'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children?: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isExpanded } = useSidebarStore() as { isExpanded: boolean }

  return (
    <div className="bg-background flex h-screen w-full overflow-hidden text-sm">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-card border-border fixed top-0 left-0 h-screen border-r transition-all duration-300 ease-in-out',
          isExpanded ? 'w-64' : 'w-16'
        )}
      >
        <SideBar />
      </aside>

      {/* Main content area */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out',
          isExpanded ? 'ml-64' : 'ml-16'
        )}
      >
        <Header />

        {/* Main content */}
        <main className="flex min-h-0 flex-1 flex-col p-4">
          <div className="flex min-h-0 flex-1 flex-col">{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
  )
}

export default MainLayout
