const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true })
const outPath = path.join(__dirname, '..', 'ChantabbaiFileDrop-FullDocumentation.pdf')
doc.pipe(fs.createWriteStream(outPath))

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  RED: '#C4161C', DARK: '#0F172A', BODY: '#1E293B', GRAY: '#64748B',
  LIGHT: '#F8FAFC', BLUE: '#2563EB', GREEN: '#16A34A', YELLOW: '#D97706',
  WHITE: '#FFFFFF', BORDER: '#E2E8F0', PURPLE: '#7C3AED', TEAL: '#0D9488',
  SLATE: '#475569', PINK: '#DB2777',
}

let pageNum = 0

// ── Page number footer ────────────────────────────────────────────────────────
doc.on('pageAdded', () => {
  pageNum++
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const PW = doc.page.width
const PH = doc.page.height
const ML = 50, MR = 50

function newPage() { doc.addPage() }

function coverPage() {
  // Full dark background
  doc.rect(0, 0, PW, PH).fill('#0F172A')
  // Red left stripe
  doc.rect(0, 0, 6, PH).fill(C.RED)
  // Top accent line
  doc.rect(6, 80, PW - 6, 2).fill(C.RED)

  // Logo placeholder circle
  doc.circle(PW / 2, 160, 45).fill(C.RED)
  doc.fontSize(28).font('Helvetica-Bold').fillColor(C.WHITE).text('CF', PW / 2 - 20, 143)

  // Main title
  doc.fontSize(32).font('Helvetica-Bold').fillColor(C.WHITE)
    .text('Chantabbai FileDrop', ML, 230, { align: 'center', width: PW - ML - MR })
  doc.fontSize(14).font('Helvetica').fillColor('#94A3B8')
    .text('Complete Project Documentation', ML, 272, { align: 'center', width: PW - ML - MR })

  // Divider
  doc.rect(120, 302, PW - 240, 1).fill(C.RED)

  // Subtitle
  doc.fontSize(11).fillColor('#CBD5E1')
    .text('Restaurant Expense Management System', ML, 315, { align: 'center', width: PW - ML - MR })

  // Tech badges row
  const badges = ['Next.js 15', 'Supabase', 'Tailwind CSS', 'Groq AI', 'Recharts', 'SheetJS', 'Playwright']
  let bx = 65
  badges.forEach(b => {
    const w = b.length * 7 + 16
    doc.rect(bx, 350, w, 20).fill('#1E293B').stroke()
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#94A3B8').text(b, bx + 8, 356)
    bx += w + 8
  })

  // Sections index
  doc.fontSize(10).font('Helvetica').fillColor('#64748B').text('CONTENTS', ML + 60, 395)
  doc.rect(ML + 60, 408, 180, 1).fill('#334155')

  const contents = [
    '1. Project Overview & Purpose',
    '2. Folder & File Structure',
    '3. Login Page — How It Works',
    '4. Dashboard & Navigation',
    '5. Upload Tab — Complete Flow',
    '6. Files Tab — Every Click Explained',
    '7. Analytics Tab — Charts & Data',
    '8. AI Extraction — How It Works',
    '9. Excel Import & Export',
    '10. Database & Storage Architecture',
    '11. Authentication System',
    '12. API Routes Reference',
    '13. Component Guide',
    '14. Recharts — Chart Implementation',
    '15. SheetJS — Excel Handling',
    '16. Playwright — Test Suite',
    '17. Mobile Responsive Design',
    '18. Deployment Guide',
  ]
  contents.forEach((c, i) => {
    const col = i < 9 ? 0 : 1
    const row = i < 9 ? i : i - 9
    doc.fontSize(9).font('Helvetica').fillColor('#94A3B8')
      .text(c, ML + 60 + col * 230, 418 + row * 18)
  })

  // Footer
  doc.fontSize(9).fillColor('#334155')
    .text(`Generated ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}  ·  Chantabbai Restaurant`, ML, PH - 50, { align: 'center', width: PW - ML - MR })
  newPage()
}

// Chapter header — full width colored bar
function chapterHeader(num, title, subtitle = '', color = C.RED) {
  doc.rect(ML - 10, doc.y, PW - ML - MR + 20, 52).fill(color)
  doc.fontSize(10).font('Helvetica-Bold').fillColor(C.WHITE)
    .text(`CHAPTER ${num}`, ML, doc.y - 48)
  doc.fontSize(18).font('Helvetica-Bold').fillColor(C.WHITE)
    .text(title, ML, doc.y - 30)
  if (subtitle) {
    doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.75)')
      .text(subtitle, ML, doc.y - 10)
  }
  doc.moveDown(1.5)
}

function h2(t, color = C.RED) {
  doc.moveDown(0.4)
  doc.fontSize(13).font('Helvetica-Bold').fillColor(color).text(t)
  doc.moveDown(0.25)
}

function h3(t) {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(C.BODY).text(t)
  doc.moveDown(0.2)
}

function body(t) {
  doc.fontSize(10).font('Helvetica').fillColor(C.BODY).text(t, { lineGap: 3, width: PW - ML - MR })
  doc.moveDown(0.35)
}

function code(snippet, lang = '') {
  const lines = snippet.trim().split('\n')
  const bh = lines.length * 13 + 20
  const by = doc.y
  doc.rect(ML - 5, by, PW - ML - MR + 10, bh).fill('#1E293B')
  if (lang) {
    doc.fontSize(7).font('Helvetica').fillColor('#64748B').text(lang, ML, by + 5)
  }
  doc.fontSize(8).font('Courier').fillColor('#E2E8F0')
  lines.forEach((line, i) => {
    doc.text(line.substring(0, 100), ML + 5, by + (lang ? 14 : 8) + i * 13, { lineBreak: false, width: PW - ML - MR })
  })
  doc.y = by + bh + 8
  doc.moveDown(0.3)
}

function bullet(items, color = C.RED) {
  items.forEach(item => {
    doc.fontSize(10).font('Helvetica').fillColor(color).text('▸ ', ML, doc.y, { continued: true, width: 15 })
    doc.fillColor(C.BODY).text(item, { width: PW - ML - MR - 15, lineGap: 2 })
  })
  doc.moveDown(0.3)
}

function infoBox(title, text, color = C.BLUE) {
  const by = doc.y
  doc.rect(ML - 5, by, 3, 40).fill(color)
  doc.rect(ML - 2, by, PW - ML - MR + 7, 40).fill(color + '18')
  doc.fontSize(9).font('Helvetica-Bold').fillColor(color).text(title, ML + 8, by + 6)
  doc.fontSize(9).font('Helvetica').fillColor(C.BODY).text(text, ML + 8, by + 18, { width: PW - ML - MR - 16 })
  doc.y = by + 48
  doc.moveDown(0.2)
}

function clickBox(action, result) {
  const by = doc.y
  doc.rect(ML - 5, by, PW - ML - MR + 10, 32).fill('#F0FDF4')
  doc.rect(ML - 5, by, 3, 32).fill(C.GREEN)
  doc.fontSize(9).font('Helvetica-Bold').fillColor(C.GREEN).text('CLICK: ', ML + 6, by + 6, { continued: true })
  doc.font('Helvetica').fillColor(C.BODY).text(action)
  doc.fontSize(9).font('Helvetica').fillColor(C.SLATE).text(`→ ${result}`, ML + 6, by + 18, { width: PW - ML - MR - 12 })
  doc.y = by + 38
  doc.moveDown(0.2)
}

function divider() {
  doc.moveDown(0.3)
  doc.rect(ML - 5, doc.y, PW - ML - MR + 10, 1).fill(C.BORDER)
  doc.moveDown(0.5)
}

function table(headers, rows) {
  const colW = (PW - ML - MR) / headers.length
  const by = doc.y
  // header
  doc.rect(ML - 5, by, PW - ML - MR + 10, 20).fill(C.DARK)
  headers.forEach((h, i) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.WHITE).text(h, ML - 5 + i * colW + 5, by + 6, { width: colW - 8 })
  })
  // rows
  rows.forEach((row, ri) => {
    const ry = by + 20 + ri * 18
    doc.rect(ML - 5, ry, PW - ML - MR + 10, 18).fill(ri % 2 === 0 ? '#F8FAFC' : C.WHITE)
    row.forEach((cell, ci) => {
      doc.fontSize(8).font('Helvetica').fillColor(C.BODY).text(cell, ML - 5 + ci * colW + 5, ry + 5, { width: colW - 8 })
    })
  })
  doc.y = by + 20 + rows.length * 18 + 8
  doc.moveDown(0.4)
}

