/** Server searchTypeParamSchema valid set */
export type SearchType =
  | 'news'
  | 'documents'
  | 'citizen-feedbacks'
  | 'map-layers'
  | 'map-layer-apis'
  | 'map-images'
  | 'users'
  | 'notifications'

export interface SearchResultItem {
  id: number
  type: SearchType
  title: string
  description?: string
  url?: string
  metadata?: Record<string, any>
}

export interface SearchResult {
  query: string
  type: SearchType
  items: SearchResultItem[]
  total: number
}
