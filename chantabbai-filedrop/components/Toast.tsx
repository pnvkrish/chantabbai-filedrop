'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { NotificationType } from '@/lib/types'

interface ToastMessage {
  id: string
  message: string
  type: NotificationType
}

const toastListeners: Array<(toast: ToastMessage) => void> = []

export function showToast(
  message: string,
  type: NotificationType = NotificationType.Info,
  _duration = 4000
) {
  const id = Math.random().toString(36).slice(2)
  const toast: ToastMessage = { id, message, type }
  toastListeners.forEach(fn => fn(toast))
}

const bgColors: Record<NotificationType, string> = {
  [NotificationType.Success]: 'bg-green-50 border-green-200 text-green-800',
  [NotificationType.Error]: 'bg-red-50 border-red-200 text-red-800',
  [NotificationType.Warning]: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  [NotificationType.Info]: 'bg-blue-50 border-blue-200 text-blue-800',
}

const icons: Record<NotificationType, string> = {
  [NotificationType.Success]: '✓',
  [NotificationType.Error]: '✕',
  [NotificationType.Warning]: '⚠',
  [NotificationType.Info]: 'ℹ',
}

interface ToastItemProps {
  toast: ToastMessage
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg animate-slide-in ${bgColors[toast.type]}`}
      style={{ minWidth: 260, maxWidth: 360 }}
    >
      <span className="font-bold text-sm mt-0.5">{icons[toast.type]}</span>
      <span className="text-sm flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-current opacity-60 hover:opacity-100 text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = (
    typeof window !== 'undefined'
      ? require('react').useState
      : () => [[], () => {}]
  )([]) as [ToastMessage[], React.Dispatch<React.SetStateAction<ToastMessage[]>>]

  useEffect(() => {
    const handler = (toast: ToastMessage) => {
      setToasts(prev => [...prev, toast])
    }
    toastListeners.push(handler)
    return () => {
      const idx = toastListeners.indexOf(handler)
      if (idx !== -1) toastListeners.splice(idx, 1)
    }
  }, [])

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  if (typeof document === 'undefined') return null

  const container = document.getElementById('toast-container')
  if (!container) return null

  return createPortal(
    <>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={remove} />
      ))}
    </>,
    container
  )
}
