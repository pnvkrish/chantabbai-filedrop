'use strict'
/**
 * generate-ai-docs-pdf.js
 * Full-manual page control — no PDFKit auto page-breaks, no blank pages.
 */
const PDFDocument = require('pdfkit')
const fs   = require('fs')
const path = require('path')

const MD  = path.join(__dirname, '../docs/AI-EXPENSE-CLASSIFIER-DOCUMENTATION.md')
const OUT = path.join(__dirname, '../docs/AI-EXPENSE-CLASSIFIER-DOCUMENTATION.pdf')

// ── Geometry (A4) ─────────────────────────────────────────────────────────────
const PW = 595, PH = 842
const L  = 56, R = 56, W = PW - L - R   // left, right margin, content width
const HDR_H = 32                          // header band height
const FTR_H = 26                          // footer band height
const TOP   = HDR_H + 14                  // first content Y on each page
const BOT   = PH - FTR_H - 14            // last content Y on each page

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  navy:'#0F172A', blue:'#1E40AF', teal:'#0F766E', tealBg:'#F0FDFA',
  orange:'#C2410C', purple:'#6D28D9', white:'#FFFFFF',
  body:'#1E293B', muted:'#64748B', bdr:'#CBD5E1',
  rowA:'#F8FAFC', rowB:'#FFFFFF', codeBg:'#1E293B', codeFg:'#E2E8F0',
}

// ── Doc (NO auto page breaks — we control everything) ────────────────────────
const doc = new PDFDocument({
  size: [PW, PH],
  // Large margins so PDFKit NEVER auto-adds a page
  margins: { top: 0, bottom: 0, left: L, right: R },
  autoFirstPage: false,
  info: { Title:'AI-Powered Expense Classification — Technical Docs', Author:'neela krishna' },
})
doc.pipe(fs.createWriteStream(OUT))

// ── State ─────────────────────────────────────────────────────────────────────
let Y      = TOP    // current vertical cursor
let pageNo = 0

// ── Page chrome ───────────────────────────────────────────────────────────────
function chrome() {
  // header
  doc.rect(0, 0, PW, HDR_H).fill(C.navy)
  doc.font('Helvetica').fontSize(7.5).fillColor('#94A3B8')
     .text('ChantabbaiFileDrop  ·  AI-Powered Expense Classification System',
           L, 11, { lineBreak:false, width: W - 50 })
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748B')
     .text(`Page ${pageNo}`, PW - R - 40, 11, { lineBreak:false, width:40, align:'right' })
  // footer
  doc.moveTo(L, PH - FTR_H).lineTo(PW - R, PH - FTR_H)
     .lineWidth(0.4).strokeColor(C.bdr).stroke()
  doc.font('Helvetica').fontSize(7).fillColor(C.muted)
     .text('Groq LLaMA 4 Scout  ·  Next.js 15  ·  Supabase  ·  TypeScript  ·  Playwright  ·  April 2026',
           L, PH - FTR_H + 7, { lineBreak:false, width:W, align:'center' })
}

function newPage() {
  doc.addPage()
  pageNo++
  chrome()
  Y = TOP
}

// Ensure `needed` pts are available; add page if not
function need(pts) { if (Y + pts > BOT) newPage() }

function gap(n) { Y += (n || 6) }

// ── Clean markdown inline syntax ─────────────────────────────────────────────
function clean(s) {
  return s.replace(/\*\*(.+?)\*\*/g,'$1')
           .replace(/\*(.+?)\*/g,'$1')
           .replace(/`(.+?)`/g,'$1')
           .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
           .trim()
}

// ── Core text writer: writes at (x,Y) and advances Y by actual rendered height
// Uses heightOfString to pre-measure so we never overflow silently
function write(text, x, fontSize, font, color, opts) {
  if (!text || !text.trim()) return
  const w    = opts && opts.width != null ? opts.width : W - (x - L)
  const addY = opts && opts.addY != null  ? opts.addY  : 3
  // Measure height — forces page break if needed before drawing
  doc.font(font).fontSize(fontSize)
  const h = doc.heightOfString(text, { width: w, lineGap: opts && opts.lineGap || 1 })
  need(h + addY)
  doc.font(font).fontSize(fontSize).fillColor(color)
     .text(text, x, Y, {
       width: w,
       lineGap: opts && opts.lineGap || 1,
       lineBreak: true,
     })
  Y += h + addY
}

