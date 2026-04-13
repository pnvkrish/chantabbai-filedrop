'use client'

import { useEffect, useState } from 'react'
import { Dashboard } from '@/components/Dashboard'

interface Session { username: string; isOwner: boolean; userId?: string }

const USER_IDS: Record<string, string> = {
  pavan:  '00000000-0000-0000-0000-000000000001',
  viewer: '00000000-0000-0000-0000-000000000002',
}

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('chantabbai_session')
      if (raw) {
        setSession(JSON.parse(raw) as Session)
      } else {
        window.location.href = '/'
      }
    } catch {
      window.location.href = '/'
    }
  }, [])

  // undefined = still checking, null = no session (redirecting)
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
      </div>
    )
  }

  const userId = session.userId ?? USER_IDS[session.username] ?? '00000000-0000-0000-0000-000000000001'

  return (
    <Dashboard
      userId={userId}
      userEmail={session.username}
      isOwner={session.isOwner}
    />
  )
}