function stepFlow(steps) {
  steps.forEach((step, i) => {
    const by = doc.y
    // Circle
    doc.circle(ML + 10, by + 10, 10).fill(C.RED)
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.WHITE).text(String(i + 1), ML + 6, by + 5)
    // Arrow line
    if (i < steps.length - 1) {
      doc.moveTo(ML + 10, by + 20).lineTo(ML + 10, by + 36).strokeColor(C.RED).lineWidth(1).dash(2, { space: 2 }).stroke().undash()
    }
    // Text
    doc.fontSize(10).font('Helvetica').fillColor(C.BODY).text(step, ML + 28, by + 5, { width: PW - ML - MR - 28 })
    doc.y = by + 26
  })
  doc.moveDown(0.5)
}

// ════════════════════════════════════════════════════════════════════════════
// COVER
// ════════════════════════════════════════════════════════════════════════════
coverPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 1 — PROJECT OVERVIEW
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(1, 'Project Overview & Purpose', 'What is Chantabbai FileDrop and why was it built?')

h2('What is Chantabbai FileDrop?')
body('Chantabbai FileDrop is a full-stack web application built exclusively for Chantabbai Restaurant to digitise, store and analyse all expense bills. Before this app, the restaurant was managing paper bills manually — now staff can photograph a bill, upload it, and the AI automatically extracts the vendor name, date, total amount, and category. Owners can see monthly spending charts, track budgets, and export data to Excel.')

h2('Who Uses It?')
table(
  ['User', 'Username', 'Password', 'What they can do'],
  [
    ['Owner / Manager', 'pavan', 'pavan.9000', 'Upload, extract, delete files, manage budgets, import Excel'],
    ['Viewer / Staff', 'viewer', 'view.001', 'View all files and analytics (read-only, cannot upload)'],
  ]
)

h2('Technology Stack Overview')
table(
  ['Layer', 'Technology', 'Purpose'],
  [
    ['Frontend Framework', 'Next.js 15 (App Router)', 'Routing, server components, API routes'],
    ['UI Styling', 'Tailwind CSS', 'Responsive utility-first CSS'],
    ['Backend/API', 'Next.js Route Handlers', 'All server-side logic with service role key'],
    ['Database', 'Supabase (Postgres)', 'File metadata, bills, budgets storage'],
    ['File Storage', 'Supabase Storage', 'Bucket "files" for all uploaded documents'],
    ['AI Extraction', 'Groq — LLaMA 4 Scout', 'OCR and data extraction from bill images'],
    ['Charts', 'Recharts', 'Pie charts, stacked bar charts for analytics'],
    ['Excel', 'SheetJS (xlsx)', 'Parse uploaded Excel sheets, generate Excel downloads'],
    ['Authentication', 'localStorage (custom)', '2 hardcoded users, no Supabase Auth sessions'],
    ['Testing', 'Playwright', '13 automated end-to-end tests, Chromium'],
  ]
)

infoBox('Key Design Decision', 'All database and storage operations go through Next.js server API routes using the Supabase service role key — this bypasses Row Level Security (RLS) and lets both users see all files.', C.BLUE)

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 2 — FOLDER STRUCTURE
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(2, 'Folder & File Structure', 'Every file and what it does')

h2('Project Root')
code(`chantabbai-filedrop/
├── app/                          # Next.js App Router pages & API
│   ├── page.tsx                  # Login page (/)
│   ├── dashboard/page.tsx        # Dashboard page (/dashboard)
│   ├── globals.css               # Global styles + Tailwind
│   ├── layout.tsx                # Root HTML layout
│   └── api/
│       ├── upload/route.ts       # POST — upload file (service role)
│       ├── files/route.ts        # GET — fetch all files (service role)
│       ├── signed-url/route.ts   # GET — generate signed storage URL
│       ├── bills/route.ts        # GET/POST/DELETE — manual expense bills
│       ├── extract/route.ts      # POST — AI extract from image/PDF
│       └── extract-all/route.ts  # POST — batch extract → Excel download
├── components/
│   ├── AuthForm.tsx              # Login form (2 hardcoded users)
│   ├── Dashboard.tsx             # Main layout: header + tab routing
│   ├── AnalyticsDashboard.tsx    # Charts, KPIs, Excel import panel
│   ├── FileGrid.tsx              # Grid/List/Timeline file display
│   ├── UploadZone.tsx            # Drag-and-drop upload area
│   ├── StatsBar.tsx              # Storage stats + donut chart
│   ├── FilterBar.tsx             # Search + sort + filter controls
│   ├── PreviewModal.tsx          # Full-screen file preview
│   ├── Toast.tsx                 # Notification toasts (3s auto-dismiss)
│   ├── Logo.tsx                  # Brand logo component
│   └── PasswordModal.tsx         # Confirm delete dialog
├── hooks/
│   └── useFileManager.ts         # All file state + actions hook
├── lib/
│   ├── parser.ts                 # Category detection, vendor extract, date/amount parse
│   ├── database.ts               # Supabase DB helper functions
│   ├── storage.ts                # File validation, checksum, upload queue
│   ├── extractToExcel.ts         # Excel generation from extracted data
│   ├── types.ts                  # TypeScript types and constants
│   └── supabase/client.ts        # Browser Supabase client
├── tests/
│   └── app.spec.ts               # 13 Playwright automated tests
├── scripts/
│   └── generate-full-docs.js     # This PDF generator
├── middleware.ts                  # Passthrough (auth removed)
├── playwright.config.ts           # Playwright configuration
└── .env.local                    # Environment variables (not in git)`, 'Project Structure')

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 3 — LOGIN PAGE
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(3, 'Login Page — How It Works', 'URL: http://localhost:3001  |  File: app/page.tsx + components/AuthForm.tsx', C.BLUE)

