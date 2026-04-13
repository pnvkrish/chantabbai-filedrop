import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { parseDocument } from '@/lib/parser'
import { withTimeout, EXTRACTION_MIME_TYPES } from '@/lib/server-utils'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const STRUCTURED_PROMPT = `You are an expert at reading Indian restaurant bills, receipts, and invoices including handwritten ones.

Carefully read EVERY detail in this image and return ONLY a valid JSON object with exactly these keys:

{
  "vendor": "the business/shop name (usually largest text at top)",
  "date": "date as DD/MM/YYYY — search the entire image carefully",
  "amount": <final total amount as a plain NUMBER only — e.g. 1300 or 450.50 — NO symbols NO commas>,
  "category": "exactly one of: Fuel & Transport | Meat & Seafood | Dairy & Eggs | Vegetables & Fruits | Rice & Grains | Cooking Supplies | Gas / LPG | Electricity | Water | Rent | Staff Salary | Equipment & Maintenance | Packaging | Others",
  "bill_type": "e.g. Fuel Receipt / GST Invoice / Delivery Challan / Restaurant Bill / Utility Bill",
  "raw_text": "ALL text visible in the image exactly as written line by line"
}

Rules:
- amount: GRAND TOTAL or total payable. For handwritten bills read numbers very carefully. Return plain number only.
- date: Any date on the bill. Return as DD/MM/YYYY.
- petrol/diesel/fuel bill → category MUST be "Fuel & Transport"
- LPG/gas cylinder → category MUST be "Gas / LPG"
- Use null ONLY if a field is truly not present anywhere in the image.
- Return ONLY the JSON. No markdown. No explanation.`

interface Structured {
  vendor: string | null; date: string | null; amount: number | null
  category: string | null; bill_type: string | null; raw_text: string | null
}

interface FileInput { fileUrl: string; mimeType: string; fileName: string }
type FileResult = {
  fileName: string; keyValues: string[][]
  tableData: string[][]; rawLines: string[]
  summary_numbers: { label: string; value: string; unit: string }[]
  error?: string
}

async function extractFromImage(buffer: Buffer, mimeType: string, attempt = 1): Promise<Structured> {
  const safeMime = ['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) ? mimeType : 'image/jpeg'
  const b64 = buffer.toString('base64')

  try {
    const res = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${safeMime};base64,${b64}` } },
          { type: 'text', text: STRUCTURED_PROMPT },
        ],
      }],
      max_tokens: 2048,
      temperature: 0.1,
    })

    const content = res.choices[0]?.message?.content ?? ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0]) as Structured
    if (typeof parsed.amount === 'string') {
      parsed.amount = parseFloat(String(parsed.amount).replace(/[^0-9.]/g, '')) || null
    }
    return parsed

  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    const isRateLimit = msg.includes('429')
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, isRateLimit ? 8000 : 2000))
      return extractFromImage(buffer, mimeType, attempt + 1)
    }
    console.error('Groq extraction failed:', e)
    return { vendor: null, date: null, amount: null, category: null, bill_type: null, raw_text: null }
  }
}

async function throttledAll<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = []
  let idx = 0
  async function worker() {
    while (idx < tasks.length) { const i = idx++; results[i] = await tasks[i]() }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
}

async function processFile({ fileUrl, mimeType, fileName }: FileInput): Promise<FileResult> {
  if (!(EXTRACTION_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { fileName, keyValues: [], tableData: [], rawLines: [], summary_numbers: [], error: 'Unsupported type' }
  }
  try {
    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) throw new Error('Failed to fetch file')
    const buffer = Buffer.from(await fileRes.arrayBuffer())

    if (mimeType.startsWith('image/')) {
      const s = await extractFromImage(buffer, mimeType)
      const rawText = s.raw_text ?? ''
      const fallback = parseDocument(rawText, fileName)
      const date = s.date ?? fallback.billDateRaw
      const amount = s.amount ?? fallback.billAmountNumeric
      const amountStr = amount != null
        ? `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'Not found'
      return {
        fileName,
        keyValues: [
          ['Date', date || 'Not found'],
          ['Amount', amountStr],
          ['Bill Type', s.bill_type || fallback.purpose],
          ...(s.vendor ? [['Vendor', s.vendor]] as string[][] : []),
        ],
        tableData: [], rawLines: rawText.split('\n').filter(Boolean), summary_numbers: [],
      }
    }

    let rawText = ''
    if (mimeType === 'application/pdf') {
      const pdfParse = (await import('pdf-parse') as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default
      rawText = (await withTimeout(pdfParse(buffer), 20000, 'PDF parse')).text
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth')
      rawText = (await withTimeout(mammoth.extractRawText({ buffer }), 10000, 'DOCX parse')).value
    } else if (mimeType === 'application/msword') {
      const mammoth = await import('mammoth')
      try { rawText = (await mammoth.extractRawText({ buffer })).value } catch { rawText = '' }
    }
    return { fileName, ...parseDocument(rawText, fileName) }

  } catch (e) {
    return { fileName, keyValues: [], tableData: [], rawLines: [], summary_numbers: [], error: e instanceof Error ? e.message : 'Extraction failed' }
  }
}

export async function POST(req: Request) {
  try {
    const { files } = (await req.json()) as { files: FileInput[] }
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }
    const results = await throttledAll(files.map(f => () => processFile(f)), 2)
    return NextResponse.json({ results })
  } catch (err) {
    console.error('Extract-all error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Extraction failed' }, { status: 500 })
  }
}
