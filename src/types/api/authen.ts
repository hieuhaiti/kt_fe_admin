import type { User } from './user'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  tokenType?: string
  expiresIn?: string | number
  refreshExpiresIn?: string | number
}

export interface AuthLoginData extends AuthTokens {
  user?: Pick<User, 'id' | 'email' | 'fullName' | 'roleCode'> & Record<string, any>
}

export interface AuthRegisterData extends AuthTokens {
  user?: User
  requireEmailVerification?: boolean
}

export interface AuthRefreshData {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: string | number
  refreshExpiresIn?: string | number
}

export interface AuthMeData {
  user: User
}

export interface AuthLogoutData {}

export interface AuthSetPasswordData {
  hasPassword: boolean
}

export interface LoginBody {
  email: string
  password: string
}

export interface RegisterBody {
  email: string
  password: string
  fullName: string
  phone?: string
}

export interface RefreshBody {
  refreshToken: string
}

export interface ForgotPasswordBody {
  email: string
}

export interface ResetPasswordBody {
  token: string
  newPassword: string
}

export interface VerifyEmailBody {
  token: string
}

export interface ResendVerificationBody {
  email: string
}

export interface GoogleMobileBody {
  idToken: string
}

export interface OAuthExchangeBody {
  code: string
}

export interface UpdateProfileBody {
  fullName?: string
  phone?: string
  avatarUrl?: string
  addressDetail?: string
}

export interface ChangePasswordBody {
  oldPassword: string
  newPassword: string
}

export interface SetPasswordBody {
  newPassword: string
}

export interface LogoutBody {
  refreshToken?: string
}