h2('What You See on the Login Page')
bullet([
  'Chantabbai logo (logo.png) — circular image with red rounded corners',
  '"Chantabbai FileDrop" heading — red "Chantabbai" + dark "FileDrop"',
  '"Restaurant expense management" subtitle in gray',
  'White card with: Username input, Password input, Sign In button',
  'Footer: "© 2026 Chantabbai Restaurant"',
  'Background: gradient from red-50 via white to orange-50',
])

h2('What Happens When You Type and Click')
clickBox('Type in Username field', 'Updates React state (useState). autoComplete="off" prevents browser email suggestions.')
clickBox('Type in Password field', 'Updates password state. Input type="password" hides characters.')
clickBox('Click Sign In button', 'Calls handleSubmit() → looks up USERS array → if match, saves session to localStorage → router.replace("/dashboard")')
clickBox('Wrong credentials', 'setError("Invalid username or password") → red error box appears above form')

h2('Authentication Flow (Step by Step)')
stepFlow([
  'User enters username "pavan" and password "pavan.9000" and clicks Sign In',
  'handleSubmit() searches USERS array: [{username:"pavan", password:"pavan.9000", isOwner:true, userId:"00000000-...-0001"}]',
  'Match found → localStorage.setItem("chantabbai_session", JSON.stringify({username, isOwner, userId}))',
  'router.replace("/dashboard") → Next.js navigates to dashboard',
  'Dashboard reads localStorage → if no session, redirects back to /',
])

h2('Hardcoded Users (components/AuthForm.tsx)')
code(`const USERS = [
  {
    username: 'pavan',
    password: 'pavan.9000',
    isOwner: true,
    userId: '00000000-0000-0000-0000-000000000001'  // fake UUID for state only
  },
  {
    username: 'viewer',
    password: 'view.001',
    isOwner: false,
    userId: '00000000-0000-0000-0000-000000000002'
  },
]`, 'components/AuthForm.tsx')

infoBox('Why localStorage?', 'Supabase Auth was replaced with simple localStorage auth because the app has only 2 fixed users. No signup, no email verification, no password reset needed. The real Supabase auth users (pavan@chantabbai.internal) exist only to satisfy database FK constraints on upload.', C.YELLOW)

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 4 — DASHBOARD & NAVIGATION
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(4, 'Dashboard & Navigation', 'File: components/Dashboard.tsx  |  hooks/useFileManager.ts', C.PURPLE)

h2('Dashboard Layout')
body('The dashboard has a sticky header and a main content area. The header is different on desktop vs mobile:')

h3('Desktop Header (sm+) — Single Row:')
bullet([
  'LEFT: Chantabbai FileDrop logo + brand name',
  'MIDDLE: Nav buttons — "📎 Upload" | "📁 Files" | "📊 Analytics"',
  'RIGHT: "👤 pavan" username + "Sign Out" button',
])

h3('Mobile Header — Two Rows:')
bullet([
  'ROW 1: Logo (left) + Username + "Sign Out" (right)',
  'ROW 2: Centered pill container with Upload | Files | Analytics buttons',
])

h2('Navigation Clicks')
clickBox('Click "📎 Upload" tab', 'actions.switchView("upload") → shows UploadZone component. OWNER ONLY — viewer cannot see this tab.')
clickBox('Click "📁 Files" tab', 'actions.switchView("files") → loads all files from /api/files → shows StatsBar + FilterBar + FileGrid')
clickBox('Click "📊 Analytics" tab', 'actions.switchView("analytics") → shows AnalyticsDashboard with charts and KPIs')
clickBox('Click "Sign Out"', 'localStorage.removeItem("chantabbai_session") → window.location.href = "/" → back to login')

h2('useFileManager Hook — The Brain')
body('All file state (list, filters, sort, upload queue, stats) lives in the useFileManager hook. Dashboard passes it down to all child components.')
code(`// hooks/useFileManager.ts — key state
const [state, setState] = useState({
  files: [],           // all files from /api/files
  filteredFiles: [],   // files after search/filter applied
  viewMode: ViewMode.Grid,
  filters: getDefaultFilters(),
  sort: getDefaultSort(),
  isLoading: false,
  uploadItems: [],     // files being uploaded
  stats: null,         // storage stats computed from files array
  currentView: isOwner ? 'upload' : 'files',  // owner→upload, viewer→files
})`, 'hooks/useFileManager.ts')

h2('Default View Logic')
infoBox('Owner vs Viewer Default', 'Owner (pavan) opens to Upload tab. Viewer opens to Files tab — because viewer cannot upload. Controlled by: currentView: isOwner ? "upload" : "files"', C.GREEN)

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 5 — UPLOAD TAB
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(5, 'Upload Tab — Complete Flow', 'Component: UploadZone.tsx  |  API: /api/upload', C.GREEN)

h2('What the Upload Tab Shows')
bullet([
  '"Upload Files" heading + file type hint (PNG, JPG, HEIC, PDF, Word & Excel — up to 30 MB each)',
  'UploadZone: dashed border drag-and-drop area with upload icon',
  'File queue: list of files with status indicators (pending/uploading/done/error)',
  '"Start Upload" and "Clear Done" action buttons',
])

h2('Upload Flow — Every Click Explained')
clickBox('Click anywhere in the dashed zone OR drag files into it', 'Opens OS file picker (or accepts dropped files). Multiple files allowed. Files added to upload queue as "pending".')
clickBox('Click "Start Upload" button', 'startUploads() called → processes valid pending files concurrently (max 3 at once via UploadQueue)')
clickBox('Click "Clear Done"', 'Removes completed/failed items from queue. Only uploading items remain.')
clickBox('Click "Extract" on a done item', 'handleExtractToExcel() → gets signed URL → sends to /api/extract → downloads Excel file')

