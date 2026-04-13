// scripts/generate-ai-docs-pdf.js
// Converts AI-EXPENSE-CLASSIFIER-DOCUMENTATION.md to a styled PDF

const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

const INPUT  = path.join(__dirname, '../docs/AI-EXPENSE-CLASSIFIER-DOCUMENTATION.md')
const OUTPUT = path.join(__dirname, '../docs/AI-EXPENSE-CLASSIFIER-DOCUMENTATION.pdf')

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  navy:      '#0F172A',
  blue:      '#2563EB',
  blueLight: '#DBEAFE',
  teal:      '#0D9488',
  tealLight: '#CCFBF1',
  gray:      '#64748B',
  grayLight: '#F1F5F9',
  grayBorder:'#CBD5E1',
  white:     '#FFFFFF',
  codeBack:  '#1E293B',
  codeFore:  '#E2E8F0',
  red:       '#DC2626',
  green:     '#16A34A',
  orange:    '#EA580C',
  purple:    '#7C3AED',
}

// ── Font sizes ────────────────────────────────────────────────────────────────
const F = { h1: 26, h2: 18, h3: 14, h4: 12, body: 10, small: 9, code: 9 }

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  info: {
    Title:    'AI-Powered Expense Classification System — Technical Documentation',
    Author:   'neela krishna',
    Subject:  'ChantabbaiFileDrop AI Documentation',
    Keywords: 'LLaMA, Groq, Next.js, Supabase, AI, OCR, Classification',
  },
  autoFirstPage: false,
})

doc.pipe(fs.createWriteStream(OUTPUT))

const PW = 595
const PH = 842
const ML = 60, MR = 60, MT = 60, MB = 60
const CW = PW - ML - MR  // 595 - 60 - 60 = 475

let pageNum = 0

// ── Helpers ───────────────────────────────────────────────────────────────────
function newPage() {
  doc.addPage()
  pageNum++

  // Header bar
  doc.rect(0, 0, PW, 36).fill(C.navy)
  doc.fillColor(C.white).fontSize(F.small).font('Helvetica')
     .text('ChantabbaiFileDrop — AI Expense Classification System', ML, 13, { width: CW - 80 })
  doc.fillColor(C.gray).fontSize(F.small)
     .text(`Page ${pageNum}`, PW - MR - 30, 13, { width: 30, align: 'right' })

  // Footer line
  doc.moveTo(ML, PH - 36).lineTo(PW - MR, PH - 36).lineWidth(0.5).strokeColor(C.grayBorder).stroke()
  doc.fillColor(C.gray).fontSize(F.small).font('Helvetica')
     .text('Generated April 2026 · Context7 + Groq + Supabase + Next.js', ML, PH - 26, { width: CW })

  doc.y = MT + 36
}

function safeY(needed = 20) {
  if (doc.y + needed > PH - MB - 36) newPage()
}

function gap(n = 6) { doc.y += n }

// ── Cover Page ────────────────────────────────────────────────────────────────
doc.addPage()
pageNum++

// Full-bleed gradient header
doc.rect(0, 0, PW, 320).fill(C.navy)

// Decorative accent circles
doc.circle(PW - 40, 40, 120).fillOpacity(0.06).fill(C.blue).fillOpacity(1)
doc.circle(60, 280, 80).fillOpacity(0.06).fill(C.teal).fillOpacity(1)

// Title block
doc.fillColor(C.teal).fontSize(11).font('Helvetica-Bold')
   .text('TECHNICAL DOCUMENTATION', 0, 90, { align: 'center', width: PW })

gap(10)
doc.fillColor(C.white).fontSize(30).font('Helvetica-Bold')
   .text('AI-Powered Expense', 0, doc.y, { align: 'center', width: PW })
doc.fillColor(C.white).fontSize(30).font('Helvetica-Bold')
   .text('Classification System', 0, doc.y, { align: 'center', width: PW })

gap(12)
doc.fillColor('#94A3B8').fontSize(13).font('Helvetica')
   .text('ChantabbaiFileDrop · End-to-End Reference', 0, doc.y, { align: 'center', width: PW })

