import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const INTERNAL_EMAIL = 'pavan@chantabbai.internal'
let cachedUserId: string | null = null

// Get or create an internal Supabase auth user to satisfy the FK constraint on manual_bills.user_id
async function getInternalUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId

  // Try creating the user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: INTERNAL_EMAIL,
    password: 'chantabbai_internal_9000',
    email_confirm: true,
    user_metadata: { username: 'pavan_internal' },
  })

  if (!createErr && created.user) {
    cachedUserId = created.user.id
    return cachedUserId
  }

  // User already exists — find them by listing
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 100 })
  const found = users.find(u => u.email === INTERNAL_EMAIL)
  if (found) {
    cachedUserId = found.id
    return cachedUserId
  }

  // Fallback — shouldn't reach here
  return '00000000-0000-0000-0000-000000000001'
}

// GET — fetch all analytics bills
export async function GET() {
  const { data, error } = await admin
    .from('manual_bills')
    .select('id, vendor_name, category, bill_amount, bill_date, created_at, description, source')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bills: data ?? [] })
}

// POST — insert bills from Excel upload
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    bills: { vendor_name: string; category: string; bill_amount: number; bill_date: string; description: string }[]
  }
  const { bills } = body
  if (!bills?.length) return NextResponse.json({ error: 'No bills' }, { status: 400 })

  const userId = await getInternalUserId()

  const { error } = await admin.from('manual_bills').insert(
    bills.map(b => ({
      vendor_name: b.vendor_name,
      category: b.category,
      bill_amount: b.bill_amount,
      bill_date: b.bill_date,
      description: b.description,
      user_id: userId,
      source: 'excel_import',
    }))
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — delete bills by ids
export async function DELETE(req: NextRequest) {
  const { ids } = await req.json() as { ids: string[] }
  if (!ids?.length) return NextResponse.json({ error: 'No ids' }, { status: 400 })
  const { error } = await admin.from('manual_bills').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