h2('Full Upload Step-by-Step')
stepFlow([
  'User selects file(s) — addFiles() called — each file validated (type, size 1KB–30MB)',
  'Invalid files show toast error. Valid files appear in queue as "pending" (grey)',
  'User clicks "Start Upload" — startUploads() fired',
  'Browser computes SHA-256 checksum of file content (for duplicate detection)',
  'FormData built: { file, username: "pavan", checksum }',
  'POST /api/upload — server checks duplicate by checksum (admin DB query)',
  'If duplicate: returns { isDuplicate: true } → item marked "duplicate" (yellow)',
  'If new: server calls getRealUserId("pavan") → finds/creates pavan@chantabbai.internal in Supabase Auth',
  'File uploaded to Supabase Storage bucket "files" at path: {realUserId}/{timestamp}-{filename}',
  'DB record inserted into file_metadata table with user_id = real UUID',
  'Server returns { metadata } → item marked "done" (green ✓)',
  'File appears in Files tab immediately (state updated client-side)',
])

h2('File Validation Rules')
table(
  ['Rule', 'Allowed', 'Rejected'],
  [
    ['File Types', 'PNG, JPEG, HEIC/HEIF, PDF, DOC, DOCX, XLS, XLSX', 'MP4, ZIP, TXT, etc.'],
    ['Minimum Size', '1 KB', 'Empty files'],
    ['Maximum Size', '30 MB', 'Files > 30 MB'],
    ['Duplicate', 'Flagged as duplicate, not re-uploaded', 'Same file uploaded twice'],
  ]
)

h2('Upload API Route (app/api/upload/route.ts)')
code(`export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const username = formData.get('username') as string  // "pavan" or "viewer"
  const checksum = formData.get('checksum') as string

  // 1. Resolve to real Supabase auth UUID
  const realUserId = await getRealUserId(username)

  // 2. Check duplicate
  const { data: existing } = await admin.from('file_metadata')
    .select('*').eq('checksum', checksum).maybeSingle()
  if (existing) return NextResponse.json({ isDuplicate: true, metadata: existing })

  // 3. Upload to storage (service role bypasses RLS)
  const storagePath = \`\${realUserId}/\${Date.now()}-\${safeName}\`
  await admin.storage.from('files').upload(storagePath, arrayBuffer, { contentType })

  // 4. Insert DB record
  const { data: metadata } = await admin.from('file_metadata')
    .insert({ user_id: realUserId, name, original_name, size, mime_type,
              storage_path: storagePath, checksum, tags }).select().single()

  return NextResponse.json({ isDuplicate: false, metadata })
}`, 'app/api/upload/route.ts')

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 6 — FILES TAB
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(6, 'Files Tab — Every Click Explained', 'Components: FileGrid.tsx, StatsBar.tsx, FilterBar.tsx, PreviewModal.tsx')

h2('Files Tab Layout (top to bottom)')
bullet([
  '1. StatsBar — donut chart + Storage Used + Images/Documents/Spreadsheets counts',
  '2. FilterBar — search box + sort dropdown + filter chips + preset save/load',
  '3. Extract All button (owner only) — batch extract all visible files to Excel',
  '4. View Mode switcher — Grid (⊞) / List (≡) / Timeline (⊟)',
  '5. FileGrid — displays files in chosen view mode',
])

h2('StatsBar Interactions')
body('The StatsBar is purely visual — no clicks. It shows a canvas-drawn donut chart (blue = images, purple = documents, green = spreadsheets) and file counts. Stats are computed from the loaded files array — no separate query.')

h2('Filter & Sort Clicks')
clickBox('Type in search box', 'applyFilters() runs on every keystroke — filters by filename, category, vendor, tags')
clickBox('Click sort dropdown', 'applySortClient() re-sorts filteredFiles by chosen field (date, name, size, etc.)')
clickBox('Click a filter chip (starred, by type)', 'Adds filter → filteredFiles updates immediately')
clickBox('Click "Save Preset"', 'savePreset() stores current filters+sort in localStorage for reuse')
clickBox('Click a saved preset', 'handleLoadPreset() restores that filter/sort combination')

h2('File Card Clicks (Grid View)')
clickBox('Click thumbnail area', 'handlePreview(id) → GET /api/signed-url → opens PreviewModal with full-size file')
clickBox('Click "👁 Preview" button', 'Same as clicking thumbnail — opens PreviewModal')
clickBox('Click "⬇ Download" button', 'GET /api/signed-url → creates <a> tag → downloads file')
clickBox('Click "☆ Star" button (owner)', 'toggleStar(id, !current) → updates file_metadata.is_starred in DB → star turns gold')
clickBox('Click "🗑 Delete" button (owner)', 'Opens PasswordModal → on confirm: deleteFileRecord(id) + deleteFromStorage(path)')
clickBox('Click "⬇ Extract to Excel" button (owner)', 'Sends file to /api/extract (Groq AI) → downloads Excel with extracted data')

h2('PreviewModal Interactions')
clickBox('Click ← / → arrows', 'Navigate to previous/next file in current filtered list')
clickBox('Click ⭐ Star in modal', 'Toggles star on current file')
clickBox('Click Share icon', 'GET /api/signed-url → copies 1-hour URL to clipboard → toast notification')
clickBox('Click × or outside modal', 'setPreviewData(null) → modal closes')

h2('View Modes')
table(
  ['Mode', 'What it shows', 'Grid definition'],
  [
    ['Grid (⊞)', 'Cards with thumbnail/icon, filename, size, date, tags, actions', 'auto-fill minmax(155px, 1fr)'],
    ['List (≡)', 'Compact rows: icon | name | size | actions in columns', 'Fixed column widths'],
    ['Timeline (⊟)', 'Files grouped by upload month, grid within each group', 'Same as grid'],
  ]
)

h2('Thumbnail Lazy Loading')
body('Image thumbnails (PNG/JPEG) are loaded lazily. A custom IntersectionObserver watches for <img> tags with data-storage-path attributes. When visible, it calls GET /api/signed-url to get a signed URL and sets img.src.')
code(`// FileGrid.tsx — lazy load thumbnails
const imgs = container.querySelectorAll('img[data-storage-path]')
imgs.forEach(async img => {
  const path = img.dataset['storagePath']
  // getAttribute used (not .src) — .src returns base URL when unset
  if (!path || img.getAttribute('src')) return
  const url = await getSignedUrl(path)
  if (url) img.src = url
})`, 'components/FileGrid.tsx')

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 7 — ANALYTICS TAB
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(7, 'Analytics Tab — Charts & Data', 'Component: AnalyticsDashboard.tsx  |  API: /api/bills', C.TEAL)

h2('Analytics Tab Layout')
bullet([
  'Header row: "Monthly Analytics" + month dropdown selector',
  'Action buttons: "📋 Monthly Files" | "📥 Upload Excel" | "⚙ Set Budgets"',
  '"Missing this month" alert — shows recurring categories not yet uploaded',
  'Budget alerts — red/yellow if spending near/over monthly limit',
  'KPI cards: Total Spend | Entries | Vendors',
  'Category Breakdown — Pie chart',
  'Monthly Spend Trend — Stacked Bar chart (last 6 months)',
  'Top Vendors — horizontal bar chart',
  'Monthly Summary — AI-generated 3-point insight panel',
])

