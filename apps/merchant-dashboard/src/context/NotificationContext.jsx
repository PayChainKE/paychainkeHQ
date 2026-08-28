import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { useMerchantAuth } from './MerchantAuthContext'

const NotificationContext = createContext()

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Backend persists real account events (payments, sign-ins, bulk payouts, trust
// score changes) via Notification documents — this maps that shape onto what
// the UI already expects (`id`/`type`/`isRead`) rather than reshaping every consumer.
const mapNotification = (n) => ({
  id: n._id,
  type: n.kind,
  title: n.title,
  message: n.message,
  isRead: n.read,
  createdAt: n.createdAt,
})

export function NotificationProvider({ children }) {
  const { merchant, token, liveEventAt } = useMerchantAuth()

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [toasts, setToasts] = useState([])
  const pollRef = useRef(null)

  const authHeaders = useCallback(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token])

  const fetchNotifications = useCallback(async () => {
    if (!merchant?._id || !token) return
    try {
      const res = await axios.get(`${API_URL}/api/notifications`, { headers: authHeaders() })
      setNotifications((res.data.notifications || []).map(mapNotification))
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }, [merchant?._id, token, authHeaders])

  const fetchUnreadCount = useCallback(async () => {
    if (!merchant?._id || !token) return
    try {
      const res = await axios.get(`${API_URL}/api/notifications/unread-count`, { headers: authHeaders() })
      setUnreadCount(res.data.count || 0)
    } catch (err) {
      console.error('Failed to fetch unread notification count:', err)
    }
  }, [merchant?._id, token, authHeaders])

  // Load on login/merchant change, then poll for real events (payments,
  // sign-ins, etc.) that happen server-side without a page reload.
  useEffect(() => {
    if (!merchant?._id || !token) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    fetchNotifications()
    fetchUnreadCount()

    pollRef.current = setInterval(() => {
      fetchNotifications()
      fetchUnreadCount()
    }, 30000)

    return () => clearInterval(pollRef.current)
  }, [merchant?._id, token, fetchNotifications, fetchUnreadCount])

  // Live push — refetch immediately the instant PayChain changes anything
  // on this account (see MerchantAuthContext's SSE connection), instead of
  // waiting up to 30s for the poll above.
  useEffect(() => {
    if (!merchant?._id || !token || !liveEventAt) return
    fetchNotifications()
    fetchUnreadCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEventAt])

  // Ephemeral toast only — real notifications come from the backend via the
  // events above. Kept as `addNotification` for the many existing call sites
  // that use it purely for local action feedback (copy, validation, etc).
  const addNotification = ({ type, message, title }) => {
    const toastId = `t_${Date.now()}`
    const newToast = { id: toastId, type, message, title: title || message }
    setToasts(prev => [...prev, newToast])

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId))
    }, 4000)
  }

  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await axios.patch(`${API_URL}/api/notifications/${id}/read`, {}, { headers: authHeaders() })
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await axios.patch(`${API_URL}/api/notifications/read-all`, {}, { headers: authHeaders() })
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }

  const deleteNotification = async (id) => {
    const target = notifications.find(n => n.id === id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (target && !target.isRead) setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await axios.delete(`${API_URL}/api/notifications/${id}`, { headers: authHeaders() })
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  // Backward compatibility alias for useToast
  const push = (t) => addNotification({ type: t.type, message: t.message, title: t.title })

  return (
    <NotificationContext.Provider value={{
      notifications,
      toasts,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      refreshNotifications: fetchNotifications,
      push, // Alias for legacy useToast calls
      addToast: push // Alias for legacy useToast calls
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

// Backward compatibility alias
export const useToast = useNotification
