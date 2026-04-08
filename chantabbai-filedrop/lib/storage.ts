import { supabase } from './supabase/client'
import {
  ok,
  err,
  formatBytes,
  type Result,
  type UploadResult,
  type ValidationResult,
  type ShareLink,
  ALLOWED_MIME_TYPES,
  MIME_TO_EXT,
  MIN_FILE_SIZE,
  MAX_FILE_SIZE,
  type AllowedMimeType,
} from './types'
import { insertFileMetadata, findByChecksum } from './database'

const BUCKET = 'files'

export function validateFile(file: File): ValidationResult {
  const errors: string[] = []

  const isAllowedType = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)
  if (!isAllowedType) {
    errors.push('File type not allowed. Only PNG, JPEG, HEIC, PDF, DOC, DOCX, XLS, XLSX are accepted.')
  }

  if (file.size < MIN_FILE_SIZE) {
    errors.push(`File too small. Minimum size is 1 KB (your file: ${formatBytes(file.size)}).`)
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File too large. Maximum size is 30 MB (your file: ${formatBytes(file.size)}).`)
  }

  return { valid: errors.length === 0, errors }
}

export async function computeChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function generateAutoTags(file: File): string[] {
  const tags: string[] = []

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext) tags.push(ext)

  if (['image/png', 'image/jpeg', 'image/heic', 'image/heif'].includes(file.type)) {
    tags.push('image')
  } else if (file.type === 'application/pdf') {
    tags.push('pdf', 'document')
  } else if (
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    tags.push('word', 'document')
  } else if (
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    tags.push('excel', 'spreadsheet')
  }

  const now = new Date()
  const monthTag = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  tags.push(monthTag)

  if (file.size < 1024 * 1024) tags.push('small')
  else if (file.size < 10 * 1024 * 1024) tags.push('medium')
  else tags.push('large')

  return [...new Set(tags)]
}

export async function withRetry<T>(
  fn: () => Promise<Result<T>>,
  maxAttempts = 3
): Promise<Result<T>> {
  let lastError = 'Unknown error'
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500))
    }
    const result = await fn()
    if (result.ok) return result
    lastError = result.error
  }
  return err(`Failed after ${maxAttempts} attempts: ${lastError}`)
}

type QueueTask = () => Promise<void>

export class UploadQueue {
  private readonly maxConcurrent = 3
  private active = 0
  private readonly queue: QueueTask[] = []

  enqueue(task: QueueTask): void {
    this.queue.push(task)
    this.drain()
  }

  private drain(): void {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()
      if (!task) break
      this.active++
      task().finally(() => {
        this.active--
        this.drain()
      })
    }
  }

  get pendingCount(): number { return this.queue.length }
  get activeCount(): number { return this.active }
}

export async function uploadFile(
  file: File,
  userId: string,
  onProgress: (pct: number) => void
): Promise<UploadResult> {
  const validation = validateFile(file)
  if (!validation.valid) {
    return { file, metadata: null, error: validation.errors[0] ?? 'Invalid file', isDuplicate: false, storagePath: null }
  }

  onProgress(5)
  const checksum = await computeChecksum(file)

  onProgress(10)
  const dupeResult = await findByChecksum(userId, checksum)
  if (dupeResult.ok && dupeResult.value !== null) {
    onProgress(100)
    return { file, metadata: dupeResult.value, error: null, isDuplicate: true, storagePath: dupeResult.value.storage_path }
  }

  const mimeType = file.type as AllowedMimeType
  const ext = MIME_TO_EXT[mimeType] ?? (file.name.split('.').pop() ?? 'bin')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${userId}/${Date.now()}-${safeName}`

  onProgress(20)
  const uploadResult = await withRetry(async () => {
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })
    if (error) return err(error.message)
    return ok(undefined)
  })

  onProgress(70)

  if (!uploadResult.ok) {
    return { file, metadata: null, error: uploadResult.error, isDuplicate: false, storagePath: null }
  }

  const autoTags = generateAutoTags(file)

  const insertResult = await insertFileMetadata({
    user_id: userId,
    name: safeName,
    original_name: file.name,
    size: file.size,
    mime_type: file.type,
    extension: ext,
    storage_path: storagePath,
    checksum,
    tags: autoTags,
  })

  onProgress(100)

  if (!insertResult.ok) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { file, metadata: null, error: `Database error: ${insertResult.error}`, isDuplicate: false, storagePath: null }
  }

  return { file, metadata: insertResult.value, error: null, isDuplicate: false, storagePath }
}

export async function deleteFromStorage(storagePath: string): Promise<Result<void>> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) return err(error.message)
  return ok(undefined)
}

export async function getDownloadUrl(storagePath: string): Promise<Result<string>> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60)
  if (error) return err(error.message)
  return ok(data.signedUrl)
}

export async function createSignedUrl(
  storagePath: string,
  fileId: string,
  expiresInSeconds = 3600
): Promise<Result<ShareLink>> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds)
  if (error) return err(error.message)
  return ok({
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    fileId,
  })
}

