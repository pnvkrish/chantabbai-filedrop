'use client'

import { useRef, useEffect } from 'react'
import type { StorageStats } from '@/lib/types'
import { FileCategory, formatBytes } from '@/lib/types'

interface StatsBarProps {
  stats: StorageStats
}

const categoryColors: Record<FileCategory, string> = {
  [FileCategory.All]: '#C4161C',
  [FileCategory.Image]: '#3b82f6',
  [FileCategory.Document]: '#8b5cf6',
  [FileCategory.Spreadsheet]: '#10b981',
}

const categoryLabels: Record<FileCategory, string> = {
  [FileCategory.All]: 'Total',
  [FileCategory.Image]: 'Images',
  [FileCategory.Document]: 'Documents',
  [FileCategory.Spreadsheet]: 'Spreadsheets',
}

export function StatsBar({ stats }: StatsBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = 100 * dpr
    canvas.height = 100 * dpr
    ctx.scale(dpr, dpr)

    const cx = 50, cy = 50, r = 38, lineWidth = 10
    const total = stats.totalFiles || 1

    const slices: { count: number; color: string }[] = [
      { count: stats.byCategory[FileCategory.Image], color: categoryColors[FileCategory.Image] },
      { count: stats.byCategory[FileCategory.Document], color: categoryColors[FileCategory.Document] },
      { count: stats.byCategory[FileCategory.Spreadsheet], color: categoryColors[FileCategory.Spreadsheet] },
    ]

    let startAngle = -Math.PI / 2

    if (stats.totalFiles === 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = lineWidth
      ctx.stroke()
    } else {
      slices.forEach(({ count, color }) => {
        const angle = (count / total) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(cx, cy, r, startAngle, startAngle + angle)
        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        ctx.stroke()
        startAngle += angle
      })
    }

    // Center text
    ctx.fillStyle = '#111827'
    ctx.font = `bold 14px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(stats.totalFiles), cx, cy)
  }, [stats])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start gap-6 flex-wrap">
        {/* Donut chart */}
        <div className="flex-shrink-0">
          <canvas
            ref={canvasRef}
            style={{ width: 100, height: 100 }}
            className="block"
          />
        </div>

        {/* Stats grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 min-w-0">
          {/* Storage used */}
          <div className="col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-400 font-medium mb-1">Storage Used</p>
            <p className="text-lg font-bold text-gray-800" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>
              {formatBytes(stats.totalBytes)}
            </p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(stats.usedPercent, 100)}%`, background: '#C4161C' }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{stats.usedPercent.toFixed(1)}% of 1 GB</p>
          </div>

          {/* Per-category */}
          {[FileCategory.Image, FileCategory.Document, FileCategory.Spreadsheet].map(cat => (
            <div key={cat}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: categoryColors[cat] }} />
                <p className="text-xs text-gray-400 font-medium">{categoryLabels[cat]}</p>
              </div>
              <p className="text-xl font-bold text-gray-800" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>
                {stats.byCategory[cat]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
