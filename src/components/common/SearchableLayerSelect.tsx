import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { mapLayerService, useApiQuery } from '@/service'
import type { ApiResponse, MapLayer } from '@/types/api'

export interface SearchableLayerSelectProps {
  value?: number | string | null
  onChange: (value: number | string, layer?: MapLayer | null) => void
  disabled?: boolean
  placeholder?: string
  includeAllOption?: boolean
  allOptionLabel?: string
  allOptionValue?: string
  className?: string
  triggerClassName?: string
  initialLayerName?: string
  initialLayerCode?: string
  isActive?: boolean
  geometryType?: string
}

function getLayerItems(data: unknown): MapLayer[] {
  const response = data as
    | ApiResponse<{ items?: MapLayer[]; mapLayers?: MapLayer[] } | MapLayer[]>
    | undefined
  const payload = response?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.mapLayers)) return payload.mapLayers
  return []
}

function layerLabel(layer: MapLayer): string {
  return layer.name_vi || layer.name || layer.code
}

export default function SearchableLayerSelect({
  value,
  onChange,
  disabled = false,
  placeholder = 'Chọn lớp bản đồ...',
  includeAllOption = false,
  allOptionLabel = 'Tất cả lớp bản đồ',
  allOptionValue = 'all',
  triggerClassName,
  initialLayerName,
  initialLayerCode,
  isActive = true,
  geometryType,
}: SearchableLayerSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [selectedLayerObj, setSelectedLayerObj] = useState<MapLayer | null>(null)

  const queryParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...(isActive !== undefined && { is_active: isActive }),
      ...(geometryType && { geometry_type: geometryType }),
      ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
    }),
    [isActive, geometryType, debouncedSearch]
  )

  const layerQuery = useApiQuery(
    ['searchable-map-layers', queryParams],
    () => mapLayerService.getAll(queryParams),
    {
      enabled: open || Boolean(value && String(value) !== allOptionValue),
      staleTime: 30 * 1000,
    },
    false,
    false
  )

  const layers = useMemo(() => getLayerItems(layerQuery.data), [layerQuery.data])

  const activeLayer = useMemo(() => {
    if (!value && value !== 0) return null
    if (String(value) === allOptionValue) return null
    if (selectedLayerObj && String(selectedLayerObj.id) === String(value)) return selectedLayerObj
    return layers.find((l) => String(l.id) === String(value)) ?? null
  }, [value, allOptionValue, selectedLayerObj, layers])

  const displayLayers = useMemo(() => {
    const list = [...layers]
    const current = activeLayer || selectedLayerObj
    if (
      current &&
      String(value) !== allOptionValue &&
      !list.some((l) => String(l.id) === String(current.id))
    ) {
      list.unshift(current)
    }
    return list
  }, [layers, activeLayer, selectedLayerObj, value, allOptionValue])

  const displayLabel = useMemo(() => {
    if (includeAllOption && String(value) === allOptionValue) {
      return allOptionLabel
    }
    if (!value && value !== 0) return ''

    if (activeLayer) {
      return `${layerLabel(activeLayer)} (${activeLayer.code})`
    }
    if (initialLayerName || initialLayerCode) {
      return [initialLayerName, initialLayerCode ? `(${initialLayerCode})` : '']
        .filter(Boolean)
        .join(' ')
    }
    return `#${value}`
  }, [
    value,
    includeAllOption,
    allOptionValue,
    allOptionLabel,
    activeLayer,
    initialLayerName,
    initialLayerCode,
  ])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={displayLabel || placeholder}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-10 w-full justify-between font-normal text-left px-3',
            !displayLabel && 'text-muted-foreground',
            triggerClassName
          )}
        >
          <span className="truncate">
            {displayLabel || (layerQuery.isLoading ? 'Đang tải...' : placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[min(max(400px,calc(var(--radix-popover-trigger-width)+8rem)),calc(100dvw-2rem))] p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc mã lớp..."
              className="pl-8 h-9 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {includeAllOption && (
            <button
              type="button"
              className={cn(
                'hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                String(value) === allOptionValue && 'bg-accent font-medium text-accent-foreground'
              )}
              onClick={() => {
                onChange(allOptionValue, null)
                setSelectedLayerObj(null)
                setOpen(false)
                setSearch('')
              }}
            >
              <span className="truncate font-medium">{allOptionLabel}</span>
              {String(value) === allOptionValue && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </button>
          )}

          {layerQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Đang tìm kiếm...</span>
            </div>
          ) : displayLayers.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Không tìm thấy lớp bản đồ phù hợp
            </div>
          ) : (
            displayLayers.map((layer) => {
              const isSelected = String(value) === String(layer.id)
              return (
                <button
                  key={layer.id ?? layer.code}
                  type="button"
                  className={cn(
                    'hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                    isSelected && 'bg-accent font-medium text-accent-foreground'
                  )}
                  onClick={() => {
                    onChange(layer.id ?? layer.code, layer)
                    setSelectedLayerObj(layer)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate font-medium">{layerLabel(layer)}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {layer.code} • {layer.geometry_type}
                    </p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
