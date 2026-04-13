'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const USERS = [
  { username: 'pavan',  password: 'pavan.9000', isOwner: true,  userId: '00000000-0000-0000-0000-000000000001' },
  { username: 'viewer', password: 'view.001',   isOwner: false, userId: '00000000-0000-0000-0000-000000000002' },
]

export function AuthForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const user = USERS.find(u => u.username === username.trim() && u.password === password)
    if (!user) {
      setError('Invalid username or password')
      setLoading(false)
      return
    }
    localStorage.setItem('chantabbai_session', JSON.stringify({ username: user.username, isOwner: user.isOwner, userId: user.userId }))
    router.replace('/dashboard')
  }

  return (
    <div className="w-full max-w-sm">
      {/* Brand header */}
      <div className="flex flex-col items-center mb-6">
        <Image src="/logo.png" alt="Chantabbai" width={72} height={72} className="rounded-2xl shadow-md mb-4" />
        <h1 className="text-3xl font-extrabold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif', letterSpacing: '-0.5px' }}>
          <span style={{ color: '#C4161C' }}>Chantabbai</span>{' '}
          <span className="text-gray-800">FileDrop</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1 tracking-wide">Restaurant expense management</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="off"
              placeholder="Enter username"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition placeholder-gray-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter password"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition placeholder-gray-300"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white text-sm tracking-wide transition active:scale-95 disabled:opacity-50 mt-2 shadow-md"
            style={{ background: 'linear-gradient(135deg, #C4161C 0%, #9B1116 100%)' }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-300 mt-6">© 2026 Chantabbai Restaurant</p>
    </div>
  )
}
