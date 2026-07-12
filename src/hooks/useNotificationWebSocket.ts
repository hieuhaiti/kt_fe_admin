import { useEffect, useMemo, useRef } from 'react'
import { tokenManager } from '@/lib/tokenManager'

type UseNotificationWebSocketOptions = {
    enabled?: boolean
    onMessage: () => void
}

const WS_BASE_URL = import.meta.env.VITE_WS_URL || ''

function buildNotificationSocketUrl(token?: string) {
    if (!WS_BASE_URL) return ''
    // If .env already includes /ws suffix (VITE_WS_URL=wss://.../ws) don't double it.
    const base = WS_BASE_URL.replace(/^http/, 'ws').replace(/\/+$/, '')
    const rawUrl = /\/ws$/.test(base) ? base : `${base}/ws`

    let url: URL
    try {
        url = new URL(rawUrl)
    } catch {
        return ''
    }

    if (token) {
        url.searchParams.set('token', token)
    }

    return url.toString()
}

export function useNotificationWebSocket(options: UseNotificationWebSocketOptions) {
    const { enabled = true, onMessage } = options
    const reconnectTimeoutRef = useRef<number | null>(null)
    const reconnectAttemptRef = useRef(0)
    const socketRef = useRef<WebSocket | null>(null)
    const lastRefetchAtRef = useRef(0)

    const socketUrl = useMemo(() => {
        const token = tokenManager.getAccessToken() || undefined
        return buildNotificationSocketUrl(token)
    }, [])

    useEffect(() => {
        if (!enabled || !socketUrl) return

        let disposed = false

        const clearReconnectTimer = () => {
            if (reconnectTimeoutRef.current !== null) {
                window.clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
            }
        }

        const scheduleReconnect = () => {
            if (disposed) return
            clearReconnectTimer()

            const delay = Math.min(30000, 1000 * 2 ** reconnectAttemptRef.current)
            reconnectTimeoutRef.current = window.setTimeout(() => {
                reconnectAttemptRef.current += 1
                connect()
            }, delay)
        }

        const handleMessage = () => {
            const now = Date.now()
            if (now - lastRefetchAtRef.current < 500) return
            lastRefetchAtRef.current = now
            onMessage()
        }

        const connect = () => {
            if (disposed) return

            const socket = new WebSocket(socketUrl)
            socketRef.current = socket

            socket.onopen = () => {
                reconnectAttemptRef.current = 0
            }

            socket.onmessage = () => {
                handleMessage()
            }

            socket.onerror = () => {
                socket.close()
            }

            socket.onclose = () => {
                if (!disposed) scheduleReconnect()
            }
        }

        connect()

        return () => {
            disposed = true
            clearReconnectTimer()

            if (socketRef.current) {
                socketRef.current.onclose = null
                socketRef.current.close()
                socketRef.current = null
            }
        }
    }, [enabled, onMessage, socketUrl])
}
