import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BUCKET = 'files'

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

function generateAutoTags(filename: string, mimeType: string, size: number): string[] {
  const tags: string[] = []
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext) tags.push(ext)
  if (['image/png', 'image/jpeg', 'image/heic', 'image/heif'].includes(mimeType)) tags.push('image')
  else if (mimeType === 'application/pdf') tags.push('pdf', 'document')
  else if (mimeType.includes('word')) tags.push('word', 'document')
  else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) tags.push('excel', 'spreadsheet')
  const now = new Date()
  tags.push(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  if (size < 1024 * 1024) tags.push('small')
  else if (size < 10 * 1024 * 1024) tags.push('medium')
  else tags.push('large')
  return [...new Set(tags)]
}

// Cache: username → real Supabase auth user UUID
const userIdCache: Record<string, string> = {}

async function getRealUserId(username: string): Promise<string> {
  if (userIdCache[username]) return userIdCache[username]

  const email = `${username}@chantabbai.internal`

  // Try to create the user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: 'chantabbai_internal_9000',
    email_confirm: true,
  })
  if (!createErr && created?.user) {
    userIdCache[username] = created.user.id
    return created.user.id
  }

  // Already exists — find it
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 100 })
  const found = users.find(u => u.email === email)
  if (found) {
    userIdCache[username] = found.id
    return found.id
  }

  throw new Error(`Could not create or find internal user for ${username}`)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const username = (formData.get('username') as string | null) ?? 'pavan'
    const checksum = formData.get('checksum') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    // Resolve username → real Supabase auth UUID
    const realUserId = await getRealUserId(username)

    // Check for duplicate by checksum
    if (checksum) {
      const { data: existing } = await admin
        .from('file_metadata')
        .select('*')
        .eq('checksum', checksum)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ isDuplicate: true, metadata: existing })
      }
    }

    const mimeType = file.type
    const ext = MIME_TO_EXT[mimeType] ?? (file.name.split('.').pop() ?? 'bin')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${realUserId}/${Date.now()}-${safeName}`

    // Upload to storage using service role (bypasses storage RLS)
    const arrayBuffer = await file.arrayBuffer()
    const { error: storageError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, { contentType: mimeType, upsert: false })

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 })
    }

    // Insert DB record using service role (bypasses table RLS + satisfies FK)
    const autoTags = generateAutoTags(file.name, mimeType, file.size)
    const { data: metadata, error: dbError } = await admin
      .from('file_metadata')
      .insert({
        user_id: realUserId,
        name: safeName,
        original_name: file.name,
        size: file.size,
        mime_type: mimeType,
        extension: ext,
        storage_path: storagePath,
        checksum: checksum ?? '',
        tags: autoTags,
      })
      .select()
      .single()

    if (dbError) {
      await admin.storage.from(BUCKET).remove([storagePath])
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ isDuplicate: false, metadata })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
