import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BUCKET = 'files'

export async function GET(req: NextRequest) {
  const storagePath = req.nextUrl.searchParams.get('path')
  if (!storagePath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl })
}
