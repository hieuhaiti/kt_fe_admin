export const ACCESS_TOKEN_KEY = 'access_token'
export const REFRESH_TOKEN_KEY = 'refresh_token'
export const TOKEN_TYPE_KEY = 'token_type'
export const TOKEN_EXPIRES_IN_KEY = 'token_expires_in'
export const REFRESH_EXPIRES_IN_KEY = 'refresh_expires_in'
export const LOGIN_TIMESTAMP_KEY = 'login_timestamp'
export const ANONYMOUS_ID_KEY = 'anonymous_id'

export function parseDurationToDays(duration: string): number {
  if (!duration) return 0
  const match = /^([0-9]+)([smhd])$/i.exec(duration)
  if (!match) return 0
  const value = parseInt(match[1], 10)
  const unit = match[2].toLowerCase()

  switch (unit) {
    case 's':
      return value / 86400
    case 'm':
      return value / 1440
    case 'h':
      return value / 24
    case 'd':
      return value
    default:
      return 0
  }
}

function ensureAnonymousId(): string {
  const existing = localStorage.getItem(ANONYMOUS_ID_KEY)
  if (existing) return existing
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`
  localStorage.setItem(ANONYMOUS_ID_KEY, uuid)
  return uuid
}

export const tokenManager = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => localStorage.setItem(ACCESS_TOKEN_KEY, token),
  removeAccessToken: () => localStorage.removeItem(ACCESS_TOKEN_KEY),

  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => localStorage.setItem(REFRESH_TOKEN_KEY, token),
  removeRefreshToken: () => localStorage.removeItem(REFRESH_TOKEN_KEY),

  getTokenType: () => localStorage.getItem(TOKEN_TYPE_KEY),
  setTokenType: (type: string) => localStorage.setItem(TOKEN_TYPE_KEY, type),
  removeTokenType: () => localStorage.removeItem(TOKEN_TYPE_KEY),

  getLoginTimestamp: () => localStorage.getItem(LOGIN_TIMESTAMP_KEY),
  setLoginTimestamp: (timestamp: string) => localStorage.setItem(LOGIN_TIMESTAMP_KEY, timestamp),
  removeLoginTimestamp: () => localStorage.removeItem(LOGIN_TIMESTAMP_KEY),

  getAnonymousId: () => localStorage.getItem(ANONYMOUS_ID_KEY),
  ensureAnonymousId,
  removeAnonymousId: () => localStorage.removeItem(ANONYMOUS_ID_KEY),

  clearAll: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(TOKEN_TYPE_KEY)
    localStorage.removeItem(LOGIN_TIMESTAMP_KEY)
  },
}
