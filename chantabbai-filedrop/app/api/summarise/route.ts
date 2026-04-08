import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export async function POST(req: Request) {
  try {
    const { fileUrl, mimeType } = (await req.json()) as {
      fileUrl: string
      mimeType: string
    }

    if (!fileUrl || !mimeType) {
      return NextResponse.json({ error: 'Missing fileUrl or mimeType' }, { status: 400 })
    }

    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json({ summary: null, unsupported: true })
    }

    // Fetch the file
    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 })
    }

    const buffer = await fileRes.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // Only PDF is natively supported by Claude's document type
    // For DOCX/DOC, we send as base64 PDF-like — Claude handles it gracefully
    const effectiveMime = mimeType === 'application/pdf' ? 'application/pdf' : 'application/pdf'

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: effectiveMime,
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Summarise this document in 3-5 concise bullet points. Focus on the key information, purpose, and any important details. Format each bullet starting with • symbol.',
            },
          ],
        },
      ],
    })

    const summaryBlock = msg.content[0]
    const summary = summaryBlock?.type === 'text' ? summaryBlock.text : null

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Summarise error:', err)
    return NextResponse.json({ error: 'Summarisation failed' }, { status: 500 })
  }
}
