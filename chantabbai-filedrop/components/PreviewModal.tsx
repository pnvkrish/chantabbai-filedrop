'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { DbFileMetadata } from '@/lib/supabase/client'
import { formatBytes, formatDate, formatTime } from '@/lib/types'
import { SummaryPanel } from './SummaryPanel'

interface PreviewModalProps {
  file: DbFileMetadata
  url: string
  allFiles: DbFileMetadata[]
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onStar: (id: string, starred: boolean) => void
  onTagsUpdate: (id: string, tags: string[]) => void
  onShare: (id: string, expiry: number) => Promise<string | null>
  onDownload: (id: string) => void
}

type PreviewType = 'image' | 'pdf' | 'office'

function getPreviewType(mimeType: string): PreviewType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'office'
}

const OFFICE_COLORS: Record<string, string> = {
  doc: '#2b579a', docx: '#2b579a', xls: '#217346', xlsx: '#217346', pdf: '#cc4125',
}

export function PreviewModal({
  file,
  url,
  allFiles,
  onClose,
  onPrev,
  onNext,
  onStar,
  onTagsUpdate,
  onShare,
  onDownload,
}: PreviewModalProps) {
  const previewType = getPreviewType(file.mime_type)
  const [tagInput, setTagInput] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [shareExpiry, setShareExpiry] = useState(3600)
  const [shareLoading, setShareLoading] = useState(false)

  const currentIndex = allFiles.findIndex(f => f.id === file.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allFiles.length - 1

  // Close on Escape, arrow nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      if (e.key === 'ArrowRight' && hasNext) onNext()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || file.tags.includes(tag)) { setTagInput(''); return }
    onTagsUpdate(file.id, [...file.tags, tag])
    setTagInput('')
  }, [tagInput, file.tags, file.id, onTagsUpdate])

  const handleRemoveTag = useCallback((tag: string) => {
    onTagsUpdate(file.id, file.tags.filter(t => t !== tag))
  }, [file.tags, file.id, onTagsUpdate])

  const handleShare = useCallback(async () => {
    setShareLoading(true)
    const link = await onShare(file.id, shareExpiry)
    if (link) setShareUrl(link)
    setShareLoading(false)
  }, [file.id, shareExpiry, onShare])

  return (
    <div className="modal-overlay animate-fade-in" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-container">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <span className="text-lg">{getFileEmoji(file.mime_type)}</span>
          <h2
            className="flex-1 text-sm font-semibold text-gray-800 truncate"
            style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
          >
            {file.original_name}
          </h2>
          <div className="flex items-center gap-1">
            <NavBtn disabled={!hasPrev} onClick={onPrev}>←</NavBtn>
            <NavBtn disabled={!hasNext} onClick={onNext}>→</NavBtn>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 text-lg transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ minHeight: 320 }}>
          {/* Preview area */}
          <div className="modal-preview-area">
            {previewType === 'image' && <ImagePreview url={url} name={file.original_name} />}
            {previewType === 'pdf' && (
              <iframe
                src={url}
                className="w-full h-full"
                style={{ minHeight: 320 }}
                title={file.original_name}
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            )}
            {previewType === 'office' && (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow"
                  style={{ background: OFFICE_COLORS[file.extension] ?? '#6b7280' }}
                >
                  {file.extension.toUpperCase()}
                </div>
                <p className="text-sm text-gray-500">
                  This file type cannot be previewed inline.
                </p>
                <button
                  onClick={() => onDownload(file.id)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #C4161C, #9B1116)', fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
                >
                  Download to View
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="modal-sidebar">
            {/* Metadata */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">File Info</h3>
              <dl className="flex flex-col gap-2">
                <MetaRow label="Size" value={formatBytes(file.size)} />
                <MetaRow label="Type" value={file.extension.toUpperCase()} />
                <MetaRow label="Uploaded" value={`${formatDate(file.uploaded_at)} ${formatTime(file.uploaded_at)}`} />
                <MetaRow label="Downloads" value={String(file.download_count)} />
              </dl>
            </div>

            {/* AI Summary */}
            <SummaryPanel fileUrl={url} mimeType={file.mime_type} />

            {/* Star */}
            <button
              onClick={() => onStar(file.id, !file.is_starred)}
              className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl border transition-all ${
                file.is_starred
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-600'
                  : 'border-gray-200 text-gray-400 hover:border-yellow-200'
              }`}
            >
              <span>{file.is_starred ? '★' : '☆'}</span>
              <span>{file.is_starred ? 'Starred' : 'Add to Starred'}</span>
            </button>

            {/* Tags */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {file.tags.map(tag => (
                  <span key={tag} className="tag-chip gap-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  placeholder="Add tag…"
                  className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-red-300"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTag() }}
                />
                <button
                  onClick={handleAddTag}
                  className="text-xs px-2.5 py-1.5 rounded-lg text-white transition-all"
                  style={{ background: '#C4161C' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Share */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Share</h3>
              <div className="flex gap-1 mb-2">
                <select
                  value={shareExpiry}
                  onChange={e => setShareExpiry(Number(e.target.value))}
                  className="text-xs flex-1 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                >
                  <option value={3600}>1 hour</option>
                  <option value={86400}>24 hours</option>
                  <option value={604800}>7 days</option>
                </select>
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className="text-xs px-3 py-1.5 rounded-lg text-white transition-all"
                  style={{ background: shareLoading ? '#9ca3af' : '#C4161C' }}
                >
                  {shareLoading ? '…' : 'Generate'}
                </button>
              </div>
              {shareUrl && (
                <div className="flex gap-1">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 text-xs px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg truncate"
                  />
                  <button
                    onClick={() => { void navigator.clipboard.writeText(shareUrl) }}
                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:border-red-300 transition-colors"
                    title="Copy"
                  >
                    📋
                  </button>
                </div>
              )}
            </div>

            {/* Download */}
            <button
              onClick={() => onDownload(file.id)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #C4161C, #9B1116)', fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
            >
              ⬇ Download
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Image Preview with zoom/pan/rotate ──────────────────────────────────────

function ImagePreview({ url, name }: { url: string; name: string }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const transform = `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${scale})`

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale(s => Math.min(5, Math.max(0.5, s + (e.deltaY > 0 ? -0.1 : 0.1))))
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }, [pan])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panStart.current) return
    setPan({ x: panStart.current.panX + e.clientX - panStart.current.x, y: panStart.current.panY + e.clientY - panStart.current.y })
  }, [])

  const onMouseUp = useCallback(() => { panStart.current = null }, [])

  const reset = () => { setScale(1); setRotation(0); setPan({ x: 0, y: 0 }) }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 bg-white">
        <ToolBtn onClick={() => setScale(s => Math.min(5, s + 0.2))}>+</ToolBtn>
        <ToolBtn onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>−</ToolBtn>
        <ToolBtn onClick={() => setRotation(r => r + 90)}>↻</ToolBtn>
        <ToolBtn onClick={reset}>⤢</ToolBtn>
        <span className="text-xs text-gray-400 ml-2">{Math.round(scale * 100)}%</span>
      </div>

      {/* Canvas */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center bg-gray-50"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: panStart.current ? 'grabbing' : 'grab' }}
      >
        <img
          ref={imgRef}
          src={url}
          alt={name}
          style={{ transform, transition: panStart.current ? 'none' : 'transform 0.1s', maxWidth: '100%', maxHeight: '100%', userSelect: 'none', pointerEvents: 'none' }}
          draggable={false}
        />
      </div>
    </div>
  )
}

function ToolBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors border border-gray-200"
    >
      {children}
    </button>
  )
}

function NavBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-gray-400 flex-shrink-0">{label}</dt>
      <dd className="text-xs text-gray-700 font-medium text-right truncate">{value}</dd>
    </div>
  )
}

function getFileEmoji(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('word')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  return '📁'
}
