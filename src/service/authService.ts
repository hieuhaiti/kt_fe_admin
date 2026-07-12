import apiClient from './common/apiClient'
import type {
  ApiResponse,
  AuthLoginData,
  AuthRegisterData,
  AuthRefreshData,
  AuthMeData,
  AuthLogoutData,
  AuthSetPasswordData,
  LoginBody,
  RegisterBody,
  RefreshBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  VerifyEmailBody,
  ResendVerificationBody,
  GoogleMobileBody,
  OAuthExchangeBody,
  UpdateProfileBody,
  ChangePasswordBody,
  SetPasswordBody,
  LogoutBody,
} from '@/types/api'
import { serviceAuthPath } from '@/constant/serviceConstant'

export default {
  /** POST /auth/register */
  register: (data: RegisterBody) =>
    apiClient.post<AuthRegisterData>(`${serviceAuthPath}/register`, data),

  /** POST /auth/login */
  login: (data: LoginBody) => apiClient.post<AuthLoginData>(`${serviceAuthPath}/login`, data),

  /** POST /auth/refresh */
  refreshToken: (data: RefreshBody) =>
    apiClient.post<AuthRefreshData>(`${serviceAuthPath}/refresh`, data),

  /** POST /auth/forgot-password */
  forgotPassword: (data: ForgotPasswordBody) =>
    apiClient.post<ApiResponse<{}>>(`${serviceAuthPath}/forgot-password`, data),

  /** POST /auth/reset-password */
  resetPassword: (data: ResetPasswordBody) =>
    apiClient.post<ApiResponse<{}>>(`${serviceAuthPath}/reset-password`, data),

  /** POST /auth/verify-email */
  verifyEmail: (data: VerifyEmailBody) =>
    apiClient.post<ApiResponse<{}>>(`${serviceAuthPath}/verify-email`, data),

  /** POST /auth/resend-verification */
  resendVerification: (data: ResendVerificationBody) =>
    apiClient.post<ApiResponse<{}>>(`${serviceAuthPath}/resend-verification`, data),

  /** POST /auth/google/mobile */
  googleMobile: (data: GoogleMobileBody) =>
    apiClient.post<AuthLoginData>(`${serviceAuthPath}/google/mobile`, data),

  /** POST /auth/oauth/exchange */
  oauthExchange: (data: OAuthExchangeBody) =>
    apiClient.post<AuthLoginData>(`${serviceAuthPath}/oauth/exchange`, data),

  /** GET /auth/me */
  getProfile: () => apiClient.get<AuthMeData>(`${serviceAuthPath}/me`),

  /** PATCH /auth/me (JSON body: fullName, phone, avatarUrl, addressDetail) */
  updateProfile: (data: UpdateProfileBody | FormData) => {
    if (data instanceof FormData) {
      return apiClient.patch<AuthMeData>(`${serviceAuthPath}/me`, data, { useForm: true })
    }
    return apiClient.patch<AuthMeData>(`${serviceAuthPath}/me`, data)
  },

  /** POST /auth/change-password */
  changePassword: (data: ChangePasswordBody) =>
    apiClient.post<ApiResponse<{}>>(`${serviceAuthPath}/change-password`, data),

  /** POST /auth/set-password */
  setPassword: (data: SetPasswordBody) =>
    apiClient.post<AuthSetPasswordData>(`${serviceAuthPath}/set-password`, data),

  /** POST /auth/logout */
  logout: (data?: LogoutBody) =>
    apiClient.post<AuthLogoutData>(`${serviceAuthPath}/logout`, data ?? {}),
}
