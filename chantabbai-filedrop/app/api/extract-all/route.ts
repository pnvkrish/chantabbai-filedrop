import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { parseDocument } from '@/lib/parser'
import { withTimeout, EXTRACTION_MIME_TYPES } from '@/lib/server-utils'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

interface FileInput { fileUrl: string; mimeType: string; fileName: string }

type FileResult = {
  fileName: string
  keyValues: string[][]
  tableData: string[][]
  rawLines: string[]
  summary_numbers: { label: string; value: string; unit: string }[]
  error?: string
}

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

async function throttledAll<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = []
  let idx = 0
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      results[i] = await tasks[i]()
    }
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

    } else if (mimeType.startsWith('image/')) {
      rawText = await extractTextFromImage(buffer, mimeType)
    }

    return { fileName, ...parseDocument(rawText, fileName) }
  } catch (e) {
    return {
      fileName,
      keyValues: [], tableData: [], rawLines: [], summary_numbers: [],
      error: e instanceof Error ? e.message : 'Extraction failed',
    }
  }
}

export async function POST(req: Request) {
  try {
    const { files } = (await req.json()) as { files: FileInput[] }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const results = await throttledAll(files.map(f => () => processFile(f)), 3)
    return NextResponse.json({ results })
  } catch (err) {
    console.error('Extract-all error:', err)
    const msg = err instanceof Error ? err.message : 'Extraction failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