h2('Every Click in Analytics')
clickBox('Month dropdown', 'setSelectedMonth(value) → all charts/KPIs filter to that month instantly')
clickBox('"📋 Monthly Files" button', 'setShowMonthlyFiles(true) → expands panel showing all bills for selected month with delete option')
clickBox('"📥 Upload Excel" button (owner)', 'setShowImport(true) → opens Excel Import Panel below the header')
clickBox('"⚙ Set Budgets" button (owner)', 'setShowBudgetModal(true) → modal to set monthly ₹ limits per category')
clickBox('Delete bills in Monthly Files panel', 'DELETE /api/bills with { ids } → bills removed → charts refresh')
clickBox('Pie chart slice (hover)', 'Recharts Tooltip shows category name + ₹ amount on hover')
clickBox('Bar chart bar (hover)', 'Recharts Tooltip shows month + breakdown per category')

h2('KPI Cards — How Values are Computed')
table(
  ['Card', 'Value', 'How calculated'],
  [
    ['Total Spend', '₹9,57,000', 'Sum of bill_amount for all bills in selected month'],
    ['Entries', '7', 'Count of bills in selected month'],
    ['Vendors', '5', 'Count of unique vendor_name values (excluding "Unknown")'],
  ]
)

h2('Charts Implementation (Recharts — from Context7)')
code(`// Category Breakdown — Pie Chart
<ResponsiveContainer width="100%" height={260}>
  <PieChart>
    <Pie data={catData} dataKey="value" nameKey="name"
         cx="50%" cy="42%" outerRadius={80}
         label={({ percent }) => percent > 0.05 ? \`\${(percent*100).toFixed(0)}%\` : ''}>
      {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
    </Pie>
    <Tooltip formatter={(v) => \`₹\${Number(v).toLocaleString('en-IN')}\`} />
    <Legend wrapperStyle={{ fontSize: 10 }} iconSize={9} />
  </PieChart>
</ResponsiveContainer>

// Monthly Trend — Stacked Bar Chart
<ResponsiveContainer width="100%" height={260}>
  <BarChart data={trendData}>
    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
    <YAxis tickFormatter={v => \`₹\${(v/1000).toFixed(0)}k\`} width={44} />
    <Tooltip />
    <Legend />
    {trendCats.map((cat, i) => (
      <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[i % COLORS.length]}
           radius={i === last ? [3,3,0,0] : [0,0,0,0]} />
    ))}
  </BarChart>
</ResponsiveContainer>`, 'components/AnalyticsDashboard.tsx')

h2('"Missing This Month" Logic')
body('Checks if recurring expense categories (Electricity, Water, Gas, Rent, Staff Salary) appear in the selected month\'s bills. If a category has no bills, it appears in the blue "Missing this month" alert.')
code(`const RECURRING_CATS = ['Electricity', 'Water', 'Gas', 'Rent', 'Staff Salary']
const actualCatsLower = Object.keys(catMap).map(k => k.toLowerCase())
const missingRecurring = RECURRING_CATS.filter(cat => {
  const needleWords = cat.toLowerCase().split(/\s+/)
  return !actualCatsLower.some(k => {
    const kWords = k.split(/\s+/)
    return needleWords.some(nw => kWords.some(kw => kw.startsWith(nw) || nw.startsWith(kw)))
  })
})`, 'components/AnalyticsDashboard.tsx')

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 8 — AI EXTRACTION
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(8, 'AI Extraction — How It Works', 'API: /api/extract/route.ts  |  Model: Groq LLaMA 4 Scout', C.PINK)

h2('What AI Extraction Does')
body('When you click "Extract to Excel" on a file, the system sends the image/PDF to Groq\'s LLaMA 4 Scout vision model. The AI reads the bill (including handwritten ones) and returns structured JSON with: vendor name, date, total amount, category, bill type, and all visible text.')

h2('What the AI Is Told (The Prompt)')
body('The system prompt tells the AI exactly how to read Indian restaurant bills:')
code(`"You are an expert at reading Indian restaurant supplier bills...
VENDOR: The vendor is the SELLER (the shop issuing the bill) — at the TOP
- On cash bills, the 'Name:' field is the CUSTOMER (us) — NEVER use as vendor
- Example: 'SV Milk Distribution' is vendor, 'Chantabbai Biryani' after 'Name:' is customer

AMOUNT: Use the 'Total' field. If unclear, ADD UP all line items.

CATEGORY rules:
- Milk, Curd, Paneer, Butter, Ghee → 'Dairy & Eggs'
- Chicken, Mutton, Fish → 'Meat & Seafood'
- Petrol, Diesel → 'Fuel & Transport'
- LPG, Gas cylinder → 'Gas / LPG'
..."`, 'app/api/extract/route.ts — STRUCTURED_PROMPT')

h2('AI Extraction Flow')
stepFlow([
  'User clicks "⬇ Extract to Excel" on a file card',
  'GET /api/signed-url?path={storagePath} → 1-hour signed URL returned',
  'POST /api/extract with { fileUrl, mimeType, fileName, fileId }',
  'Server fetches file bytes → converts to base64 string',
  'Groq API called: model="meta-llama/llama-4-scout-17b-16e-instruct", image+prompt sent',
  'AI returns JSON: { vendor, date, amount, category, bill_type, raw_text }',
  'If AI fails: regex fallback parser (lib/parser.ts) runs on raw_text',
  'file_metadata record updated: category, vendor_name, bill_amount, bill_date (via admin client)',
  'Excel file generated with extracted data → browser download triggered',
])

h2('Category Auto-Detection (lib/parser.ts Fallback)')
table(
  ['Category', 'Keywords that trigger it'],
  [
    ['Dairy & Eggs', 'milk, dairy, paneer, curd, cheese, butter, ghee, cream'],
    ['Meat & Seafood', 'chicken, mutton, fish, prawn, seafood, meat, gosht, lamb'],
    ['Vegetables & Fruits', 'vegetable, sabji, onion, tomato, potato, carrot, cabbage'],
    ['Rice & Grains', 'rice, wheat, flour, dal, pulses, grain, maida, rava'],
    ['Gas / LPG', 'lpg, gas cylinder, hp gas, indane, bharatgas'],
    ['Fuel & Transport', 'petrol, diesel, fuel, filling station, hpcl, bpcl, ruchi trails'],
    ['Staff Salary', 'salary, payslip, wages, payroll (not vendor names)'],
    ['Electricity', 'electricity, current bill, eb bill, bescom, tangedco'],
    ['Water', 'water bill, water supply, metro water, bwssb'],
    ['Rent', 'rent, lease, property, premises'],
  ]
)

