export interface CronAlertVegetation {
  increaseKm2: number
  decreaseKm2: number
}

export interface CronAlertLog {
  id: number
  job_name: string
  schedule_type: 'day_1' | 'day_15' | 'retry'
  scheduled_date: string
  status: 'running' | 'success' | 'waiting_retry' | 'failed_final'
  attempt_no: number

  base_period1_start?: string | null
  base_period1_end?: string | null
  base_period2_start?: string | null
  base_period2_end?: string | null

  actual_period1_start?: string | null
  actual_period1_end?: string | null
  actual_period2_start?: string | null
  actual_period2_end?: string | null

  period1_retry_count: number
  period2_retry_count: number
  next_retry_date?: string | null
  last_error?: string | null
  request_payload?: Record<string, unknown> | null
  raw_response?: Record<string, unknown> | null
  started_at?: string | null
  finished_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  vegetation?: CronAlertVegetation
}

export interface CronAlertLogListParams {
  page?: number
  limit?: number
  status?: 'running' | 'success' | 'waiting_retry' | 'failed_final'
  schedule_type?: 'day_1' | 'day_15' | 'retry'
  from_date?: string
  to_date?: string
}

export interface CronAlertLogListData {
  logs: CronAlertLog[]
  pagination: import('./index').Pagination
}

export interface RetryCronLogResponse {
  success: boolean
  skipped?: boolean
  reason?: string
  log?: CronAlertLog | null
}

export interface TestMainCronResponse {
  success: boolean
  skipped?: boolean
  reason?: string
  logId?: number
  scheduleType?: 'day_1' | 'day_15'
  scheduledDate?: string
  jobName?: string
}
