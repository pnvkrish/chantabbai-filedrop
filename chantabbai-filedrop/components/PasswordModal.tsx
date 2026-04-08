'use client'

import { useState, useRef, useEffect } from 'react'

interface PasswordModalProps {
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}

const DELETE_PASSWORD = 'Chanti'

export function PasswordModal({ title, description, onConfirm, onCancel }: PasswordModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === DELETE_PASSWORD) {
      onConfirm()
    } else {
      setError(true)
      setShake(true)
      setPassword('')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 ${shake ? 'animate-shake' : ''}`}
        style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
      >
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
          <span className="text-xl">🔒</span>
        </div>

        {/* Title */}
        <h2 className="text-base font-bold text-gray-800 text-center mb-1">{title}</h2>
        <p className="text-xs text-gray-400 text-center mb-5">{description}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false) }}
              placeholder="Enter password"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                error
                  ? 'border-red-400 bg-red-50 text-red-700 placeholder-red-300'
                  : 'border-gray-200 focus:border-red-400 focus:ring-2 focus:ring-red-100'
              }`}
            />
            {error && (
              <p className="text-xs text-red-500 mt-1 ml-1">Incorrect password. Try again.</p>
            )}
          </div>

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #C4161C, #9B1116)' }}
            >
              Delete
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  )
}
