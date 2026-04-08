'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from './Logo'
import { UploadZone } from './UploadZone'
import { FileGrid } from './FileGrid'
import { FilterBar } from './FilterBar'
import { StatsBar } from './StatsBar'
import { PreviewModal } from './PreviewModal'
import { PasswordModal } from './PasswordModal'
import { ToastContainer } from './Toast'
import { useFileManager } from '@/hooks/useFileManager'
import { ViewMode } from '@/lib/types'
import type { DbFileMetadata } from '@/lib/supabase/client'
import { supabase } from '@/lib/supabase/client'

interface DashboardProps {
  userId: string
  userEmail: string
}

export function Dashboard({ userId, userEmail }: DashboardProps) {
  const router = useRouter()
  const { state, actions } = useFileManager(userId)
  const [previewData, setPreviewData] = useState<{ file: DbFileMetadata; url: string } | null>(null)
  const [extractingAll, setExtractingAll] = useState(false)
  const extractAllRef = useRef(false)
  const [passwordModal, setPasswordModal] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  const requirePassword = useCallback((title: string, description: string, onConfirm: () => void) => {
    setPasswordModal({ title, description, onConfirm })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleFileAction = useCallback(async (action: string, id: string) => {
    switch (action) {
      case 'preview': {
        const data = await actions.handlePreview(id)
        if (data) setPreviewData(data)
        break
      }
      case 'download':
        await actions.handleDownload(id)
        break
      case 'share': {
        const url = await actions.handleShare(id, 3600)
        if (url) {
          void navigator.clipboard.writeText(url)
        }
        break
      }
      case 'star': {
        const file = state.files.find(f => f.id === id)
        if (file) await actions.handleStar(id, !file.is_starred)
        break
      }
      case 'delete': {
        const file = state.files.find(f => f.id === id)
        requirePassword(
          'Delete File',
          `"${file?.original_name ?? 'this file'}" will be permanently deleted.`,
          () => { void actions.handleDelete(id) }
        )
        break
      }
      case 'extract': {
        const file = state.files.find(f => f.id === id)
        if (!file) break
        await actions.handleExtractFromGrid(file)
        break
      }
    }
  }, [actions, state.files])

  const hasFilter =
    state.filters.query.trim() !== '' ||
    state.filters.category !== 'all' ||
    state.filters.tags.length > 0 ||
    state.filters.isStarred !== null ||
    state.filters.dateFrom !== null ||
    state.filters.dateTo !== null

  return (
    <>
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Logo />

          {/* Nav */}
          <nav className="flex gap-1 ml-6">
            <NavBtn
              active={state.currentView === 'upload'}
              onClick={() => actions.switchView('upload')}
            >
              📎 Upload
            </NavBtn>
            <NavBtn
              active={state.currentView === 'files'}
              onClick={() => actions.switchView('files')}
            >
              📁 My Files {state.files.length > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-current/10">
                  {state.files.length}
                </span>
              )}
            </NavBtn>
          </nav>

          {/* User */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block truncate max-w-32">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 transition-all"
              style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Upload view */}
        {state.currentView === 'upload' && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h1
                className="text-2xl font-bold text-gray-800 mb-2"
                style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
              >
                Upload Files
              </h1>
              <p className="text-gray-400 text-sm">PNG, JPG, HEIC, PDF, Word & Excel — up to 30 MB each</p>
            </div>
            <UploadZone
              uploadItems={state.uploadItems}
              onFilesSelected={actions.addFiles}
              onStartUpload={actions.startUploads}
              onClear={actions.clearUploadQueue}
              onExtract={actions.handleExtractToExcel}
            />
          </div>
        )}

        {/* Files view */}
        {state.currentView === 'files' && (
          <div className="animate-fade-in flex flex-col gap-6">
            {/* Stats */}
            {state.stats && <StatsBar stats={state.stats} />}

            {/* Filter bar + Extract All */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
            <FilterBar
              filters={state.filters}
              sort={state.sort}
              allTags={state.allTags}
              totalFiles={state.files.length}
              filteredCount={state.filteredFiles.length}
              presets={actions.loadPresets()}
              onFiltersChange={actions.setFilters}
              onSortChange={actions.setSort}
              onSavePreset={actions.handleSavePreset}
              onLoadPreset={actions.handleLoadPreset}
              onDeletePreset={actions.handleDeletePreset}
            />
              </div>

              {/* Extract All button */}
              <button
                onClick={async () => {
                  if (extractAllRef.current) return
                  extractAllRef.current = true
                  setExtractingAll(true)
                  try {
                    await actions.handleExtractAll(state.filteredFiles)
                  } finally {
                    extractAllRef.current = false
                    setExtractingAll(false)
                  }
                }}
                disabled={extractingAll || state.filteredFiles.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 whitespace-nowrap shrink-0"
                style={{
                  background: extractingAll ? '#15803d' : 'linear-gradient(135deg, #16a34a, #15803d)',
                  fontFamily: 'var(--font-poppins), Poppins, sans-serif',
                }}
              >
                {extractingAll ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-green-200 border-t-white rounded-full animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>⬇ Extract All</>
                )}
              </button>
            </div>

            {/* View mode switcher */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {[
                  { mode: ViewMode.Grid, icon: '⊞' },
                  { mode: ViewMode.List, icon: '≡' },
                  { mode: ViewMode.Timeline, icon: '⊟' },
                ].map(({ mode, icon }) => (
                  <button
                    key={mode}
                    onClick={() => actions.setViewMode(mode)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                      state.viewMode === mode ? 'view-mode-active shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title={mode}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400">{state.viewMode} view</span>
            </div>

            {/* File list */}
            {state.isLoading ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-48 rounded-2xl" />
                ))}
              </div>
            ) : (
              <FileGrid
                files={state.filteredFiles}
                viewMode={state.viewMode}
                hasFilter={hasFilter}
                onAction={handleFileAction}
                getSignedUrl={actions.getSignedUrlForThumbnail}
              />
            )}
          </div>
        )}
      </main>

      {/* Preview modal */}
      {previewData && (
        <PreviewModal
          file={previewData.file}
          url={previewData.url}
          allFiles={state.filteredFiles}
          onClose={() => setPreviewData(null)}
          onPrev={async () => {
            const idx = state.filteredFiles.findIndex(f => f.id === previewData.file.id)
            const prev = state.filteredFiles[idx > 0 ? idx - 1 : state.filteredFiles.length - 1]
            if (prev) { const data = await actions.handlePreview(prev.id); if (data) setPreviewData(data) }
          }}
          onNext={async () => {
            const idx = state.filteredFiles.findIndex(f => f.id === previewData.file.id)
            const next = state.filteredFiles[idx < state.filteredFiles.length - 1 ? idx + 1 : 0]
            if (next) { const data = await actions.handlePreview(next.id); if (data) setPreviewData(data) }
          }}
          onStar={actions.handleStar}
          onTagsUpdate={actions.handleTagsUpdate}
          onShare={actions.handleShare}
          onDownload={actions.handleDownload}
        />
      )}

      {/* Password modal for delete / clean up */}
      {passwordModal && (
        <PasswordModal
          title={passwordModal.title}
          description={passwordModal.description}
          onConfirm={() => {
            setPasswordModal(null)
            passwordModal.onConfirm()
          }}
          onCancel={() => setPasswordModal(null)}
        />
      )}
    </>
  )
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
        active ? 'nav-active shadow-sm' : 'text-gray-500 hover:bg-gray-100'
      }`}
      style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
    >
      {children}
    </button>
  )
}
