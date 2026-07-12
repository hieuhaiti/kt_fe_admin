import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useSidebarStore } from '@/stores/common/useSidebarStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { navConfig } from '@/constant/common'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { can, hasRole } from '@/lib/permissions'
import type { NavItem } from '@/types/common'

function isPathActive(pathname: string, item: Pick<NavItem, 'path' | 'subpath'>): boolean {
  const { path, subpath } = item
  if (!path) return false
  if (/^https?:\/\//i.test(path)) return false
  if (pathname === path) return true
  if (subpath && pathname === subpath) return true
  // Nested routes: match `/foo/bar` under `/foo`, but avoid matching `/foobar`.
  if (path !== '/' && pathname.startsWith(`${path}/`)) return true
  return false
}

export function SideBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isExpanded, setExpanded } = useSidebarStore() as {
    isExpanded: boolean
    setExpanded: (isExpanded: boolean) => void
    toggleSidebar: () => void
  }
  const user = useAuthStore((s) => s.user)
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null)

  const filteredNav = useMemo<NavItem[]>(() => {
    return navConfig
      .filter((item) => allowNav(item, user))
      .map((item) => ({
        ...item,
        subItems: item.subItems?.filter((sub) => allowNav(sub, user)),
      }))
      .filter((item) => !item.subItems || item.subItems.length || !hasAnyRestriction(item))
  }, [user])

  const handleMenuClick = (path: string) => {
    if (/^https?:\/\//i.test(path)) {
      window.open(path, '_blank', 'noopener,noreferrer')
      return
    }
    navigate(path)
  }

  // Auto-open parent menu whose subItems contain the active path
  useEffect(() => {
    const parent = filteredNav.find(
      (item) =>
        item.subItems?.some((sub) => isPathActive(location.pathname, sub as any)) ?? false
    )
    if (parent && isExpanded) setOpenSubMenu(parent.path)
  }, [location.pathname, filteredNav, isExpanded])

  useEffect(() => {
    if (!isExpanded) setOpenSubMenu(null)
  }, [isExpanded])

  return (
    <div className="bg-card flex h-full flex-col">
      <div className="flex items-center justify-between p-4">
        {isExpanded ? (
          <div className="flex items-center gap-2">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <span className="text-primary-foreground text-sm font-bold">KT</span>
            </div>
            <span className="text-foreground font-semibold">Kon Tum GIS</span>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <span className="text-primary-foreground text-sm font-bold">KT</span>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {filteredNav.map((item) => {
            const selfActive = isPathActive(location.pathname, item)
            const childActive =
              item.subItems?.some((sub) => isPathActive(location.pathname, sub as any)) ?? false
            const isActive = selfActive || childActive
            const hasSubItems = !!item.subItems && item.subItems.length > 0
            const isSubOpen = openSubMenu === item.path

            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <div className="relative">
                      {isActive && (
                        <span
                          className="bg-primary absolute top-1 bottom-1 left-0 w-1 rounded-r"
                          aria-hidden
                        />
                      )}
                      <Button
                        variant={isActive ? 'secondary' : 'ghost'}
                        className={cn(
                          'text-foreground hover:bg-primary/5 h-auto w-full justify-start gap-3 px-3 py-2 transition-colors',
                          isExpanded ? 'justify-start' : 'justify-center px-2',
                          isActive &&
                            'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-semibold'
                        )}
                        onClick={(e) => {
                          if (hasSubItems) {
                            e.stopPropagation()
                            setExpanded(true)
                            setOpenSubMenu(isSubOpen ? null : item.path)
                          } else {
                            handleMenuClick(item.path)
                          }
                        }}
                      >
                        <span
                          className={cn(
                            'flex items-center justify-center',
                            isActive ? 'text-primary' : 'text-muted-foreground'
                          )}
                        >
                          {item.icon}
                        </span>
                        {isExpanded && (
                          <span className="flex w-full items-center justify-between truncate text-sm font-medium">
                            {item.name}
                            {hasSubItems && (
                              <span className="ml-auto flex h-6 w-6 items-center justify-center">
                                {isSubOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </span>
                            )}
                          </span>
                        )}
                      </Button>
                    </div>

                    {hasSubItems && isSubOpen && isExpanded && (
                      <div className="mt-1 ml-4 space-y-1 border-l pl-2">
                        {item.subItems?.map((sub) => {
                          const subActive = isPathActive(location.pathname, sub as any)
                          return (
                            <Button
                              key={sub.path}
                              variant={subActive ? 'secondary' : 'ghost'}
                              className={cn(
                                'h-auto w-full justify-start gap-3 px-3 py-1.5 text-sm',
                                subActive &&
                                  'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-semibold'
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMenuClick(sub.path)
                              }}
                            >
                              <span
                                className={cn(
                                  'inline-block h-1.5 w-1.5 rounded-full',
                                  subActive ? 'bg-primary' : 'bg-muted-foreground/40'
                                )}
                              />
                              <span className="truncate">{sub.name}</span>
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right" sideOffset={8}>
                    <p>{item.name}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function allowNav(item: Pick<NavItem, 'roles' | 'permission'>, user: any): boolean {
  if (item.roles && !hasRole(user, item.roles)) return false
  if (item.permission && !can(user, item.permission)) return false
  return true
}

function hasAnyRestriction(item: NavItem): boolean {
  return !!(item.roles || item.permission)
}

export default SideBar
