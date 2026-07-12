import apiClient from './common/apiClient'
import type { ApiResponse, SearchType, SearchResult } from '@/types/api'
import { serviceSearchPath } from '@/constant/serviceConstant'

export default {
  /** GET /search/:type?q=... */
  searchByType: (type: SearchType, q: string) =>
    apiClient.get<ApiResponse<SearchResult>>(`${serviceSearchPath}/${type}`, { q }),

  /** GET /search/types */
  getTypes: () => apiClient.get<ApiResponse<SearchType[]>>(`${serviceSearchPath}/types`),
}
