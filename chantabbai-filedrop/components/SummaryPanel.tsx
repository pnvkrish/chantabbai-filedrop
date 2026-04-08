'use client'

import { useEffect, useState } from 'react'

interface SummaryPanelProps {
  fileUrl: string
  mimeType: string
}

const SUMMARISABLE = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export function SummaryPanel({ fileUrl, mimeType }: SummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSummarise = SUMMARISABLE.includes(mimeType)

  useEffect(() => {
    if (!canSummarise || !fileUrl) return
    setSummary(null)
    setError('')
    setLoading(true)

    fetch('/api/summarise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl, mimeType }),
    })
      .then(res => res.json())
      .then((data: { summary?: string; error?: string; unsupported?: boolean }) => {
        if (data.summary) setSummary(data.summary)
        else if (data.unsupported) setSummary(null)
        else setError(data.error ?? 'Failed to summarise')
      })
      .catch(() => setError('Failed to summarise'))
      .finally(() => setLoading(false))
  }, [fileUrl, mimeType, canSummarise])

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-50 to-orange-50 border-b border-gray-100">
        <span className="text-base">✨</span>
        <span
          className="text-sm font-semibold text-gray-800"
          style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
        >
          AI Summary
        </span>
        <span className="ml-auto text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-100">
          Claude
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {!canSummarise ? (
          <p className="text-xs text-gray-400 italic">
            AI summary is available for PDF and Word documents only.
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span className="text-xs text-gray-400">Analysing document…</span>
          </div>
        ) : error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : summary ? (
          <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
            {summary}
          </div>
        ) : null}
      </div>
    </div>
  )
}