// Info badges
doc.y = 340
const badges = [
  ['Model',   'LLaMA 4 Scout 17B',     C.blue],
  ['Backend', 'Next.js 15 App Router', C.teal],
  ['Storage', 'Supabase Postgres',     C.purple],
  ['Testing', 'Playwright E2E',        C.orange],
]
const bw = 110, bh = 44, startX = (PW - badges.length * (bw + 10)) / 2
badges.forEach(([label, val, col], i) => {
  const x = startX + i * (bw + 10)
  doc.roundedRect(x, doc.y, bw, bh, 6).fill(col)
  doc.fillColor(C.white).fontSize(F.small).font('Helvetica-Bold')
     .text(label, x, doc.y + 8, { width: bw, align: 'center' })
  doc.fillColor(C.white).fontSize(7.5).font('Helvetica')
     .text(val, x, doc.y + 20, { width: bw, align: 'center' })
})

doc.y = 420
// Meta info
const meta = [
  ['Version', '1.0'],
  ['Author',  'neela krishna'],
  ['Date',    'April 2026'],
  ['Docs',    'Context7-sourced'],
]
meta.forEach(([k, v]) => {
  doc.fillColor(C.gray).fontSize(F.small).font('Helvetica-Bold')
     .text(k + ': ', ML, doc.y, { continued: true, width: 70 })
  doc.fillColor(C.navy).font('Helvetica').text(v)
  doc.y += 2
})

// Footer divider
doc.moveTo(ML, PH - 60).lineTo(PW - MR, PH - 60).lineWidth(0.5).strokeColor(C.grayBorder).stroke()
doc.fillColor(C.gray).fontSize(F.small).font('Helvetica')
   .text('Groq LLaMA 4 Scout · Next.js 15 · Supabase · TypeScript · Playwright · SheetJS · Recharts',
         0, PH - 48, { align: 'center', width: PW })

// ── Table of Contents ─────────────────────────────────────────────────────────
newPage()
doc.fillColor(C.navy).fontSize(F.h2).font('Helvetica-Bold').text('Table of Contents', ML, doc.y)
doc.y += 4
doc.moveTo(ML, doc.y).lineTo(PW - MR, doc.y).lineWidth(1.5).strokeColor(C.teal).stroke()
doc.y += 14

const toc = [
  ['1.', 'Project Overview'],
  ['2.', 'System Architecture'],
  ['3.', 'Tech Stack with Justification'],
  ['4.', 'Data Flow Pipeline'],
  ['5.', 'AI Model Usage'],
  ['6.', 'Model Training / Fine-tuning'],
  ['7.', 'OCR Integration'],
  ['8.', 'Fallback Logic — detectRestaurantCategory()'],
  ['9.', 'Category Detection Logic'],
  ['10.', 'Code Structure'],
  ['11.', 'API Design'],
  ['12.', 'Error Handling'],
  ['13.', 'Performance Optimization'],
  ['14.', 'Security Considerations'],
  ['15.', 'Future Improvements'],
  ['A.', 'Appendix: Environment Variables'],
  ['B.', 'Appendix: Playwright Test Coverage'],
  ['C.', 'Appendix: Quick Start Guide'],
]
toc.forEach(([num, title], i) => {
  const isSection = !num.includes('.')  // always false here
  doc.fillColor(i % 2 === 0 ? C.grayLight : C.white)
     .rect(ML, doc.y - 2, CW, 18).fill()
  doc.fillColor(C.blue).fontSize(F.body).font('Helvetica-Bold')
     .text(num, ML + 6, doc.y, { continued: true, width: 28 })
  doc.fillColor(C.navy).font('Helvetica').text(title)
  doc.y += 2
})

// ── Parse & Render Markdown ───────────────────────────────────────────────────
const raw = fs.readFileSync(INPUT, 'utf8')
const lines = raw.split('\n')

let inCode = false
let codeLines = []
let inTable = false
let tableRows = []

function renderCodeBlock(lines) {
  safeY(lines.length * 13 + 20)
  const height = lines.length * 13 + 16
  doc.roundedRect(ML, doc.y, CW, height, 4).fill(C.codeBack)
  doc.fillColor(C.codeFore).fontSize(F.code).font('Courier')
  lines.forEach((line, i) => {
    doc.text(line, ML + 10, doc.y + 8 + i * 13, { width: CW - 20, lineBreak: false })
  })
  doc.y += height + 8
}

