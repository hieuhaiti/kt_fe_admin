import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
  type QueryKey,
} from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useLoadingStore } from '@/stores/common/useLoadingStore'
import { apiClient } from '@/service'

type QueryFn<T> = () => Promise<T>

export interface ApiErrorLike {
  status?: number
  isAuthRequest?: boolean
  meta?: {
    suppressGlobalError?: boolean
  }
  body?: {
    status?: number
    statusCode?: number
    message?: string
  }
  message?: string
}

interface MessageHolder {
  message?: string
}

const SESSION_EXPIRED_TOAST_ID = 'session-expired'

function notifyUnauthorized() {
  toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', {
    toastId: SESSION_EXPIRED_TOAST_ID,
  })
}

export function useApiQuery<TData = unknown, TError = ApiErrorLike>(
  key: string | readonly unknown[],
  queryFn: QueryFn<TData>,
  options: Omit<UseQueryOptions<TData, TError, TData, QueryKey>, 'queryKey' | 'queryFn'> = {},
  loading = true,
  notification = false
) {
  const navigate = useNavigate()
  const setLoading = useLoadingStore((s) => s.setLoading)

  const query = useQuery<TData, TError>({
    queryKey: (Array.isArray(key) ? key : [key]) as QueryKey,
    queryFn,
    retry: false,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    ...options,
  })

  useEffect(() => {
    if (loading) setLoading(query.isLoading || query.isFetching)
    else setLoading(false)
  }, [query.isLoading, query.isFetching, loading, setLoading])

  useEffect(() => {
    if (notification && query.isSuccess && query.data) {
      const msg = (query.data as MessageHolder).message
      if (msg) toast.success(msg)
    }
  }, [notification, query.isSuccess, query.data])

  useEffect(() => {
    if (!query.error) return
    const err = query.error as ApiErrorLike
    if (err.meta?.suppressGlobalError) return

    const status = err.status || err.body?.status || err.body?.statusCode
    if (status === 401 && !err.isAuthRequest) {
      apiClient.clearTokens()
      notifyUnauthorized()
      navigate('/login', { replace: true })
    }
  }, [query.error, navigate])

  return query
}

export function useApiMutation<TData = unknown, TVariables = void, TError = ApiErrorLike>(
  mutationFn: (body: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TError, TVariables> = {},
  notification = true
) {
  const navigate = useNavigate()
  const setLoading = useLoadingStore((s) => s.setLoading)

  const mutation = useMutation<TData, TError, TVariables>({
    mutationFn,
    ...options,

    onSuccess: (data, variables, context) => {
      if (notification && data) {
        const msg = (data as MessageHolder).message
        if (msg) toast.success(msg)
      }
      if (typeof options.onSuccess === 'function') {
        ;(options.onSuccess as (data: TData, variables: TVariables, context: unknown) => void)(
          data,
          variables,
          context
        )
      }
    },

    onError: (error, variables, context) => {
      const err = error as ApiErrorLike
      const status = err.status || err.body?.status || err.body?.statusCode

      if (status === 401 && !err.isAuthRequest) {
        apiClient.clearTokens()
        notifyUnauthorized()
        navigate('/login', { replace: true })
        return
      }

      if (typeof options.onError === 'function') {
        ;(options.onError as (error: TError, variables: TVariables, context: unknown) => void)(
          error,
          variables,
          context
        )
      }
    },
  })

  useEffect(() => {
    setLoading(mutation.isPending)
  }, [mutation.isPending, setLoading])

  return mutation
}

export function useQueryCache() {
  const qc = useQueryClient()

  const getCached = <T = unknown>(key: string | readonly unknown[]) =>
    qc.getQueryData<T>((Array.isArray(key) ? key : [key]) as QueryKey)
  const setCached = <T = unknown>(key: string | readonly unknown[], data: T) =>
    qc.setQueryData<T>((Array.isArray(key) ? key : [key]) as QueryKey, data)
  const removeQuery = (key: string | readonly unknown[]) =>
    qc.removeQueries({ queryKey: (Array.isArray(key) ? key : [key]) as QueryKey })

  return { getCached, setCached, removeQuery }
}

export default { useApiQuery, useApiMutation, useQueryCache }
