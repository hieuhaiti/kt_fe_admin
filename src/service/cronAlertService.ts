import apiClient from './common/apiClient'
import type {
  ApiResponse,
  CronAlertLogListData,
  CronAlertLogListParams,
  RetryCronLogResponse,
  TestMainCronResponse,
} from '@/types/api'
import { serviceSatellitePath } from '@/constant/serviceConstant'

export default {
  getLogs: (params?: CronAlertLogListParams) =>
    apiClient.get<ApiResponse<CronAlertLogListData>>(`${serviceSatellitePath}/cron/logs`, params),

  retryLog: (id: number) =>
    apiClient.post<ApiResponse<RetryCronLogResponse>>(`${serviceSatellitePath}/cron/retry/${id}`, {
      force: true,
    }),

  testMain: (payload: { scheduledDate: string; jobName?: string }) =>
    apiClient.post<ApiResponse<TestMainCronResponse>>(
      `${serviceSatellitePath}/cron/test-main`,
      payload
    ),
}