function renderTable(rows) {
  if (rows.length < 2) return
  const header = rows[0]
  const data   = rows.slice(2) // skip separator row
  const cols   = header.length
  const colW   = (CW - 2) / cols

  safeY(data.length * 20 + 30)

  // Header row
  let rx = ML
  header.forEach(cell => {
    doc.rect(rx, doc.y, colW, 20).fill(C.navy)
    doc.fillColor(C.white).fontSize(F.small).font('Helvetica-Bold')
       .text(cell.trim(), rx + 4, doc.y + 5, { width: colW - 8, lineBreak: false })
    rx += colW
  })
  doc.y += 20

  // Data rows
  data.forEach((row, ri) => {
    const rowH = 18
    safeY(rowH)
    rx = ML
    const bg = ri % 2 === 0 ? C.white : C.grayLight
    doc.rect(ML, doc.y, CW, rowH).fill(bg)
    row.forEach((cell, ci) => {
      const color = ci === 0 ? C.blue : C.navy
      doc.fillColor(color).fontSize(F.small).font(ci === 0 ? 'Helvetica-Bold' : 'Helvetica')
         .text(cell.trim(), rx + 4, doc.y + 4, { width: colW - 8, lineBreak: false })
      rx += colW
    })
    doc.moveTo(ML, doc.y + rowH).lineTo(PW - MR, doc.y + rowH)
       .lineWidth(0.3).strokeColor(C.grayBorder).stroke()
    doc.y += rowH
  })
  doc.y += 8
}

function parseTableLine(line) {
  return line.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1)
}

function isSeparatorRow(cells) {
  return cells.every(c => /^[-:]+$/.test(c))
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]

  // ── Code block ──
  if (line.startsWith('```')) {
    if (!inCode) {
      inCode = true
      codeLines = []
    } else {
      inCode = false
      renderCodeBlock(codeLines)
    }
    continue
  }
  if (inCode) { codeLines.push(line); continue }

  // ── Table ──
  if (line.startsWith('|')) {
    if (!inTable) { inTable = true; tableRows = [] }
    const cells = parseTableLine(line)
    if (isSeparatorRow(cells)) {
      tableRows.push(cells)
    } else {
      tableRows.push(cells)
    }
    continue
  } else if (inTable) {
    inTable = false
    renderTable(tableRows)
    tableRows = []
  }

  // ── Headings ──
  if (line.startsWith('#### ')) {
    safeY(20)
    doc.fillColor(C.orange).fontSize(F.h4).font('Helvetica-Bold')
       .text(line.slice(5), ML, doc.y)
    doc.y += 4
  } else if (line.startsWith('### ')) {
    safeY(28)
    const t = line.slice(4)
    doc.y += 6
    doc.fillColor(C.teal).fontSize(F.h3).font('Helvetica-Bold').text(t, ML, doc.y)
    doc.moveTo(ML, doc.y + 14).lineTo(PW - MR, doc.y + 14)
       .lineWidth(0.5).strokeColor(C.tealLight).stroke()
    doc.y += 18
  } else if (line.startsWith('## ')) {
    newPage()
    const t = line.slice(3)
    // Section banner
    doc.rect(ML, doc.y, CW, 36).fill(C.navy)
    doc.fillColor(C.white).fontSize(F.h2).font('Helvetica-Bold')
       .text(t, ML + 12, doc.y + 9, { width: CW - 24 })
    doc.y += 46
  } else if (line.startsWith('# ')) {
    // Skip — cover page handles the title
  }

  // ── Horizontal rule ──
  else if (/^---+$/.test(line.trim())) {
    safeY(12)
    doc.moveTo(ML, doc.y + 4).lineTo(PW - MR, doc.y + 4)
       .lineWidth(0.5).strokeColor(C.grayBorder).stroke()
    doc.y += 12
  }

  // ── Bullet point ──
  else if (line.startsWith('- ') || line.startsWith('* ')) {
    safeY(14)
    const txt = line.slice(2).replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1')
    doc.fillColor(C.teal).fontSize(F.body).font('Helvetica-Bold')
       .text('•', ML + 4, doc.y, { continued: true, width: 12 })
    doc.fillColor(C.navy).font('Helvetica').text(txt, { width: CW - 20 })
    doc.y += 2
  }

  // ── Numbered list ──
  else if (/^\d+\. /.test(line)) {
    safeY(14)
    const m = line.match(/^(\d+)\. (.+)/)
    const txt = m[2].replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1')
    doc.fillColor(C.blue).fontSize(F.body).font('Helvetica-Bold')
       .text(m[1] + '.', ML + 4, doc.y, { continued: true, width: 20 })
    doc.fillColor(C.navy).font('Helvetica').text(txt, { width: CW - 28 })
    doc.y += 2
  }

  // ── Blockquote ──
  else if (line.startsWith('> ')) {
    safeY(26)
    const txt = line.slice(2)
    const qh = 22
    doc.rect(ML, doc.y, 3, qh).fill(C.teal)
    doc.rect(ML + 3, doc.y, CW - 3, qh).fill(C.tealLight)
    doc.fillColor(C.teal).fontSize(F.body).font('Helvetica-Oblique')
       .text(txt, ML + 10, doc.y + 6, { width: CW - 18 })
    doc.y += qh + 6
  }

  // ── Normal paragraph / bold inline ──
  else if (line.trim()) {
    safeY(14)
    const clean = line.replace(/\*\*(.+?)\*\*/g, '$1')
                      .replace(/`(.+?)`/g, '$1')
                      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                      .replace(/^#+\s/, '')

    // Detect if the line is mostly bold (a heading-like line)
    if (/^\*\*[^*]+\*\*/.test(line.trim())) {
      doc.fillColor(C.navy).fontSize(F.body).font('Helvetica-Bold').text(clean, ML, doc.y, { width: CW })
    } else {
      doc.fillColor(C.navy).fontSize(F.body).font('Helvetica').text(clean, ML, doc.y, { width: CW })
    }
    doc.y += 2
  } else {
    // Blank line
    doc.y += 5
  }
}