// ── RENDERERS ─────────────────────────────────────────────────────────────────

function renderBanner(title) {
  newPage()
  doc.rect(L, Y, W, 36).fill(C.navy)
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.white)
     .text(title, L + 14, Y + 10, { width: W - 28, lineBreak: false })
  Y += 44
}

function renderH3(title) {
  need(34)
  gap(8)
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(C.teal)
     .text(title, L, Y, { width: W, lineBreak: false })
  Y += 14
  doc.moveTo(L, Y).lineTo(PW-R, Y).lineWidth(0.5).strokeColor('#99F6E4').stroke()
  Y += 7
}

function renderH4(title) {
  need(22)
  gap(4)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.orange)
     .text(title, L, Y, { width: W, lineBreak: false })
  Y += 14
}

function renderPara(line) {
  const t = clean(line)
  if (!t) return
  doc.font('Helvetica').fontSize(9.5)
  const h = doc.heightOfString(t, { width: W, lineGap: 2 })
  need(h + 4)
  doc.fillColor(C.body).text(t, L, Y, { width: W, lineGap: 2, lineBreak: true })
  Y += h + 4
}

function renderBullet(text, indent) {
  const t = clean(text)
  if (!t) return
  const bx = L + indent
  const tx = bx + 14
  const tw = W - indent - 14
  doc.font('Helvetica').fontSize(9.5)
  const h = doc.heightOfString(t, { width: tw, lineGap: 2 })
  need(h + 4)
  // bullet dot — absolute, no line-break, no cursor move
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.teal)
     .text('\u2022', bx, Y, { lineBreak: false, width: 12 })
  // text at same Y, different X
  doc.font('Helvetica').fontSize(9.5).fillColor(C.body)
     .text(t, tx, Y, { width: tw, lineGap: 2, lineBreak: true })
  Y += h + 4
}

function renderNumbered(num, text) {
  const t = clean(text)
  if (!t) return
  const tw = W - 22
  doc.font('Helvetica').fontSize(9.5)
  const h = doc.heightOfString(t, { width: tw, lineGap: 2 })
  need(h + 4)
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.blue)
     .text(num + '.', L, Y, { lineBreak: false, width: 20 })
  doc.font('Helvetica').fontSize(9.5).fillColor(C.body)
     .text(t, L + 22, Y, { width: tw, lineGap: 2, lineBreak: true })
  Y += h + 4
}

function renderHR() {
  need(16)
  gap(4)
  doc.moveTo(L, Y).lineTo(PW-R, Y).lineWidth(0.4).strokeColor(C.bdr).stroke()
  Y += 12
}

function renderQuote(text) {
  const t = clean(text)
  if (!t) return
  const qw = W - 20
  doc.font('Helvetica-Oblique').fontSize(9.5)
  const inner = doc.heightOfString(t, { width: qw, lineGap: 2 })
  const h     = inner + 18
  need(h + 6)
  doc.rect(L, Y, 4, h).fill(C.teal)
  doc.rect(L+4, Y, W-4, h).fill(C.tealBg)
  doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(C.teal)
     .text(t, L+12, Y+9, { width: qw-8, lineGap: 2, lineBreak: true })
  Y += h + 6
}

