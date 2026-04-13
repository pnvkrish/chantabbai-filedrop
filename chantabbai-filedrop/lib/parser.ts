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
  // Structured bill fields for DB storage
  restaurantCategory: string
  vendorName: string
  billAmountNumeric: number | null
  billDateRaw: string
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
// RESTAURANT CATEGORY
// ─────────────────────────────────────────────────────────────────────────────

export const RESTAURANT_CATEGORIES = [
  'Staff Salary',
  'Rent',
  'Electricity',
  'Water',
  'Gas / LPG',
  'Fuel & Transport',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Vegetables & Fruits',
  'Rice & Grains',
  'Cooking Supplies',
  'Packaging',
  'Equipment & Maintenance',
  'Others',
] as const

export type RestaurantCategory = (typeof RESTAURANT_CATEGORIES)[number]

export function detectRestaurantCategory(full: string, vendorName?: string): RestaurantCategory {
  // Staff Salary: only if explicit salary keywords in the description/category, NOT just a person name as vendor
  const nonVendorText = vendorName ? full.replace(new RegExp(vendorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '') : full
  if (/salary|payslip|wages|payroll|staff\s*pay|employee\s*pay/i.test(nonVendorText)) return 'Staff Salary'
  if (/\brent\b|lease|property|premises/i.test(full))                                 return 'Rent'
  if (/electricity|current\s*bill|eb\s*bill|bescom|mseb|tangedco|power\s*bill/i.test(full)) return 'Electricity'
  if (/water\s*bill|water\s*supply|metro\s*water|bwssb/i.test(full))                 return 'Water'
  if (/lpg|gas\s*cylinder|hp\s*gas|indane|bharatgas|cooking\s*gas/i.test(full))      return 'Gas / LPG'
  if (/petrol|diesel|fuel|filling\s*station|hpcl|bpcl|iocl|ruchi\s*trails/i.test(full)) return 'Fuel & Transport'
  // Payment voucher "Towards" field — e.g. "Towards: Petrol"
  const towardsMatch = full.match(/towards\s*[:\-]?\s*([a-z\s\/&]+)/i)
  if (towardsMatch) {
    const towards = towardsMatch[1].toLowerCase()
    if (/petrol|diesel|fuel/.test(towards))              return 'Fuel & Transport'
    if (/gas|lpg/.test(towards))                         return 'Gas / LPG'
    if (/salary|wages|staff/.test(towards))              return 'Staff Salary'
    if (/rent/.test(towards))                            return 'Rent'
    if (/electricity|current/.test(towards))             return 'Electricity'
    if (/water/.test(towards))                           return 'Water'
    if (/meat|chicken|mutton|fish/.test(towards))        return 'Meat & Seafood'
    if (/milk|dairy|paneer|ghee/.test(towards))          return 'Dairy & Eggs'
    if (/vegetable|onion|tomato/.test(towards))          return 'Vegetables & Fruits'
    if (/rice|wheat|flour|grain/.test(towards))          return 'Rice & Grains'
    if (/oil|spice|masala/.test(towards))                return 'Cooking Supplies'
  }
  if (/chicken|mutton|fish|prawn|seafood|meat|gosht|lamb|pork|beef/i.test(full))     return 'Meat & Seafood'
  if (/milk|dairy|paneer|curd|cheese|butter|ghee|cream/i.test(full))                 return 'Dairy & Eggs'
  if (/vegetable|sabji|sabzi|onion|tomato|potato|carrot|cabbage|cauliflower|spinach/i.test(full)) return 'Vegetables & Fruits'
  if (/\brice\b|wheat|flour|\bdal\b|pulses|grain|maida|rava|suji/i.test(full))       return 'Rice & Grains'
  if (/oil|spice|masala|ingredient|condiment|vinegar|sugar|salt/i.test(full))        return 'Cooking Supplies'
  if (/packaging|container|box|packet|foil|wrapper/i.test(full))                     return 'Packaging'
  if (/equipment|machine|appliance|repair|maintenance|service\s*charge/i.test(full)) return 'Equipment & Maintenance'
  return 'Others'
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR
// ─────────────────────────────────────────────────────────────────────────────

export function extractVendor(lines: string[]): string {
  const SKIP = /^(invoice|receipt|bill|tax|gst|date|to:|from:|dear|sl\.?\s*no|s\.no|page|ref|no\.|original|duplicate)/i
  for (const line of lines.slice(0, 12)) {
    const t = line.trim()
    if (t.length >= 3 && t.length <= 80 && !SKIP.test(t) && !/^\d/.test(t) && !/^[^a-zA-Z]{5,}$/.test(t)) {
      return t
    }
  }
  return 'Unknown Vendor'
}

// ─────────────────────────────────────────────────────────────────────────────
// AMOUNT (numeric)
// ─────────────────────────────────────────────────────────────────────────────

export function extractAmountNumeric(lines: string[], full: string): number | null {
  const AMOUNT_LABEL_NUM = /(?:grand\s*total|total\s*amount|net\s*(?:amount|payable)|amount\s*(?:paid|due)|bill\s*amount|net\s*pay|payable|subtotal|balance\s*due|total|amount)[\s:=₹Rs.\-]*([\d,]+(?:\.\d{1,2})?)/gi
  const labelled: number[] = []
  for (const line of lines) {
    AMOUNT_LABEL_NUM.lastIndex = 0
    for (const m of line.matchAll(AMOUNT_LABEL_NUM)) {
      const v = parseFloat(m[1].replace(/,/g, ''))
      if (!isNaN(v) && v > 0 && v < 10_000_000) labelled.push(v)
    }
  }
  if (labelled.length) return Math.max(...labelled)

  const currency: number[] = []
  for (const m of full.matchAll(/(?:₹|rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi)) {
    const v = parseFloat(m[1].replace(/,/g, ''))
    if (!isNaN(v) && v > 0 && v < 10_000_000) currency.push(v)
  }
  if (currency.length) return Math.max(...currency)

  const decimals: number[] = []
  for (const m of full.matchAll(/\b(\d{1,7}\.\d{2})\b/g)) {
    const v = parseFloat(m[1])
    if (!isNaN(v) && v >= 1 && v < 10_000_000) decimals.push(v)
  }
  if (decimals.length) return Math.max(...decimals)

  return null
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
  const category = detectRestaurantCategory(full)
  const vendor   = extractVendor(lines)
  const amountNum = extractAmountNumeric(lines, full)

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
    restaurantCategory: category,
    vendorName:         vendor,
    billAmountNumeric:  amountNum,
    billDateRaw:        date,
  }
}
