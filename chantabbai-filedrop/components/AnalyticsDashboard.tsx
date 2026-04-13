'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { fetchBudgets, upsertBudget, deleteBudget, type BillAnalyticsRow } from '@/lib/database'
import type { BudgetSetting } from '@/lib/supabase/client'
import { RESTAURANT_CATEGORIES, detectRestaurantCategory } from '@/lib/parser'
import * as XLSX from 'xlsx'

const COLORS = [
  '#C4161C', '#e55a5f', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
  '#84cc16', '#06b6d4', '#a855f7', '#f43f5e',
]

function getMonthKey(dateStr: string | null, fallback: string): string {
  if (dateStr && dateStr !== 'Not found') {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts
      return `${yyyy}-${mm}`
    }
  }
  return fallback.slice(0, 7)
}

function formatINR(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

interface Props {
  userId: string
  isOwner?: boolean
}

export function AnalyticsDashboard({ userId, isOwner = false }: Props) {
  const [bills, setBills] = useState<BillAnalyticsRow[]>([])
  const [budgets, setBudgets] = useState<BudgetSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showMonthlyFiles, setShowMonthlyFiles] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const reload = useCallback(async () => {
    setLoading(true)
    const [billsRes, budgetRes] = await Promise.all([
      fetch('/api/bills').then(r => r.json()) as Promise<{ bills: BillAnalyticsRow[] }>,
      fetchBudgets(userId),
    ])
    setBills((billsRes.bills ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      original_name: (r.description as string) || (r.vendor_name as string) || 'Excel Entry',
      category: (() => { const n = normalizeExcelCategory((r.category as string) ?? ''); return (n && n !== 'SKIP') ? n : (r.category as string | null) })(),
      vendor_name: r.vendor_name as string | null,
      bill_amount: r.bill_amount as number | null,
      bill_date: r.bill_date as string | null,
      approval_status: null,
      uploaded_at: r.created_at as string,
      source: 'excel_import',
    })))
    if (budgetRes.ok) setBudgets(budgetRes.value)
    setLoading(false)
  }, [userId])

  useEffect(() => { void reload() }, [reload])

  // Derive available months
  const months = [...new Set(bills.map(b => getMonthKey(b.bill_date, b.uploaded_at)))].sort().reverse()
  const prevMonth = months[months.indexOf(selectedMonth) + 1] ?? null

  // Filter bills for selected month
  const thisMonthBills = bills.filter(b => getMonthKey(b.bill_date, b.uploaded_at) === selectedMonth)
  const prevMonthBills = prevMonth ? bills.filter(b => getMonthKey(b.bill_date, b.uploaded_at) === prevMonth) : []

  const totalThis = thisMonthBills.reduce((s, b) => s + (b.bill_amount ?? 0), 0)
  const totalPrev = prevMonthBills.reduce((s, b) => s + (b.bill_amount ?? 0), 0)
  const change = totalPrev > 0 ? ((totalThis - totalPrev) / totalPrev) * 100 : null

  // Category breakdown for selected month (exclude 'Total' rows which are summary rows)
  const EXCLUDED_CATS = ['total', 'grand total', 'subtotal']
  const catMap: Record<string, number> = {}
  for (const b of thisMonthBills) {
    const cat = b.category ?? 'Others'
    if (EXCLUDED_CATS.includes(cat.toLowerCase())) continue
    catMap[cat] = (catMap[cat] ?? 0) + (b.bill_amount ?? 0)
  }
  const catData = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Stacked monthly trend: last 6 months × category
  const trendMonths = [...new Set(bills.map(b => getMonthKey(b.bill_date, b.uploaded_at)))].sort().slice(-6)
  const trendCats = [...new Set(
    bills.filter(b => b.bill_amount && !EXCLUDED_CATS.includes((b.category ?? '').toLowerCase()))
      .map(b => b.category ?? 'Others')
  )].slice(0, 10)
  const trendData = trendMonths.map(month => {
    const row: Record<string, string | number> = { month: month.slice(5) }
    for (const cat of trendCats) {
      row[cat] = bills
        .filter(b => getMonthKey(b.bill_date, b.uploaded_at) === month && (b.category ?? 'Others') === cat)
        .reduce((s, b) => s + (b.bill_amount ?? 0), 0)
    }
    return row
  })

  // Budget alerts
  const budgetMap = Object.fromEntries(budgets.map(b => [b.category, b.monthly_limit]))
  const alerts = catData
    .filter(c => budgetMap[c.name] && c.value >= budgetMap[c.name] * 0.8)
    .map(c => ({
      category: c.name,
      spent: c.value,
      limit: budgetMap[c.name],
      pct: (c.value / budgetMap[c.name]) * 100,
    }))

  // Vendor totals
  const vendorMap: Record<string, number> = {}
  for (const b of thisMonthBills) {
    const v = b.vendor_name ?? 'Unknown'
    vendorMap[v] = (vendorMap[v] ?? 0) + (b.bill_amount ?? 0)
  }
  const topVendors = Object.entries(vendorMap)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // Recurring detection: categories that appear in 2+ consecutive months
  const monthCatSet: Record<string, Set<string>> = {}
  for (const b of bills) {
    const mk = getMonthKey(b.bill_date, b.uploaded_at)
    if (!monthCatSet[mk]) monthCatSet[mk] = new Set()
    if (b.category) monthCatSet[mk].add(b.category)
  }
  const RECURRING_CATS = ['Electricity', 'Water', 'Gas', 'Rent', 'Staff Salary']
  const actualCatsLower = Object.keys(catMap).map(k => k.toLowerCase())
  const missingRecurring = RECURRING_CATS.filter(cat => {
    const needleWords = cat.toLowerCase().split(/\s+/)
    return !actualCatsLower.some(k => {
      const kWords = k.split(/\s+/)
      // Match if the first word of the needle starts with or matches any word in actual category
      return needleWords.some(nw => kWords.some(kw => kw.startsWith(nw) || nw.startsWith(kw)))
    })
  })

  // Generate 3-line summary insights
  function buildInsights(): [string, string, string] {
    const topCat = catData[0]
    const topCatPct = totalThis > 0 && topCat ? ((topCat.value / totalThis) * 100).toFixed(0) : '0'
    const changeAbs = Math.abs(change ?? 0).toFixed(1)
    const monthLabel = selectedMonth

    const line1 = topCat
      ? `Your highest expense in ${monthLabel} is ${topCat.name} at ₹${topCat.value.toLocaleString('en-IN')} (${topCatPct}% of total spend).`
      : `No expense data recorded for ${monthLabel} yet.`

    const line2 = change !== null
      ? change > 5
        ? `Spending rose ${changeAbs}% vs last month — review bulk purchases and vendor pricing to bring costs down.`
        : change < -5
          ? `Great job! Spending dropped ${changeAbs}% vs last month — keep maintaining discipline in procurement.`
          : `Spending is stable (${changeAbs}% change vs last month) — consistent expense control is working.`
      : `No previous month data to compare — upload last month's Excel sheet to track trends.`

    const topTarget = totalThis > 0 ? Math.round(totalThis * 0.9) : 0
    const line3 = topCat
      ? `To reduce costs: negotiate better rates for ${topCat.name}, batch-order to get discounts, and target ₹${topTarget.toLocaleString('en-IN')} (10% less) next month.`
      : `Start uploading your monthly expense Excel to get personalised cost-control recommendations.`

    return [line1, line2, line3]
  }
  const insights = buildInsights()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">

      {/* ── Desktop header (sm+): title left | buttons + month right ── */}
      <div className="hidden sm:flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>
            Monthly Analytics
          </h2>
          <p className="text-sm text-gray-400">Track your restaurant expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMonthlyFiles(v => !v)}
            className={`text-sm px-4 py-2 rounded-xl border transition-all font-semibold ${showMonthlyFiles ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
          >
            📋 Monthly Files
          </button>
          {isOwner && (
            <button
              onClick={() => setShowImport(v => !v)}
              className={`text-sm px-4 py-2 rounded-xl border transition-all font-semibold ${showImport ? 'border-red-300 text-red-600 bg-red-50' : 'border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'}`}
            >
              📥 Upload Excel
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setShowBudgetModal(true)}
              className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 transition-all"
            >
              ⚙ Set Budgets
            </button>
          )}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* ── Mobile header: title + month row | buttons row ── */}
      <div className="flex flex-col gap-3 sm:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>
              Monthly Analytics
            </h2>
            <p className="text-xs text-gray-400">Track your restaurant expenses</p>
          </div>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMonthlyFiles(v => !v)}
            className={`flex-1 text-xs px-3 py-2 rounded-xl border transition-all font-semibold text-center ${showMonthlyFiles ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
          >
            📋 Files
          </button>
          {isOwner && (
            <button
              onClick={() => setShowImport(v => !v)}
              className={`flex-1 text-xs px-3 py-2 rounded-xl border transition-all font-semibold text-center ${showImport ? 'border-red-300 text-red-600 bg-red-50' : 'border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'}`}
            >
              📥 Excel
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setShowBudgetModal(true)}
              className="flex-1 text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 transition-all text-center"
            >
              ⚙ Budgets
            </button>
          )}
        </div>
      </div>

      {/* Excel Import panel */}
      {showImport && (
        <ExcelImportPanel
          userId={userId}
          onImported={async () => { await reload(); setShowImport(false) }}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Monthly Files panel — right below header */}
      {showMonthlyFiles && (
        <MonthlyFilesPanel
          bills={bills}
          allBills={bills}
          isOwner={isOwner}
          onDeleteMonth={async (ids) => {
            const res = await fetch('/api/bills', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids }),
            })
            if (res.ok) await reload()
          }}
          onClose={() => setShowMonthlyFiles(false)}
        />
      )}

      {/* Budget alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map(a => (
            <div key={a.category} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${a.pct >= 100 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
              <span>{a.pct >= 100 ? '🔴' : '🟡'}</span>
              <span className="font-semibold">{a.category}</span>
              <span>spent {formatINR(a.spent)} of {formatINR(a.limit)} budget ({a.pct.toFixed(0)}%)</span>
            </div>
          ))}
        </div>
      )}

      {/* Recurring missing */}
      {missingRecurring.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <span className="font-semibold">📌 Missing this month:</span>{' '}
          {missingRecurring.join(', ')} — no bills uploaded yet.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total Spend" value={formatINR(totalThis)} sub={change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs last` : 'No prior'} subColor={change !== null ? (change > 0 ? 'text-red-500' : 'text-green-600') : 'text-gray-400'} />
        <KpiCard label="Entries" value={String(thisMonthBills.length)} sub="this month" subColor="text-blue-600" />
        <KpiCard label="Vendors" value={String(Object.keys(vendorMap).filter(v => v !== 'Unknown').length || thisMonthBills.length)} sub="unique" subColor="text-gray-400" />
      </div>

      {/* Charts */}
      {catData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Pie */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Category Breakdown</h3>
            <p className="text-xs text-gray-400 mb-3">{selectedMonth} · {catData.length} categories</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="42%" outerRadius={80}
                  label={({ percent }: { percent?: number }) => percent !== undefined && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => formatINR(Number(v))} />
                <Legend
                  formatter={(v) => <span className="text-xs text-gray-600">{v}</span>}
                  wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                  iconSize={9}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Stacked Bar — monthly trend */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Monthly Spend Trend</h3>
            <p className="text-xs text-gray-400 mb-3">Last {trendMonths.length} months · stacked by category</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trendData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: unknown) => `₹${(Number(v) / 1000).toFixed(0)}k`} width={44} />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [formatINR(Number(v)), String(name)]}
                  wrapperStyle={{ zIndex: 10 }}
                />
                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                  iconSize={9}
                  formatter={(v) => <span className="text-xs text-gray-600">{v}</span>}
                />
                {trendCats.map((cat, i) => (
                  <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[i % COLORS.length]}
                    radius={i === trendCats.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-12 text-center text-gray-400 shadow-sm">
          <p className="text-base mb-1">No data for {selectedMonth}</p>
          <p className="text-sm">Use <strong className="text-gray-600">Upload Excel</strong> to import your expense sheet for this month.</p>
        </div>
      )}

      {/* Top vendors */}
      {topVendors.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Vendors — {selectedMonth}</h3>
          <div className="flex flex-col gap-2">
            {topVendors.map((v, i) => (
              <div key={v.name} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-4 text-right shrink-0">{i + 1}.</span>
                <span className="text-xs font-medium text-gray-700 w-24 sm:w-32 shrink-0 truncate">{v.name}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-lg overflow-hidden min-w-0">
                  <div
                    className="h-full rounded-lg"
                    style={{ width: `${(v.total / topVendors[0].total) * 100}%`, background: COLORS[i % COLORS.length], minWidth: 6 }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-20 sm:w-28 text-right shrink-0">{formatINR(v.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Summary */}
      {thisMonthBills.length > 0 && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📊</span>
            <h3 className="text-sm font-bold text-white" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>
              Monthly Summary — {selectedMonth}
            </h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {insights.map((line, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{ background: i === 0 ? '#C4161C' : i === 1 ? '#f97316' : '#22c55e', color: 'white' }}>
                  {i + 1}
                </span>
                <p className="text-xs sm:text-sm text-gray-200 leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget modal */}
      {showBudgetModal && (
        <BudgetModal
          userId={userId}
          budgets={budgets}
          onSave={async (cat, limit) => {
            await upsertBudget(userId, cat, limit)
            await reload()
          }}
          onDelete={async (cat) => {
            await deleteBudget(userId, cat)
            await reload()
          }}
          onClose={() => setShowBudgetModal(false)}
        />
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, subColor }: { label: string; value: string; sub: string; subColor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 shadow-sm">
      <p className="text-[10px] sm:text-xs text-gray-400 mb-1 truncate">{label}</p>
      <p className="text-base sm:text-2xl font-bold text-gray-800 truncate" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>{value}</p>
      <p className={`text-[10px] sm:text-xs mt-1 truncate ${subColor}`}>{sub}</p>
    </div>
  )
}

// ─── Excel Import Panel ───────────────────────────────────────────────────────

interface ParsedRow {
  idx: number
  date: string
  vendor: string
  amount: number
  category: string
  description: string
}

function findHeader(keys: string[], candidates: string[]): string | undefined {
  // Exact match first, then partial
  return (
    keys.find(k => candidates.some(c => k.toLowerCase().trim() === c)) ??
    keys.find(k => candidates.some(c => k.toLowerCase().includes(c)))
  )
}

function excelDateToString(val: unknown): string {
  if (typeof val === 'number' && val > 1000) {
    // Excel serial date → JS date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    if (!isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      return `${dd}/${mm}/${d.getUTCFullYear()}`
    }
  }
  const s = String(val ?? '').trim()
  // Convert YYYY-MM-DD to DD/MM/YYYY
  const iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (iso) return `${iso[3].padStart(2,'0')}/${iso[2].padStart(2,'0')}/${iso[1]}`
  return s
}

const SUMMARY_ROW_PATTERN = /^(total|grand\s*total|sub\s*total|net\s*total|sum|average|nil)$/i

// Map abbreviated/partial Excel category values to proper RESTAURANT_CATEGORIES
function normalizeExcelCategory(cat: string): string {
  const c = cat.toLowerCase().trim()
  if (!c) return ''
  if (SUMMARY_ROW_PATTERN.test(c)) return 'SKIP'
  if (/^gas|lpg/.test(c))                               return 'Gas / LPG'
  if (/^meat|seafood|fish|chicken|mutton/.test(c))       return 'Meat & Seafood'
  if (/^electric/.test(c))                               return 'Electricity'
  if (/^water/.test(c))                                  return 'Water'
  if (/^staff|^salary|salari|salaries|^wage/.test(c))    return 'Staff Salary'
  if (/^rent/.test(c))                                   return 'Rent'
  if (/^mainten|^repair|^equipment/.test(c))             return 'Equipment & Maintenance'
  if (/^dairy|^milk|^egg/.test(c))                       return 'Dairy & Eggs'
  if (/^veg|^fruit|^sabji/.test(c))                      return 'Vegetables & Fruits'
  if (/^rice|^grain|^wheat|^flour|^dal/.test(c))         return 'Rice & Grains'
  if (/^oil|^spice|^masala|^cooking/.test(c))            return 'Cooking Supplies'
  if (/^pack|^box|^container/.test(c))                   return 'Packaging'
  if (/^fuel|^petrol|^diesel|^transport/.test(c))        return 'Fuel & Transport'
  // Exact match
  const exact = RESTAURANT_CATEGORIES.find(rc => rc.toLowerCase() === c)
  if (exact) return exact
  return cat
}

// Vendor memory — persisted in localStorage so corrections apply to future imports
const VENDOR_MEMORY_KEY = 'chantabbai_vendor_cats'
function loadVendorMemory(): Record<string, string> {
  try { return JSON.parse(typeof window !== 'undefined' ? (localStorage.getItem(VENDOR_MEMORY_KEY) ?? '{}') : '{}') } catch { return {} }
}
function saveVendorMemory(entries: { vendor: string; category: string }[]) {
  const mem = loadVendorMemory()
  entries.forEach(({ vendor, category }) => { if (vendor && vendor !== 'Unknown') mem[vendor.toLowerCase()] = category })
  if (typeof window !== 'undefined') localStorage.setItem(VENDOR_MEMORY_KEY, JSON.stringify(mem))
}
function lookupVendorMemory(vendor: string): string | undefined {
  return loadVendorMemory()[vendor.toLowerCase()]
}

function ExcelImportPanel({ userId, onImported, onClose }: { userId: string; onImported: () => Promise<void>; onClose: () => void }) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [editRows, setEditRows] = useState<ParsedRow[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fileName, setFileName] = useState('')
  const [uploadMonth, setUploadMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setParsing(true)
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: false })

      // Try each sheet until we get rows with data
      let raw: Record<string, unknown>[] = []
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName]
        const attempt = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        if (attempt.length > 0) { raw = attempt; break }
      }

      if (raw.length === 0) { setParsing(false); return }

      // If headers look numeric (no proper header row), try raw array mode and find header row
      const firstKeys = Object.keys(raw[0])
      const hasProperHeaders = firstKeys.some(k => /[a-zA-Z]/.test(k))
      if (!hasProperHeaders) {
        // Try sheet_to_json with header:1 to get array of arrays, find the row with text headers
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName]
          const arr = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
          const headerRowIdx = arr.findIndex(row =>
            Array.isArray(row) && row.some(c => typeof c === 'string' && /[a-zA-Z]/.test(c))
          )
          if (headerRowIdx >= 0) {
            const headers = arr[headerRowIdx] as string[]
            raw = arr.slice(headerRowIdx + 1).map(row => {
              const r: Record<string, unknown> = {}
              ;(row as unknown[]).forEach((v, i) => { r[headers[i] ?? `col${i}`] = v })
              return r
            })
            break
          }
        }
      }

      const keys = Object.keys(raw[0] ?? {})
      const dateKey   = findHeader(keys, ['date', 'dt', 'bill date', 'invoice date', 'bill_date', 'तारीख', 'दिनांक'])
      const vendorKey = findHeader(keys, ['vendor', 'supplier', 'party', 'from', 'name', 'company', 'payee', 'particulars', 'paid to', 'towards', 'shop'])
      const amountKey = findHeader(keys, ['amount', 'total', 'net amount', 'grand total', 'value', 'rs', '₹', 'price', 'rate', 'cost', 'bill amount', 'paid', 'spend', 'expense', 'amt'])
      const catKey    = findHeader(keys, ['category', 'type', 'head', 'expense head', 'group', 'cat'])
      const descKey   = findHeader(keys, ['description', 'details', 'item', 'narration', 'remarks', 'note', 'particular'])

      const [yyyy, mm] = uploadMonth.split('-')
      const fallbackDate = `01/${mm}/${yyyy}`

      const parsed: ParsedRow[] = raw
        .map((row, i) => {
          const vendor = String(row[vendorKey ?? ''] ?? '').trim() || 'Unknown'
          // Skip summary/total rows
          if (SUMMARY_ROW_PATTERN.test(vendor)) return null

          const rawAmt = String(row[amountKey ?? ''] ?? '').replace(/[,₹Rs.\s]/g, '')
          const amount = parseFloat(rawAmt) || 0
          if (amount <= 0) return null

          const fullText = Object.values(row).join(' ')
          const rawCat = catKey ? String(row[catKey] ?? '').trim() : ''
          const normalizedCat = normalizeExcelCategory(rawCat)
          const rawDate = dateKey ? excelDateToString(row[dateKey]) : ''

          // Skip rows where category column says "Total" or similar
          if (normalizedCat === 'SKIP') return null

          // Priority: 1) vendor memory (past corrections), 2) normalized sheet category, 3) auto-detect
          const memoryCat = lookupVendorMemory(vendor)
          const autocat = detectRestaurantCategory(fullText, vendor)
          let category: string
          if (memoryCat) {
            category = memoryCat
          } else if (normalizedCat && normalizedCat !== rawCat) {
            // Successfully normalized from Excel value
            category = normalizedCat
          } else if (rawCat && RESTAURANT_CATEGORIES.includes(rawCat as never)) {
            category = rawCat
          } else {
            category = autocat
          }

          return {
            idx: i,
            date: rawDate || fallbackDate,
            vendor,
            amount,
            category,
            description: descKey ? String(row[descKey] ?? '').trim() : '',
          }
        })
        .filter((r): r is ParsedRow => r !== null)

      setRows(parsed)
      setEditRows(parsed.map(r => ({ ...r })))
    } catch (e) {
      console.error('Excel parse error:', e)
    }
    setParsing(false)
  }

  async function handleSave() {
    setSaving(true)
    saveVendorMemory(editRows.map(r => ({ vendor: r.vendor, category: r.category })))
    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        bills: editRows.map(r => ({
          vendor_name: r.vendor,
          category: r.category,
          bill_amount: r.amount,
          bill_date: r.date,
          description: r.description || r.vendor,
        })),
      }),
    })
    setSaving(false)
    if (res.ok) await onImported()
  }

  function updateRow(idx: number, field: keyof ParsedRow, value: string) {
    setEditRows(prev => prev.map(r => r.idx === idx ? { ...r, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : r))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-800" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>Upload Excel</h3>
          <p className="text-xs text-gray-400 mt-0.5">Date, Vendor, Amount columns are auto-detected</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
        <span className="text-sm text-blue-700 font-semibold whitespace-nowrap">📅 Which month are these bills for?</span>
        <input
          type="month"
          value={uploadMonth}
          onChange={e => setUploadMonth(e.target.value)}
          className="text-sm border border-blue-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
        />
      </div>

      {/* Drop zone */}
      {rows.length === 0 && (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-all"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = '' }}
          />
          {parsing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Detecting columns…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <span className="text-4xl">📊</span>
              <p className="text-sm font-medium">Click or drop your Excel / CSV file here</p>
              <p className="text-xs">Supports .xlsx, .xls, .csv — any column order</p>
            </div>
          )}
        </div>
      )}

      {/* Preview table */}
      {editRows.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{editRows.length} rows</span> detected from <span className="font-medium">{fileName}</span>
              {rows.length === 0 && <span className="ml-2 text-red-500 text-xs">⚠ No valid rows found — check column headers</span>}
            </p>
            <button onClick={() => { setRows([]); setEditRows([]) }} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100 mb-4">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {['Date', 'Vendor', 'Category', 'Amount (₹)', 'Description'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {editRows.map(r => (
                  <tr key={r.idx} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5">
                      <input value={r.date} onChange={e => updateRow(r.idx, 'date', e.target.value)} className="w-24 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-300" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={r.vendor} onChange={e => updateRow(r.idx, 'vendor', e.target.value)} className="w-32 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-300" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={r.category} onChange={e => updateRow(r.idx, 'category', e.target.value)} className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-300">
                        {RESTAURANT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={r.amount} onChange={e => updateRow(r.idx, 'amount', e.target.value)} className="w-24 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-300" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={r.description} onChange={e => updateRow(r.idx, 'description', e.target.value)} className="w-36 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-300" placeholder="optional" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => { setRows([]); setEditRows([]) }} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600">Cancel</button>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="text-sm px-5 py-2 rounded-xl font-semibold text-white disabled:opacity-50 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #C4161C, #9B1116)' }}
            >
              {saving ? 'Saving…' : `Save ${editRows.length} Bills`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Month Report Generator ───────────────────────────────────────────────────

function generateMonthReport(monthKey: string, allBills: BillAnalyticsRow[]) {
  const monthBills = allBills.filter(b => getMonthKey(b.bill_date, b.uploaded_at) === monthKey)
  const [yyyy, mm] = monthKey.split('-')
  const prevDate = new Date(Number(yyyy), Number(mm) - 2)
  const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const prevBills = allBills.filter(b => getMonthKey(b.bill_date, b.uploaded_at) === prevKey)

  const totalThis = monthBills.reduce((s, b) => s + (b.bill_amount ?? 0), 0)
  const totalPrev = prevBills.reduce((s, b) => s + (b.bill_amount ?? 0), 0)
  const change = totalPrev > 0 ? ((totalThis - totalPrev) / totalPrev) * 100 : null

  const catMap: Record<string, number> = {}
  for (const b of monthBills) { const c = b.category ?? 'Others'; catMap[c] = (catMap[c] ?? 0) + (b.bill_amount ?? 0) }
  const prevCatMap: Record<string, number> = {}
  for (const b of prevBills) { const c = b.category ?? 'Others'; prevCatMap[c] = (prevCatMap[c] ?? 0) + (b.bill_amount ?? 0) }

  const catData = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const allCats = [...new Set([...Object.keys(catMap), ...Object.keys(prevCatMap)])]
  const maxVal = Math.max(...allCats.map(c => Math.max(catMap[c] ?? 0, prevCatMap[c] ?? 0)), 1)

  const monNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const label = `${monNames[Number(mm)]} ${yyyy}`
  const prevLabel = `${monNames[prevDate.getMonth() + 1]} ${prevDate.getFullYear()}`

  const topCat = catData[0]
  const topCatPct = totalThis > 0 && topCat ? ((topCat[1] / totalThis) * 100).toFixed(0) : '0'
  const ins1 = topCat
    ? `Your highest expense in ${label} is <strong>${topCat[0]}</strong> at ₹${topCat[1].toLocaleString('en-IN')} (${topCatPct}% of total spend).`
    : `No expense data for ${label}.`
  const ins2 = change !== null
    ? change > 5
      ? `Spending rose <strong>${Math.abs(change).toFixed(1)}%</strong> vs last month — review bulk purchases and vendor pricing to bring costs down.`
      : change < -5
        ? `Great job! Spending dropped <strong>${Math.abs(change).toFixed(1)}%</strong> vs last month — keep maintaining procurement discipline.`
        : `Spending is <strong>stable</strong> (${Math.abs(change).toFixed(1)}% change) — consistent expense control is working well.`
    : `No previous month data available for comparison.`
  const target = Math.round(totalThis * 0.9)
  const ins3 = topCat
    ? `To reduce costs: negotiate better rates for <strong>${topCat[0]}</strong>, batch-order supplies, and target ₹${target.toLocaleString('en-IN')} (10% less) next month.`
    : `Upload your expense data to get personalised cost-control recommendations.`

  const barRows = allCats.map(cat => {
    const tw = totalThis > 0 ? ((catMap[cat] ?? 0) / maxVal * 100).toFixed(1) : '0'
    const pw = totalPrev > 0 ? ((prevCatMap[cat] ?? 0) / maxVal * 100).toFixed(1) : '0'
    const diff = (catMap[cat] ?? 0) - (prevCatMap[cat] ?? 0)
    const diffStr = diff === 0 ? '—' : (diff > 0 ? `+₹${diff.toLocaleString('en-IN')}` : `-₹${Math.abs(diff).toLocaleString('en-IN')}`)
    const diffColor = diff > 0 ? '#ef4444' : diff < 0 ? '#22c55e' : '#9ca3af'
    return `
      <tr>
        <td style="padding:8px 12px;font-weight:500;color:#374151;">${cat}</td>
        <td style="padding:8px 12px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="flex:1;background:#f3f4f6;border-radius:4px;height:10px;">
              <div style="width:${tw}%;background:#C4161C;border-radius:4px;height:10px;"></div>
            </div>
            <span style="font-weight:600;color:#111827;white-space:nowrap;min-width:80px;">₹${(catMap[cat] ?? 0).toLocaleString('en-IN')}</span>
          </div>
        </td>
        <td style="padding:8px 12px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="flex:1;background:#f3f4f6;border-radius:4px;height:10px;">
              <div style="width:${pw}%;background:#d1d5db;border-radius:4px;height:10px;"></div>
            </div>
            <span style="color:#6b7280;white-space:nowrap;min-width:80px;">₹${(prevCatMap[cat] ?? 0).toLocaleString('en-IN')}</span>
          </div>
        </td>
        <td style="padding:8px 12px;font-weight:600;color:${diffColor};white-space:nowrap;">${diffStr}</td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Expense Report — ${label}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',sans-serif;color:#111827;background:#f9fafb;padding:32px;}
  @media print{body{background:white;padding:24px;} .no-print{display:none}}
  .card{background:white;border-radius:16px;padding:24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.08);}
  h1{font-size:22px;font-weight:700;color:#C4161C;} h2{font-size:14px;font-weight:700;color:#374151;margin-bottom:14px;}
  table{width:100%;border-collapse:collapse;} th{text-align:left;padding:8px 12px;background:#f9fafb;font-size:11px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;}
  tr:hover td{background:#fafafa;}
  .ins{display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;}
  .num{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;}
  .ins p{font-size:13px;line-height:1.6;color:#374151;}
  .legend{display:flex;gap:20px;margin-bottom:12px;}
  .dot{width:12px;height:12px;border-radius:3px;display:inline-block;margin-right:5px;vertical-align:middle;}
</style></head><body>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h1>Chantabbai FileDrop</h1>
      <p style="color:#6b7280;font-size:13px;margin-top:4px;">Monthly Expense Report</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:20px;font-weight:700;color:#111827;">₹${totalThis.toLocaleString('en-IN')}</p>
      <p style="font-size:12px;color:#6b7280;">${label} · ${monthBills.length} entries</p>
      ${change !== null ? `<p style="font-size:12px;font-weight:600;color:${change>0?'#ef4444':'#22c55e'};">${change>0?'▲':'▼'} ${Math.abs(change).toFixed(1)}% vs ${prevLabel}</p>` : ''}
    </div>
  </div>
</div>

<div class="card">
  <h2>Category Comparison — ${label} vs ${prevLabel}</h2>
  <div class="legend">
    <span><span class="dot" style="background:#C4161C;"></span>${label}</span>
    <span><span class="dot" style="background:#d1d5db;"></span>${prevLabel}</span>
  </div>
  <table>
    <thead><tr><th>Category</th><th>${label}</th><th>${prevLabel}</th><th>Change</th></tr></thead>
    <tbody>${barRows}</tbody>
    <tfoot>
      <tr style="border-top:2px solid #e5e7eb;">
        <td style="padding:10px 12px;font-weight:700;">TOTAL</td>
        <td style="padding:10px 12px;font-weight:700;color:#C4161C;">₹${totalThis.toLocaleString('en-IN')}</td>
        <td style="padding:10px 12px;font-weight:600;color:#6b7280;">₹${totalPrev.toLocaleString('en-IN')}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</div>

<div class="card">
  <h2>Monthly Insights & Recommendations</h2>
  <div class="ins"><div class="num" style="background:#C4161C;">1</div><p>${ins1}</p></div>
  <div class="ins"><div class="num" style="background:#f97316;">2</div><p>${ins2}</p></div>
  <div class="ins"><div class="num" style="background:#22c55e;">3</div><p>${ins3}</p></div>
</div>

<div style="text-align:center;margin-top:8px;">
  <button class="no-print" onclick="window.print()" style="background:#C4161C;color:white;border:none;padding:10px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
    🖨 Save as PDF
  </button>
</div>
</body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

// ─── Monthly Files Panel ──────────────────────────────────────────────────────

function MonthlyFilesPanel({
  bills,
  allBills,
  isOwner = false,
  onDeleteMonth,
  onClose,
}: {
  bills: BillAnalyticsRow[]
  allBills: BillAnalyticsRow[]
  isOwner?: boolean
  onDeleteMonth: (ids: string[]) => Promise<void>
  onClose: () => void
}) {
  const [confirmMonth, setConfirmMonth] = useState<string | null>(null)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Group bills by month
  const grouped: Record<string, BillAnalyticsRow[]> = {}
  for (const b of bills) {
    const mk = getMonthKey(b.bill_date, b.uploaded_at)
    if (!grouped[mk]) grouped[mk] = []
    grouped[mk].push(b)
  }
  const sortedMonths = Object.keys(grouped).sort().reverse()

  function startDelete(month: string) {
    setConfirmMonth(month); setPwInput(''); setPwError(false)
  }

  async function confirmDelete() {
    if (pwInput !== 'Chanti') { setPwError(true); return }
    if (!confirmMonth) return
    const ids = grouped[confirmMonth].map(b => b.id)
    setDeleting(confirmMonth); setConfirmMonth(null); setPwInput('')
    await onDeleteMonth(ids)
    setDeleting(null)
  }

  function formatMonthLabel(mk: string) {
    const [yyyy, mm] = mk.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[Number(mm) - 1]} ${yyyy}`
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-bold text-gray-800" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>Uploaded Excel Sheets</h3>
          <p className="text-xs text-gray-400 mt-0.5">Each card = one month of data · delete removes all entries for that month (password required)</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      {sortedMonths.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
          <p className="text-sm text-gray-400">No Excel data uploaded yet.</p>
          <p className="text-xs text-gray-300 mt-1">Use &quot;Upload Excel&quot; above to import your expense sheets.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedMonths.map(mk => {
            const entries = grouped[mk]
            const total = entries.reduce((s, b) => s + (b.bill_amount ?? 0), 0)
            const cats = [...new Set(entries.map(b => b.category).filter(Boolean))].slice(0, 3)
            const isDeleting = deleting === mk
            const isConfirming = confirmMonth === mk

            return (
              <div key={mk} className="flex items-center justify-between gap-4 px-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all">
                {/* Month info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                    <span className="text-[10px] font-semibold leading-none">{formatMonthLabel(mk).split(' ')[0]}</span>
                    <span className="text-sm font-bold leading-none mt-0.5">{formatMonthLabel(mk).split(' ')[1]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800">{formatMonthLabel(mk)}</p>
                    <p className="text-xs text-gray-500">{entries.length} entries · {formatINR(total)}</p>
                    {cats.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {cats.map(c => (
                          <span key={c} className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full">{c}</span>
                        ))}
                        {[...new Set(entries.map(b => b.category).filter(Boolean))].length > 3 && (
                          <span className="text-[10px] text-gray-400">+{[...new Set(entries.map(b => b.category).filter(Boolean))].length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Download report */}
                  <button
                    onClick={() => generateMonthReport(mk, allBills)}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all font-medium"
                  >
                    ⬇ Download
                  </button>

                  {/* Delete control — owner only */}
                  {isOwner && !isConfirming && !isDeleting && (
                    <button
                      onClick={() => startDelete(mk)}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-all font-medium"
                    >
                      🗑 Delete
                    </button>
                  )}
                  {isDeleting && (
                    <span className="text-xs text-gray-400">Deleting…</span>
                  )}
                  {isConfirming && (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          type="password"
                          placeholder="Password"
                          value={pwInput}
                          onChange={e => { setPwInput(e.target.value); setPwError(false) }}
                          onKeyDown={e => { if (e.key === 'Enter') void confirmDelete(); if (e.key === 'Escape') setConfirmMonth(null) }}
                          className={`w-24 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 ${pwError ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-red-200'}`}
                        />
                        <button
                          onClick={() => void confirmDelete()}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-all"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmMonth(null)}
                          className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                      {pwError && <p className="text-[10px] text-red-500">Wrong password</p>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BudgetModal({ userId, budgets, onSave, onDelete, onClose }: {
  userId: string
  budgets: BudgetSetting[]
  onSave: (cat: string, limit: number) => Promise<void>
  onDelete: (cat: string) => Promise<void>
  onClose: () => void
}) {
  void userId
  const [selected, setSelected] = useState(RESTAURANT_CATEGORIES[0] as string)
  const [limit, setLimit] = useState('')
  const [saving, setSaving] = useState(false)
  const budgetMap = Object.fromEntries(budgets.map(b => [b.category, b.monthly_limit]))

  async function handleSave() {
    const n = parseFloat(limit)
    if (isNaN(n) || n <= 0) return
    setSaving(true)
    await onSave(selected, n)
    setLimit('')
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}>Monthly Budgets</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* Set budget form */}
        <div className="flex gap-2 mb-5">
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setLimit(budgetMap[e.target.value] ? String(budgetMap[e.target.value]) : '') }}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            {RESTAURANT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number"
            placeholder="₹ Limit"
            value={limit}
            onChange={e => setLimit(e.target.value)}
            className="w-28 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #C4161C, #9B1116)' }}
          >
            {saving ? '…' : 'Set'}
          </button>
        </div>

        {/* Current budgets */}
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
          {budgets.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No budgets set yet</p>}
          {budgets.map(b => (
            <div key={b.category} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-700">{b.category}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-800">₹{b.monthly_limit.toLocaleString('en-IN')}/mo</span>
                <button onClick={() => void onDelete(b.category)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
