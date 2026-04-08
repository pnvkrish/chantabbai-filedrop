'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { DbFileMetadata } from '@/lib/supabase/client'
import {
  ViewMode,
  NotificationType,
  type SearchFilters,
  type SortConfig,
  type StorageStats,
  type ValidationResult,
  getDefaultFilters,
  getDefaultSort,
  isFileMetadata,
} from '@/lib/types'
import {
  fetchAllFiles,
  getStorageStats,
  toggleStar,
  updateFileTags,
  incrementDownload,
  deleteFileRecord,
  getAllTags,
} from '@/lib/database'
import {
  validateFile,
  uploadFile,
  deleteFromStorage,
  getDownloadUrl,
  createSignedUrl,
  UploadQueue,
} from '@/lib/storage'
import { applyFilters, applySortClient, savePreset, loadPresets, deletePreset } from '@/lib/search'
import type { FilterPreset } from '@/lib/types'
import { showToast } from '@/components/Toast'

export interface UploadItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error' | 'duplicate'
  progress: number
  error: string | null
  validation: ValidationResult
  storagePath?: string
  dbFileId?: string
}

interface AppState {
  files: DbFileMetadata[]
  filteredFiles: DbFileMetadata[]
  viewMode: ViewMode
  filters: SearchFilters
  sort: SortConfig
  isLoading: boolean
  uploadItems: UploadItem[]
  stats: StorageStats | null
  allTags: string[]
  currentView: 'upload' | 'files'
}

