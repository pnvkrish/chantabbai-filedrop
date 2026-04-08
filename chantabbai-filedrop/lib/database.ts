import { supabase } from './supabase/client'
import type { DbFileMetadata, DbFileInsert } from './supabase/client'
import {
  ok,
  err,
  type Result,
  type SearchFilters,
  type SortConfig,
  type StorageStats,
  FileCategory,
  STORAGE_QUOTA_BYTES,
} from './types'

export type { DbFileMetadata, DbFileInsert }

export async function insertFileMetadata(
  data: DbFileInsert
): Promise<Result<DbFileMetadata>> {
  const { data: row, error } = await supabase
    .from('file_metadata')
    .insert(data)
    .select()
    .single()
  if (error) return err(error.message)
  return ok(row)
}

export async function fetchAllFiles(
  userId: string
): Promise<Result<DbFileMetadata[]>> {
  const { data, error } = await supabase
    .from('file_metadata')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })
  if (error) return err(error.message)
  return ok(data ?? [])
}

export async function fetchFiles(
  userId: string,
  filters: SearchFilters,
  sort: SortConfig
): Promise<Result<DbFileMetadata[]>> {
  let query = supabase
    .from('file_metadata')
    .select('*')
    .eq('user_id', userId)

  if (filters.query.trim()) {
    query = query.ilike('name', `%${filters.query.trim()}%`)
  }

  if (filters.isStarred === true) {
    query = query.eq('is_starred', true)
  }

  if (filters.dateFrom) {
    query = query.gte('uploaded_at', filters.dateFrom)
  }

  if (filters.dateTo) {
    const endOfDay = filters.dateTo.includes('T')
      ? filters.dateTo
      : `${filters.dateTo}T23:59:59.999Z`
    query = query.lte('uploaded_at', endOfDay)
  }

  if (filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags)
  }

  if (filters.minSize !== null) {
    query = query.gte('size', filters.minSize)
  }

  if (filters.maxSize !== null) {
    query = query.lte('size', filters.maxSize)
  }

  query = query.order(sort.field, { ascending: sort.direction === 'asc' })

  const { data, error } = await query
  if (error) return err(error.message)
  return ok(data ?? [])
}

export async function findByChecksum(
  userId: string,
  checksum: string
): Promise<Result<DbFileMetadata | null>> {
  const { data, error } = await supabase
    .from('file_metadata')
    .select('*')
    .eq('user_id', userId)
    .eq('checksum', checksum)
    .maybeSingle()
  if (error) return err(error.message)
  return ok(data)
}

export async function toggleStar(
  id: string,
  isStarred: boolean
): Promise<Result<void>> {
  const { error } = await supabase
    .from('file_metadata')
    .update({ is_starred: isStarred, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(undefined)
}

export async function updateFileTags(
  id: string,
  tags: string[]
): Promise<Result<void>> {
  const { error } = await supabase
    .from('file_metadata')
    .update({ tags, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(undefined)
}

export async function incrementDownload(id: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('increment_download_count', {
    file_id: id,
  })
  if (error) {
    const { data } = await supabase
      .from('file_metadata')
      .select('download_count')
      .eq('id', id)
      .single()
    if (data) {
      await supabase
        .from('file_metadata')
        .update({ download_count: data.download_count + 1 })
        .eq('id', id)
    }
  }
  return ok(undefined)
}

export async function deleteFileRecord(id: string): Promise<Result<void>> {
  const { error } = await supabase.from('file_metadata').delete().eq('id', id)
  if (error) return err(error.message)
  return ok(undefined)
}

export async function getStorageStats(
  userId: string
): Promise<Result<StorageStats>> {
  const { data, error } = await supabase
    .from('file_metadata')
    .select('size, mime_type')
    .eq('user_id', userId)

  if (error) return err(error.message)

  const rows = data ?? []
  const totalBytes = rows.reduce((acc, r) => acc + r.size, 0)

  const byCategory: Record<FileCategory, number> = {
    [FileCategory.All]: rows.length,
    [FileCategory.Image]: rows.filter(r => r.mime_type === 'image/png').length,
    [FileCategory.Document]: rows.filter(
      r =>
        r.mime_type === 'application/pdf' ||
        r.mime_type === 'application/msword' ||
        r.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ).length,
    [FileCategory.Spreadsheet]: rows.filter(
      r =>
        r.mime_type === 'application/vnd.ms-excel' ||
        r.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ).length,
  }

  return ok({
    totalFiles: rows.length,
    totalBytes,
    usedPercent: Math.min((totalBytes / STORAGE_QUOTA_BYTES) * 100, 100),
    byCategory,
  })
}

export async function getAllTags(userId: string): Promise<Result<string[]>> {
  const { data, error } = await supabase
    .from('file_metadata')
    .select('tags')
    .eq('user_id', userId)
  if (error) return err(error.message)
  const allTags = (data ?? []).flatMap(r => r.tags)
  return ok([...new Set(allTags)].sort())
}
