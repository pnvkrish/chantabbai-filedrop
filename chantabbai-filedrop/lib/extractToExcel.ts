import * as XLSX from 'xlsx'
import type { ParsedDocument } from '@/lib/parser'

type ExtractionResult = ParsedDocument

// ── Column definitions ────────────────────────────────────────────────────────
const HEADERS = ['Date', 'Category', 'Amount (₹)', 'Vendor', 'Bill Type', 'File Name']
const COL_WIDTHS = [{ wch: 13 }, { wch: 22 }, { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 32 }]

function hasDate(e: ExtractionResult): boolean {
  return e.billDateRaw !== 'Not found'
}

function formatUploadDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function amountStr(e: ExtractionResult): string {
  if (e.billAmountNumeric !== null) {
    return e.billAmountNumeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const kv = e.keyValues.find(([k]) => k === 'Amount')
  return kv ? kv[1].replace('₹ ', '').trim() : ''
}

function makeRow(e: ExtractionResult, fileName: string, dateOverride?: string): string[] {
  return [
    dateOverride ?? e.billDateRaw,
    e.restaurantCategory ?? 'Others',
    amountStr(e),
    e.vendorName !== 'Unknown Vendor' ? e.vendorName : '',
    e.purpose,
    fileName,
  ]
}

function applyHeader(sheet: XLSX.WorkSheet) {
  HEADERS.forEach((h, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i })
    if (sheet[cellRef]) sheet[cellRef].s = { font: { bold: true } }
  })
  sheet['!cols'] = COL_WIDTHS
}

function sortByDate(rows: string[][]): string[][] {
  return rows.slice(1).sort((a, b) => {
    const parseD = (s: string) => {
      const [dd, mm, yyyy] = s.replace(/[^0-9/]/g, '').split('/')
      if (!dd || !mm || !yyyy) return 0
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime()
    }
    return parseD(a[0]) - parseD(b[0])
  })
}

// ── Fetch from API ────────────────────────────────────────────────────────────
async function fetchExtract(fileUrl: string, mimeType: string, fileName: string, fileId?: string): Promise<ExtractionResult> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileUrl, mimeType, fileName, fileId }),
  })
  if (!res.ok) {
    const e = (await res.json()) as { error?: string }
    throw new Error(e.error ?? 'Extraction failed')
  }
  return ((await res.json()) as { extracted: ExtractionResult }).extracted
}

const EMPTY_PARSED = {
  tableData: [] as string[][], rawLines: [] as string[], summary_numbers: [] as {label:string;value:string;unit:string}[],
  restaurantCategory: 'Others' as string, vendorName: 'Unknown Vendor' as string,
  billAmountNumeric: null as number | null, billDateRaw: 'Not found' as string,
}

// ── Single file ───────────────────────────────────────────────────────────────
export async function extractAndDownloadExcel(
  fileUrl: string,
  mimeType: string,
  fileName: string,
  fileId?: string,
  uploadedAt?: string,
): Promise<void> {
  let extracted: ExtractionResult
  try {
    extracted = await fetchExtract(fileUrl, mimeType, fileName, fileId)
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Extraction failed'
    extracted = {
      title: fileName, purpose: 'Error',
      keyValues: [
        ['Date', 'Not extracted'], ['Amount', 'Not extracted'],
        ['Bill Type', 'Not extracted'], ['Error', errMsg],
      ],
      ...EMPTY_PARSED,
    } as ExtractionResult
  }

  const wb = XLSX.utils.book_new()
  const uploadDate = uploadedAt ? formatUploadDate(uploadedAt) : ''

  if (hasDate(extracted)) {
    const sheet = XLSX.utils.aoa_to_sheet([HEADERS, makeRow(extracted, fileName)])
    applyHeader(sheet)
    XLSX.utils.book_append_sheet(wb, sheet, 'Bill')
  } else {
    const row = makeRow(extracted, fileName, uploadDate ? `${uploadDate} (upload date)` : 'Not found')
    const sheet = XLSX.utils.aoa_to_sheet([HEADERS, row])
    applyHeader(sheet)
    XLSX.utils.book_append_sheet(wb, sheet, 'Date Not Found')
  }

  XLSX.writeFile(wb, `${fileName.replace(/\.[^.]+$/, '')}_extracted.xlsx`)
}

// ── Batch — all files ─────────────────────────────────────────────────────────
export async function extractAllAndDownload(
  files: Array<{ fileUrl: string; mimeType: string; fileName: string; uploadedAt?: string }>
): Promise<void> {
  const results = await Promise.all(
    files.map(async ({ fileUrl, mimeType, fileName, uploadedAt }) => {
      try {
        return { fileName, uploadedAt, extracted: await fetchExtract(fileUrl, mimeType, fileName), error: null }
      } catch (e) {
        return {
          fileName, uploadedAt,
          extracted: { title: fileName, purpose: 'Error', keyValues: [], ...EMPTY_PARSED } as ExtractionResult,
          error: e instanceof Error ? e.message : 'failed',
        }
      }
    })
  )

  const wb = XLSX.utils.book_new()
  const billRows: string[][] = []       // date found
  const noDateRows: string[][] = []     // date not found
  const catTotals: Record<string, number> = {}

  for (const { fileName, extracted, uploadedAt, error } of results) {
    const uploadDate = uploadedAt ? formatUploadDate(uploadedAt) : ''

    if (error) {
      noDateRows.push([`${uploadDate} (upload date)`, 'Error', '', '', error, fileName])
      continue
    }

    if (hasDate(extracted)) {
      billRows.push(makeRow(extracted, fileName))
      if (extracted.billAmountNumeric) {
        const cat = extracted.restaurantCategory ?? 'Others'
        catTotals[cat] = (catTotals[cat] ?? 0) + extracted.billAmountNumeric
      }
    } else {
      noDateRows.push(makeRow(extracted, fileName, `${uploadDate} (upload date)`))
    }
  }

  // ── Sheet 1: Bills (sorted by date) ──────────────────────────────────────
  const sorted = sortByDate([HEADERS, ...billRows])
  const billSheet = XLSX.utils.aoa_to_sheet([HEADERS, ...sorted])
  applyHeader(billSheet)
  XLSX.utils.book_append_sheet(wb, billSheet, 'Bills')

  // ── Sheet 2: Date Not Found ───────────────────────────────────────────────
  if (noDateRows.length > 0) {
    const noDateSheet = XLSX.utils.aoa_to_sheet([HEADERS, ...noDateRows])
    applyHeader(noDateSheet)
    XLSX.utils.book_append_sheet(wb, noDateSheet, 'Date Not Found')
  }

  // ── Sheet 3: Category Summary ─────────────────────────────────────────────
  const grandTotal = Object.values(catTotals).reduce((a, b) => a + b, 0)
  const summaryRows = [
    ['Category', 'Total (₹)', '% of Total'],
    ...Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => [cat, total.toFixed(2), `${((total / grandTotal) * 100).toFixed(1)}%`]),
    ['', '', ''],
    ['GRAND TOTAL', grandTotal.toFixed(2), '100%'],
  ]
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Category Summary')

  XLSX.writeFile(wb, `extracted_all_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
