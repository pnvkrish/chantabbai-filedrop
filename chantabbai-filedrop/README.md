# Chantabbai FileDrop

A production-grade AI-powered file manager built with Next.js 15 and Supabase. Upload, manage, preview, and extract structured data from documents — with Claude AI summarisation built in.

---

## Project Overview

Chantabbai FileDrop is a full-stack web application that lets authenticated users upload files, organise them with tags and filters, preview content in-browser, and extract structured data from documents (PDFs, Word files, images) into downloadable Excel reports. An AI layer (Claude Sonnet) summarises documents on demand.

---

## Objectives

- Provide a secure, per-user file storage system backed by Supabase Storage.
- Enable intelligent document analysis: OCR on images, text extraction from PDFs/DOCX, and AI summarisation.
- Export structured data (key-value fields, tables, numbers) from any supported document to Excel.
- Deliver a clean, responsive UI with multiple view modes and advanced filtering.

---

## Key Features

| Feature | Detail |
|---|---|
| Auth | Email + password via Supabase Auth; session persisted via SSR cookies; middleware-level route protection |
| Upload | Drag & drop or file picker; SHA-256 duplicate detection; 3-concurrent upload queue; per-file progress; 3× exponential-backoff retry |
| File types | PNG, JPEG, HEIC, PDF, DOC, DOCX, XLS, XLSX (1 KB – 30 MB) |
| View modes | Grid / List / Timeline |
| Preview | In-browser image viewer (zoom/pan/rotate), PDF iframe, Office download prompt |
| Search & Filter | Debounced text search, category tabs, tag filter, date range, size range, starred toggle, sort by any field, saveable filter presets |
| AI Summarise | Claude Sonnet 4.6 reads PDFs/DOCX and returns 3–5 bullet-point summaries |
| Data Extraction | Extracts key-value pairs, tables, and numeric fields from documents/images to `.xlsx` |
| Batch Extract | "Extract All" button processes every visible file and downloads a multi-sheet Excel workbook |
| OCR | Tesseract.js (English) for PNG/JPEG/HEIC images — runs server-side (single file) or client-side (batch) |
| Tags | Auto-tagged on upload (type, size, month); user-editable in preview modal |
| Starring | Star/unstar files for quick filtering |
| Share | Generates time-limited signed URLs (default 1 hour), copied to clipboard |
| Stats bar | Total files, total storage used, breakdown by category |
| Delete | Password-confirmation modal before permanent deletion |
| Toast notifications | Success / error / warning feedback across all actions |

---

## Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 15.3 (App Router, React 19) |
| Language | TypeScript 5.7 (strict mode) |
| Styling | Tailwind CSS v4 |
| State | Custom `useFileManager` hook (no Redux/Zustand) |

### Backend (Next.js API Routes)
| Route | Purpose |
|---|---|
| `POST /api/extract` | Extract structured data from a single file (PDF/DOCX/DOC/image) |
| `POST /api/extract-all` | Batch extract from multiple files with a shared Tesseract worker |
| `POST /api/summarise` | AI document summarisation via Claude Sonnet 4.6 |

### Database & Storage
| Service | Role |
|---|---|
| Supabase PostgreSQL | `file_metadata` table — stores file info, tags, checksums, counters |
| Supabase Storage | Private `files` bucket — per-user folder isolation |
| Supabase Auth | JWT-based email/password authentication |
| Row Level Security | Users can only access their own rows and storage objects |

### Libraries & Tools
| Library | Purpose |
|---|---|
| `@anthropic-ai/sdk` | Claude AI API client for document summarisation |
| `@supabase/ssr` | Server-side Supabase client with cookie-based session management |
| `pdf-parse` | Server-side PDF text extraction |
| `mammoth` | Server-side DOCX/DOC text extraction |
| `tesseract.js` | OCR engine for image-to-text |
| `xlsx` | Build and write Excel workbooks client-side |
| `crypto` (Node built-in) | SHA-256 checksum for duplicate detection |

---

## System Architecture

```
Browser (React / Next.js Client Components)
  │
  ├── useFileManager hook  ─── lib/storage.ts (upload, signed URLs)
  │                        ─── lib/database.ts (CRUD queries)
  │                        ─── lib/search.ts (filter, sort, presets)
  │
  ├── /api/extract         ─── pdf-parse / mammoth / tesseract.js
  ├── /api/extract-all     ─── same, shared Tesseract worker
  └── /api/summarise       ─── Anthropic Claude Sonnet 4.6
              │
              └── Supabase
                    ├── Auth (JWT + cookies via @supabase/ssr)
                    ├── PostgreSQL  →  file_metadata table (RLS)
                    └── Storage     →  files bucket (RLS)
```

