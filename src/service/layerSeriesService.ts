import apiClient from './common/apiClient'
import type {
  LayerSeriesGroup,
  LayerSeriesGroupPayload,
  LayerSeriesGroupsListData,
  LayerSeriesTimeline,
} from '@/types/api'
import { serviceLayerSeriesPath } from '@/constant/serviceConstant'

/**
 * Time-series raster layer groups.
 * Server routes: GET /map/layer-groups, GET /map/layer-groups/:group/timeline,
 * POST/PATCH/DELETE /map/layer-groups for administration.
 */
export default {
  /** GET /map/layer-groups */
  getAll: () => apiClient.get<LayerSeriesGroupsListData>(serviceLayerSeriesPath),

  /** GET /map/layer-groups/:groupCode/timeline */
  getTimeline: (groupCode: string) =>
    apiClient.get<LayerSeriesTimeline>(
      `${serviceLayerSeriesPath}/${encodeURIComponent(groupCode)}/timeline`
    ),

  create: (data: LayerSeriesGroupPayload) =>
    apiClient.post<LayerSeriesGroup>(serviceLayerSeriesPath, data),

  update: (groupCode: string, data: Partial<Omit<LayerSeriesGroupPayload, 'code'>>) =>
    apiClient.patch<LayerSeriesGroup>(
      `${serviceLayerSeriesPath}/${encodeURIComponent(groupCode)}`,
      data
    ),

  delete: (groupCode: string) =>
    apiClient.del<LayerSeriesGroup>(
      `${serviceLayerSeriesPath}/${encodeURIComponent(groupCode)}`
    ),
}

export type { LayerSeriesGroup, LayerSeriesTimeline }
