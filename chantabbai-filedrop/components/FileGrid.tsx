'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { DbFileMetadata } from '@/lib/supabase/client'
import { ViewMode, formatBytes, formatDate } from '@/lib/types'

const EXTRACTABLE_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/heic',
  'image/heif',
]

interface FileGridProps {
  files: DbFileMetadata[]
  viewMode: ViewMode
  hasFilter: boolean
  onAction: (action: string, id: string) => Promise<void> | void
  getSignedUrl: (storagePath: string) => Promise<string | null>
}

export function FileGrid({ files, viewMode, hasFilter, onAction, getSignedUrl }: FileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Lazy-load PNG thumbnails
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const imgs = container.querySelectorAll<HTMLImageElement>('img[data-storage-path]')
    imgs.forEach(async img => {
      const path = img.dataset['storagePath']
      if (!path || img.src) return
      const url = await getSignedUrl(path)
      if (url) img.src = url
    })
  }, [files, viewMode, getSignedUrl])

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">📁</div>
        <h3 className="text-base font-semibold text-gray-600" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>
          {hasFilter ? 'No files match your filters' : 'No files yet'}
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          {hasFilter ? 'Try clearing some filters' : 'Upload your first file to get started'}
        </p>
      </div>
    )
  }

  if (viewMode === ViewMode.Grid) {
    return (
      <div ref={containerRef} className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {files.map(file => (
          <FileCard key={file.id} file={file} onAction={onAction} />
        ))}
      </div>
    )
  }

  if (viewMode === ViewMode.List) {
    return (
      <div ref={containerRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid text-xs font-semibold text-gray-400 px-4 py-2.5 border-b border-gray-100 bg-gray-50"
          style={{ gridTemplateColumns: '32px 1fr 80px 110px 1fr' }}>
          <span />
          <span>Name</span>
          <span>Size</span>
          <span className="hidden sm:block">Uploaded</span>
          <span className="text-right">Actions</span>
        </div>
        {files.map(file => (
          <FileRow key={file.id} file={file} onAction={onAction} />
        ))}
      </div>
    )
  }

  // Timeline
  const grouped: Record<string, DbFileMetadata[]> = {}
  files.forEach(f => {
    const key = new Date(f.uploaded_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(f)
  })

  return (
    <div ref={containerRef} className="flex flex-col gap-8">
      {Object.entries(grouped).map(([month, groupFiles]) => (
        <div key={month}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full" style={{ background: '#C4161C' }} />
            <h3 className="text-sm font-semibold text-gray-600" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>
              {month}
            </h3>
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">{groupFiles.length} files</span>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {groupFiles.map(file => (
              <FileCard key={file.id} file={file} onAction={onAction} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── File Card (Grid / Timeline) ─────────────────────────────────────────────

function FileCard({ file, onAction }: { file: DbFileMetadata; onAction: (a: string, id: string) => void }) {
  const isPng = file.mime_type === 'image/png'
  const [extracting, setExtracting] = useState(false)
  const canExtract = EXTRACTABLE_MIME_TYPES.includes(file.mime_type)

  const handleExtract = useCallback(async () => {
    setExtracting(true)
    try {
      await onAction('extract', file.id)
    } finally {
      setExtracting(false)
    }
  }, [onAction, file.id])

  return (
    <div className="file-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Thumbnail */}
      <div
        className="h-28 flex items-center justify-center cursor-pointer"
        style={{ background: isPng ? '#f9fafb' : getFileBg(file.mime_type) }}
        onClick={() => onAction('preview', file.id)}
      >
        {isPng ? (
          <img
            data-storage-path={file.storage_path}
            alt={file.original_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-3xl">{getFileEmoji(file.mime_type)}</span>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-xs font-semibold text-gray-700 truncate" title={file.original_name}>
          {file.original_name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatBytes(file.size)} · {formatDate(file.uploaded_at)}
        </p>

        {/* Tags */}
        {file.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {file.tags.slice(0, 3).map(t => (
              <span key={t} className="tag-chip">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Extract button */}
      {canExtract && (
        <div className="px-3 pb-2">
          <button
            onClick={() => void handleExtract()}
            disabled={extracting}
            className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
          >
            {extracting ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-green-200 border-t-white rounded-full animate-spin" />
                Extracting...
              </>
            ) : (
              <>⬇ Extract to Excel</>
            )}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-4 border-t border-gray-100">
        <ActionBtn icon="👁" label="Preview" onClick={() => onAction('preview', file.id)} />
        <ActionBtn icon="⬇" label="Download" onClick={() => onAction('download', file.id)} />
        <ActionBtn
          icon={file.is_starred ? '★' : '☆'}
          label={file.is_starred ? 'Starred' : 'Star'}
          onClick={() => onAction('star', file.id)}
          color={file.is_starred ? '#F5A623' : undefined}
        />
        <ActionBtn icon="🗑" label="Delete" onClick={() => onAction('delete', file.id)} danger />
      </div>
    </div>
  )
}

// ─── File Row (List) ──────────────────────────────────────────────────────────

function FileRow({ file, onAction }: { file: DbFileMetadata; onAction: (a: string, id: string) => void }) {
  const [extracting, setExtracting] = useState(false)
  const canExtract = EXTRACTABLE_MIME_TYPES.includes(file.mime_type)

  const handleExtract = useCallback(async () => {
    setExtracting(true)
    try {
      await onAction('extract', file.id)
    } finally {
      setExtracting(false)
    }
  }, [onAction, file.id])

  return (
    <div
      className="grid items-center px-4 py-3 hover:bg-red-50/30 transition-colors border-b border-gray-50 last:border-b-0"
      style={{ gridTemplateColumns: '32px 1fr 80px 110px 1fr' }}
    >
      <span className="text-lg">{getFileEmoji(file.mime_type)}</span>
      <div className="min-w-0">
        <p className="text-sm text-gray-700 font-medium truncate">{file.original_name}</p>
        {file.is_starred && <span className="text-xs text-yellow-500">★</span>}
      </div>
      <span className="text-xs text-gray-400">{formatBytes(file.size)}</span>
      <span className="text-xs text-gray-400 hidden sm:block">{formatDate(file.uploaded_at)}</span>
      <div className="flex justify-end items-center gap-1">
        {canExtract && (
          <button
            onClick={() => void handleExtract()}
            disabled={extracting}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
          >
            {extracting ? (
              <span className="inline-block w-3 h-3 border-2 border-green-200 border-t-white rounded-full animate-spin" />
            ) : (
              '⬇ Extract'
            )}
          </button>
        )}
        <ActionBtn icon="👁" label="Preview" onClick={() => onAction('preview', file.id)} />
        <ActionBtn icon="⬇" label="Download" onClick={() => onAction('download', file.id)} />
        <ActionBtn icon="🔗" label="Share" onClick={() => onAction('share', file.id)} />
        <ActionBtn icon="🗑" label="Delete" onClick={() => onAction('delete', file.id)} danger />
      </div>
    </div>
  )
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionBtn({
  icon, label, onClick, danger, color
}: {
  icon: string
  label: string
  onClick: () => void
  danger?: boolean
  color?: string
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 py-2 text-center transition-all border-r border-gray-100 last:border-r-0 ${
        danger
          ? 'hover:bg-red-50 text-gray-400 hover:text-red-600'
          : 'hover:bg-gray-50 text-gray-500 hover:text-gray-700'
      }`}
      style={color ? { color } : undefined}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFileEmoji(mimeType: string): string {
  if (mimeType === 'image/png') return '🖼'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('word')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  return '📁'
}

function getFileBg(mimeType: string): string {
  if (mimeType === 'application/pdf') return '#fff5f5'
  if (mimeType.includes('word')) return '#eff6ff'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '#f0fdf4'
  return '#f9fafb'
}