// ── Code block ────────────────────────────────────────────────────────────────
function renderCode(lines, lang) {
  const LH = 10.5, PX = 10, PY = 8

  if (lang) {
    need(14)
    doc.rect(L, Y, 52, 13).fill(C.blue)
    doc.font('Courier-Bold').fontSize(7).fillColor(C.white)
       .text(lang.toUpperCase(), L+4, Y+3, { width:46, lineBreak:false })
    Y += 13
  }

  let seg = []
  function flushSeg() {
    if (!seg.length) return
    const h = seg.length * LH + PY * 2
    need(h)
    const sy = Y
    doc.rect(L, sy, W, h).fill(C.codeBg)
    doc.font('Courier').fontSize(8).fillColor(C.codeFg)
    seg.forEach((ln, i) => {
      const d = ln.length > 88 ? ln.slice(0,88)+'…' : ln
      doc.text(d, L+PX, sy+PY+i*LH, { lineBreak:false, width: W-PX*2 })
    })
    Y = sy + h
    seg = []
  }

  for (const ln of lines) {
    // if one more line would overflow, flush and start new page
    if (Y + (seg.length + 1) * LH + PY * 2 > BOT) {
      flushSeg()
      newPage()
    }
    seg.push(ln)
  }
  flushSeg()
  Y += 8
}

// ── Table ─────────────────────────────────────────────────────────────────────
function parseRow(line) {
  return line.split('|').map(c => clean(c)).filter((_,i,a) => i>0 && i<a.length-1)
}

function renderTable(rows) {
  const data = rows.filter(r => !r.every(c => /^[-:\s]*$/.test(c)))
  if (data.length < 2) return
  const hdr  = data[0]
  const body = data.slice(1)
  const cols = hdr.length
  if (!cols) return
  const cw = W / cols
  const HH = 22, RH = 19

  need(HH + 2)
  // header row
  hdr.forEach((cell, i) => {
    doc.rect(L + i*cw, Y, cw, HH).fill(C.navy)
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
       .text(cell, L+i*cw+5, Y+7, { width:cw-10, lineBreak:false })
  })
  Y += HH

  body.forEach((row, ri) => {
    need(RH)
    const ry = Y
    doc.rect(L, ry, W, RH).fill(ri%2===0 ? C.rowA : C.rowB)
    doc.moveTo(L, ry+RH).lineTo(PW-R, ry+RH).lineWidth(0.25).strokeColor(C.bdr).stroke()
    row.forEach((cell, ci) => {
      doc.font(ci===0 ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(8.5).fillColor(ci===0 ? C.blue : C.body)
         .text(cell, L+ci*cw+5, ry+5, { width:cw-10, lineBreak:false })
    })
    Y += RH
  })
  Y += 8
}

// ═══════════════════════════════════════════════════════════════════════════
//  COVER PAGE
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage()
pageNo++
// Full navy top
doc.rect(0, 0, PW, 308).fill(C.navy)
// No header chrome on cover — draw page number only
doc.font('Helvetica').fontSize(7.5).fillColor('#475569')
   .text(`Page ${pageNo}`, PW-R-40, 11, { lineBreak:false, width:40, align:'right' })

doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#38BDF8')
   .text('TECHNICAL DOCUMENTATION', 0, 66, { align:'center', width:PW, lineBreak:false })
doc.font('Helvetica-Bold').fontSize(28).fillColor(C.white)
   .text('AI-Powered Expense', 0, 94, { align:'center', width:PW, lineBreak:false })
doc.font('Helvetica-Bold').fontSize(28).fillColor(C.white)
   .text('Classification System', 0, 130, { align:'center', width:PW, lineBreak:false })
doc.font('Helvetica').fontSize(11).fillColor('#94A3B8')
   .text('ChantabbaiFileDrop  ·  End-to-End Technical Reference',
         0, 172, { align:'center', width:PW, lineBreak:false })

// Badges
const BD = [
  {t:'Model',v:'LLaMA 4 Scout 17B',c:C.blue},
  {t:'Backend',v:'Next.js 15',c:C.teal},
  {t:'Storage',v:'Supabase Postgres',c:C.purple},
  {t:'Testing',v:'Playwright E2E',c:C.orange},
]
const BW=106,BH=44,BG=8
const bx0=(PW-(BD.length*BW+(BD.length-1)*BG))/2
BD.forEach((b,i)=>{
  const bx=bx0+i*(BW+BG)
  doc.roundedRect(bx,204,BW,BH,6).fill(b.c)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
     .text(b.t, bx, 213, {width:BW,align:'center',lineBreak:false})
  doc.font('Helvetica').fontSize(7.5).fillColor('rgba(255,255,255,0.85)')
     .text(b.v, bx, 225, {width:BW,align:'center',lineBreak:false})
})

// Meta strip
doc.roundedRect(L, 268, W, 50, 6).fill('#F8FAFC')
const META=[['Version','1.0'],['Author','neela krishna'],['Date','April 2026'],['Source','Context7']]
META.forEach(([k,v],i)=>{
  const mx=L+14+i*(W/4)
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.muted).text(k, mx, 279, {lineBreak:false})
  doc.font('Helvetica').fontSize(9).fillColor(C.navy).text(v, mx, 291, {lineBreak:false})
})
// Cover footer
doc.moveTo(L,PH-36).lineTo(PW-R,PH-36).lineWidth(0.4).strokeColor(C.bdr).stroke()
doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
   .text('Groq LLaMA 4 Scout  ·  Next.js 15  ·  Supabase  ·  TypeScript  ·  Playwright  ·  SheetJS  ·  Recharts',
         0, PH-24, {align:'center',width:PW,lineBreak:false})

