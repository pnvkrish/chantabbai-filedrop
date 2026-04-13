// ─── Enums ───────────────────────────────────────────────────────────────────

export enum FileCategory {
  All = 'all',
  Image = 'image',
  Document = 'document',
  Spreadsheet = 'spreadsheet',
}

export enum ViewMode {
  Grid = 'grid',
  List = 'list',
  Timeline = 'timeline',
}

export enum SortField {
  Name = 'name',
  Size = 'size',
  UploadedAt = 'uploaded_at',
  UpdatedAt = 'updated_at',
  DownloadCount = 'download_count',
}

export enum NotificationType {
  Success = 'success',
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

export enum PreviewType {
  Image = 'image',
  PDF = 'pdf',
  Office = 'office',
}

// ─── Core Interfaces ─────────────────────────────────────────────────────────

export interface FileMetadata {
  id: string
  user_id: string
  name: string
  original_name: string
  size: number
  mime_type: string
  extension: string
  storage_path: string
  checksum: string
  tags: string[]
  is_starred: boolean
  download_count: number
  uploaded_at: string
  updated_at: string
  category: string | null
  vendor_name: string | null
  bill_amount: number | null
  bill_date: string | null
  approval_status: 'pending' | 'approved' | 'rejected' | null
}

export interface SearchFilters {
  query: string
  category: FileCategory
  tags: string[]
  isStarred: boolean | null
  dateFrom: string | null
  dateTo: string | null
  minSize: number | null
  maxSize: number | null
}

export interface SortConfig {
  field: SortField
  direction: 'asc' | 'desc'
}

export interface StorageStats {
  totalFiles: number
  totalBytes: number
  usedPercent: number
  byCategory: Record<FileCategory, number>
}

export interface UploadResult {
  file: File
  metadata: FileMetadata | null
  error: string | null
  isDuplicate: boolean
  storagePath: string | null
}

export interface ShareLink {
  url: string
  expiresAt: string
  fileId: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface FilterPreset {
  name: string
  filters: SearchFilters
  sort: SortConfig
  createdAt: string
}

export interface UploadQueueItem {
  id: string
  file: File
  checksum: string
  status: 'pending' | 'uploading' | 'done' | 'error' | 'duplicate'
  progress: number
  retryCount: number
  error: string | null
}

export interface ImageState {
  scale: number
  rotation: number
  panX: number
  panY: number
  isPanning: boolean
  startX: number
  startY: number
}

// ─── Result Pattern ───────────────────────────────────────────────────────────

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isFileMetadata(v: unknown): v is FileMetadata {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['user_id'] === 'string' &&
    typeof obj['name'] === 'string' &&
    typeof obj['storage_path'] === 'string' &&
    typeof obj['checksum'] === 'string' &&
    // New bill fields are optional (may be null from older records)
    ('category' in obj || true)
  )
}

export function isFilterPreset(v: unknown): v is FilterPreset {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj['name'] === 'string' &&
    typeof obj['filters'] === 'object' &&
    obj['filters'] !== null &&
    typeof obj['sort'] === 'object' &&
    obj['sort'] !== null
  )
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// ─── Validation Constants ─────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export const MIME_TO_EXT: Record<AllowedMimeType, string> = {
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

export const MIN_FILE_SIZE = 1 * 1024
export const MAX_FILE_SIZE = 30 * 1024 * 1024
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024

// ─── Generic Helpers ──────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(value < 10 ? 2 : 1)} ${sizes[i]}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function getDefaultFilters(): SearchFilters {
  return {
    query: '',
    category: FileCategory.All,
    tags: [],
    isStarred: null,
    dateFrom: null,
    dateTo: null,
    minSize: null,
    maxSize: null,
  }
}

export function getDefaultSort(): SortConfig {
  return { field: SortField.UploadedAt, direction: 'desc' }
}
