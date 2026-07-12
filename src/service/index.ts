export { default as apiClient } from './common/apiClient'
export * from './common/useApi'

// Auth + core
export { default as authService } from './authService'
export { default as userService } from './userService'
export { default as notificationService } from './notificationService'

// Content
export { default as newsService } from './newsService'
export { default as newsCommentService } from './newsCommentService'
export { default as documentService } from './documentService'
export { default as citizenFeedbackService } from './citizenFeedbackService'
// Alias matching Postman naming
export { default as feedbackService } from './citizenFeedbackService'

// Map + GIS
export { default as mapImageService } from './mapImageService'
// Alias matching Postman naming
export { default as pdfMapService } from './mapImageService'
export { default as mapLayerService } from './mapLayerService'
export { default as mapLayerApiService } from './mapLayerApiService'
// Alias matching Postman naming
export { default as mapApiService } from './mapLayerApiService'

// GEE / satellite / weather / fire risk
export { default as weatherService } from './weatherService'
export { default as remoteSensingService } from './remoteSensingService'
export { default as fireRiskService } from './fireRiskService'
export { default as satelliteService } from './satelliteService'
export { default as forestClassificationService } from './forestClassificationService'
export { default as mobileService } from './mobileService'

// Stats / spatial
export { default as statisticsService } from './statisticsService'
export { default as statsService } from './statisticsService'

// Legacy / kept as-is (not in Postman)
export { default as searchService } from './searchService'
export { default as cronAlertService } from './cronAlertService'