// ═══════════════════════════════════════════════════════════════════════════
//  TABLE OF CONTENTS
// ═══════════════════════════════════════════════════════════════════════════
newPage()
doc.font('Helvetica-Bold').fontSize(16).fillColor(C.navy)
   .text('Table of Contents', L, Y, {lineBreak:false})
Y += 22
doc.moveTo(L,Y).lineTo(PW-R,Y).lineWidth(2).strokeColor(C.teal).stroke()
Y += 12

const TOC=[
  ['1','Project Overview'],['2','System Architecture'],['3','Tech Stack with Justification'],
  ['4','Data Flow Pipeline'],['5','AI Model Usage'],['6','Model Training / Fine-tuning'],
  ['7','OCR Integration'],['8','Fallback Logic — detectRestaurantCategory()'],
  ['9','Category Detection Logic'],['10','Code Structure'],['11','API Design'],
  ['12','Error Handling'],['13','Performance Optimization'],['14','Security Considerations'],
  ['15','Future Improvements'],['A','Appendix: Environment Variables'],
  ['B','Appendix: Playwright Test Coverage'],['C','Appendix: Quick Start Guide'],
]
TOC.forEach(([num,title],i)=>{
  const rh=22, isApp=isNaN(Number(num))
  doc.rect(L,Y,W,rh).fill(i%2===0?C.rowA:C.rowB)
  doc.rect(L,Y,30,rh).fill(isApp?C.teal:C.navy)
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
     .text(num, L, Y+7, {width:30,align:'center',lineBreak:false})
  doc.font('Helvetica').fontSize(10).fillColor(C.navy)
     .text(title, L+38, Y+6, {width:W-46,lineBreak:false})
  doc.moveTo(L,Y+rh).lineTo(PW-R,Y+rh).lineWidth(0.2).strokeColor(C.bdr).stroke()
  Y+=rh
})

// ═══════════════════════════════════════════════════════════════════════════
//  PARSE + RENDER MARKDOWN
// ═══════════════════════════════════════════════════════════════════════════
const lines = fs.readFileSync(MD,'utf8').split('\n')
let inCode=false, codeLang='', codeAcc=[]
let inTable=false, tableAcc=[]
let started=false

function flushTable(){
  if(inTable&&tableAcc.length&&started) renderTable(tableAcc)
  inTable=false; tableAcc=[]
}

