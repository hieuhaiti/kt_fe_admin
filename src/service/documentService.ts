import apiClient from './common/apiClient'
import type {
  ApiResponse,
  Document,
  DocumentListData,
  DocumentListParams,
  PatchDocumentBody,
  UpdateDocumentBody,
} from '@/types/api'
import { serviceDocumentPath, serviceAdminDocumentPath } from '@/constant/serviceConstant'

export default {
  /** GET /documents (public list) */
  getPublicList: (params?: DocumentListParams) =>
    apiClient.get<DocumentListData>(serviceDocumentPath, { params }),

  /** GET /documents/:documentId (public detail) */
  getPublicById: (documentId: number | string) =>
    apiClient.get<Document>(`${serviceDocumentPath}/${documentId}`),

  /**
   * GET /documents (list — admin & public share the same route).
   * Server uses `optionalAuth` + `canViewInternal(actor)` to return non-public
   * items when the caller has `documents:read`. `/admin/documents` list does
   * NOT exist on the server.
   */
  getAll: (params?: DocumentListParams) =>
    apiClient.get<DocumentListData>(serviceDocumentPath, { params }),

  /** GET /admin/documents/:documentId (admin detail, includes vi+en) */
  getById: (documentId: number | string) =>
    apiClient.get<Document>(`${serviceAdminDocumentPath}/${documentId}`),

  /**
   * POST /admin/documents
   * Multipart body: lang, title, description, docType, isPublic, file
   */
  create: (data: FormData) => apiClient.post<Document>(serviceAdminDocumentPath, data, true),

  /** PATCH /admin/documents/:documentId (partial: isPublic, docType, expectedUpdatedAt) */
  patch: (documentId: number | string, data: PatchDocumentBody) =>
    apiClient.patch<Document>(`${serviceAdminDocumentPath}/${documentId}`, data),

  /**
   * PUT /admin/documents/:documentId
   * body: { docType, isPublic, expectedUpdatedAt, translations: { vi:{...} } }
   */
  update: (documentId: number | string, data: UpdateDocumentBody) =>
    apiClient.put<Document>(`${serviceAdminDocumentPath}/${documentId}`, data),

  /** DELETE /admin/documents/:documentId */
  delete: (documentId: number | string) =>
    apiClient.del<ApiResponse<{}>>(`${serviceAdminDocumentPath}/${documentId}`),
}