// Flush any remaining table
if (inTable && tableRows.length) renderTable(tableRows)

// ── Last page — key references ────────────────────────────────────────────────
newPage()
doc.rect(ML, doc.y, CW, 34).fill(C.navy)
doc.fillColor(C.white).fontSize(F.h2).font('Helvetica-Bold')
   .text('Key References & Sources', ML + 12, doc.y + 9, { width: CW - 24 })
doc.y += 48

const refs = [
  ['Groq Vision API',        'LLaMA 4 Scout 17B multimodal model, base64 image input',   'https://console.groq.com/docs/vision'],
  ['Groq Model Specs',       'DocVQA 94.4, 131K context, $0.11/1M tokens',               'https://console.groq.com/docs/model/meta-llama/llama-4-scout-17b-16e-instruct'],
  ['Next.js Route Handlers', 'FormData handling, API routes, server-side processing',    'https://nextjs.org/docs/app/api-reference/file-conventions/route'],
  ['Supabase RLS',           'Row Level Security, service role bypass, BYPASSRLS attr',  'https://supabase.com/docs/guides/database/postgres/row-level-security'],
  ['Supabase Storage',       'File upload, signed URLs, private bucket access',          'https://supabase.com/docs/guides/storage'],
  ['Supabase Service Key',   'Server-only admin access, never expose in browser',        'https://supabase.com/docs/guides/api/api-keys'],
  ['Playwright Testing',     'E2E test framework, getByRole, strict mode, headless',     'https://playwright.dev/docs/intro'],
  ['SheetJS',                'Excel export from JSON data, workbook/worksheet API',      'https://docs.sheetjs.com/'],
  ['Recharts',               'React charting library — BarChart, PieChart, Responsive', 'https://recharts.org/en-US/api'],
  ['Tailwind CSS',           'Utility-first, sm: breakpoints, hidden/flex patterns',     'https://tailwindcss.com/docs'],
]

refs.forEach(([name, desc, url], i) => {
  safeY(36)
  const bg = i % 2 === 0 ? C.grayLight : C.white
  doc.rect(ML, doc.y, CW, 30).fill(bg)
  doc.fillColor(C.blue).fontSize(F.body).font('Helvetica-Bold')
     .text(name, ML + 8, doc.y + 4, { width: CW - 16 })
  doc.fillColor(C.gray).fontSize(F.small).font('Helvetica')
     .text(desc, ML + 8, doc.y + 16, { width: CW - 16 })
  doc.y += 30
})

gap(20)
doc.moveTo(ML, doc.y).lineTo(PW - MR, doc.y).lineWidth(1).strokeColor(C.teal).stroke()
gap(12)
doc.fillColor(C.gray).fontSize(F.small).font('Helvetica')
   .text('All documentation sourced via Context7 live library documentation system.',
         ML, doc.y, { align: 'center', width: CW })
gap(4)
doc.fillColor(C.gray).fontSize(F.small)
   .text('ChantabbaiFileDrop · AI Expense Classification System · April 2026',
         ML, doc.y, { align: 'center', width: CW })

// ── Finalise ──────────────────────────────────────────────────────────────────
doc.end()
doc.on('finish', () => {
  const stats = fs.statSync(OUTPUT)
  console.log(`✅ PDF saved: ${OUTPUT} (${pageNum} pages, ${(stats.size/1024).toFixed(0)} KB)`)
})