infoBox('Vendor Confusion Fix', '"SV Milk Distribution" bill had "Name: Chantabbai Biryani" (customer field). Old AI read "Chantabbai Biryani" as vendor. Fixed by explicitly telling AI: the Name/To field = customer, NOT vendor. The company at the top = vendor.', C.RED)

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 9 — EXCEL IMPORT & EXPORT
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(9, 'Excel Import & Export', 'SheetJS (xlsx)  |  Component: ExcelImportPanel  |  API: /api/bills', C.YELLOW)

h2('Excel Import — Upload Monthly Expense Sheet')
body('Owners can upload a monthly expense Excel file. The system reads each row, normalises the category, detects the vendor, and saves all rows as bills to the manual_bills table.')

h2('Excel Import Flow (Every Click)')
clickBox('Click "📥 Upload Excel" in Analytics tab', 'setShowImport(true) → ExcelImportPanel slides in below the header')
clickBox('Select or drag an .xlsx / .xls file into the panel', 'SheetJS reads the file: XLSX.read(buffer) → sheet_to_json() → array of row objects')
clickBox('Preview table appears', 'First 5 rows shown with parsed columns: Date, Category, Amount, Vendor')
clickBox('Click "Save to Analytics" button', 'POST /api/bills with all parsed rows → saved to manual_bills table')
clickBox('Panel closes automatically', 'reload() called → charts refresh with new data')

h2('How SheetJS Reads Excel (from Context7 docs)')
code(`// ExcelImportPanel — reading the uploaded Excel file
const buffer = await file.arrayBuffer()
const wb = XLSX.read(buffer)                          // parse workbook
const sheet = wb.Sheets[wb.SheetNames[0]]             // first sheet
const rows = XLSX.utils.sheet_to_json(sheet)          // array of row objects

// Each row looks like: { Date: "01/04/2026", Category: "Veg", Amount: 1200, Vendor: "ABC" }`, 'SheetJS usage in ExcelImportPanel')

h2('Column Name Normalisation')
body('Excel sheets use different column names. The parser tries multiple variations:')
code(`// Flexible column detection — handles different sheet formats
function getVal(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined) return String(row[k]).trim()
  }
  return ''
}
const vendor = getVal(row, 'Vendor', 'vendor', 'VENDOR', 'Vendor Name', 'Party', 'Party Name')
const category = getVal(row, 'Category', 'category', 'CAT', 'Type', 'Head')
const amount = getVal(row, 'Amount', 'amount', 'AMOUNT', 'Total', 'Net Amount', 'Dr Amount')
const date = getVal(row, 'Date', 'date', 'DATE', 'Bill Date', 'Invoice Date')`, 'ExcelImportPanel column detection')

h2('Category Normalisation')
body('Raw Excel category values like "Gas", "Meat", "Staff Salaries" are normalised to standard categories to prevent duplicates in charts:')
code(`function normalizeExcelCategory(raw: string): string {
  const r = raw.trim().toLowerCase()
  if (/\bgas\b/.test(r) && !/lpg/.test(r)) return 'Gas / LPG'
  if (/\bmeat\b/.test(r)) return 'Meat & Seafood'
  if (/staff\s*salar/i.test(r)) return 'Staff Salary'
  if (/vegetable|veg\b/i.test(r)) return 'Vegetables & Fruits'
  if (/dairy|milk/i.test(r)) return 'Dairy & Eggs'
  if (/rice|grain/i.test(r)) return 'Rice & Grains'
  if (/total|grand total|subtotal/i.test(r)) return 'SKIP'  // skip total rows
  return raw  // keep original if no match
}`, 'normalizeExcelCategory() in AnalyticsDashboard.tsx')

h2('Vendor Memory System')
body('When a vendor is wrongly categorised (e.g., "paul" detected as Staff Salary instead of Meat), the owner can correct it. The correction is saved in localStorage. Future imports automatically apply the remembered category for that vendor.')

h2('Excel Export — Extract All')
clickBox('Click "⬇ Extract All" button in Files tab', 'handleExtractAll() runs — fetches signed URLs for all extractable files → sends each to /api/extract → combines results into one Excel workbook → download')

h2('Excel Output Format')
table(
  ['Column', 'Data', 'Example'],
  [
    ['Date', 'Extracted bill date', '09/04/2026'],
    ['Category', 'Auto-detected category', 'Dairy & Eggs'],
    ['Amount (₹)', 'Total bill amount', '2188'],
    ['Vendor', 'Supplier name', 'SV Milk Distribution'],
    ['Bill Type', 'Type of document', 'Cash Bill'],
    ['File Name', 'Original filename', '1.jpeg'],
  ]
)

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 10 — DATABASE & STORAGE
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(10, 'Database & Storage Architecture', 'Supabase Postgres + Storage  |  All via Service Role Key')

h2('Database Tables')
table(
  ['Table', 'Key Columns', 'Purpose'],
  [
    ['file_metadata', 'id, user_id (FK auth.users), name, original_name, size, mime_type, storage_path, checksum, tags, category, vendor_name, bill_amount, bill_date, is_starred, approval_status', 'All uploaded file records'],
    ['manual_bills', 'id, user_id (FK auth.users), description, category, vendor_name, bill_amount, bill_date, created_at', 'Excel-imported expense entries'],
    ['profiles', 'id, username', 'Display names for users'],
    ['budget_settings', 'id, user_id, category, monthly_limit', 'Monthly budget limits per category'],
  ]
)

h2('Why Service Role Key?')
body('Supabase Row Level Security (RLS) policies restrict which rows each user can read/write based on their auth token. Since we use fake UUIDs (not real Supabase sessions), RLS would block all operations from the browser client.')
infoBox('Solution', 'All DB and storage operations go through Next.js server API routes using the SUPABASE_SERVICE_ROLE_KEY. This key bypasses RLS entirely. The key is never exposed to the browser.', C.RED)

h2('Storage Bucket')
bullet([
  'Bucket name: "files"',
  'Files stored at path: {real_user_uuid}/{timestamp}-{filename}',
  'Access: private (requires signed URLs)',
  'Signed URL expiry: 3600 seconds (1 hour)',
])

h2('Signed URL Flow')
code(`// GET /api/signed-url?path={storagePath}
const admin = createClient(url, SUPABASE_SERVICE_ROLE_KEY)
const { data } = await admin.storage.from('files').createSignedUrl(storagePath, 3600)
return NextResponse.json({ url: data.signedUrl })
// → client gets temporary URL valid for 1 hour`, 'app/api/signed-url/route.ts')

