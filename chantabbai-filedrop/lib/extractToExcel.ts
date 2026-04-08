import * as XLSX from 'xlsx'
import type { ParsedDocument } from '@/lib/parser'

type ExtractionResult = ParsedDocument

// ── Build Excel sheet ─────────────────────────────────────────────────────────
function buildExcel(extracted: ExtractionResult, wb: ReturnType<typeof XLSX.utils.book_new>, sheetName?: string) {
  const name = (sheetName ?? extracted.title.replace(/\.[^.]+$/, '')).replace(/[\\/:*?[\]]/g, '').slice(0, 31) || 'Sheet'
  const sheet = XLSX.utils.aoa_to_sheet([['Field', 'Value'], ...extracted.keyValues])
  sheet['!cols'] = [{ wch: 25 }, { wch: 40 }]
  sheet['A1'] = { v: 'Field', t: 's', s: { font: { bold: true } } }
  sheet['B1'] = { v: 'Value', t: 's', s: { font: { bold: true } } }
  XLSX.utils.book_append_sheet(wb, sheet, name)
}

// All extraction (including images) goes through /api/extract so Claude handles handwriting
async function fetchExtract(fileUrl: string, mimeType: string, fileName: string): Promise<ExtractionResult> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileUrl, mimeType, fileName }),
  })
  if (!res.ok) {
    const e = (await res.json()) as { error?: string }
    throw new Error(e.error ?? 'Extraction failed')
  }
  return ((await res.json()) as { extracted: ExtractionResult }).extracted
}

// ── Single file ───────────────────────────────────────────────────────────────
export async function extractAndDownloadExcel(fileUrl: string, mimeType: string, fileName: string): Promise<void> {
  let extracted: ExtractionResult
  try {
    extracted = await fetchExtract(fileUrl, mimeType, fileName)
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Extraction failed'
    extracted = {
      title: fileName,
      purpose: 'Error',
      keyValues: [
        ['Date', 'Not extracted'],
        ['Amount', 'Not extracted'],
        ['Bill Type', 'Not extracted'],
        ['Error', errMsg],
      ],
      tableData: [],
      rawLines: [],
      summary_numbers: [],
    }
  }
  const wb = XLSX.utils.book_new()
  buildExcel(extracted, wb)
  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No content found']]), 'Result')
  }
  XLSX.writeFile(wb, `${fileName.replace(/\.[^.]+$/, '')}_extracted.xlsx`)
}

// ── Batch — all files in parallel ────────────────────────────────────────────
export async function extractAllAndDownload(
  files: Array<{ fileUrl: string; mimeType: string; fileName: string }>
): Promise<void> {
  const wb = XLSX.utils.book_new()
  const summaryRows: string[][] = [['File', 'Document Type', 'Fields', 'Status']]

  const results = await Promise.all(
    files.map(async ({ fileUrl, mimeType, fileName }) => {
      try {
        return { fileName, extracted: await fetchExtract(fileUrl, mimeType, fileName), error: null }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'failed'
        return {
          fileName,
          extracted: {
            title: fileName,
            purpose: 'Error',
            keyValues: [['Date', 'Not extracted'], ['Amount', 'Not extracted'], ['Bill Type', 'Not extracted'], ['Error', errMsg]],
            tableData: [],
            rawLines: [],
            summary_numbers: [],
          } as ExtractionResult,
          error: errMsg,
        }
      }
    })
  )

  for (const { fileName, extracted, error } of results) {
    buildExcel(extracted, wb, fileName.replace(/\.[^.]+$/, '').replace(/[\\/:*?[\]]/g, '').slice(0, 20))
    summaryRows.push([fileName, extracted.purpose, String(extracted.keyValues.length), error ? `Error: ${error}` : 'OK'])
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
  summarySheet['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 20 }]
  summarySheet['A1'] = { v: 'File', t: 's', s: { font: { bold: true } } }
  summarySheet['B1'] = { v: 'Document Type', t: 's', s: { font: { bold: true } } }
  summarySheet['C1'] = { v: 'Fields', t: 's', s: { font: { bold: true } } }
  summarySheet['D1'] = { v: 'Status', t: 's', s: { font: { bold: true } } }
  wb.SheetNames.unshift('Summary')
  wb.Sheets['Summary'] = summarySheet

  XLSX.writeFile(wb, `extracted_all_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
