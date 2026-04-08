// ─── Shared document parser — runs in browser AND Node.js ────────────────────
// Always outputs exactly 3 mandatory fields: Date, Amount, Bill Type

import { parse, isValid } from 'date-fns'

export interface ParsedDocument {
  title: string
  purpose: string
  keyValues: string[][]
  tableData: string[][]
  rawLines: string[]
  summary_numbers: { label: string; value: string; unit: string }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR NORMALISER
// ─────────────────────────────────────────────────────────────────────────────

function ocrClean(text: string): string {
  return text
    .replace(/(\d)\s*([\/\-\.])\s*(\d)/g, '$1$2$3')   // "07 / 04 / 2024" → "07/04/2024"
    .replace(/(?<=\d)[Oo](?=\d)/g, '0')                // OCR O/o → 0 between digits
    .replace(/(?<=\d)[lI](?=\d)/g, '1')                // OCR l/I → 1 between digits
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE
// ─────────────────────────────────────────────────────────────────────────────

const DATE_FORMATS = [
  'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy/MM/dd',
  'dd-MM-yyyy', 'MM-dd-yyyy', 'yyyy-MM-dd',
  'dd.MM.yyyy', 'MM.dd.yyyy', 'yyyy.MM.dd',
  'd/M/yyyy',   'M/d/yyyy',
  'd-M-yyyy',   'M-d-yyyy',
  'd.M.yyyy',   'M.d.yyyy',
  'dd/MM/yy',   'MM/dd/yy',
  'd/M/yy',     'M/d/yy',
  'dd MMM yyyy', 'd MMM yyyy',
  'dd MMMM yyyy', 'd MMMM yyyy',
  'MMM dd, yyyy', 'MMM d, yyyy',
  'MMMM dd, yyyy', 'MMMM d, yyyy',
  'dd-MMM-yyyy', 'd-MMM-yyyy',
  'dd MMM yy',   'd MMM yy',
]

// Module-level reference date — avoids allocating on every tryParseDate call
const DATE_REF = new Date()

function tryParseDate(raw: string): Date | null {
  const s = raw.trim()
  for (const fmt of DATE_FORMATS) {
    try {
      const d = parse(s, fmt, DATE_REF)
      if (isValid(d) && d.getFullYear() >= 2000 && d.getFullYear() <= 2099) return d
    } catch { /* date-fns throws on bad input — skip */ }
  }
  return null
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

// Module-level regex — reset lastIndex before each matchAll call
const NUMERIC_DATE  = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g
const ISO_DATE      = /\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g
const MONTH_NAME_DY = /\b(\d{1,2}[\s\-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s,\-]+\d{2,4})\b/gi
const MONTH_NAME_MD = /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}[,\s]+\d{4})\b/gi
const DATE_LABEL    = /\b(?:date[d]?|dt\.?|invoice\s*date|bill\s*date|receipt\s*date|issued?\s*(?:on|date)?)\b/i

function candidatesFromLine(line: string): string[] {
  const out: string[] = []
  for (const re of [NUMERIC_DATE, ISO_DATE, MONTH_NAME_DY, MONTH_NAME_MD]) {
    re.lastIndex = 0
    for (const m of line.matchAll(re)) out.push(m[1])
  }
  return out
}

function extractDate(lines: string[], rawText: string): string {
  const cleaned      = ocrClean(rawText)
  const cleanedLines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)

  // Priority 1 — lines with a "date" label, plus the line immediately after
  for (let i = 0; i < cleanedLines.length; i++) {
    if (DATE_LABEL.test(cleanedLines[i])) {
      for (const line of [cleanedLines[i], cleanedLines[i + 1] ?? '']) {
        for (const c of candidatesFromLine(line)) {
          const d = tryParseDate(c)
          if (d) return fmtDate(d)
        }
      }
    }
  }

  // Priority 2 — every line top to bottom
  for (const line of cleanedLines) {
    for (const c of candidatesFromLine(line)) {
      const d = tryParseDate(c)
      if (d) return fmtDate(d)
    }
  }

  // Priority 3 — full joined text (catches dates split across very short lines)
  for (const c of candidatesFromLine(cleaned.replace(/\n/g, ' '))) {
    const d = tryParseDate(c)
    if (d) return fmtDate(d)
  }