h2('Internal Auth User Pattern')
body('file_metadata.user_id has a FK constraint to auth.users. Since our fake UUIDs don\'t exist in auth.users, we create real Supabase auth users for each username (pavan, viewer) on first upload. Their real UUIDs are cached in memory.')
code(`// Cached: username → real Supabase auth UUID
const userIdCache: Record<string, string> = {}

async function getRealUserId(username: string): Promise<string> {
  if (userIdCache[username]) return userIdCache[username]
  const email = \`\${username}@chantabbai.internal\`
  const { data } = await admin.auth.admin.createUser({
    email, password: 'chantabbai_internal_9000', email_confirm: true,
  })
  // If already exists, listUsers() to find it
  userIdCache[username] = data.user.id
  return data.user.id
}`, 'app/api/upload/route.ts')

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 11 — API ROUTES REFERENCE
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(11, 'API Routes Complete Reference', 'All server-side endpoints — all use service role key')

const apiRoutes = [
  ['GET', '/api/files', 'Fetch all files from file_metadata. Enriches with username from profiles table. Returns all files for all users (no RLS).'],
  ['POST', '/api/upload', 'Accept FormData(file, username, checksum). Check duplicate. Resolve username→real UUID. Upload to storage. Insert DB record.'],
  ['GET', '/api/signed-url', 'Query param: path={storagePath}. Returns 1-hour signed URL for private file access.'],
  ['GET', '/api/bills', 'Fetch all rows from manual_bills table. Used by Analytics tab.'],
  ['POST', '/api/bills', 'Insert expense rows from Excel import. Uses getInternalUserId() for FK satisfaction.'],
  ['DELETE', '/api/bills', 'Body: { ids: string[] }. Deletes specified bills from manual_bills.'],
  ['POST', '/api/extract', 'Body: { fileUrl, mimeType, fileName, fileId }. Fetches file, sends to Groq LLaMA 4, returns extracted JSON. Updates file_metadata record.'],
  ['POST', '/api/extract-all', 'Batch version — processes multiple files, generates combined Excel download.'],
]

apiRoutes.forEach(([method, path, desc]) => {
  const color = method === 'GET' ? C.GREEN : method === 'POST' ? C.BLUE : method === 'DELETE' ? C.RED : C.YELLOW
  const by = doc.y
  doc.rect(ML - 5, by, 40, 18).fill(color)
  doc.fontSize(8).font('Helvetica-Bold').fillColor(C.WHITE).text(method, ML, by + 5)
  doc.fontSize(9).font('Courier').fillColor(C.BLUE).text(path, ML + 48, by + 4)
  doc.y = by + 20
  doc.fontSize(9).font('Helvetica').fillColor(C.SLATE).text(desc, ML + 10, doc.y, { width: PW - ML - MR - 10 })
  doc.moveDown(0.5)
  doc.rect(ML - 5, doc.y, PW - ML - MR + 10, 0.5).fill(C.BORDER)
  doc.moveDown(0.3)
})

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 12 — COMPONENT GUIDE
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(12, 'Component Guide', 'Every component, its props, and what it renders')

const components = [
  ['AuthForm', 'None', 'Login form. Reads USERS array. On success stores session in localStorage.'],
  ['Dashboard', 'userId, userEmail, isOwner', 'Main layout. Sticky header + tab routing. Calls useFileManager hook.'],
  ['UploadZone', 'uploadItems, onFilesSelected, onStartUpload, onClear, onExtract', 'Drag-and-drop zone + file queue list + action buttons.'],
  ['FileGrid', 'files, viewMode, hasFilter, onAction, getSignedUrl, isOwner', 'Renders Grid / List / Timeline view. Lazy-loads image thumbnails.'],
  ['FileCard', 'file, onAction, isOwner', 'Individual file card with thumbnail, metadata, action buttons.'],
  ['StatsBar', 'stats (StorageStats)', 'Canvas donut chart + storage used + per-category counts.'],
  ['FilterBar', 'filters, sort, allTags, totalFiles, filteredCount, presets, onFiltersChange...', 'Search input + sort dropdown + filter chips + preset manager.'],
  ['AnalyticsDashboard', 'userId, isOwner', 'Charts, KPIs, Excel import, budget modal. Fetches /api/bills.'],
  ['PreviewModal', 'file, url, allFiles, onClose, onPrev, onNext, onStar, onShare...', 'Full-screen overlay. Image/PDF preview. Prev/Next navigation.'],
  ['Toast / ToastContainer', 'showToast(message, type, duration)', 'Portal-rendered toasts. Auto-dismiss after 3 seconds.'],
  ['Logo', 'None', 'Image + "Chantabbai FileDrop" brand text.'],
  ['PasswordModal', 'title, description, onConfirm, onCancel', 'Confirmation dialog for destructive actions (delete).'],
]

components.forEach(([name, props, desc]) => {
  h3(`<${name} />`)
  doc.fontSize(9).font('Helvetica').fillColor(C.SLATE)
    .text(`Props: ${props}`, ML + 8)
  doc.fontSize(9).font('Helvetica').fillColor(C.BODY)
    .text(desc, ML + 8, doc.y + 2)
  divider()
})

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 13 — PLAYWRIGHT TESTING
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(13, 'Playwright — Full Test Suite', '13/13 Tests Passing  |  File: tests/app.spec.ts', C.GREEN)

h2('Test Configuration')
code(`// playwright.config.ts
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,              // retry once on failure
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    headless: false,       // opens real browser window (visible)
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})`, 'playwright.config.ts')

h2('Test Results — All 13 Passing ✅')
const tests13 = [
  ['1', 'login page loads correctly', '2.2s', 'Checks h1, inputs, button text visible'],
  ['2', 'wrong password shows error', '1.9s', 'Enters bad creds, checks error message'],
  ['3', 'owner sees all nav tabs', '3.0s', 'Login as pavan, check Upload/Files/Analytics buttons'],
  ['4', 'owner default view is Upload', '3.0s', 'Login as pavan, heading "Upload Files" visible'],
  ['5', 'viewer has no Upload tab', '3.2s', 'Login as viewer, Upload button NOT visible'],
  ['6', 'owner switches all tabs', '5.1s', 'Files→Storage Used, Analytics→heading, Upload→Upload Files'],
  ['7', 'files view shows stats bar', '3.7s', '"Storage Used" text visible after switching to Files'],
  ['8', 'view mode switcher works', '5.8s', 'Grid/List/Timeline title buttons exist and clickable'],
  ['9', 'analytics tab loads', '4.8s', 'Monthly Analytics heading + 3 action buttons visible'],
  ['10', 'month selector visible', '5.7s', 'Select dropdown visible in Analytics'],
  ['11', 'sign out works', '3.9s', 'Click Sign Out → URL becomes /, login inputs visible'],
  ['12', 'mobile login renders', '1.6s', 'Viewport 390×844, h1 + submit button visible'],
  ['13', 'mobile nav buttons visible', '2.9s', 'Viewport 390×844, Upload/Files/Analytics all visible'],
]
table(
  ['#', 'Test Name', 'Time', 'What it checks'],
  tests13
)

