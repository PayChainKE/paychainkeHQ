import React, { createContext, useContext, useState, useEffect } from 'react'

const NotificationContext = createContext()

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])

  // Derived state for unread count
  const unreadCount = notifications.filter(n => !n.isRead).length

  // Add a notification (persistent + ephemeral toast)
  const addNotification = ({ type, message, title }) => {
    const newId = `n_${Date.now()}`
    const newNotif = {
      id: newId,
      type: type || 'notifications',
      message,
      isRead: false,
      createdAt: new Date().toISOString()
    }

    // Add to persistent list
    setNotifications(prev => [newNotif, ...prev])

    // Trigger ephemeral toast
    const toastId = `t_${Date.now()}`
    const newToast = { id: toastId, type, message, title: title || message }
    setToasts(prev => [...prev, newToast])

    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId))
    }, 4000)
  }

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
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
