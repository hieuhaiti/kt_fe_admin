import type { CronAlertLog } from '@/types/api'

export const CRON_ALERT_STATUS_LABEL: Record<CronAlertLog['status'], string> = {
  running: 'Đang chạy',
  success: 'Thành công',
  waiting_retry: 'Chờ retry',
  failed_final: 'Thất bại cuối',
}

export const CRON_ALERT_STATUS_BADGE_CLASS: Record<CronAlertLog['status'], string> = {
  running: 'bg-sky-100 text-sky-700 border-sky-200',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  waiting_retry: 'bg-amber-100 text-amber-700 border-amber-200',
  failed_final: 'bg-red-100 text-red-700 border-red-200',
}

export const CRON_ALERT_STATUS_DOT_CLASS: Record<CronAlertLog['status'], string> = {
  running: 'bg-sky-500',
  success: 'bg-emerald-500',
  waiting_retry: 'bg-amber-500',
  failed_final: 'bg-red-500',
}

export const CRON_ALERT_SCHEDULE_LABEL: Record<CronAlertLog['schedule_type'], string> = {
  day_1: 'Ngày 1',
  day_15: 'Ngày 15',
  retry: 'Retry',
}

export const CRON_ALERT_SCHEDULE_BADGE_CLASS: Record<CronAlertLog['schedule_type'], string> = {
  day_1: 'bg-blue-50 text-blue-700 border-blue-200',
  day_15: 'bg-violet-50 text-violet-700 border-violet-200',
  retry: 'bg-slate-100 text-slate-700 border-slate-200',
}

export const CRON_ALERT_SCHEDULE_DOT_CLASS: Record<CronAlertLog['schedule_type'], string> = {
  day_1: 'bg-blue-500',
  day_15: 'bg-violet-500',
  retry: 'bg-slate-500',
}

export const CRON_ALERT_STATUS_FILTER_OPTIONS: Array<{
  value: 'all' | CronAlertLog['status']
  label: string
}> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'running', label: CRON_ALERT_STATUS_LABEL.running },
  { value: 'success', label: CRON_ALERT_STATUS_LABEL.success },
  { value: 'waiting_retry', label: CRON_ALERT_STATUS_LABEL.waiting_retry },
  { value: 'failed_final', label: CRON_ALERT_STATUS_LABEL.failed_final },
]

export const CRON_ALERT_SCHEDULE_FILTER_OPTIONS: Array<{
  value: 'all' | CronAlertLog['schedule_type']
  label: string
}> = [
  { value: 'all', label: 'Tất cả loại lịch' },
  { value: 'day_1', label: CRON_ALERT_SCHEDULE_LABEL.day_1 },
  { value: 'day_15', label: CRON_ALERT_SCHEDULE_LABEL.day_15 },
  { value: 'retry', label: CRON_ALERT_SCHEDULE_LABEL.retry },
]