for(let i=0;i<lines.length;i++){
  const line=lines[i]

  // code fence
  if(line.startsWith('```')){
    if(!inCode){ flushTable(); inCode=true; codeLang=line.slice(3).trim(); codeAcc=[] }
    else { inCode=false; if(started) renderCode(codeAcc,codeLang); codeAcc=[]; codeLang='' }
    continue
  }
  if(inCode){ codeAcc.push(line); continue }

  // table rows
  if(line.startsWith('|')){
    if(!inTable){inTable=true;tableAcc=[]}
    tableAcc.push(parseRow(line))
    continue
  } else if(inTable){ flushTable() }

  // skip until first section
  if(!started){ if(/^## 1\./.test(line)) started=true; else continue }

  if(/^## /.test(line))   { renderBanner(clean(line)); continue }
  if(/^### /.test(line))  { renderH3(clean(line));     continue }
  if(/^#### /.test(line)) { renderH4(clean(line));     continue }
  if(/^# /.test(line))    continue
  if(/^---+\s*$/.test(line.trim())) { renderHR(); continue }

  const bm=line.match(/^(\s*)[-*] (.+)/)
  if(bm){ renderBullet(bm[2], bm[1].length>0?14:0); continue }

  const nm=line.match(/^(\d+)\. (.+)/)
  if(nm){ renderNumbered(nm[1],nm[2]); continue }

  if(line.startsWith('> ')){ renderQuote(line.slice(2)); continue }

  if(!line.trim()){ gap(4); continue }

  renderPara(line)
}
flushTable()
if(inCode&&codeAcc.length) renderCode(codeAcc,codeLang)

// ═══════════════════════════════════════════════════════════════════════════
//  REFERENCES PAGE
// ═══════════════════════════════════════════════════════════════════════════
newPage()
doc.font('Helvetica-Bold').fontSize(16).fillColor(C.navy)
   .text('Key References & Sources', L, Y, {lineBreak:false})
Y+=22
doc.moveTo(L,Y).lineTo(PW-R,Y).lineWidth(2).strokeColor(C.teal).stroke()
Y+=12

const REFS=[
  {n:'Groq Vision API',      d:'LLaMA 4 Scout 17B — multimodal, base64 image, chat completions endpoint', c:C.blue  },
  {n:'Groq Model Specs',     d:'DocVQA 94.4, 131K context window, MoE 17B, $0.11/1M input tokens',        c:C.blue  },
  {n:'Next.js Route Handlers',d:'request.formData(), POST/GET handlers, server-side file processing',      c:C.teal  },
  {n:'Next.js App Router',   d:'Full-stack framework, server components, middleware, layout.tsx',          c:C.teal  },
  {n:'Supabase RLS',         d:'Row Level Security, bypassrls, service_role key, policy design',           c:C.purple},
  {n:'Supabase Storage',     d:'File upload, signed URLs (1-hour expiry), private bucket access',          c:C.purple},
  {n:'Supabase Service Key', d:'Admin access bypassing RLS — server-only, never expose in browser',        c:C.purple},
  {n:'Playwright E2E',       d:'getByRole, strict mode, headless Chromium, screenshot on failure',         c:C.orange},
  {n:'SheetJS (xlsx)',       d:'Excel export from JSON, workbook/worksheet API, XLSX.writeFile',           c:'#059669'},
  {n:'Recharts',             d:'React charts — BarChart, PieChart, ResponsiveContainer, Tooltip',          c:'#0EA5E9'},
  {n:'Tailwind CSS',         d:'Utility-first CSS, sm: breakpoints, mobile-first responsive patterns',     c:'#0284C7'},
]
REFS.forEach((r,i)=>{
  need(36)
  const rh=34, ry=Y
  doc.rect(L,ry,W,rh).fill(i%2===0?C.rowA:C.rowB)
  doc.rect(L,ry,5,rh).fill(r.c)
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navy)
     .text(r.n, L+12, ry+6, {lineBreak:false})
  doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
     .text(r.d, L+12, ry+20, {lineBreak:false})
  Y+=rh
})
Y+=14
doc.moveTo(L,Y).lineTo(PW-R,Y).lineWidth(1).strokeColor(C.teal).stroke()
Y+=10
doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
   .text('All content sourced via Context7 live library documentation — April 2026',
         0, Y, {align:'center',width:PW,lineBreak:false})
Y+=13
doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
   .text('ChantabbaiFileDrop  ·  AI-Powered Expense Classification System  ·  neela krishna',
         0, Y, {align:'center',width:PW,lineBreak:false})

// ── Done ──────────────────────────────────────────────────────────────────────
doc.end()
doc.once('finish',()=>{
  const sz=fs.statSync(OUT).size
  console.log(`\n✅  PDF: ${OUT}`)
  console.log(`   Pages : ${pageNo}  |  Size : ${(sz/1024).toFixed(1)} KB\n`)
})
