'use client'

import { useState, useCallback } from 'react'
import {
  type SearchFilters,
  type SortConfig,
  type FilterPreset,
  FileCategory,
  SortField,
  getDefaultFilters,
} from '@/lib/types'
import { getActivePillLabels } from '@/lib/search'

interface FilterBarProps {
  filters: SearchFilters
  sort: SortConfig
  allTags: string[]
  totalFiles: number
  filteredCount: number
  presets: FilterPreset[]
  onFiltersChange: (f: SearchFilters) => void
  onSortChange: (s: SortConfig) => void
  onSavePreset: (name: string) => void
  onLoadPreset: (p: FilterPreset) => void
  onDeletePreset: (name: string) => void
}

const categoryLabels: Record<FileCategory, string> = {
  [FileCategory.All]: 'All',
  [FileCategory.Image]: 'Images',
  [FileCategory.Document]: 'Docs',
  [FileCategory.Spreadsheet]: 'Sheets',
}

const sortLabels: Record<SortField, string> = {
  [SortField.UploadedAt]: 'Date',
  [SortField.Name]: 'Name',
  [SortField.Size]: 'Size',
  [SortField.UpdatedAt]: 'Updated',
  [SortField.DownloadCount]: 'Downloads',
}

export function FilterBar({
  filters,
  sort,
  allTags,
  totalFiles,
  filteredCount,
  presets,
  onFiltersChange,
  onSortChange,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [showPresetInput, setShowPresetInput] = useState(false)

  const set = useCallback((patch: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...patch })
  }, [filters, onFiltersChange])

  const activePills = getActivePillLabels(filters)
  const isFiltered = activePills.length > 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Main filter row */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={filters.query}
            onChange={e => set({ query: e.target.value })}
            placeholder="Search files…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {Object.entries(categoryLabels).map(([cat, label]) => (
            <button
              key={cat}
              onClick={() => set({ category: cat as FileCategory })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filters.category === cat
                  ? 'cat-tab-active shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <select
            value={sort.field}
            onChange={e => onSortChange({ ...sort, field: e.target.value as SortField })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:border-red-300"
          >
            {Object.entries(sortLabels).map(([field, label]) => (
              <option key={field} value={field}>{label}</option>
            ))}
          </select>
          <button
            onClick={() => onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
            className="text-sm px-2 py-2 border border-gray-200 rounded-lg hover:border-red-300 transition-colors"
            title="Toggle sort direction"
          >
            {sort.direction === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* Star filter */}
        <button
          onClick={() => set({ isStarred: filters.isStarred ? null : true })}
          className={`text-sm px-3 py-2 rounded-xl border transition-all ${
            filters.isStarred
              ? 'border-yellow-300 bg-yellow-50 text-yellow-600'
              : 'border-gray-200 text-gray-400 hover:border-yellow-300'
          }`}
        >
          ★
        </button>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-gray-400 hover:text-red-600 px-2 transition-colors"
        >
          {showAdvanced ? '▲ Less' : '▼ More'}
        </button>

        {/* Result count */}
        <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
          {isFiltered ? `${filteredCount} / ${totalFiles}` : `${totalFiles} files`}
        </span>
      </div>

      {/* Active filter pills */}
      {activePills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {activePills.map(pill => (
            <span key={pill} className="tag-chip gap-1">
              {pill}
            </span>
          ))}
          <button
            onClick={() => onFiltersChange(getDefaultFilters())}
            className="text-xs text-red-500 hover:text-red-700 ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="border-t border-gray-100 px-4 py-4 flex flex-col gap-4">
          {/* Date range */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-xs font-semibold text-gray-500 w-16">Date</span>
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={e => set({ dateFrom: e.target.value || null })}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-300"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={e => set({ dateTo: e.target.value || null })}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-300"
            />
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-gray-500 w-16">Tags</span>
              {allTags.slice(0, 16).map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    const has = filters.tags.includes(tag)
                    set({ tags: has ? filters.tags.filter(t => t !== tag) : [...filters.tags, tag] })
                  }}
                  className={`tag-chip cursor-pointer transition-all ${
                    filters.tags.includes(tag) ? 'ring-1 ring-red-400' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Presets */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500 w-16">Presets</span>
            {presets.map(p => (
              <div key={p.name} className="flex items-center gap-1">
                <button
                  onClick={() => onLoadPreset(p)}
                  className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  {p.name}
                </button>
                <button
                  onClick={() => onDeletePreset(p.name)}
                  className="text-xs text-gray-300 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
            {showPresetInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  placeholder="Preset name"
                  className="text-xs px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-red-300 w-28"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && presetName.trim()) {
                      onSavePreset(presetName.trim())
                      setPresetName('')
                      setShowPresetInput(false)
                    }
                    if (e.key === 'Escape') setShowPresetInput(false)
                  }}
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (presetName.trim()) {
                      onSavePreset(presetName.trim())
                      setPresetName('')
                      setShowPresetInput(false)
                    }
                  }}
                  className="text-xs text-green-600"
                >✓</button>
              </div>
            ) : (
              <button
                onClick={() => setShowPresetInput(true)}
                className="text-xs px-2.5 py-1 border border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
              >
                + Save preset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
