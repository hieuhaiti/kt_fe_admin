import { Menu } from 'lucide-react'
import { useSidebarStore } from '@/stores/common/useSidebarStore'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { NotificationMenu } from '@/components/layout/NotificationMenu'
import { UserMenu } from '@/components/layout/UserMenu'

export function Header() {
  const { isExpanded, toggleSidebar } = useSidebarStore() as {
    isExpanded: boolean
    toggleSidebar: () => void
  }

  return (
    <header className="bg-background/95 text-foreground supports-backdrop-filter:bg-background/60 border-border sticky top-0 z-10 border-b backdrop-blur">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side - Toggle và Title */}
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Toggle sidebar"
                onClick={() => toggleSidebar()}
                className="hover:bg-muted relative h-8 w-8 p-0 shadow-sm"
              >
                <Menu className="text-foreground h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{isExpanded ? 'Thu gọn sidebar' : 'Mở rộng sidebar'}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-3">
          <NotificationMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
