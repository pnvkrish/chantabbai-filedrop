import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Uses service role key → bypasses RLS → returns ALL files for all users
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  // Fetch all files
  const { data: files, error } = await admin
    .from('file_metadata')
    .select('*')
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!files || files.length === 0) return NextResponse.json({ files: [] })

  // Enrich with usernames from profiles table
  const userIds = [...new Set(files.map((f: { user_id: string }) => f.user_id))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, username')
    .in('id', userIds)

  const usernameMap: Record<string, string> = {}
  ;(profiles ?? []).forEach((p: { id: string; username: string }) => {
    usernameMap[p.id] = p.username
  })

  const enriched = files.map((f: Record<string, unknown>) => ({
    ...f,
    uploaded_by: usernameMap[f.user_id as string] ?? null,
  }))

  return NextResponse.json({ files: enriched })
}
