import {
  type SearchFilters,
  type SortConfig,
  type FilterPreset,
  type FileMetadata,
  FileCategory,
  SortField,
  isFilterPreset,
} from './types'

const PRESETS_KEY = 'fm_filter_presets'

export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: T) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function applyFilters(
  files: FileMetadata[],
  filters: SearchFilters
): FileMetadata[] {
  return files.filter(file => {
    if (
      filters.query.trim() &&
      !file.name.toLowerCase().includes(filters.query.toLowerCase()) &&
      !file.original_name.toLowerCase().includes(filters.query.toLowerCase())
    ) {
      return false
    }

    if (filters.category !== FileCategory.All) {
      const mimeMatch = getMimeCategory(file.mime_type)
      if (mimeMatch !== filters.category) return false
    }

    if (filters.isStarred === true && !file.is_starred) return false

    if (filters.dateFrom) {
      if (new Date(file.uploaded_at) < new Date(filters.dateFrom)) return false
    }
    if (filters.dateTo) {
      const endOfDay = new Date(filters.dateTo)
      endOfDay.setHours(23, 59, 59, 999)
      if (new Date(file.uploaded_at) > endOfDay) return false
    }

    if (
      filters.tags.length > 0 &&
      !filters.tags.some(t => file.tags.includes(t))
    ) {
      return false
    }

    if (filters.minSize !== null && file.size < filters.minSize) return false
    if (filters.maxSize !== null && file.size > filters.maxSize) return false

    return true
  })
}

export function applySortClient(
  files: FileMetadata[],
  sort: SortConfig
): FileMetadata[] {
  const sorted = [...files]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.field) {
      case SortField.Name:
        cmp = a.name.localeCompare(b.name)
        break
      case SortField.Size:
        cmp = a.size - b.size
        break
      case SortField.UploadedAt:
        cmp = new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
        break
      case SortField.UpdatedAt:
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        break
      case SortField.DownloadCount:
        cmp = a.download_count - b.download_count
        break
    }
    return sort.direction === 'asc' ? cmp : -cmp
  })
  return sorted
}

export function savePreset(preset: FilterPreset): void {
  const existing = loadPresets()
  const updated = [
    ...existing.filter(p => p.name !== preset.name),
    preset,
  ]
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated))
  } catch { /* ignore */ }
}

export function loadPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isFilterPreset)
  } catch {
    return []
  }
}

export function deletePreset(name: string): void {
  const existing = loadPresets()
  const updated = existing.filter(p => p.name !== name)
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated))
  } catch { /* ignore */ }
}

export function getMimeCategory(mimeType: string): FileCategory {
  if (mimeType === 'image/png') return FileCategory.Image
  if (
    mimeType === 'application/pdf' ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return FileCategory.Document
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) return FileCategory.Spreadsheet
  return FileCategory.All
}

export function getActivePillLabels(filters: SearchFilters): string[] {
  const pills: string[] = []
  if (filters.query.trim()) pills.push(`Search: "${filters.query.trim()}"`)
  if (filters.category !== FileCategory.All) pills.push(`Type: ${filters.category}`)
  if (filters.isStarred) pills.push('Starred')
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ?? '...'
    const to = filters.dateTo ?? '...'
    pills.push(`Date: ${from} → ${to}`)
  }
  if (filters.tags.length > 0) pills.push(`Tags: ${filters.tags.join(', ')}`)
  return pills
}
