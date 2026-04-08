'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from './Logo'
import { supabase } from '@/lib/supabase/client'

export function AuthForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email || !password) {
      setError('Email and password are required')
      return
    }

    setLoading(true)

    if (mode === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message)
      } else {
        window.location.href = '/dashboard'
      }
    } else {
      const { error: authError } = await supabase.auth.signUp({ email, password })
      if (authError) {
        setError(authError.message)
      } else {
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setMode('login')
      }
    }

    setLoading(false)
  }

  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white rounded-2xl p-3 shadow-lg">
              <Logo size="md" />
            </div>
          </div>
          <p className="text-red-100 text-sm mt-2">Secure cloud file storage</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => { setMode('login'); setError(''); setSuccess('') }}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              mode === 'login'
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              mode === 'signup'
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
              {success}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
            style={{
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #C4161C, #9B1116)',
              fontFamily: 'var(--font-poppins), Poppins, sans-serif',
            }}
          >
            {loading
              ? mode === 'login' ? 'Signing in…' : 'Creating account…'
              : mode === 'login' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>
      </div>
    </div>
  )
}