export function useFileManager(userId: string) {
  const [state, setState] = useState<AppState>({
    files: [],
    filteredFiles: [],
    viewMode: ViewMode.Grid,
    filters: getDefaultFilters(),
    sort: getDefaultSort(),
    isLoading: false,
    uploadItems: [],
    stats: null,
    allTags: [],
    currentView: 'upload',
  })

  const uploadQueueRef = useRef(new UploadQueue())
  const enqueuedIdsRef = useRef(new Set<string>())
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const updateState = useCallback((patch: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadFiles = useCallback(async () => {
    updateState({ isLoading: true })
    const result = await fetchAllFiles(userId)
    if (result.ok) {
      setState(prev => {
        const filtered = applySortClient(applyFilters(result.value, prev.filters), prev.sort)
        return { ...prev, files: result.value, filteredFiles: filtered, isLoading: false }
      })
    } else {
      showToast(`Failed to load files: ${result.error}`, NotificationType.Error)
      updateState({ isLoading: false })
    }
  }, [userId, updateState])

  const loadStats = useCallback(async () => {
    const result = await getStorageStats(userId)
    if (result.ok) updateState({ stats: result.value })
  }, [userId, updateState])

  const loadAllTags = useCallback(async () => {
    const result = await getAllTags(userId)
    if (result.ok) updateState({ allTags: result.value })
  }, [userId, updateState])

  // ── Init & cleanup ───────────────────────────────────────────────────────────

  useEffect(() => {
    void loadFiles()
    void loadStats()
    void loadAllTags()

    // Realtime subscription
    const channel = supabase
      .channel(`file_metadata:user_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'file_metadata', filter: `user_id=eq.${userId}` }, (payload) => {
        if (!isFileMetadata(payload.new)) return
        setState(prev => {
          const exists = prev.files.some(f => f.id === (payload.new as DbFileMetadata).id)
          if (exists) return prev
          const files = [payload.new as DbFileMetadata, ...prev.files]
          return { ...prev, files, filteredFiles: applySortClient(applyFilters(files, prev.filters), prev.sort) }
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'file_metadata', filter: `user_id=eq.${userId}` }, (payload) => {
        if (!isFileMetadata(payload.new)) return
        const updated = payload.new as DbFileMetadata
        setState(prev => {
          const files = prev.files.map(f => f.id === updated.id ? updated : f)
          return { ...prev, files, filteredFiles: applySortClient(applyFilters(files, prev.filters), prev.sort) }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'file_metadata', filter: `user_id=eq.${userId}` }, (payload) => {
        const old = payload.old as Record<string, unknown>
        const id = old['id']
        if (typeof id !== 'string') return
        setState(prev => {
          const files = prev.files.filter(f => f.id !== id)
          return { ...prev, files, filteredFiles: applySortClient(applyFilters(files, prev.filters), prev.sort) }
        })
      })
      .subscribe()

    realtimeRef.current = channel

    return () => {
      if (realtimeRef.current) {
        void supabase.removeChannel(realtimeRef.current)
        realtimeRef.current = null
      }
    }
  }, [userId, loadFiles, loadStats, loadAllTags])

  // ── Navigation ───────────────────────────────────────────────────────────────

  const switchView = useCallback((view: 'upload' | 'files') => {
    updateState({ currentView: view })
  }, [updateState])

  const setViewMode = useCallback((mode: ViewMode) => {
    updateState({ viewMode: mode })
  }, [updateState])

  // ── Filters ──────────────────────────────────────────────────────────────────

  const setFilters = useCallback((newFilters: SearchFilters) => {
    setState(prev => {
      const filtered = applySortClient(applyFilters(prev.files, newFilters), prev.sort)
      return { ...prev, filters: newFilters, filteredFiles: filtered }
    })
  }, [])

  const setSort = useCallback((newSort: SortConfig) => {
    setState(prev => {
      const filtered = applySortClient(applyFilters(prev.files, prev.filters), newSort)
      return { ...prev, sort: newSort, filteredFiles: filtered }
    })
  }, [])

  const handleSavePreset = useCallback((name: string) => {
    setState(prev => {
      savePreset({ name, filters: prev.filters, sort: prev.sort, createdAt: new Date().toISOString() })
      showToast(`Preset "${name}" saved`, NotificationType.Success, 2000)
      return prev
    })
  }, [])

  const handleLoadPreset = useCallback((preset: FilterPreset) => {
    setState(prev => {
      const filtered = applySortClient(applyFilters(prev.files, preset.filters), preset.sort)
      return { ...prev, filters: preset.filters, sort: preset.sort, filteredFiles: filtered }
    })
  }, [])

  const handleDeletePreset = useCallback((name: string) => {
    deletePreset(name)
    showToast(`Preset "${name}" deleted`, NotificationType.Info, 2000)
  }, [])

  // ── File actions ─────────────────────────────────────────────────────────────

  const handlePreview = useCallback(async (id: string): Promise<{ file: DbFileMetadata; url: string } | null> => {
    const file = state.filteredFiles.find(f => f.id === id) ?? state.files.find(f => f.id === id)
    if (!file) return null
    const urlResult = await createSignedUrl(file.storage_path, file.id, 3600)
    if (!urlResult.ok) {
      showToast(`Failed to get preview URL: ${urlResult.error}`, NotificationType.Error)
      return null
    }
    return { file, url: urlResult.value.url }
  }, [state.filteredFiles, state.files])

  const handleDownload = useCallback(async (id: string) => {
    const file = state.files.find(f => f.id === id)
    if (!file) return
    const urlResult = await getDownloadUrl(file.storage_path)
    if (!urlResult.ok) {
      showToast(`Download failed: ${urlResult.error}`, NotificationType.Error)
      return
    }
    const a = document.createElement('a')
    a.href = urlResult.value
    a.download = file.original_name
    a.click()
    void incrementDownload(id).then(() => {
      setState(prev => {
        const files = prev.files.map(f => f.id === id ? { ...f, download_count: f.download_count + 1 } : f)
        return { ...prev, files, filteredFiles: applySortClient(applyFilters(files, prev.filters), prev.sort) }
      })
    })
  }, [state.files])

  const handleShare = useCallback(async (id: string, expiresInSeconds: number): Promise<string | null> => {
    const file = state.files.find(f => f.id === id)
    if (!file) return null
    const result = await createSignedUrl(file.storage_path, id, expiresInSeconds)
    if (!result.ok) {
      showToast(`Share failed: ${result.error}`, NotificationType.Error)
      return null
    }
    return result.value.url
  }, [state.files])

  const handleStar = useCallback(async (id: string, starred: boolean) => {
    const result = await toggleStar(id, starred)
    if (!result.ok) {
      showToast(`Failed to update star: ${result.error}`, NotificationType.Error)
      return
    }
    setState(prev => {
      const files = prev.files.map(f => f.id === id ? { ...f, is_starred: starred } : f)
      return { ...prev, files, filteredFiles: applySortClient(applyFilters(files, prev.filters), prev.sort) }
    })
  }, [])

  const handleTagsUpdate = useCallback(async (id: string, tags: string[]) => {
    const result = await updateFileTags(id, tags)
    if (!result.ok) {
      showToast(`Failed to update tags: ${result.error}`, NotificationType.Error)
      return
    }
    setState(prev => {
      const files = prev.files.map(f => f.id === id ? { ...f, tags } : f)
      const allTags = [...new Set(files.flatMap(f => f.tags))].sort()
      return { ...prev, files, allTags, filteredFiles: applySortClient(applyFilters(files, prev.filters), prev.sort) }
    })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const file = state.files.find(f => f.id === id)
    if (!file) return
    // Password check handled by Dashboard PasswordModal

    const [dbResult, storageResult] = await Promise.all([
      deleteFileRecord(id),
      deleteFromStorage(file.storage_path),
    ])

    if (!dbResult.ok) {
      showToast(`Delete failed: ${dbResult.error}`, NotificationType.Error)
      return
    }

    if (!storageResult.ok) console.warn('Storage delete failed:', storageResult.error)

    setState(prev => {
      const files = prev.files.filter(f => f.id !== id)
      return { ...prev, files, filteredFiles: applySortClient(applyFilters(files, prev.filters), prev.sort) }
    })

    showToast(`"${file.original_name}" deleted`, NotificationType.Success)
    void loadStats()
  }, [state.files, loadStats])

  // ── Upload ───────────────────────────────────────────────────────────────────

  const addFiles = useCallback((files: File[]) => {
    const newItems: UploadItem[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending',
      progress: 0,
      error: null,
      validation: validateFile(file),
    }))

    setState(prev => ({ ...prev, uploadItems: [...prev.uploadItems, ...newItems] }))

    newItems.forEach(item => {
      if (!item.validation.valid) {
        showToast(
          `${item.file.name}: ${item.validation.errors[0] ?? 'Invalid file'}`,
          NotificationType.Error
        )
      }
    })
  }, [])

  const startUploads = useCallback(() => {
    const validItems = stateRef.current.uploadItems.filter(
      i => i.validation.valid && i.status === 'pending' && !enqueuedIdsRef.current.has(i.id)
    )
    validItems.forEach(i => enqueuedIdsRef.current.add(i.id))

    validItems.forEach(item => {
      uploadQueueRef.current.enqueue(async () => {
        setState(p => ({
          ...p,
          uploadItems: p.uploadItems.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i),
        }))

        showToast(`Uploading ${item.file.name}…`, NotificationType.Info, 2000)

        const result = await uploadFile(item.file, userId, (pct) => {
          setState(p => ({
            ...p,
            uploadItems: p.uploadItems.map(i => i.id === item.id ? { ...i, progress: pct } : i),
          }))
        })

        if (result.isDuplicate) {
          setState(p => ({
            ...p,
            uploadItems: p.uploadItems.map(i => i.id === item.id ? { ...i, status: 'duplicate', progress: 100 } : i),
          }))
          showToast(`"${item.file.name}" already exists (duplicate)`, NotificationType.Warning)
        } else if (result.error) {
          setState(p => ({
            ...p,
            uploadItems: p.uploadItems.map(i => i.id === item.id ? { ...i, status: 'error', error: result.error } : i),
          }))
          showToast(`Failed: ${item.file.name} — ${result.error}`, NotificationType.Error)
        } else {
          setState(p => {
            const files = result.metadata ? [result.metadata, ...p.files] : p.files
            return {
              ...p,
              files,
              filteredFiles: applySortClient(applyFilters(files, p.filters), p.sort),
              uploadItems: p.uploadItems.map(i => i.id === item.id ? {
                ...i,
                status: 'done',
                progress: 100,
                storagePath: result.metadata?.storage_path,
                dbFileId: result.metadata?.id,
              } : i),
            }
          })
          showToast(`"${item.file.name}" uploaded successfully`, NotificationType.Success)
          void loadStats()
          void loadAllTags()
        }
      })
    })
  }, [userId, loadStats, loadAllTags])

  const clearUploadQueue = useCallback(() => {
    setState(prev => {
      const remaining = prev.uploadItems.filter(i => i.status === 'uploading')
      // Remove cleared items from enqueued tracking so they can be re-uploaded if re-added
      const remainingIds = new Set(remaining.map(i => i.id))
      for (const id of enqueuedIdsRef.current) {
        if (!remainingIds.has(id)) enqueuedIdsRef.current.delete(id)
      }
      return { ...prev, uploadItems: remaining }
    })
  }, [])

  const getSignedUrlForThumbnail = useCallback(async (storagePath: string): Promise<string | null> => {
    const result = await createSignedUrl(storagePath, '', 3600)
    return result.ok ? result.value.url : null
  }, [])

  const handleExtractToExcel = useCallback(async (item: UploadItem): Promise<void> => {
    if (!item.storagePath) {
      showToast('No storage path available for extraction', NotificationType.Error)
      return
    }
    const urlResult = await createSignedUrl(item.storagePath, '', 3600)
    if (!urlResult.ok) {
      showToast(`Failed to get file URL: ${urlResult.error}`, NotificationType.Error)
      return
    }
    const { extractAndDownloadExcel } = await import('@/lib/extractToExcel')
    showToast(`Extracting data from "${item.file.name}"…`, NotificationType.Info, 3000)
    try {
      await extractAndDownloadExcel(urlResult.value.url, item.file.type, item.file.name)
      showToast(`Excel file downloaded for "${item.file.name}"`, NotificationType.Success)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed'
      showToast(`Extraction failed: ${msg}`, NotificationType.Error)
    }
  }, [])

  const handleCleanOrphans = useCallback(async () => {
    const files = state.files
    if (files.length === 0) return
    showToast('Checking for orphaned records…', NotificationType.Info, 3000)

    const orphanIds: string[] = []
    for (const file of files) {
      const result = await createSignedUrl(file.storage_path, '', 60)
      if (!result.ok) { orphanIds.push(file.id); continue }
      // Try to fetch the file — if 4xx it's gone from storage
      try {
        const res = await fetch(result.value.url, { method: 'HEAD' })
        if (!res.ok) orphanIds.push(file.id)
      } catch {
        orphanIds.push(file.id)
      }
    }

    if (orphanIds.length === 0) {
      showToast('No orphaned records found', NotificationType.Success)
      return
    }

    // Password check handled by Dashboard PasswordModal

    const { deleteFileRecord } = await import('@/lib/database')
    let deleted = 0
    for (const id of orphanIds) {
      const r = await deleteFileRecord(id)
      if (r.ok) deleted++
    }

    setState(prev => {
      const files = prev.files.filter(f => !orphanIds.includes(f.id))
      return { ...prev, files, filteredFiles: files }
    })
    showToast(`Removed ${deleted} orphaned record(s)`, NotificationType.Success)
    void loadStats()
  }, [state.files, loadStats])

  const handleExtractFromGrid = useCallback(async (file: import('@/lib/supabase/client').DbFileMetadata): Promise<void> => {
    const urlResult = await createSignedUrl(file.storage_path, '', 3600)
    if (!urlResult.ok) {
      showToast(`Failed to get file URL: ${urlResult.error}`, NotificationType.Error)
      return
    }
    const { extractAndDownloadExcel } = await import('@/lib/extractToExcel')
    showToast(`Extracting data from "${file.original_name}"…`, NotificationType.Info, 3000)
    try {
      await extractAndDownloadExcel(urlResult.value.url, file.mime_type, file.original_name)
      showToast(`Excel file downloaded for "${file.original_name}"`, NotificationType.Success)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed'
      showToast(`Extraction failed: ${msg}`, NotificationType.Error)
    }
  }, [])

  const handleExtractAll = useCallback(async (files: import('@/lib/supabase/client').DbFileMetadata[]): Promise<void> => {
    const EXTRACTABLE = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/heic',
      'image/heif',
    ]
    const extractable = files.filter(f => EXTRACTABLE.includes(f.mime_type))
    if (extractable.length === 0) {
      showToast('No extractable files in current view', NotificationType.Warning)
      return
    }

    showToast(`Extracting ${extractable.length} files…`, NotificationType.Info, 8000)

    const fileInputs: { fileUrl: string; mimeType: string; fileName: string }[] = []
    for (const file of extractable) {
      const urlResult = await createSignedUrl(file.storage_path, '', 3600)
      if (urlResult.ok) {
        fileInputs.push({ fileUrl: urlResult.value.url, mimeType: file.mime_type, fileName: file.original_name })
      }
    }

    try {
      const { extractAllAndDownload } = await import('@/lib/extractToExcel')
      await extractAllAndDownload(fileInputs)
      showToast('All files extracted and downloaded!', NotificationType.Success)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed'
      showToast(`Extract All failed: ${msg}`, NotificationType.Error)
    }
  }, [])


  return {
    state,
    actions: {
      switchView,
      setViewMode,
      setFilters,
      setSort,
      handleSavePreset,
      handleLoadPreset,
      handleDeletePreset,
      handlePreview,
      handleDownload,
      handleShare,
      handleStar,
      handleTagsUpdate,
      handleDelete,
      addFiles,
      startUploads,
      clearUploadQueue,
      getSignedUrlForThumbnail,
      handleExtractToExcel,
      handleExtractFromGrid,
      handleExtractAll,
      handleCleanOrphans,
      loadPresets,
    },
  }
}
