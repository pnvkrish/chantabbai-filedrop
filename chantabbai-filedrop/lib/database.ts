import { supabase as _supabase } from './supabase/client'
import type { DbFileMetadata, DbFileInsert, BudgetSetting, ApprovalStatus } from './supabase/client'

// Cast to bypass complex Supabase generic inference on custom Database types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any
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

export type { DbFileMetadata, DbFileInsert, BudgetSetting, ApprovalStatus }

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

async function enrichWithUsernames(files: DbFileMetadata[]): Promise<DbFileMetadata[]> {
  if (files.length === 0) return files
  const userIds = [...new Set(files.map(f => f.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds)
  const map: Record<string, string> = {}
  ;(profiles ?? []).forEach((p: { id: string; username: string }) => { map[p.id] = p.username })
  return files.map(f => ({ ...f, uploaded_by: map[f.user_id] ?? null }))
}

export async function fetchAllFiles(
  _userId: string
): Promise<Result<DbFileMetadata[]>> {
  const { data, error } = await supabase
    .from('file_metadata')
    .select('*')
    .order('uploaded_at', { ascending: false })
  if (error) return err(error.message)
  return ok(await enrichWithUsernames(data ?? []))
}

export async function fetchFiles(
  _userId: string,
  filters: SearchFilters,
  sort: SortConfig
): Promise<Result<DbFileMetadata[]>> {
  let query = supabase
    .from('file_metadata')
    .select('*')

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
  return ok(await enrichWithUsernames(data ?? []))
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
  _userId: string
): Promise<Result<StorageStats>> {
  const { data, error } = await supabase
    .from('file_metadata')
    .select('size, mime_type')

  if (error) return err(error.message)

  const rows = (data ?? []) as { size: number; mime_type: string }[]
  const totalBytes = rows.reduce((acc: number, r: { size: number }) => acc + r.size, 0)

  const byCategory: Record<FileCategory, number> = {
    [FileCategory.All]: rows.length,
    [FileCategory.Image]: rows.filter((r: { mime_type: string }) => r.mime_type === 'image/png').length,
    [FileCategory.Document]: rows.filter(
      (r: { mime_type: string }) =>
        r.mime_type === 'application/pdf' ||
        r.mime_type === 'application/msword' ||
        r.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ).length,
    [FileCategory.Spreadsheet]: rows.filter(
      (r: { mime_type: string }) =>
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

export async function getAllTags(_userId: string): Promise<Result<string[]>> {
  const { data, error } = await supabase
    .from('file_metadata')
    .select('tags')
  if (error) return err(error.message)
  const allTags = (data ?? []).flatMap((r: { tags: string[] }) => r.tags) as string[]
  return ok([...new Set(allTags)].sort())
}

// ── Approval status ───────────────────────────────────────────────────────────

export async function updateApprovalStatus(id: string, status: ApprovalStatus): Promise<Result<void>> {
  const { error } = await supabase
    .from('file_metadata')
    .update({ approval_status: status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(undefined)
}

// ── Budget settings ───────────────────────────────────────────────────────────

export async function fetchBudgets(userId: string): Promise<Result<BudgetSetting[]>> {
  const { data, error } = await supabase
    .from('budget_settings')
    .select('*')
    .eq('user_id', userId)
    .order('category')
  if (error) return err(error.message)
  return ok(data ?? [])
}

export async function upsertBudget(userId: string, category: string, monthlyLimit: number): Promise<Result<void>> {
  const { error } = await supabase
    .from('budget_settings')
    .upsert({ user_id: userId, category, monthly_limit: monthlyLimit, updated_at: new Date().toISOString() }, { onConflict: 'user_id,category' })
  if (error) return err(error.message)
  return ok(undefined)
}

export async function deleteBudget(userId: string, category: string): Promise<Result<void>> {
  const { error } = await supabase
    .from('budget_settings')
    .delete()
    .eq('user_id', userId)
    .eq('category', category)
  if (error) return err(error.message)
  return ok(undefined)
}

// ── Analytics data ────────────────────────────────────────────────────────────

export interface BillAnalyticsRow {
  id: string
  original_name: string
  category: string | null
  vendor_name: string | null
  bill_amount: number | null
  bill_date: string | null
  approval_status: string | null
  uploaded_at: string
  source?: string
  storage_path?: string
}

export interface ManualBillInsert {
  vendor_name: string
  category: string
  bill_amount: number
  bill_date: string
  description: string
}

export async function fetchAnalyticsData(_userId: string): Promise<Result<BillAnalyticsRow[]>> {
  // Analytics shows all users' Excel-uploaded data
  const { data, error } = await supabase
    .from('manual_bills')
    .select('id, vendor_name, category, bill_amount, bill_date, created_at, description, source')
    .order('created_at', { ascending: false })

  if (error) return err(error.message)

  const bills = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    original_name: (r.description as string) || (r.vendor_name as string) || 'Excel Entry',
    category: r.category as string | null,
    vendor_name: r.vendor_name as string | null,
    bill_amount: r.bill_amount as number | null,
    bill_date: r.bill_date as string | null,
    approval_status: null,
    uploaded_at: r.created_at as string,
    source: 'excel_import',
  }))

  return ok(bills)
}

export async function insertManualBills(userId: string, bills: ManualBillInsert[]): Promise<Result<void>> {
  const { error } = await supabase.from('manual_bills').insert(
    bills.map(b => ({ ...b, user_id: userId, source: 'excel_import' }))
  )
  if (error) return err(error.message)
  return ok(undefined)
}

export async function deleteManualBill(id: string): Promise<Result<void>> {
  const { error } = await supabase.from('manual_bills').delete().eq('id', id)
  if (error) return err(error.message)
  return ok(undefined)
}

export async function deleteManualBillsBatch(ids: string[]): Promise<Result<void>> {
  if (ids.length === 0) return ok(undefined)
  const { error } = await supabase.from('manual_bills').delete().in('id', ids)
  if (error) return err(error.message)
  return ok(undefined)
}

export async function deleteUploadedFile(id: string, storagePath: string): Promise<Result<void>> {
  const { deleteFromStorage } = await import('./storage')
  await deleteFromStorage(storagePath)
  const { error } = await supabase.from('file_metadata').delete().eq('id', id)
  if (error) return err(error.message)
  return ok(undefined)
}
