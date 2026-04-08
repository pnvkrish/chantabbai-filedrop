import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { parseDocument } from '@/lib/parser'
import { withTimeout, EXTRACTION_MIME_TYPES } from '@/lib/server-utils'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

async function extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  const safeMime = ['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) ? mimeType : 'image/jpeg'
  const b64 = buffer.toString('base64')

  const res = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${safeMime};base64,${b64}` } },
          { type: 'text', text: 'Extract ALL text from this image exactly as written — including handwritten text, printed text, stamps, numbers, dates, and amounts. Preserve line breaks. Return only the raw text, no commentary.' },
        ],
      },
    ],
    max_tokens: 1024,
  })

  return res.choices[0]?.message?.content ?? ''
}

export async function POST(req: Request) {
  try {
    const { fileUrl, mimeType, fileName } = (await req.json()) as {
      fileUrl: string
      mimeType: string
      fileName: string
    }

    if (!fileUrl || !mimeType) {
      return NextResponse.json({ error: 'Missing fileUrl or mimeType' }, { status: 400 })
    }

    if (!(EXTRACTION_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 })
    }

    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 })
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer())
    let rawText = ''

    if (mimeType === 'application/pdf') {
      const pdfParse = (await import('pdf-parse') as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default
      rawText = (await withTimeout(pdfParse(buffer), 20000, 'PDF parse')).text

    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth')
      rawText = (await withTimeout(mammoth.extractRawText({ buffer }), 10000, 'DOCX parse')).value

    } else if (mimeType === 'application/msword') {
      const mammoth = await import('mammoth')
      try {
        rawText = (await withTimeout(mammoth.extractRawText({ buffer }), 10000, 'DOC parse')).value
      } catch { rawText = '' }

    } else if (mimeType.startsWith('image/')) {
      rawText = await extractTextFromImage(buffer, mimeType)
    }

    const extracted = parseDocument(rawText, fileName)
    return NextResponse.json({ extracted, fileName })
  } catch (err) {
    console.error('Extract error:', err)
    const msg = err instanceof Error ? err.message : 'Extraction failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
