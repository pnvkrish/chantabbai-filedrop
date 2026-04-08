'use client'

import { useRef, useState, useCallback } from 'react'
import type { UploadItem } from '@/hooks/useFileManager'
import { formatBytes } from '@/lib/types'

interface UploadZoneProps {
  uploadItems: UploadItem[]
  onFilesSelected: (files: File[]) => void
  onStartUpload: () => void
  onClear: () => void
  onExtract: (item: UploadItem) => void
}

const statusIcon: Record<UploadItem['status'], string> = {
  pending: '⏳',
  uploading: '⬆',
  done: '✓',
  error: '✕',
  duplicate: '⊘',
}

const statusColor: Record<UploadItem['status'], string> = {
  pending: 'text-gray-500',
  uploading: 'text-blue-600',
  done: 'text-green-600',
  error: 'text-red-600',
  duplicate: 'text-yellow-600',
}

const EXTRACTABLE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/heic',
  'image/heif',
]

export function UploadZone({ uploadItems, onFilesSelected, onStartUpload, onClear, onExtract }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [extractingIds, setExtractingIds] = useState<Set<string>>(new Set())

  const handleExtract = useCallback(async (item: UploadItem) => {
    setExtractingIds(prev => new Set(prev).add(item.id))
    try {
      await onExtract(item)
    } finally {
      setExtractingIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }, [onExtract])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) onFilesSelected(files)
  }, [onFilesSelected])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFilesSelected(files)
    e.target.value = ''
  }, [onFilesSelected])

  const hasPending = uploadItems.some(i => i.validation.valid && i.status === 'pending')
  const hasCompleted = uploadItems.some(i => ['done', 'error', 'duplicate'].includes(i.status))

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
          dragOver
            ? 'border-red-500 bg-red-50'
            : 'border-gray-200 hover:border-red-300 hover:bg-red-50/30 bg-white'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
            style={{ background: dragOver ? '#C4161C' : '#fee2e2' }}
          >
            <span style={{ filter: dragOver ? 'brightness(10)' : 'none' }}>📎</span>
          </div>

          <div>
            <p
              className="text-base font-semibold text-gray-700"
              style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
            >
              {dragOver ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              or <span className="text-red-600 font-medium">browse files</span>
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {['PNG', 'JPG', 'HEIC', 'PDF', 'DOC', 'DOCX', 'XLS', 'XLSX'].map(ext => (
              <span key={ext} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full font-medium">
                {ext}
              </span>
            ))}
          </div>

          <p className="text-xs text-gray-400">1 KB – 30 MB per file</p>
        </div>
      </div>

      {/* Upload queue */}
      {uploadItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <span
              className="text-sm font-semibold text-gray-700"
              style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
            >
              Upload Queue ({uploadItems.length})
            </span>
            {hasCompleted && (
              <button
                onClick={onClear}
                className="text-xs text-gray-400 hover:text-red-600 transition-colors"
              >
                Clear done
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {uploadItems.map(item => (
              <div key={item.id} className="px-5 py-3.5">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className={`text-sm ${statusColor[item.status]}`}>
                    {item.status === 'uploading'
                      ? <span className="inline-block w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                      : statusIcon[item.status]
                    }
                  </span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{item.file.name}</span>
                  <span className="text-xs text-gray-400">{formatBytes(item.file.size)}</span>
                </div>

                {!item.validation.valid && (
                  <p className="text-xs text-red-500 ml-6">{item.validation.errors[0]}</p>
                )}

                {item.status === 'uploading' && (
                  <div className="ml-6 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.progress}%`, background: '#C4161C' }}
                    />
                  </div>
                )}

                {item.status === 'error' && item.error && (
                  <p className="text-xs text-red-500 ml-6">{item.error}</p>
                )}

                {item.status === 'duplicate' && (
                  <p className="text-xs text-yellow-600 ml-6">Duplicate — file already exists</p>
                )}

                {item.status === 'done' && (
                  <div className="ml-6 flex items-center gap-3">
                    <p className="text-xs text-green-600">Uploaded successfully</p>
                    {EXTRACTABLE_TYPES.includes(item.file.type) && (
                      <button
                        onClick={() => void handleExtract(item)}
                        disabled={extractingIds.has(item.id)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                      >
                        {extractingIds.has(item.id) ? (
                          <>
                            <span className="inline-block w-3 h-3 border-2 border-green-200 border-t-white rounded-full animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <span>⬇</span> Extract to Excel
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasPending && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={onStartUpload}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #C4161C, #9B1116)',
                  fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                }}
              >
                Upload {uploadItems.filter(i => i.validation.valid && i.status === 'pending').length} File(s)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
