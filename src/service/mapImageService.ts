import apiClient from './common/apiClient'
import type {
  ApiResponse,
  PdfMap,
  PdfMapListData,
  PdfMapListParams,
  UpdatePdfMapBody,
} from '@/types/api'
import { servicePdfMapPath, serviceAdminPdfMapPath } from '@/constant/serviceConstant'

/**
 * Postman renamed the old "map images" module to PDF Maps.
 * This service now targets `/pdf-maps` (public) and `/admin/pdf-maps` (admin).
 * Legacy import path kept as `mapImageService` for backwards compatibility.
 */
export default {
  /** GET /pdf-maps (public list) */
  getPublicList: (params?: PdfMapListParams) =>
    apiClient.get<PdfMapListData>(servicePdfMapPath, { params }),

  /** GET /pdf-maps/:pdfMapId (public detail) */
  getPublicById: (pdfMapId: number | string) =>
    apiClient.get<PdfMap>(`${servicePdfMapPath}/${pdfMapId}`),

  /** GET /admin/pdf-maps (admin list) */
  getAll: (params?: PdfMapListParams) =>
    apiClient.get<PdfMapListData>(serviceAdminPdfMapPath, { params }),

  /** GET /admin/pdf-maps/:pdfMapId (admin detail, includes vi+en) */
  getById: (pdfMapId: number | string) =>
    apiClient.get<PdfMap>(`${serviceAdminPdfMapPath}/${pdfMapId}`),

  /**
   * POST /admin/pdf-maps  (multipart)
   * body: file, thumbnail?, themeCode, year, scale, region, lang, title,
   *       description, isPublic, thumbnailUrl (fallback)
   */
  create: (data: FormData) => apiClient.post<PdfMap>(serviceAdminPdfMapPath, data, true),

  /**
   * PUT /admin/pdf-maps/:pdfMapId
   * body: { themeCode, year, scale, region, thumbnailUrl, isPublic,
   *         expectedUpdatedAt, translations: { vi:{...} } }
   */
  update: (pdfMapId: number | string, data: UpdatePdfMapBody) =>
    apiClient.put<PdfMap>(`${serviceAdminPdfMapPath}/${pdfMapId}`, data),

  /** PUT /admin/pdf-maps/:pdfMapId/translations/:lang */
  updateTranslation: (
    pdfMapId: number | string,
    lang: 'vi' | 'en',
    data: { title: string; description?: string }
  ) =>
    apiClient.put<PdfMap>(
      `${serviceAdminPdfMapPath}/${pdfMapId}/translations/${lang}`,
      data
    ),

  /** DELETE /admin/pdf-maps/:pdfMapId (soft delete) */
  delete: (pdfMapId: number | string) =>
    apiClient.del<ApiResponse<{}>>(`${serviceAdminPdfMapPath}/${pdfMapId}`),

  /**
   * Legacy toggle-status endpoint isn't in Postman; falls back to a partial update
   * of `isPublic`. Caller must supply an expectedUpdatedAt via the second argument.
   */
  toggleStatus: (pdfMapId: number | string, expectedUpdatedAt: string, isPublic: boolean) =>
    apiClient.put<PdfMap>(`${serviceAdminPdfMapPath}/${pdfMapId}`, {
      isPublic,
      expectedUpdatedAt,
    }),
}