h2('How to Run Tests')
code(`# 1. Make sure dev server is running
npm run dev

# 2. Run all tests (browser visible)
npx playwright test

# 3. Run headless (no browser window)
npx playwright test --headless

# 4. Run one specific test
npx playwright test -g "login page"

# 5. View HTML report
npx playwright show-report`, 'Terminal commands')

h2('Common Locator Patterns Used (Context7 Playwright docs)')
code(`// Role-based (preferred) — works across languages
page.getByRole('button', { name: /Files/ }).first()
page.getByRole('heading', { name: 'Upload Files' })
page.getByRole('button', { name: 'Sign Out' }).first()

// Title attribute
page.getByTitle('Grid')

// Placeholder text
page.fill('input[placeholder="Enter username"]', 'pavan')

// URL assertion
await expect(page).toHaveURL('/')

// Visibility assertion
await expect(locator).toBeVisible({ timeout: 10000 })
await expect(locator).not.toBeVisible()`, 'tests/app.spec.ts — locator patterns')

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 14 — MOBILE RESPONSIVE
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(14, 'Mobile Responsive Design', 'Tailwind CSS breakpoints  |  sm: = 640px', C.BLUE)

h2('Breakpoint Strategy (Context7 Tailwind docs)')
body('Tailwind uses mobile-first design: unprefixed classes apply to all sizes, sm: applies at ≥640px, lg: at ≥1024px.')

table(
  ['Screen', 'Breakpoint', 'What changes'],
  [
    ['Mobile', 'default (<640px)', 'Two-row header, compact KPIs, smaller text, pill nav centered'],
    ['Tablet', 'sm: (≥640px)', 'Single-row header, full text labels, larger paddings'],
    ['Desktop', 'lg: (≥1024px)', '2-column chart layout (Pie + Bar side by side)'],
  ]
)

h2('Mobile Header Structure')
code(`{/* Desktop: hidden on mobile */}
<div className="hidden sm:flex items-center gap-4">
  <Logo />
  <nav className="flex gap-1 ml-6"> Upload | Files | Analytics </nav>
  <div className="ml-auto"> 👤 pavan | Sign Out </div>
</div>

{/* Mobile: hidden on desktop */}
<div className="sm:hidden">
  <div className="flex justify-between px-4 pt-2.5">
    <Logo />
    <div> 👤 pavan | Sign Out </div>
  </div>
  <div className="flex justify-center pb-2">
    <nav className="bg-gray-100 rounded-2xl p-1">
      Upload | Files | Analytics
    </nav>
  </div>
</div>`, 'components/Dashboard.tsx — responsive header')

h2('Other Mobile Fixes Applied')
bullet([
  'Main padding: py-8 → py-4 sm:py-8, px-4 → px-3 sm:px-4',
  'KPI cards: always 3 columns, text-base sm:text-2xl (smaller numbers on mobile)',
  'Analytics buttons: flex-1 (full width), short labels (Files/Excel/Budgets)',
  'File grid: minmax(155px) → ~2 cards per row on 390px phone',
  'Vendor bar chart: w-24 sm:w-32 (narrower name column on mobile)',
  'Chart height: 300px → 260px on all screens',
  'body overflow-x: hidden → prevents horizontal scroll',
  '.scrollbar-none → hides scrollbar on nav pill overflow',
])

newPage()

// ════════════════════════════════════════════════════════════════════════════
// CH 15 — ENVIRONMENT VARIABLES & DEPLOYMENT
// ════════════════════════════════════════════════════════════════════════════
chapterHeader(15, 'Environment Variables & Deployment', 'How to run and deploy this project', C.PURPLE)

h2('Required Environment Variables (.env.local)')
code(`# .env.local — never commit to git
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`, '.env.local')

table(
  ['Variable', 'Where to get it', 'Used in'],
  [
    ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase Dashboard → Project Settings → API', 'All routes + browser client'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Supabase Dashboard → Project Settings → API', 'Browser Supabase client'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase Dashboard → Project Settings → API (service_role)', 'All server API routes (SECRET)'],
    ['GROQ_API_KEY', 'console.groq.com → API Keys', 'AI extraction route'],
  ]
)

h2('Run Locally')
code(`# Install dependencies
npm install

# Install Playwright browsers (for tests)
npx playwright install chromium

# Start development server
npm run dev
# → http://localhost:3000 (or 3001 if 3000 is taken)

# Run tests (dev server must be running)
npx playwright test

# Build for production
npm run build
npm start`, 'Terminal')

h2('Deploy to Vercel (Free Hosting)')
stepFlow([
  'Push code to GitHub: git push origin main',
  'Go to vercel.com → New Project → Import your GitHub repo',
  'Set Framework Preset to "Next.js" (auto-detected)',
  'Add all 4 environment variables in Vercel dashboard → Settings → Environment Variables',
  'Click Deploy → Vercel builds and deploys automatically',
  'Your app is live at: https://yourproject.vercel.app',
  'Optional: Add custom domain (chantabbaifiledrop.com) in Vercel → Domains',
])

infoBox('Free Tier', 'Vercel free tier supports Next.js fully. No cost for hosting. Custom domain requires buying it (~₹900/year from Porkbun or Cloudflare Registrar).', C.GREEN)

h2('Supabase Setup Required')
bullet([
  'Create Supabase project at supabase.com',
  'Create storage bucket named "files" (set to private)',
  'Run SQL migrations to create: file_metadata, manual_bills, profiles, budget_settings tables',
  'The app will auto-create internal auth users (pavan@chantabbai.internal, viewer@chantabbai.internal) on first upload',
])

// ── Final page footer ─────────────────────────────────────────────────────
newPage()
doc.rect(0, 0, PW, PH).fill('#0F172A')
doc.rect(0, 0, 6, PH).fill(C.RED)
doc.rect(6, 80, PW - 6, 2).fill(C.RED)
doc.fontSize(28).font('Helvetica-Bold').fillColor(C.WHITE)
  .text('End of Documentation', ML, 250, { align: 'center', width: PW - ML - MR })
doc.fontSize(12).font('Helvetica').fillColor('#94A3B8')
  .text('Chantabbai FileDrop — Complete Technical Guide', ML, 295, { align: 'center', width: PW - ML - MR })
doc.fontSize(10).fillColor('#64748B')
  .text(`${pageNum} pages  ·  Generated ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, ML, 330, { align: 'center', width: PW - ML - MR })
doc.rect(120, 360, PW - 240, 1).fill(C.RED)
doc.fontSize(9).fillColor('#475569')
  .text('Documentation generated using Context7 live library docs', ML, 375, { align: 'center', width: PW - ML - MR })
  .text('Next.js · Supabase · Tailwind CSS · Recharts · SheetJS · Playwright', ML, 390, { align: 'center', width: PW - ML - MR })

doc.end()
console.log('✅ PDF saved:', outPath, `(${pageNum} pages)`)
