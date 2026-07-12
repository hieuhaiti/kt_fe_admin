import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useLoadingStore } from '@/stores/common/useLoadingStore'
import { apiClient } from '@/service'

type QueryFn<T> = () => Promise<T>

const SESSION_EXPIRED_TOAST_ID = 'session-expired'

function notifyUnauthorized() {
  toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', {
    toastId: SESSION_EXPIRED_TOAST_ID,
  })
}

export function useApiQuery<T = any>(
  key: string | readonly unknown[],
  queryFn: QueryFn<T>,
  options: Omit<UseQueryOptions<T, any, T, any>, 'queryKey' | 'queryFn'> = {},
  loading = true,
  notification = false
) {
  const navigate = useNavigate()
  const setLoading = useLoadingStore((s: any) => s.setLoading)

  const query = useQuery<T>({
    queryKey: Array.isArray(key) ? (key as any) : [key],
    queryFn,
    retry: false,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    ...(options as any),
  })

  useEffect(() => {
    if (loading) setLoading(query.isLoading || query.isFetching)
    else setLoading(false)
  }, [query.isLoading, query.isFetching, loading, setLoading])

  useEffect(() => {
    if (notification && query.isSuccess && query.data && (query.data as any).message) {
      toast.success((query.data as any).message)
    }
  }, [notification, query.isSuccess, query.data])

  useEffect(() => {
    if (!query.error) return
    const err: any = query.error
    if (err?.meta?.suppressGlobalError) return

    const status = err?.status || err?.body?.status || err?.body?.statusCode
    if (status === 401 && !err?.isAuthRequest) {
      apiClient.clearTokens()
      notifyUnauthorized()
      navigate('/login', { replace: true })
    }
  }, [query.error, navigate])

  return query
}

export function useApiMutation<TData = any, TVariables = any>(
  mutationFn: (body: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, any, TVariables> = {},
  notification = true
) {
  const navigate = useNavigate()
  const setLoading = useLoadingStore((s: any) => s.setLoading)

  const mutation = useMutation<TData, any, TVariables>({
    mutationFn,
    ...options,

    onSuccess: (data, variables, context) => {
      if (notification && (data as any)?.message) {
        toast.success((data as any).message)
      }
      ;(options.onSuccess as any)?.(data as any, variables, context)
    },

    onError: (error: any, variables, context) => {
      const status = error?.status || error?.body?.status || error?.body?.statusCode

      if (status === 401 && !error?.isAuthRequest) {
        apiClient.clearTokens()
        notifyUnauthorized()
        navigate('/login', { replace: true })
        return
      }

      ;(options.onError as any)?.(error as any, variables, context)
    },
  })

  useEffect(() => {
    setLoading(mutation.isPending)
  }, [mutation.isPending, setLoading])

  return mutation
}

export function useQueryCache() {
  const qc = useQueryClient()

  const getCached = (key: string | readonly unknown[]) =>
    qc.getQueryData(Array.isArray(key) ? key : [key])
  const setCached = (key: string | readonly unknown[], data: any) =>
    qc.setQueryData(Array.isArray(key) ? key : [key], data)
  const removeQuery = (key: string | readonly unknown[]) =>
    qc.removeQueries({ queryKey: Array.isArray(key) ? key : [key] })

  return { getCached, setCached, removeQuery }
}

export default { useApiQuery, useApiMutation, useQueryCache }
