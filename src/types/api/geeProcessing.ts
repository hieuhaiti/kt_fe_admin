export type GeePipeline = 'fire-risk' | 'forest-classification'

export type GeeProcessingStage =
  | 'idle'
  | 'queued'
  | 'pending'
  | 'computing'
  | 'exporting'
  | 'completed'
  | 'published'
  | 'failed'

export interface GeeDistrictExportProgress {
  status: 'not_started' | 'queued' | 'running' | 'completed' | 'completed_with_errors'
  total: number
  completed: number
  failed: number
  skipped: number
  pending: number
  progressPercent: number
}

export interface GeeProcessingState {
  pipeline: GeePipeline
  state: GeeProcessingStage
  queue: {
    status: 'idle' | 'queued' | 'running'
    concurrency: 1
    maxPending: number
    capacityRemaining: number
    accepting: boolean
    /** 0 khi đang chạy; 1..N khi đang chờ; null khi pipeline không nằm trong queue. */
    position: number | null
    jobsAhead: number
    waitingCount: number
    enqueuedAt: string | null
    startedAt: string | null
    globalBusy: boolean
    activePipeline: GeePipeline | null
    activePipelineLabel: string | null
  }
  districtExport: GeeDistrictExportProgress
  retry: {
    count: number
    nextRetryAt: string | null
    lastError: string | null
  }
}