**Authentication flow:** Next.js middleware (`middleware.ts`) reads the Supabase session on every request. Unauthenticated requests to `/dashboard/*` are redirected to `/`. Authenticated requests to `/` are redirected to `/dashboard`.

---

## Setup & Installation

### 1. Clone & Install

```bash
git clone <repo-url>
cd chantabbai-filedrop
npm install
```

### 2. Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Get Supabase credentials from your [Supabase dashboard](https://supabase.com/dashboard) → Project Settings → API.
Get the Anthropic API key from [console.anthropic.com](https://console.anthropic.com).

### 3. Supabase Database Setup

Run in the Supabase SQL Editor:

```sql
-- Table
CREATE TABLE file_metadata (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  original_name  TEXT        NOT NULL,
  size           BIGINT      NOT NULL,
  mime_type      TEXT        NOT NULL,
  extension      TEXT        NOT NULL,
  storage_path   TEXT        NOT NULL,
  checksum       TEXT        NOT NULL,
  tags           TEXT[]      DEFAULT '{}',
  is_starred     BOOLEAN     DEFAULT false,
  download_count INTEGER     DEFAULT 0,
  uploaded_at    TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own files"
  ON file_metadata FOR ALL
  USING (auth.uid() = user_id);

-- Atomic download counter
CREATE OR REPLACE FUNCTION increment_download_count(file_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE file_metadata SET download_count = download_count + 1 WHERE id = file_id;
END;
$$;
```

### 4. Supabase Storage Bucket

1. Go to **Storage** → **New bucket**
2. Name: `files`, keep **Public bucket** OFF
3. Add RLS policies:

```sql
CREATE POLICY "Users upload own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 5. Run

```bash
npm run dev        # http://localhost:3000
npm run build      # production build → .next/
npm run start      # run production build
```

---

## Usage Instructions

1. **Sign up / Log in** — create an account on the landing page.
2. **Upload** — drag files onto the upload zone or click to browse. Supported: PNG, JPEG, HEIC, PDF, DOC, DOCX, XLS, XLSX (1 KB–30 MB).
3. **My Files** — switch to the files view to browse your uploads.
   - Use the **filter bar** to search by name, category, tag, date, or size.
   - Toggle **Grid / List / Timeline** view modes.
   - **Star** files for quick access.
   - **Share** — generates a 1-hour signed URL, copied to clipboard.
   - **Preview** — images open with zoom/pan/rotate; PDFs open inline.
   - **Summarise** — in the preview modal, click Summarise to get an AI summary (PDFs & DOCX only).
   - **Extract** — downloads an Excel file with structured data extracted from the document.
   - **Extract All** — processes all visible (filtered) files and downloads a multi-sheet workbook.
   - **Delete** — requires password confirmation.

---

## Folder Structure

```
chantabbai-filedrop/
├── app/
│   ├── api/
│   │   ├── extract/route.ts        # Single-file text extraction
│   │   ├── extract-all/route.ts    # Batch extraction
│   │   └── summarise/route.ts      # Claude AI summarisation
│   ├── dashboard/
│   │   └── page.tsx                # Protected dashboard (server component)
│   ├── globals.css                 # Global styles + Tailwind directives
│   ├── layout.tsx                  # Root layout (fonts, metadata)
│   └── page.tsx                    # Auth page (login/signup)
├── components/
│   ├── AuthForm.tsx                # Login / signup form
│   ├── Dashboard.tsx               # Main app shell, nav, view routing
│   ├── FileGrid.tsx                # Grid / List / Timeline renderers
│   ├── FilterBar.tsx               # Search, filter, sort, presets UI
│   ├── Logo.tsx                    # Brand logo
│   ├── PasswordModal.tsx           # Confirmation modal for delete
│   ├── PreviewModal.tsx            # File preview + summarise + tag edit
│   ├── StatsBar.tsx                # Storage usage stats
│   ├── SummaryPanel.tsx            # AI summary display panel
│   ├── Toast.tsx                   # Toast notification system
│   └── UploadZone.tsx              # Drag & drop upload area
├── hooks/
│   └── useFileManager.ts           # Central state & all action handlers
├── lib/
│   ├── database.ts                 # Supabase DB queries (CRUD)
│   ├── extractToExcel.ts           # Excel generation + client-side OCR
│   ├── search.ts                   # Filter, sort, localStorage presets
│   ├── storage.ts                  # Upload engine, signed URLs, validation
│   ├── types.ts                    # Enums, interfaces, Result<T,E>, helpers
│   └── supabase/
│       ├── client.ts               # Browser Supabase client singleton
│       ├── server.ts               # Server Supabase client (SSR cookies)
│       └── types.ts                # Generated Supabase DB types
├── middleware.ts                   # Auth route protection
├── next.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

---

## API Endpoints

### `POST /api/extract`
Extracts structured data from a single file.

**Request body:**
```json
{ "fileUrl": "string", "mimeType": "string", "fileName": "string" }
```

**Response:**
```json
{
  "extracted": {
    "title": "string",
    "keyValues": [["Field", "Value"]],
    "tableData": [["col1", "col2"]],
    "rawLines": ["string"],
    "summary_numbers": [{ "label": "string", "value": "string", "unit": "string" }]
  }
}
```

**Supported MIME types:** `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/png`, `image/jpeg`, `image/heic`, `image/heif`

---

### `POST /api/extract-all`
Batch extracts structured data from multiple files using a shared Tesseract worker.

**Request body:**
```json
{ "files": [{ "fileUrl": "string", "mimeType": "string", "fileName": "string" }] }
```

**Response:**
```json
{ "results": [{ "fileName": "string", "keyValues": [], "tableData": [], "rawLines": [], "summary_numbers": [], "error": "string|undefined" }] }
```

---

### `POST /api/summarise`
Sends a PDF or DOCX to Claude Sonnet 4.6 and returns a bullet-point summary.

**Request body:**
```json
{ "fileUrl": "string", "mimeType": "string" }
```

**Response:**
```json
{ "summary": "• Point 1\n• Point 2\n..." }
```

---

## UI Description

- **Auth page** — centered card with email/password fields, toggle between login and signup.
- **Dashboard header** — sticky top bar with logo, Upload / My Files nav buttons, user email, and Sign Out.
- **Upload view** — large drag-and-drop zone; queued files show type icon, name, size, progress bar, and status badge. Extract button downloads queued files as Excel before or after upload.
- **Files view** — stats bar → filter bar → view mode switcher → file grid/list/timeline. Each file card shows thumbnail/icon, name, size, tags, and action buttons (preview, download, share, star, extract, delete).
- **Preview modal** — full-screen overlay with prev/next navigation, zoom/pan/rotate for images, PDF iframe, tag editor, star toggle, and an AI Summarise button that streams bullet points into a side panel.

---

## Testing Approach

No automated test suite is currently in place. Manual testing covers:

- Auth: sign up, log in, session persistence across page reloads, middleware redirects.
- Upload: single/multi file, duplicates (same SHA-256 skipped), oversized/disallowed type rejection, retry on failure.
- File actions: preview, download (signed URL), share (clipboard), star, tag edit, delete (with modal).
- Extraction: PDF, DOCX, image OCR — verify Excel output contains expected key-value rows.
- AI summarise: PDF summary rendered correctly; unsupported types return `unsupported: true` gracefully.
- Filter/sort: all combinations of search, category, tag, date range, star, sort field/direction.

---

## Deployment Process

The app is a standard Next.js project and deploys to any Node.js host.

**Vercel (recommended):**
1. Push to GitHub.
2. Import the repo in Vercel.
3. Set environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`.
4. Deploy — Vercel auto-detects Next.js and runs `npm run build`.

**Self-hosted:**
```bash
npm run build
npm run start   # runs on port 3000
```

---

## Future Improvements

- **Realtime sync** — Supabase Realtime subscriptions so file changes appear instantly across browser tabs.
- **Folder / collections** — group files into named folders.
- **XLSX/XLS preview** — render spreadsheet data in a table inside the preview modal.
- **Bulk delete / tag edit** — multi-select actions on the file grid.
- **AI chat with file** — ask freeform questions about a document using Claude.
- **Automated tests** — Playwright E2E tests for upload, auth, and extraction flows.
- **Rate limiting** — protect `/api/summarise` and `/api/extract` from abuse.
- **Offline support** — PWA with service worker for offline file browsing.
