import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'
import { parseDocument } from '@/lib/parser'
import { withTimeout, EXTRACTION_MIME_TYPES } from '@/lib/server-utils'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const STRUCTURED_PROMPT = `You are an expert at reading Indian restaurant supplier bills, receipts, and invoices including handwritten ones.

Carefully read EVERY detail in this image and return ONLY a valid JSON object with exactly these keys:

{
  "vendor": "the SELLER/SUPPLIER business name — usually the largest text or header at the very top of the bill",
  "date": "date as DD/MM/YYYY — search the entire image carefully, convert 2-digit year to 4-digit (e.g. 26 → 2026)",
  "amount": <final total amount as a plain NUMBER only — e.g. 2188 or 450.50 — NO symbols NO commas>,
  "category": "exactly one of: Fuel & Transport | Meat & Seafood | Dairy & Eggs | Vegetables & Fruits | Rice & Grains | Cooking Supplies | Gas / LPG | Electricity | Water | Rent | Staff Salary | Equipment & Maintenance | Packaging | Others",
  "bill_type": "e.g. Cash Bill / Fuel Receipt / GST Invoice / Delivery Challan / Restaurant Bill / Utility Bill",
  "raw_text": "ALL text visible in the image exactly as written line by line"
}

CRITICAL RULES — follow exactly:

VENDOR:
- The vendor is the SELLER (the shop/company issuing the bill) — always the header/title at the TOP
- On cash bills, the "Name:" or "To:" field is the CUSTOMER (who bought) — NEVER use that as vendor
- Example: "SV Milk Distribution" is the vendor, "Chantabbai Biryani" written after "Name:" is the customer — ignore it for vendor
- For payment vouchers: use the company name at the top, not the "Paid to" person name

AMOUNT:
- Use the "Total" field. For handwritten bills, read each digit carefully.
- If the total is unclear or smudged, ADD UP all individual line item amounts and return that sum.
- Return as a plain number — no ₹ symbol, no commas.

DATE:
- Convert 2-digit years: 26 → 2026, 25 → 2025, 24 → 2024
- Format: DD/MM/YYYY always

CATEGORY — choose based on what items/products are on the bill:
- Milk, Curd, Paneer, Butter, Ghee, Cheese, Cream, Khowa, Malai → "Dairy & Eggs"
- Chicken, Mutton, Fish, Prawn, Meat, Seafood → "Meat & Seafood"
- Vegetables, Onion, Tomato, Potato, Fruits → "Vegetables & Fruits"
- Rice, Wheat, Flour, Dal, Grains, Pulses → "Rice & Grains"
- Petrol, Diesel, Fuel → "Fuel & Transport"
- LPG, Gas cylinder → "Gas / LPG"
- Oil, Spices, Masala, Cooking ingredients → "Cooking Supplies"
- Electricity bill → "Electricity"
- Water bill → "Water"
- Rent → "Rent"
- Salary, Wages → "Staff Salary"
- For PAYMENT VOUCHERS: read the "Towards" field to determine category

Return ONLY the JSON. No markdown. No explanation.`

interface Structured {
  vendor: string | null
  date: string | null
  amount: number | null
  category: string | null
  bill_type: string | null
  raw_text: string | null
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
    console.error('Image extraction failed:', e)
    return { vendor: null, date: null, amount: null, category: null, bill_type: null, raw_text: null }
  }
}

export async function POST(req: Request) {
  try {
    const { fileUrl, mimeType, fileName, fileId } = (await req.json()) as {
      fileUrl: string; mimeType: string; fileName: string; fileId?: string
    }

    if (!fileUrl || !mimeType) {
      return NextResponse.json({ error: 'Missing fileUrl or mimeType' }, { status: 400 })
    }
    if (!(EXTRACTION_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 })
    }

    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 })
    const buffer = Buffer.from(await fileRes.arrayBuffer())

    let extracted = parseDocument('', fileName)

    if (mimeType.startsWith('image/')) {
      const s = await extractFromImage(buffer, mimeType)
      const rawText = s.raw_text ?? ''
      const fallback = parseDocument(rawText, fileName)

      const date = s.date ?? fallback.billDateRaw
      const amount = s.amount ?? fallback.billAmountNumeric
      const amountStr = amount != null
        ? `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'Not found'

      extracted = {
        ...fallback,
        vendorName:         s.vendor || fallback.vendorName,
        billDateRaw:        date || 'Not found',
        billAmountNumeric:  amount,
        restaurantCategory: (s.category as typeof fallback.restaurantCategory) ?? fallback.restaurantCategory,
        purpose:            s.bill_type || fallback.purpose,
        keyValues: [
          ['Date',      date || 'Not found'],
          ['Amount',    amountStr],
          ['Bill Type', s.bill_type || fallback.purpose],
          ...(s.vendor ? [['Vendor', s.vendor]] as string[][] : []),
        ],
      }

    } else if (mimeType === 'application/pdf') {
      const pdfParse = (await import('pdf-parse') as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default
      const rawText = (await withTimeout(pdfParse(buffer), 20000, 'PDF parse')).text
      extracted = parseDocument(rawText, fileName)

    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth')
      const rawText = (await withTimeout(mammoth.extractRawText({ buffer }), 10000, 'DOCX parse')).value
      extracted = parseDocument(rawText, fileName)

    } else if (mimeType === 'application/msword') {
      const mammoth = await import('mammoth')
      try {
        const rawText = (await withTimeout(mammoth.extractRawText({ buffer }), 10000, 'DOC parse')).value
        extracted = parseDocument(rawText, fileName)
      } catch { extracted = parseDocument('', fileName) }
    }

    if (fileId) {
      await admin.from('file_metadata').update({
        category:        extracted.restaurantCategory,
        vendor_name:     extracted.vendorName === 'Unknown Vendor' ? null : extracted.vendorName,
        bill_amount:     extracted.billAmountNumeric,
        bill_date:       extracted.billDateRaw === 'Not found' ? null : extracted.billDateRaw,
        approval_status: 'pending',
        updated_at:      new Date().toISOString(),
      }).eq('id', fileId)
    }

    return NextResponse.json({ extracted, fileName })
  } catch (err) {
    console.error('Extract error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Extraction failed' }, { status: 500 })
  }
}