  return 'Not found'
}

// ─────────────────────────────────────────────────────────────────────────────
// AMOUNT
// ─────────────────────────────────────────────────────────────────────────────

const AMOUNT_LABEL = /(?:grand\s*total|total\s*amount|net\s*(?:amount|payable)|amount\s*(?:paid|due)|amt\s*paid|bill\s*amount|net\s*pay|payable|subtotal|balance\s*due|total|amount)[\s:=₹Rs.\-]*([\d,]+(?:\.\d{1,2})?)/gi

function numVal(s: string): number { return parseFloat(s.replace(/,/g, '')) }

function fmtAmount(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function extractAmount(lines: string[], full: string): string {
  // Strategy 1: explicit label
  const labelled: number[] = []
  for (const line of lines) {
    AMOUNT_LABEL.lastIndex = 0
    for (const m of line.matchAll(AMOUNT_LABEL)) {
      const v = numVal(m[1])
      if (!isNaN(v) && v > 0 && v < 10_000_000) labelled.push(v)
    }
  }
  if (labelled.length) return fmtAmount(Math.max(...labelled))

  // Strategy 2: ₹ / Rs. prefix — largest
  const currency: number[] = []
  for (const m of full.matchAll(/(?:₹|rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi)) {
    const v = numVal(m[1])
    if (!isNaN(v) && v > 0 && v < 10_000_000) currency.push(v)
  }
  if (currency.length) return fmtAmount(Math.max(...currency))

  // Strategy 3: standalone decimal — largest
  const decimals: number[] = []
  for (const m of full.matchAll(/\b(\d{1,7}\.\d{2})\b/g)) {
    const v = numVal(m[1])
    if (!isNaN(v) && v >= 1 && v < 10_000_000) decimals.push(v)
  }
  if (decimals.length) return fmtAmount(Math.max(...decimals))

  return 'Not found'
}

// ─────────────────────────────────────────────────────────────────────────────
// BILL TYPE
// ─────────────────────────────────────────────────────────────────────────────

function detectBillType(full: string): string {
  if (/petrol|diesel|fuel|hpcl|bpcl|iocl|filling\s*station|pump/i.test(full))        return 'Fuel Receipt'
  if (/salary|payslip|pay\s*slip|payroll|basic\s*pay|hra|pf\s*deduction/i.test(full)) return 'Salary Slip'
  if (/purchase\s*order|p\.?o\.?\s*no|po\s*number/i.test(full))                       return 'Purchase Order'
  if (/delivery\s*note|challan|consignment/i.test(full))                               return 'Delivery Challan'
  if (/bank\s*statement|account\s*summary|opening\s*balance/i.test(full))             return 'Bank Statement'
  if (/restaurant|cafe|dine|swiggy|zomato|food\s*order/i.test(full))                  return 'Restaurant Bill'
  if (/hotel|lodge|accommodation|room\s*(?:rent|charge)/i.test(full))                 return 'Hotel Bill'
  if (/medical|pharmacy|medicine|prescription|hospital/i.test(full))                  return 'Medical Bill'
  if (/electricity|water\s*bill|utility|ebill/i.test(full))                           return 'Utility Bill'
  if (/mobile|internet|broadband|recharge|telecom/i.test(full))                       return 'Telecom Bill'
  if (/gstin|cgst|sgst|igst/i.test(full))                                             return 'GST Invoice'
  if (/invoice/i.test(full))                                                           return 'Invoice'
  if (/quotation|estimate|proforma/i.test(full))                                       return 'Quotation'
  if (/credit\s*note|debit\s*note/i.test(full))                                       return 'Credit / Debit Note'
  if (/receipt/i.test(full))                                                           return 'Receipt'
  return 'Bill / Document'
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function parseDocument(rawText: string, fileName: string): ParsedDocument {
  // Split once, pass to all helpers — avoids triple split/join
  const lines    = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const full     = lines.join(' ')
  const billType = detectBillType(full)
  const date     = extractDate(lines, rawText)
  const amount   = extractAmount(lines, full)

  return {
    title:   fileName,
    purpose: billType,
    keyValues: [
      ['Date',      date],
      ['Amount',    amount],
      ['Bill Type', billType],
    ],
    tableData:       [],
    rawLines:        [],
    summary_numbers: [],
  }
}
