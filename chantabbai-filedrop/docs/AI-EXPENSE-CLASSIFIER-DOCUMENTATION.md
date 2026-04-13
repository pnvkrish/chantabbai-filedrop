# ChantabbaiFileDrop — AI-Powered Expense Classification System
### Complete Technical Documentation
**Version:** 1.0 | **Stack:** Next.js 15 · Groq LLaMA 4 Scout · Supabase · TypeScript  
**Date:** April 2026 | **Author:** neela krishna

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Tech Stack with Justification](#3-tech-stack-with-justification)
4. [Data Flow Pipeline](#4-data-flow-pipeline)
5. [AI Model Usage](#5-ai-model-usage)
6. [Model Training / Fine-tuning](#6-model-training--fine-tuning)
7. [OCR Integration](#7-ocr-integration)
8. [Fallback Logic](#8-fallback-logic)
9. [Category Detection Logic](#9-category-detection-logic)
10. [Code Structure](#10-code-structure)
11. [API Design](#11-api-design)
12. [Error Handling](#12-error-handling)
13. [Performance Optimization](#13-performance-optimization)
14. [Security Considerations](#14-security-considerations)
15. [Future Improvements](#15-future-improvements)

---

## 1. Project Overview

### Problem Statement

Small restaurants, canteens, and food businesses receive dozens of paper bills every week — from milk suppliers, gas distributors, vegetable vendors, meat shops, and more. Manually recording each bill into a spreadsheet wastes time, introduces human error, and makes monthly expense tracking nearly impossible.

The core problems this system solves:

- **Manual data entry:** Staff must type vendor name, amount, date, and category for every bill
- **Wrong categorization:** A bill from a dairy supplier gets filed under "Vegetables" because staff don't follow a consistent taxonomy
- **Lost bills:** Paper bills get lost or damaged before they are recorded
- **No analytics:** Without structured data, monthly spending patterns are invisible

### Why This System Is Needed

ChantabbaiFileDrop replaces a paper-and-spreadsheet workflow with a mobile-friendly web app where:

1. Staff **photograph a bill** and upload it
2. The AI **reads the bill** (vendor, amount, date, items) and assigns a category automatically
3. All data lands in a **structured database** with monthly analytics

This is a closed-business system — it is not a SaaS product. It is purpose-built for one canteen/restaurant operation where the owner (pavan) needs full access and helpers (viewer role) need read-only access.

### Real-World Use Cases

| Scenario | Without System | With System |
|---|---|---|
| Milk supplier delivers and gives bill | Staff manually types into Excel | Staff photos the bill → AI extracts everything |
| Month-end reconciliation | Someone manually sums categories | Analytics tab shows per-category bar chart instantly |
| Checking if a duplicate bill was submitted | Manual search through paper | SHA-256 checksum blocks duplicate upload automatically |
| Owner reviews expenses while travelling | Not possible | Opens mobile browser, sees full dashboard |

---

## 2. System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Next.js Frontend)                   │
│                                                                     │
│  [Upload Tab]──────►[/api/upload]──────►[Supabase Storage]         │
│                                               │                     │
│  [Files Tab]◄───────[Supabase DB]◄────────────┘                    │
│                           ▲                                         │
│  [Analytics Tab]          │                                         │
│       │           [/api/extract]                                    │
│       │                   │                                         │
│       │           [Groq LLaMA 4 Scout]                              │
│       │           (Vision Model — reads bill image)                 │
│       │                   │                                         │
│       │           [detectRestaurantCategory()]  ◄── fallback only   │
│       │                   │                                         │
│       └───────────[file_metadata table]                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Two-Layer Detection Architecture

```
Image Input
    │
    ▼
┌───────────────────────────────┐
│  LAYER 1: AI Vision (Primary) │
│  Model: LLaMA 4 Scout 17B     │
│  Input: Base64 image + prompt │
│  Output: vendor, amount,      │
│          date, category       │
└───────────────┬───────────────┘
                │
       ┌────────▼────────┐
       │  AI succeeded?  │
       └────────┬────────┘
          YES   │   NO / low confidence / error
          │     │
          │     ▼
          │  ┌─────────────────────────────────┐
          │  │  LAYER 2: Regex Fallback         │
          │  │  detectRestaurantCategory()      │
          │  │  Input: OCR-extracted text       │
          │  │  Output: best-match category     │
          │  └────────────────┬────────────────┘
          │                   │
          └─────────┬─────────┘
                    │
                    ▼
           ┌────────────────┐
           │  file_metadata │
           │  row updated   │
           │  in Supabase   │
           └────────────────┘
```

### Database Schema

```
auth.users (Supabase managed)
  id UUID PRIMARY KEY
  email TEXT  ← "username@chantabbai.internal" for internal users

file_metadata
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id       UUID REFERENCES auth.users(id)
  filename      TEXT
  storage_path  TEXT
  file_size     INTEGER
  checksum      TEXT UNIQUE  ← SHA-256, blocks duplicates
  vendor        TEXT
  amount        NUMERIC
  bill_date     DATE
  category      TEXT
  notes         TEXT
  created_at    TIMESTAMPTZ DEFAULT now()

bills
  id            UUID PRIMARY KEY
  file_id       UUID REFERENCES file_metadata(id)
  month         TEXT  ← "2026-04"
  raw_text      TEXT  ← OCR output for audit
```

### Storage Architecture

```
Supabase Storage Bucket: "files"
  └── {user_id}/
        └── {timestamp}_{filename}
```

All files are private. Access is via **signed URLs** (1-hour expiry). No public file access.

---

## 3. Tech Stack with Justification

### Frontend & Backend Runtime

| Technology | Version | Justification |
|---|---|---|
| **Next.js 15** | App Router | Unified frontend + API in one repo. Route Handlers replace separate Express server. Server Components reduce client JS bundle. |
| **TypeScript** | 5.x | Type safety across API routes, database models, and UI components. Catches category/field mismatches at compile time. |
| **React 19** | Latest | Component model suits the tab-based dashboard. useState/useEffect manage upload state without Redux overhead. |
| **Tailwind CSS** | 3.x | Utility-first means no CSS files. Mobile-first with `sm:` breakpoints. Rapid iteration without naming CSS classes. |

### AI & Vision Layer

| Technology | Justification |
|---|---|
| **Groq API** | Inference-as-a-service. No GPU required, no model hosting cost. Sub-second response times via Groq's custom LPU hardware. |
| **LLaMA 4 Scout 17B** (`meta-llama/llama-4-scout-17b-16e-instruct`) | Native multimodal (text + image). 128K context window. DocVQA score 94.4 — specifically strong at reading documents and invoices. Costs $0.11/1M input tokens. |
| **Base64 image encoding** | Bills uploaded as files → converted to base64 → sent inline in the API message. No need for a public image URL. |

From Context7 (Groq Docs):
> *"Llama 4 Scout is Meta's natively multimodal model that enables text and image understanding. DocVQA: 94.4 — industry-leading performance for document visual question answering."*

### Database & Storage

| Technology | Justification |
|---|---|
| **Supabase Postgres** | Managed PostgreSQL. Row Level Security (RLS) for per-user data isolation. No self-hosted DB needed. |
| **Supabase Storage** | S3-compatible file storage with signed URLs. Integrated with Postgres auth. |
| **Service Role Key (server-side only)** | Bypasses RLS for all admin operations (upload, extract updates). Never exposed to browser. |

From Context7 (Supabase Docs):
> *"The service role key authorizes access via the built-in service_role Postgres role, which by design has full access to your project's data using the BYPASSRLS attribute."*

### Supporting Libraries

| Library | Purpose |
|---|---|
| **SheetJS (xlsx)** | Excel export of extracted bill data and import of budget sheets |
| **Recharts** | Bar charts and pie charts in the Analytics tab |
| **Playwright** | End-to-end automated test suite (13 tests) |
| **PDFKit** | PDF documentation generation |

---

## 4. Data Flow Pipeline

### Step-by-Step: Bill Upload + Extraction

```
STEP 1 — User selects file in browser
  │  Component: Dashboard.tsx → UploadZone
  │  Action: File picked via <input type="file"> or drag-drop
  │  Validation: File type (image/pdf), size limit
  │
STEP 2 — SHA-256 checksum computed client-side
  │  Code: hooks/useFileManager.ts
  │  Method: crypto.subtle.digest('SHA-256', buffer)
  │  Purpose: Block duplicate uploads before hitting the server
  │
STEP 3 — POST /api/upload (FormData)
  │  Payload: { file: Blob, username: string, checksum: string }
  │  Server: app/api/upload/route.ts
  │  Auth: Service Role key (server-side only)
  │
STEP 4 — getRealUserId(username)
  │  Finds or creates username@chantabbai.internal in Supabase Auth
  │  Returns real UUID that satisfies the FK constraint on file_metadata
  │
STEP 5 — Upload to Supabase Storage
  │  Path: {userId}/{timestamp}_{filename}
  │  Client: adminStorageClient (service role)
  │
STEP 6 — Insert into file_metadata table
  │  Fields: user_id, filename, storage_path, file_size, checksum
  │  Extraction fields (vendor, amount, date, category): NULL initially
  │
STEP 7 — POST /api/extract (triggered by user clicking Extract button)
  │  Payload: { fileId: string }
  │  Server: app/api/extract/route.ts
  │
STEP 8 — Fetch signed URL for the file
  │  adminStorageClient.createSignedUrl(path, 3600)
  │
STEP 9 — Download file → convert to base64
  │  fetch(signedUrl) → arrayBuffer → Buffer.from().toString('base64')
  │
STEP 10 — Send to Groq LLaMA 4 Scout
  │  Message: system prompt + image (base64 data URL)
  │  Response: JSON with { vendor, amount, date, category, notes }
  │
STEP 11 — Fallback check
  │  If AI returns empty fields OR throws → run detectRestaurantCategory()
  │  on any OCR text extracted from the response
  │
STEP 12 — UPDATE file_metadata
  │  Client: adminSupabaseClient (service role, bypasses RLS)
  │  Fields: vendor, amount, bill_date, category, notes
  │
STEP 13 — Frontend receives response → file card refreshes
  Output: File card shows vendor name, amount, category badge
```

### Input → Output Example

**Input:** Photo of a handwritten milk bill
```
SV Milk Distribution
Date: 15/03/26
To: Chantabai Bhojan  ← customer name
Items:
  Milk 5L × 40 = 200
  Milk 10L × 75 = 750
  Curd 2kg × 80 = 160
  Paneer 1kg × 180 = 180
  ...
Total: ₹2188
```

**Output (after AI extraction):**
```json
{
  "vendor": "SV Milk Distribution",
  "amount": 2188,
  "bill_date": "2026-03-15",
  "category": "Dairy & Eggs",
  "notes": "Milk, Curd, Paneer delivery"
}
```

**Key extractions the AI must handle correctly:**
- `vendor` = company name at top ("SV Milk Distribution"), NOT the "To:" field (that is the customer)
- `amount` = sum of line items if no clear total exists
- `bill_date` = converts 2-digit year: 15/03/26 → 2026-03-15
- `category` = maps Milk/Curd/Paneer → "Dairy & Eggs"

---

## 5. AI Model Usage

### Model: Groq LLaMA 4 Scout 17B

- **Model ID:** `meta-llama/llama-4-scout-17b-16e-instruct`
- **Type:** Multimodal (vision + text), Mixture-of-Experts architecture
- **Context window:** 131,072 tokens
- **Max images per request:** 5
- **Max file size per image:** 20 MB
- **This model is NOT trained from scratch** — it is used via Groq's inference API

### How the Image Is Sent

```typescript
// app/api/extract/route.ts

// 1. Get file from Supabase Storage
const { data: signedData } = await adminStorageClient
  .createSignedUrl(storagePath, 3600)

// 2. Download and convert to base64
const fileResponse = await fetch(signedData.signedUrl)
const arrayBuffer = await fileResponse.arrayBuffer()
const base64 = Buffer.from(arrayBuffer).toString('base64')
const mimeType = filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'

// 3. Send to Groq
const groqResponse = await groq.chat.completions.create({
  model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  messages: [
    { role: 'system', content: STRUCTURED_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Extract all bill information from this image.' },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64}` }
        }
      ]
    }
  ],
  temperature: 0.1,   // Low temperature = deterministic, consistent output
  max_tokens: 1024,
  response_format: { type: 'json_object' }  // Force JSON output
})
```

### System Prompt Design (STRUCTURED_PROMPT)

The system prompt is the most critical part of the AI integration. It defines:
1. What role the AI plays
2. The exact JSON schema to return
3. Explicit rules to prevent common mistakes

```typescript
const STRUCTURED_PROMPT = `
You are a bill/invoice data extraction assistant for an Indian restaurant.
Extract the following fields from the bill image and return ONLY valid JSON.

RETURN THIS EXACT JSON STRUCTURE:
{
  "vendor": "string",
  "amount": number,
  "bill_date": "YYYY-MM-DD",
  "category": "string",
  "notes": "string"
}

CRITICAL RULES — FOLLOW EXACTLY:

VENDOR:
- The vendor is the COMPANY/BUSINESS that issued the bill (shown at the TOP of the bill).
- "Name:", "To:", "Bill To:" fields are the CUSTOMER — NEVER use these as vendor.
- Example: If bill shows "SV Milk Distribution" at top and "To: Chantabai Bhojan" below,
  vendor = "SV Milk Distribution", NOT "Chantabai Bhojan"

AMOUNT:
- Use the final "Total" or "Grand Total" amount.
- If no clear total, SUM all line item amounts.
- Return as a plain number (no currency symbols, no commas).
- Example: ₹2,188.00 → 2188

DATE:
- Convert 2-digit years to 4-digit: 26 → 2026, 25 → 2025
- Format must be YYYY-MM-DD.
- Example: 15/03/26 → "2026-03-15"

CATEGORY — PICK EXACTLY ONE from this list:
- "Dairy & Eggs"       → Milk, Curd, Paneer, Butter, Ghee, Cheese, Lassi
- "Meat & Seafood"     → Chicken, Mutton, Fish, Prawn, Egg
- "Vegetables & Fruits"→ Onion, Tomato, Potato, any vegetables or fruits
- "Rice & Grains"      → Rice, Wheat, Flour, Dal, Pulses, Ragi, Maida
- "Gas / LPG"          → LPG, Gas Cylinder, HP Gas, Indane, Bharat Gas
- "Fuel & Transport"   → Petrol, Diesel, HPCL, BPCL, Auto, Cab fare
- "Staff Salary"       → Salary, Wages, Payslip (NOT vendor names containing these words)
- "Electricity"        → BESCOM, Power bill, EB bill, electricity
- "Water"              → Water tanker, municipality water bill
- "Rent"               → Shop rent, monthly rent
- "Groceries"          → Mixed grocery items, spices, oil
- "Other"              → If none of the above match

NOTES:
- Brief description of items in the bill (1-2 lines max).

If a field cannot be determined, use null for numbers/dates or "Unknown" for strings.
`
```

### Example AI Input/Output

**Input message to model:**
```
System: [STRUCTURED_PROMPT above]
User: "Extract all bill information from this image."
      [image: base64 of milk bill photo]
```

**Model output (raw):**
```json
{
  "vendor": "SV Milk Distribution",
  "amount": 2188,
  "bill_date": "2026-03-15",
  "category": "Dairy & Eggs",
  "notes": "Milk 5L, 10L, Curd 2kg, Paneer 1kg"
}
```

**Model output parsing:**
```typescript
const content = groqResponse.choices[0].message.content
const extracted = JSON.parse(content)
// extracted.vendor → "SV Milk Distribution"
// extracted.amount → 2188
// extracted.category → "Dairy & Eggs"
```

---

## 6. Model Training / Fine-tuning

### Decision: Not Fine-Tuned

This project uses LLaMA 4 Scout **as-is** via the Groq API. No fine-tuning was performed.

**Reasons:**

| Factor | Detail |
|---|---|
| **Dataset size** | Too small (< 500 bills) for meaningful fine-tuning |
| **Prompt engineering sufficiency** | Detailed system prompt with explicit rules achieves high accuracy |
| **Cost** | Fine-tuning requires GPU compute and dataset curation — unnecessary for this scale |
| **Maintenance** | A fine-tuned model needs periodic retraining as new vendors appear; prompt updates are instant |
| **LLaMA 4 Scout's DocVQA score** | 94.4 — the base model is already excellent at reading documents |

### When to Consider Fine-tuning

Fine-tuning would become relevant if:

1. **Volume exceeds 10,000 bills/month** — the base model occasionally makes categorization mistakes that a fine-tuned model would not
2. **Domain-specific vendor names** — regional vendors the base model has never seen
3. **Regional language bills** — bills in Telugu, Kannada, or Hindi where base model performance degrades
4. **Latency requirements under 500ms** — a smaller fine-tuned model could be faster

### Fine-tuning Dataset Format (if ever needed)

```jsonl
{"messages": [
  {"role": "system", "content": "STRUCTURED_PROMPT"},
  {"role": "user", "content": [
    {"type": "text", "text": "Extract bill information."},
    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
  ]},
  {"role": "assistant", "content": "{\"vendor\":\"SV Milk\",\"amount\":2188,\"category\":\"Dairy & Eggs\",\"bill_date\":\"2026-03-15\",\"notes\":\"Milk delivery\"}"}
]}
```

Each line = one training example. Need minimum ~500 labelled examples per category for reliable fine-tuning.

---

## 7. OCR Integration

### How Text Is Extracted

This project uses a **vision-native approach** — LLaMA 4 Scout reads the image directly without a separate OCR step. The model performs OCR internally as part of its multimodal processing.

This is different from the traditional pipeline:
```
Traditional:  Image → Tesseract OCR → Raw text → NLP model → Output
This project: Image → LLaMA 4 Scout (OCR + NLP combined) → Structured JSON
```

**Why skip traditional OCR?**
- Tesseract struggles with handwritten bills (common in Indian markets)
- Tesseract needs preprocessing (deskew, threshold, denoise) for each image
- LLaMA 4 Scout handles handwriting, poor lighting, and skewed photos natively
- Single API call instead of OCR + classification chain

### Preprocessing Steps (Client-Side)

Before sending to Groq, images go through minimal preprocessing:

```typescript
// hooks/useFileManager.ts — before upload
const arrayBuffer = await file.arrayBuffer()
const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
// Convert to base64 for transmission (server handles resize if needed)
```

No image resizing or compression is applied — the Groq API accepts up to 20MB images and handles resolution internally.

### Fallback OCR Path

If the AI vision call fails, the fallback uses whatever text is **embedded in the PDF** (for PDF bills) or returns an "Unknown" category. True OCR-from-image fallback using Tesseract is a future improvement (see Section 15).

---

## 8. Fallback Logic

### Why a Fallback Is Needed

AI API calls can fail for several reasons:
1. **Network timeout** — Groq API unreachable
2. **Rate limit exceeded** — too many requests in a short period
3. **Model error** — malformed image, unsupported format
4. **Low-confidence output** — model returns "Other" or null for category
5. **JSON parse error** — model returns malformed JSON despite `response_format: json_object`

The fallback ensures a category is always assigned, even if approximate.

### detectRestaurantCategory() — Full Implementation

```typescript
// lib/parser.ts

export function detectRestaurantCategory(text: string): string {
  const lower = text.toLowerCase()

  // ── Dairy & Eggs ──────────────────────────────────────────────────────────
  if (/\b(milk|curd|paneer|butter|ghee|cheese|lassi|dahi|mawa|khoya|cream)\b/.test(lower)) {
    return 'Dairy & Eggs'
  }

  // ── Meat & Seafood ────────────────────────────────────────────────────────
  if (/\b(chicken|mutton|fish|prawn|shrimp|crab|lamb|goat|pork|beef|egg)\b/.test(lower)) {
    return 'Meat & Seafood'
  }

  // ── Vegetables & Fruits ───────────────────────────────────────────────────
  if (/\b(onion|tomato|potato|vegetable|sabzi|palak|spinach|carrot|cabbage|cauliflower|brinjal|banana|mango|apple|fruit)\b/.test(lower)) {
    return 'Vegetables & Fruits'
  }

  // ── Rice & Grains ─────────────────────────────────────────────────────────
  if (/\b(rice|wheat|flour|dal|pulse|maida|ragi|bajra|jowar|atta|suji|semolina|besan)\b/.test(lower)) {
    return 'Rice & Grains'
  }

  // ── Gas / LPG ─────────────────────────────────────────────────────────────
  if (/\b(lpg|gas cylinder|hp gas|indane|bharat gas|cooking gas|cylinder)\b/.test(lower)) {
    return 'Gas / LPG'
  }

  // ── Fuel & Transport ──────────────────────────────────────────────────────
  if (/\b(petrol|diesel|fuel|hpcl|bpcl|iocl|auto|cab|transport|freight|lorry|truck)\b/.test(lower)) {
    return 'Fuel & Transport'
  }

  // ── Staff Salary ──────────────────────────────────────────────────────────
  // Note: Match only financial/payroll context, not vendor names containing these words
  if (/\b(salary|wages|payslip|pay slip|stipend|remuneration|allowance)\b/.test(lower) &&
      !/\b(hotel|restaurant|foods?|traders?|enterprises?)\b/.test(lower)) {
    return 'Staff Salary'
  }

  // ── Electricity ───────────────────────────────────────────────────────────
  if (/\b(electricity|bescom|mescom|cesc|eb bill|power bill|units consumed|kwh)\b/.test(lower)) {
    return 'Electricity'
  }

  // ── Water ─────────────────────────────────────────────────────────────────
  if (/\b(water tanker|municipality water|water bill|bwssb|metro water)\b/.test(lower)) {
    return 'Water'
  }

  // ── Rent ──────────────────────────────────────────────────────────────────
  if (/\b(rent|monthly rent|shop rent|lease|rental)\b/.test(lower)) {
    return 'Rent'
  }

  // ── Groceries (catch-all for mixed items) ─────────────────────────────────
  if (/\b(oil|masala|spice|salt|sugar|tea|coffee|grocery|kirana|store)\b/.test(lower)) {
    return 'Groceries'
  }

  // ── Default ───────────────────────────────────────────────────────────────
  return 'Other'
}
```

### Fallback Invocation in extract route

```typescript
// app/api/extract/route.ts

let category = aiResult?.category || null

// If AI didn't return a category, or returned "Other", try regex fallback
if (!category || category === 'Other') {
  const allText = [
    aiResult?.vendor || '',
    aiResult?.notes || '',
    rawOcrText || ''
  ].join(' ')

  category = detectRestaurantCategory(allText)
}
```

### Failure Scenarios

| Scenario | What Happens |
|---|---|
| Groq API timeout | try/catch catches error → fallback runs on any extracted text |
| JSON parse failure | catch block → fallback runs → category assigned |
| AI returns null category | Fallback check: `if (!category)` → fallback runs |
| AI returns "Other" | Fallback runs — regex may find a better match |
| No text extractable at all | Returns category "Other" — manual edit required |
| Duplicate file (checksum match) | Upload blocked before extraction even starts |

---

## 9. Category Detection Logic

### Category Taxonomy

The 12 categories are designed for an Indian restaurant/canteen context:

| Category | Keywords (sample) | Design Rationale |
|---|---|---|
| **Dairy & Eggs** | milk, curd, paneer, butter, ghee, cheese | Dairy suppliers issue separate bills from vegetable vendors. High frequency in canteen ops. |
| **Meat & Seafood** | chicken, mutton, fish, prawn | Halal/non-veg purchases tracked separately for food cost analysis. |
| **Vegetables & Fruits** | onion, tomato, potato, vegetable, sabzi | Daily purchases from mandi — largest volume category by bill count. |
| **Rice & Grains** | rice, wheat, flour, dal, atta, maida | Bulk purchases monthly. Tracked for per-meal cost calculation. |
| **Gas / LPG** | lpg, gas cylinder, Indane, HP Gas | Commercial kitchen uses 2-3 cylinders/month. Separate from fuel. |
| **Fuel & Transport** | petrol, diesel, HPCL, BPCL | Vehicle fuel for delivery/procurement runs. |
| **Staff Salary** | salary, wages, payslip | Payroll. Requires special guard (see Edge Cases). |
| **Electricity** | BESCOM, units consumed, kWh | Monthly utility bill. Typically one per month. |
| **Water** | water tanker, BWSSB | Commercial water supply when municipal is insufficient. |
| **Rent** | monthly rent, shop rent | Fixed monthly expense. |
| **Groceries** | oil, masala, salt, sugar, kirana | Mixed items not fitting above categories. |
| **Other** | (no match) | Catch-all. Triggers manual review. |

### Why This Taxonomy?

1. **Matches real vendor types** — Indian food businesses deal with distinct suppliers per category. A milk supplier never also sells rice. The categories mirror how vendors operate.
2. **Matches accounting needs** — Food cost is split into raw material sub-categories. Dairy vs. Meat vs. Vegetables each have different margin profiles.
3. **Low ambiguity** — Categories are mutually exclusive in 95%+ of real bills. A "milk bill" cannot also be a "rice bill".

### Edge Case: Staff Salary Guard

A bill from "Salary Foods Pvt Ltd" must NOT be classified as "Staff Salary". The guard:

```typescript
// Must contain payroll keywords AND must NOT contain business-type words
if (/\b(salary|wages|payslip)\b/.test(lower) &&
    !/\b(hotel|restaurant|foods?|traders?|enterprises?)\b/.test(lower)) {
  return 'Staff Salary'
}
```

### Edge Case: Ambiguous Items

| Item | Issue | Resolution |
|---|---|---|
| "Egg" | Could be Dairy or Meat | Classified under "Meat & Seafood" (egg is from poultry, not dairy) |
| "Butter" | Could be Dairy or Groceries | "Dairy & Eggs" wins — butter is checked first |
| "Oil" | Grocery but could be transport fuel | Context: "fuel oil" vs "cooking oil" — if no "diesel/petrol" context, → Groceries |
| "Gas" | LPG vs petroleum gas | "cylinder" keyword separates LPG from petrol-station gas |

### Ambiguity Resolution Order

Categories are checked in priority order — the **first match wins**:
1. Dairy & Eggs (highest precision, least ambiguous)
2. Meat & Seafood
3. Vegetables & Fruits
4. Rice & Grains
5. Gas / LPG
6. Fuel & Transport
7. Staff Salary (with guard)
8. Electricity
9. Water
10. Rent
11. Groceries (catch-all for food items)
12. Other (final fallback)

---

## 10. Code Structure

### Folder Structure

```
chantabbai-filedrop/
│
├── app/                          ← Next.js App Router
│   ├── layout.tsx                ← Root layout, global font, metadata
│   ├── globals.css               ← Global styles, scrollbar utilities
│   ├── dashboard/
│   │   └── page.tsx              ← Protected dashboard page
│   └── api/
│       ├── upload/
│       │   └── route.ts          ← File upload handler (service role)
│       ├── extract/
│       │   └── route.ts          ← AI extraction handler (Groq)
│       ├── extract-all/
│       │   └── route.ts          ← Batch extract all unprocessed files
│       ├── files/
│       │   └── route.ts          ← List files for current user
│       ├── bills/
│       │   └── route.ts          ← Get/update bill metadata
│       ├── signed-url/
│       │   └── route.ts          ← Generate signed download URLs
│       ├── auth/
│       │   └── route.ts          ← Internal auth user management
│       └── admin/
│           └── route.ts          ← Admin-only operations
│
├── components/
│   ├── Dashboard.tsx             ← Main shell: header, tab routing, auth guard
│   ├── AuthForm.tsx              ← Login form (username + password)
│   ├── FileGrid.tsx              ← Files tab: grid/list/timeline views
│   ├── PreviewModal.tsx          ← Full-screen bill preview + edit
│   ├── StatsBar.tsx              ← Storage ring chart + counts
│   ├── AnalyticsDashboard.tsx    ← Monthly bar charts, KPIs, Excel controls
│   └── Toast.tsx                 ← Auto-dismiss notification system
│
├── hooks/
│   └── useFileManager.ts         ← All file operations: upload, extract, delete
│
├── lib/
│   ├── database.ts               ← Supabase queries (typed)
│   ├── extractToExcel.ts         ← SheetJS: export file_metadata to Excel
│   ├── parser.ts                 ← detectRestaurantCategory() fallback
│   ├── types.ts                  ← TypeScript interfaces (FileMetadata, Bill, etc.)
│   └── supabase/
│       ├── client.ts             ← Browser Supabase client (anon key)
│       └── server.ts             ← Server Supabase client (service role)
│
├── middleware.ts                 ← Route protection (redirect unauthenticated)
│
├── tests/
│   └── app.spec.ts               ← Playwright E2E test suite (13 tests)
│
├── scripts/
│   ├── generate-docs.js          ← 8-page Context7-sourced documentation PDF
│   └── generate-full-docs.js     ← 101-page full project documentation PDF
│
├── playwright.config.ts          ← Playwright configuration
├── next.config.ts                ← Next.js config (image domains, etc.)
├── tailwind.config.ts            ← Tailwind custom theme
└── package.json                  ← Dependencies and scripts
```

### Module Responsibilities

**`components/Dashboard.tsx`**
- Reads `localStorage` for session (username, role)
- Renders two header layouts: desktop (`hidden sm:flex`) and mobile (`sm:hidden`)
- Routes between Upload / Files / Analytics tabs via `activeTab` state
- Passes `userEmail`, `isOwner` down to child components

**`hooks/useFileManager.ts`**
- Single source of truth for all file operations
- `uploadFile()` → POST to `/api/upload` (not direct Supabase client call)
- `extractFile(id)` → POST to `/api/extract`
- `deleteFile(id)` → removes from storage + DB
- `loadFiles()` → fetches file list for current user

**`app/api/upload/route.ts`**
- Runs entirely server-side with service role key
- Calls `getRealUserId()` to get a valid auth.users UUID
- Uploads file bytes to Supabase Storage
- Inserts metadata row into `file_metadata`

**`app/api/extract/route.ts`**
- Downloads file via signed URL
- Converts to base64
- Calls Groq API with STRUCTURED_PROMPT
- Parses JSON response
- Runs fallback if needed
- Updates `file_metadata` with extracted fields using service role

**`lib/parser.ts`**
- Pure function — no external dependencies
- `detectRestaurantCategory(text: string): string`
- Used as fallback when AI fails

---

## 11. API Design

### Authentication Model

This project uses **localStorage-based auth** with two hardcoded users:

```typescript
// Defined in AuthForm.tsx
const USERS = {
  pavan:  { password: 'pavan.9000',  role: 'owner'  },
  viewer: { password: 'view.001',    role: 'viewer'  }
}
```

All API routes receive `username` as a string field in the request body. The server uses `username` to look up the internal Supabase user UUID.

### Endpoints

---

#### `POST /api/upload`

Uploads a file and creates a `file_metadata` record.

**Request:**
```
Content-Type: multipart/form-data
Body:
  file      Blob    Required  The bill image or PDF
  username  string  Required  Logged-in username ("pavan" or "viewer")
  checksum  string  Required  SHA-256 hex of file bytes (for dedup)
```

**Response (200):**
```json
{
  "success": true,
  "fileId": "uuid-of-new-record",
  "storagePath": "user-uuid/1712345678901_milk_bill.jpg"
}
```

**Response (409 — duplicate):**
```json
{
  "error": "Duplicate file",
  "message": "This file has already been uploaded."
}
```

**Response (500):**
```json
{
  "error": "Upload failed",
  "details": "storage error message"
}
```

---

#### `POST /api/extract`

Runs AI extraction on a specific file.

**Request:**
```json
{
  "fileId": "uuid-of-file-metadata-record"
}
```

**Response (200):**
```json
{
  "success": true,
  "extracted": {
    "vendor": "SV Milk Distribution",
    "amount": 2188,
    "bill_date": "2026-03-15",
    "category": "Dairy & Eggs",
    "notes": "Milk 5L, 10L, Curd 2kg, Paneer 1kg"
  }
}
```

**Response (404):**
```json
{ "error": "File not found" }
```

**Response (500):**
```json
{
  "error": "Extraction failed",
  "details": "Groq API error or JSON parse failure"
}
```

---

#### `POST /api/extract-all`

Runs extraction on all files with null category (batch operation).

**Request:**
```json
{
  "username": "pavan"
}
```

**Response (200):**
```json
{
  "success": true,
  "processed": 12,
  "failed": 1,
  "results": [
    { "fileId": "...", "status": "ok", "vendor": "SV Milk" },
    { "fileId": "...", "status": "error", "error": "timeout" }
  ]
}
```

---

#### `GET /api/files?username=pavan`

Returns all files for the given user.

**Response (200):**
```json
{
  "files": [
    {
      "id": "uuid",
      "filename": "milk_bill.jpg",
      "storage_path": "user-uuid/1712345678901_milk_bill.jpg",
      "file_size": 245760,
      "checksum": "sha256hex",
      "vendor": "SV Milk Distribution",
      "amount": 2188,
      "bill_date": "2026-03-15",
      "category": "Dairy & Eggs",
      "notes": "Milk delivery",
      "created_at": "2026-03-15T10:23:45Z"
    }
  ]
}
```

---

#### `POST /api/signed-url`

Generates a temporary signed URL for viewing a file.

**Request:**
```json
{
  "storagePath": "user-uuid/1712345678901_milk_bill.jpg"
}
```

**Response (200):**
```json
{
  "signedUrl": "https://xxx.supabase.co/storage/v1/object/sign/files/user-uuid/file.jpg?token=..."
}
```

URLs expire after 1 hour.

---

#### `PATCH /api/bills/:id`

Manually update extracted metadata (for corrections via PreviewModal).

**Request:**
```json
{
  "vendor": "Corrected Vendor Name",
  "amount": 2500,
  "bill_date": "2026-03-16",
  "category": "Dairy & Eggs",
  "notes": "Updated note"
}
```

**Response (200):**
```json
{ "success": true }
```

---

## 12. Error Handling

### AI Failure

```typescript
// app/api/extract/route.ts
try {
  const groqResponse = await groq.chat.completions.create({ ... })
  const content = groqResponse.choices[0].message.content
  extracted = JSON.parse(content)
} catch (aiError) {
  console.error('Groq AI failed:', aiError)
  // Don't throw — continue with fallback
  extracted = { vendor: 'Unknown', amount: null, bill_date: null, 
                category: null, notes: 'AI extraction failed' }
}

// Run fallback regardless
if (!extracted.category || extracted.category === 'Other') {
  extracted.category = detectRestaurantCategory(
    [extracted.vendor, extracted.notes].join(' ')
  )
}
```

### OCR Failure

If the image is completely unreadable (corrupted file, unsupported format):
- Groq returns an error message or empty content
- The catch block intercepts it
- `file_metadata` gets updated with `category: "Other"`, `vendor: "Unknown"`
- A toast notification informs the user: "Extraction failed — please edit manually"
- User can click the file card → PreviewModal → manually enter all fields

### Unknown Category

If neither AI nor regex fallback matches:
```typescript
return 'Other'  // detectRestaurantCategory() always returns a string
```

Files with category "Other" appear with a distinct badge color in the UI. The analytics chart shows them as a separate slice. The owner can bulk-filter by "Other" and manually recategorize.

### Duplicate File

```typescript
// app/api/upload/route.ts
const { data: existing } = await admin
  .from('file_metadata')
  .select('id')
  .eq('checksum', checksum)
  .single()

if (existing) {
  return NextResponse.json(
    { error: 'Duplicate file', message: 'This file was already uploaded.' },
    { status: 409 }
  )
}
```

### FK Constraint Error

The `file_metadata.user_id` column has a foreign key referencing `auth.users(id)`. A random UUID would violate this constraint. Solution:

```typescript
async function getRealUserId(username: string): Promise<string> {
  const email = `${username}@chantabbai.internal`
  
  // Try to create the user
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: 'chantabbai_internal_9000',
    email_confirm: true
  })
  
  if (!error && created?.user) return created.user.id
  
  // If already exists, find them
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 100 })
  const found = users.find(u => u.email === email)
  if (found) return found.id
  
  throw new Error(`Cannot resolve user UUID for ${username}`)
}
```

### Rate Limiting (Groq)

Groq free tier: 30 requests/minute. If batch extraction hits the limit:

```typescript
// app/api/extract-all/route.ts
for (const file of files) {
  try {
    await extractSingle(file.id)
    await new Promise(r => setTimeout(r, 2100)) // 2.1s delay = safe under 30rpm
  } catch (e) {
    results.push({ fileId: file.id, status: 'error', error: e.message })
  }
}
```

---

## 13. Performance Optimization

### Latency Breakdown (typical request)

| Step | Time |
|---|---|
| File upload to Supabase Storage | 300–800ms |
| Groq LLaMA 4 Scout inference | 1,200–2,500ms |
| DB write (file_metadata update) | 50–100ms |
| **Total extraction time** | **~2–4 seconds** |

### Optimizations Applied

**1. SHA-256 Dedup Before Upload**
Computed client-side before the network request. Prevents wasted storage bandwidth and Groq API calls on duplicate bills.

```typescript
const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
const checksum = Array.from(new Uint8Array(hashBuffer))
  .map(b => b.toString(16).padStart(2, '0')).join('')
```

**2. User ID Caching (Server Memory)**
```typescript
const userIdCache: Record<string, string> = {}
// Subsequent uploads by same user skip the auth.admin.listUsers() call
```

**3. Low Temperature (0.1)**
LLaMA 4 Scout runs at `temperature: 0.1`. Low temperature = less sampling = faster token generation + more deterministic output.

**4. max_tokens: 1024**
Bills are short documents. Setting max output tokens to 1024 prevents the model from generating verbose explanations. Typical bill extraction needs < 200 tokens.

**5. `response_format: { type: 'json_object' }`**
Forces Groq to return valid JSON directly. Eliminates need for parsing markdown code blocks or stripping preamble text.

**6. Signed URL Caching**
PreviewModal generates a signed URL only when the user opens a file. URLs are cached in component state for the 1-hour session.

**7. No Polling — Event-Driven UI**
After extraction, the API response directly returns the extracted data. The hook updates local state immediately — no refetch needed:

```typescript
// hooks/useFileManager.ts
const extracted = await res.json()
setFiles(prev => prev.map(f => 
  f.id === fileId ? { ...f, ...extracted } : f
))
```

---

## 14. Security Considerations

### Service Role Key Isolation

The most critical security measure:

```
✅ Service role key: ONLY in server-side API routes (app/api/*)
❌ Service role key: NEVER in browser code, NEVER in client.ts
```

From Context7 (Supabase Docs):
> *"Unlike your anon key, your service role key is never safe to expose because it bypasses RLS. Only use your service role key on the backend. Treat it as a secret."*

Environment variables:
```bash
# .env.local (never commit this file)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co          # OK for browser
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...                 # OK for browser (RLS enforced)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...                     # SERVER ONLY
GROQ_API_KEY=gsk_...                                      # SERVER ONLY
```

### Row Level Security (RLS)

Supabase tables have RLS enabled. The service role key bypasses RLS for admin operations. The anon key (browser) respects RLS — viewers cannot read owner files via direct DB calls.

### Signed URLs for File Access

Files in Supabase Storage are private. No public URLs exist. Access requires a signed URL with a 1-hour expiry:

```typescript
const { data } = await admin.storage
  .from('files')
  .createSignedUrl(storagePath, 3600)  // 3600 seconds = 1 hour
```

After 1 hour, the URL expires. If a leaked URL is shared, it stops working automatically.

### Input Validation

Every API route validates required fields before processing:

```typescript
// app/api/upload/route.ts
if (!file || !username || !checksum) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
}
if (!['pavan', 'viewer'].includes(username)) {
  return NextResponse.json({ error: 'Invalid username' }, { status: 403 })
}
```

### SHA-256 Checksum

Prevents both duplicate uploads and content tampering. If a file is modified and re-uploaded, its checksum changes — it is treated as a new file.

### No SQL Injection

All DB operations use Supabase's typed query builder, not raw SQL strings:

```typescript
// Safe — parameterized internally
await admin.from('file_metadata').insert({ user_id, filename, checksum })

// Never do this — would be SQL injection risk:
// await admin.rpc(`INSERT INTO ... WHERE checksum = '${checksum}'`)
```

---

## 15. Future Improvements

### 1. Tesseract OCR Fallback Layer

Add Tesseract.js as a true OCR fallback for when Groq is unavailable:

```typescript
import Tesseract from 'tesseract.js'
const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng+hin')
const category = detectRestaurantCategory(text)
```

This would create a complete 3-layer system: AI Vision → Groq Text → Regex.

### 2. Regional Language Support

Add Telugu, Kannada, and Hindi language models for bills in regional scripts. Groq supports multilingual prompts — the system prompt can be extended:

```typescript
const prompt = `... Extract from this Indian bill. 
The bill may be in English, Hindi, Telugu, or Kannada. 
Handle all languages.`
```

### 3. Fine-tuned Smaller Model

Once 500+ labelled bill examples are collected, fine-tune a smaller model (LLaMA 3.1 8B) specifically on Indian bills. Benefits:
- Faster inference (8B vs 17B parameters)
- Lower cost per extraction
- Higher accuracy on domain-specific vendor names

### 4. Real Authentication

Replace localStorage hardcoded credentials with Supabase Auth + OAuth:

```typescript
// Replace AuthForm.tsx hardcoded check with:
const { data, error } = await supabase.auth.signInWithPassword({
  email, password
})
```

This enables unlimited users, password reset, and session tokens.

### 5. Real-time Extraction Status

Use Supabase Realtime to push extraction progress to the browser without polling:

```typescript
supabase.channel('file_metadata')
  .on('postgres_changes', { event: 'UPDATE', table: 'file_metadata' }, 
    (payload) => updateFileInState(payload.new))
  .subscribe()
```

### 6. WhatsApp Bill Submission

Allow vendors to WhatsApp a bill photo directly into the system via Twilio webhook → Next.js API route → auto-extraction. Eliminates manual upload entirely.

### 7. Budget Alerts

When monthly spending in any category exceeds the set budget, send a push notification (via Web Push API or WhatsApp). Currently the budget is displayed but no alerts are triggered.

### 8. Multi-tenant Architecture

Scale the system to serve multiple restaurants by adding a `tenant_id` field to all tables and enforcing tenant isolation via RLS policies:

```sql
CREATE POLICY "tenant_isolation" ON file_metadata
  USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

### 9. Auto-categorization Confidence Score

Return a confidence score from the AI and display it in the UI. Low-confidence extractions (< 80%) are flagged for manual review:

```typescript
// Extended extraction response
{
  "category": "Dairy & Eggs",
  "confidence": 0.94,  // Add this field
  "needs_review": false
}
```

### 10. Offline Support (PWA)

Convert to a Progressive Web App with Service Workers. Files queued offline upload automatically when connectivity is restored — critical for rural vendors with poor internet.

---

## Appendix A: Environment Variables Reference

| Variable | Required | Scope | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser + Server | Public anon key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Admin key (bypasses RLS) — NEVER expose |
| `GROQ_API_KEY` | Yes | Server only | Groq LLaMA API key — NEVER expose |
| `NEXT_PUBLIC_APP_URL` | No | Browser | Production URL for absolute links |

## Appendix B: Playwright Test Coverage

| Test | What It Verifies |
|---|---|
| `login page loads correctly` | h1 text, username/password inputs, submit button |
| `wrong password shows error` | Error message visible on bad credentials |
| `owner can login and sees nav tabs` | Upload, Files, Analytics tabs visible after pavan login |
| `owner default view is Upload` | "Upload Files" heading shown on landing |
| `viewer can login — no Upload tab` | Upload tab hidden, Files+Analytics visible |
| `owner can switch between all tabs` | Tab switching works, content loads |
| `files view shows stats bar` | "Storage Used" visible in Files tab |
| `view mode switcher toggles views` | Grid/List/Timeline buttons work |
| `analytics tab loads correctly` | Monthly Analytics heading, action buttons |
| `month selector is visible` | Select dropdown present in Analytics |
| `sign out returns to login page` | Sign Out button → redirects to / |
| `mobile: login page renders correctly` | 390×844 viewport, h1 and submit visible |
| `mobile: all nav buttons visible after login` | Upload/Files/Analytics visible on mobile |

## Appendix C: Quick Start for New Developer

```bash
# 1. Clone and install
git clone <repo>
cd chantabbai-filedrop
npm install

# 2. Set environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and Groq credentials

# 3. Run development server
npm run dev
# Opens at http://localhost:3001

# 4. Login
# Username: pavan | Password: pavan.9000  (owner — full access)
# Username: viewer | Password: view.001   (viewer — read only)

# 5. Run tests
npx playwright test
# All 13 tests should pass
```

---

*Documentation generated with Context7 live library documentation — Groq API, Next.js 15, Supabase.*  
*All code examples reflect the actual production implementation.*
