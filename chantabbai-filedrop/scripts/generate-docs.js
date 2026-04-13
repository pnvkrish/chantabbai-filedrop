const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

const doc = new PDFDocument({ margin: 50, size: 'A4' })
const outPath = path.join(__dirname, '..', 'ChantabbaiFileDrop-Documentation.pdf')
doc.pipe(fs.createWriteStream(outPath))

// ── Colors & Fonts ──────────────────────────────────────────────────────────
const RED    = '#C4161C'
const DARK   = '#111827'
const GRAY   = '#6B7280'
const LIGHT  = '#F3F4F6'
const WHITE  = '#FFFFFF'
const BLUE   = '#1D4ED8'
const GREEN  = '#15803D'

// ── Helpers ──────────────────────────────────────────────────────────────────

function coverPage() {
  // Background
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0F172A')

  // Red accent bar
  doc.rect(0, 0, 8, doc.page.height).fill(RED)

  // Title
  doc.fontSize(36).font('Helvetica-Bold').fillColor(WHITE)
    .text('Chantabbai FileDrop', 60, 220, { align: 'center' })

  doc.fontSize(16).font('Helvetica').fillColor('#94A3B8')
    .text('Technical Documentation', 60, 270, { align: 'center' })

  // Divider
  doc.moveTo(120, 310).lineTo(doc.page.width - 120, 310).strokeColor(RED).lineWidth(2).stroke()

  // Subtitle
  doc.fontSize(12).fillColor('#CBD5E1')
    .text('Stack: Next.js 15 · Supabase · Tailwind CSS · Playwright', 60, 325, { align: 'center' })

  // Date
  doc.fontSize(10).fillColor('#64748B')
    .text(`Generated: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, 60, 360, { align: 'center' })

  // Sections list
  const sections = [
    '1. Project Overview',
    '2. Next.js — App Router & API Routes',
    '3. Supabase — Auth, Storage & Database',
    '4. Tailwind CSS — Responsive Design',
    '5. Playwright — Automated Testing',
    '6. Architecture & Key Decisions',
    '7. Environment Variables',
    '8. Test Results',
  ]
  doc.fontSize(11).fillColor('#94A3B8').font('Helvetica')
  sections.forEach((s, i) => {
    doc.text(s, 200, 420 + i * 24)
  })

  doc.addPage()
}

function sectionHeader(title, subtitle = '') {
  // Header background
  doc.rect(50, doc.y, doc.page.width - 100, 40).fill('#1E293B').stroke()
  doc.fontSize(16).font('Helvetica-Bold').fillColor(WHITE)
    .text(title, 62, doc.y - 36)
  if (subtitle) {
    doc.fontSize(9).font('Helvetica').fillColor('#94A3B8')
      .text(subtitle, 62, doc.y - 14)
  }
  doc.moveDown(1.5)
}

function h2(text) {
  doc.moveDown(0.5)
  doc.fontSize(13).font('Helvetica-Bold').fillColor(RED).text(text)
  doc.moveDown(0.3)
}

function h3(text) {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK).text(text)
  doc.moveDown(0.2)
}

function body(text) {
  doc.fontSize(10).font('Helvetica').fillColor(DARK).text(text, { lineGap: 3 })
  doc.moveDown(0.4)
}

function code(snippet) {
  const x = 50, w = doc.page.width - 100
  const lines = snippet.split('\n')
  const height = lines.length * 13 + 16

  doc.rect(x, doc.y, w, height).fill('#1E293B')
  doc.fontSize(8.5).font('Courier').fillColor('#E2E8F0')
  lines.forEach((line, i) => {
    doc.text(line, x + 10, doc.y - height + 8 + i * 13, { lineBreak: false, width: w - 20 })
  })
  doc.moveDown(1.2)
}

function bullet(items) {
  items.forEach(item => {
    doc.fontSize(10).font('Helvetica').fillColor(DARK)
      .text(`• ${item}`, { indent: 15, lineGap: 2 })
  })
  doc.moveDown(0.4)
}

function badge(text, color = RED) {
  doc.fontSize(9).font('Helvetica-Bold').fillColor(WHITE)
  const w = doc.widthOfString(text) + 16
  doc.rect(doc.x, doc.y, w, 16).fill(color)
  doc.text(text, doc.x + 8, doc.y - 13)
  doc.moveDown(0.8)
}

function divider() {
  doc.moveDown(0.3)
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#E5E7EB').lineWidth(1).stroke()
  doc.moveDown(0.5)
}

// ── PAGE: Cover ───────────────────────────────────────────────────────────────
coverPage()

// ── PAGE 2: Project Overview ──────────────────────────────────────────────────
sectionHeader('1. Project Overview', 'Chantabbai FileDrop — Restaurant Expense Management System')

h2('What is Chantabbai FileDrop?')
body('Chantabbai FileDrop is a full-stack web application built for Chantabbai Restaurant to manage, store, and analyse expense bills and invoices. Restaurant staff can upload bill images (JPEGs, PDFs, Word docs), the system uses AI (Groq LLaMA 4) to extract vendor, date, amount, and category automatically, and owners can track monthly analytics.')

h2('Key Features')
bullet([
  'Secure file upload with duplicate detection via SHA-256 checksum',
  'AI-powered bill extraction (vendor, amount, date, category) using Groq LLaMA 4',
  'Monthly analytics with charts (Pie + Stacked Bar) and KPI cards',
  'Excel import for bulk expense entry with vendor memory',
  'Role-based access: Owner (pavan) and Viewer accounts',
  'Responsive UI — works on desktop and mobile',
  'Playwright automated testing (13 tests, all passing)',
])

h2('Technology Stack')
const stack = [
  ['Frontend', 'Next.js 15 App Router, React, Tailwind CSS'],
  ['Backend', 'Next.js API Routes (server-side, service role key)'],
  ['Database', 'Supabase Postgres (RLS bypassed via service role)'],
  ['Storage', 'Supabase Storage bucket "files"'],
  ['AI/OCR', 'Groq SDK — meta-llama/llama-4-scout-17b-16e-instruct'],
  ['Charts', 'Recharts (Pie, BarChart, ResponsiveContainer)'],
  ['Auth', 'localStorage-based (2 hardcoded users, no Supabase Auth)'],
  ['Testing', 'Playwright — 13 automated tests, Chromium'],
  ['Excel', 'SheetJS (xlsx) for parsing and exporting'],
]
stack.forEach(([k, v]) => {
  doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK).text(`${k}: `, { continued: true })
  doc.font('Helvetica').fillColor(GRAY).text(v)
})
doc.moveDown(0.5)

divider()
h2('User Accounts')
bullet([
  'Owner — username: pavan  |  password: pavan.9000  (can upload, extract, delete, manage budgets)',
  'Viewer — username: viewer  |  password: view.001  (read-only: view files and analytics)',
])

doc.addPage()

// ── PAGE 3: Next.js ───────────────────────────────────────────────────────────
sectionHeader('2. Next.js 15 — App Router & API Routes', 'Source: context7.com/vercel/next.js')

h2('App Router Architecture')
body('Chantabbai FileDrop uses Next.js 15 App Router. All pages are under app/ directory. Server-side API routes use the Route Handler pattern (route.ts files) with the service role key to bypass Supabase RLS.')

h3('Environment Variables (from Context7 docs)')
body('Next.js automatically loads .env.local into process.env. Variables prefixed with NEXT_PUBLIC_ are exposed to the browser; others are server-only.')
code(`.env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # SERVER ONLY - never expose to browser
GROQ_API_KEY=gsk_...               # SERVER ONLY`)

h3('API Route Handler Pattern (Context7)')
code(`// app/api/upload/route.ts
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  // ... process with service role key
  return NextResponse.json({ success: true })
}`)

h2('Key API Routes in this Project')
const routes = [
  ['GET /api/files', 'Fetch all files (service role, bypasses RLS)'],
  ['POST /api/upload', 'Upload file + insert DB record (service role)'],
  ['GET /api/signed-url', 'Generate signed storage URL (service role)'],
  ['GET/POST/DELETE /api/bills', 'Manual expense CRUD (service role)'],
  ['POST /api/extract', 'AI extraction from image/PDF (Groq LLaMA 4)'],
  ['POST /api/extract-all', 'Batch extraction → Excel download'],
]
routes.forEach(([route, desc]) => {
  doc.fontSize(10).font('Courier').fillColor(BLUE).text(route, { continued: true })
  doc.font('Helvetica').fillColor(GRAY).text(`  →  ${desc}`)
})
doc.moveDown(0.5)

h2('Why All Routes Use Service Role Key')
body('Supabase Row Level Security (RLS) blocks browser clients from reading/writing other users\' data. By routing all DB and storage operations through Next.js API routes with the service role key, we bypass RLS entirely and ensure all users can view all files and analytics.')

code(`// Pattern used in all API routes
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // bypasses RLS
  { auth: { autoRefreshToken: false, persistSession: false } }
)`)

doc.addPage()

// ── PAGE 4: Supabase ──────────────────────────────────────────────────────────
sectionHeader('3. Supabase — Auth, Storage & Database', 'Source: context7.com/supabase/supabase')

h2('Storage — File Upload (Context7 Docs)')
body('Files are uploaded to the "files" bucket using the service role admin client. This bypasses storage RLS policies that would otherwise block anonymous uploads.')
code(`// Upload file to Supabase Storage (service role)
const { error } = await admin.storage
  .from('files')
  .upload(storagePath, arrayBuffer, {
    contentType: mimeType,
    upsert: false,
  })`)

h2('Signed URLs for File Access (Context7 Docs)')
body('Signed URLs allow temporary, authenticated access to private storage files without exposing credentials. Valid for 1 hour in this project.')
code(`// Generate signed URL (via /api/signed-url route)
const { data } = await admin.storage
  .from('files')
  .createSignedUrl(storagePath, 3600)  // 3600 seconds = 1 hour
return NextResponse.json({ url: data.signedUrl })`)

h2('Database Operations')
body('All database reads/writes use the admin client with the service role key to bypass RLS.')
code(`// Fetch all files (bypasses RLS)
const { data: files } = await admin
  .from('file_metadata')
  .select('*')
  .order('uploaded_at', { ascending: false })

// Insert file record
const { data, error } = await admin
  .from('file_metadata')
  .insert({ user_id, name, original_name, size, mime_type,
            storage_path, checksum, tags })
  .select().single()`)

h2('Internal Auth Users')
body('Since we use localStorage-based auth (not Supabase Auth), but file_metadata has a FK to auth.users, we create internal placeholder users via the admin API on first upload.')
code(`// Create internal Supabase auth user to satisfy FK constraint
const { data: created } = await admin.auth.admin.createUser({
  email: 'pavan@chantabbai.internal',
  password: 'chantabbai_internal_9000',
  email_confirm: true,
})
// Cache the real UUID and use it for all DB inserts`)

h2('Database Tables')
bullet([
  'file_metadata — stores file info (name, size, mime_type, storage_path, checksum, tags, category, vendor_name, bill_amount, bill_date)',
  'manual_bills — Excel-imported expense entries (description, category, vendor_name, bill_amount, bill_date)',
  'profiles — user profile info (id, username)',
  'budget_settings — monthly budget limits per category',
])

doc.addPage()

// ── PAGE 5: Tailwind CSS ──────────────────────────────────────────────────────
sectionHeader('4. Tailwind CSS — Responsive Design', 'Source: context7.com/tailwindlabs/tailwindcss.com')

h2('Mobile-First Design (Context7 Docs)')
body('Tailwind uses a mobile-first approach: unprefixed utilities apply to all screen sizes, and breakpoint prefixes (sm:, md:, lg:) apply at larger sizes.')
code(`<!-- Mobile-first responsive design -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
  <div>Responsive grid item</div>
</div>

<!-- Responsive text sizing -->
<h1 class="text-base sm:text-xl lg:text-2xl font-bold">Heading</h1>

<!-- Responsive padding -->
<main class="px-3 py-4 sm:px-4 sm:py-8">Content</main>`)

h2('Breakpoints Used in This Project')
const breakpoints = [
  ['(default)', 'Mobile — all base styles, < 640px'],
  ['sm:', '≥ 640px — tablets, show text labels in nav'],
  ['lg:', '≥ 1024px — desktop, 2-column chart layout'],
]
breakpoints.forEach(([bp, desc]) => {
  doc.fontSize(10).font('Courier').fillColor(BLUE).text(bp, { continued: true })
  doc.font('Helvetica').fillColor(DARK).text(`  ${desc}`)
})
doc.moveDown(0.5)

h2('Responsive Header Pattern (This Project)')
body('Desktop (sm+): single flex row — Logo | Nav | User. Mobile: two rows — Logo+SignOut on top, centered pill nav below.')
code(`{/* Desktop header — single row */}
<div class="hidden sm:flex items-center gap-4">
  <Logo />
  <nav class="flex gap-1 ml-6"> ... </nav>
  <div class="ml-auto"> Sign Out </div>
</div>

{/* Mobile header — 2 rows */}
<div class="sm:hidden">
  <div class="flex justify-between"> Logo + Sign Out </div>
  <div class="flex justify-center">
    <nav class="bg-gray-100 rounded-2xl p-1"> ... </nav>
  </div>
</div>`)

h2('Key Utility Classes Used')
const utilities = [
  'flex, grid, gap-* — layout',
  'hidden sm:block, hidden sm:flex — responsive show/hide',
  'truncate, whitespace-nowrap — text overflow',
  'rounded-2xl, shadow-sm — card styling',
  'animate-spin, animate-fade-in — animations',
  'bg-gray-100, border-gray-200 — neutral tones',
]
bullet(utilities)

doc.addPage()

// ── PAGE 6: Playwright ────────────────────────────────────────────────────────
sectionHeader('5. Playwright — Automated Testing', 'Source: context7.com/microsoft/playwright')

h2('Test Configuration')
code(`// playwright.config.ts
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    headless: false,          // shows browser window
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})`)

h2('Test Results — All 13 Passing ✅')
const tests = [
  ['✅', 'login page loads correctly', '2.2s'],
  ['✅', 'wrong password shows error', '1.9s'],
  ['✅', 'owner (pavan) can login and sees nav tabs', '3.0s'],
  ['✅', 'owner default view is Upload', '3.0s'],
  ['✅', 'viewer can login — no Upload tab, lands on Files', '3.2s'],
  ['✅', 'owner can switch between all tabs', '5.1s'],
  ['✅', 'files view shows stats bar', '3.7s'],
  ['✅', 'view mode switcher toggles views', '5.8s'],
  ['✅', 'analytics tab loads correctly', '4.8s'],
  ['✅', 'month selector is visible', '5.7s'],
  ['✅', 'sign out returns to login page', '3.9s'],
  ['✅', 'mobile: login page renders correctly', '1.6s'],
  ['✅', 'mobile: all nav buttons visible after login', '2.9s'],
]
tests.forEach(([status, name, time]) => {
  doc.fontSize(9.5).font('Helvetica').fillColor(GREEN).text(`${status} `, { continued: true })
  doc.fillColor(DARK).text(`${name}  `, { continued: true })
  doc.fillColor(GRAY).text(time)
})
doc.moveDown(0.5)

doc.fontSize(11).font('Helvetica-Bold').fillColor(GREEN)
  .text('13 passed in 49.5s  |  0 failed  |  Browser: Chromium')
doc.moveDown(0.8)

h2('Locator Patterns Used (Context7 Docs)')
code(`// Role-based locators (recommended by Playwright docs)
page.getByRole('button', { name: /Files/ }).first()
page.getByRole('heading', { name: 'Upload Files' })
page.getByTitle('Grid')

// Form interactions
page.fill('input[placeholder="Enter username"]', 'pavan')
page.click('button[type="submit"]')

// Assertions
await expect(page).toHaveURL('/')
await expect(locator).toBeVisible({ timeout: 10000 })
await expect(locator).not.toBeVisible()
await expect(locator).toContainText('Sign In')`)

h2('Mobile Testing')
code(`// Test on iPhone 14 viewport
await page.setViewportSize({ width: 390, height: 844 })
await page.goto('/')
await expect(page.locator('h1')).toBeVisible()`)

doc.addPage()

// ── PAGE 7: Architecture ──────────────────────────────────────────────────────
sectionHeader('6. Architecture & Key Decisions')

h2('Data Flow — File Upload')
const uploadFlow = [
  '1. User selects file → browser computes SHA-256 checksum',
  '2. POST /api/upload with FormData (file + username + checksum)',
  '3. Server checks duplicate by checksum (admin client)',
  '4. Server resolves username → real Supabase auth UUID (creates if needed)',
  '5. File uploaded to storage bucket "files" via admin client',
  '6. DB record inserted into file_metadata with real user_id',
  '7. Client refreshes file list via GET /api/files',
]
uploadFlow.forEach(step => {
  doc.fontSize(10).font('Helvetica').fillColor(DARK).text(step, { lineGap: 2 })
})
doc.moveDown(0.6)

h2('Data Flow — AI Extraction')
const extractFlow = [
  '1. Owner clicks "Extract" on a file card',
  '2. GET /api/signed-url → 1-hour signed URL for the file',
  '3. POST /api/extract with { fileUrl, mimeType, fileName, fileId }',
  '4. Server fetches file, sends to Groq LLaMA 4 as base64 image',
  '5. AI returns JSON: { vendor, date, amount, category, bill_type, raw_text }',
  '6. Server updates file_metadata record (admin client, bypasses RLS)',
  '7. Excel download generated with extracted data',
]
extractFlow.forEach(step => {
  doc.fontSize(10).font('Helvetica').fillColor(DARK).text(step, { lineGap: 2 })
})
doc.moveDown(0.6)

h2('Category Detection Logic')
body('Two-layer detection: AI (LLaMA 4) returns a category from the image. If AI fails, regex-based detectRestaurantCategory() runs on extracted text.')
const cats = [
  'Dairy & Eggs — Milk, Curd, Paneer, Butter, Ghee, Cheese',
  'Meat & Seafood — Chicken, Mutton, Fish, Prawn',
  'Vegetables & Fruits — Onion, Tomato, Potato, Vegetables',
  'Rice & Grains — Rice, Wheat, Flour, Dal, Pulses',
  'Gas / LPG — LPG, Gas cylinder, HP Gas, Indane',
  'Fuel & Transport — Petrol, Diesel, HPCL, BPCL',
  'Staff Salary — Salary, Wages, Payslip (not vendor names)',
  'Electricity, Water, Rent — Utility bills',
]
bullet(cats)

doc.addPage()

// ── PAGE 8: Env Vars & Testing Summary ───────────────────────────────────────
sectionHeader('7. Environment Variables Reference')

h2('Required in .env.local')
const envVars = [
  ['NEXT_PUBLIC_SUPABASE_URL', 'Your Supabase project URL', 'Public (browser safe)'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Supabase anon/public key', 'Public (browser safe)'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'Service role key — bypasses RLS', '⚠ SERVER ONLY'],
  ['GROQ_API_KEY', 'Groq API key for LLaMA 4 extraction', '⚠ SERVER ONLY'],
]

envVars.forEach(([key, desc, note]) => {
  doc.fontSize(9).font('Courier').fillColor(BLUE).text(key)
  doc.fontSize(9).font('Helvetica').fillColor(DARK).text(`  ${desc}  `, { continued: true })
  const isWarning = note.includes('⚠')
  doc.fillColor(isWarning ? '#DC2626' : GREEN).text(note)
  doc.moveDown(0.3)
})

divider()
sectionHeader('8. Test Coverage Summary')

h2('Coverage Areas')
bullet([
  'Authentication — correct/wrong credentials, session storage',
  'Role-based access — owner vs viewer tab visibility',
  'Navigation — tab switching, default views',
  'File management — stats bar, view modes (Grid/List/Timeline)',
  'Analytics — header, buttons, month selector',
  'Sign out — session clear, redirect',
  'Mobile responsive — 390×844 viewport (iPhone 14)',
])

h2('Running Tests')
code(`# Make sure dev server is running first
npm run dev

# Run all tests (opens browser)
npx playwright test

# Run in headless mode
npx playwright test --headless

# Run specific test
npx playwright test -g "login page"

# Show test report
npx playwright show-report`)

h2('Adding New Tests')
code(`// tests/app.spec.ts — add test at the bottom
test('my new test', async ({ page }) => {
  await loginAs(page, 'pavan', 'pavan.9000')
  await page.getByRole('button', { name: /Files/ }).first().click()
  await expect(page.locator('text=Storage Used')).toBeVisible()
})`)

// ── Footer on last page ───────────────────────────────────────────────────────
doc.moveDown(2)
doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(RED).lineWidth(1).stroke()
doc.moveDown(0.5)
doc.fontSize(9).font('Helvetica').fillColor(GRAY)
  .text('Chantabbai FileDrop — Technical Documentation', { align: 'center' })
doc.text('Generated using Context7 live documentation | Next.js · Supabase · Tailwind CSS · Playwright', { align: 'center' })
doc.fontSize(8).fillColor('#9CA3AF')
  .text(`© ${new Date().getFullYear()} Chantabbai Restaurant`, { align: 'center' })

doc.end()
console.log('PDF generated:', outPath)
