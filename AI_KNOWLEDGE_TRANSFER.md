# AI-to-AI Knowledge Transfer Document
## ndertimi-construction — v0.1.0

**Prepared by:** Technical architecture analysis of full repository source  
**Target:** Advanced AI assisting SaaS commercialization  
**Date:** 2026-06-22  
**Codebase size:** 88 files · ~44,533 words · 212 graph nodes

---

## 1. High-Level Product Overview

### Core Purpose

This is an **internal operations management tool** built for a single construction company operating in Kosovo (Albanian-speaking market). It digitizes day-to-day field operations previously managed on paper or in spreadsheets. Core business value:

- Track which workers showed up, how many hours they worked, and at which of the three active job sites (Prishtinë, Prizren, Malishevë).
- Compute gross wages owed per worker (hours × hourly rate) minus payments already made, producing a real-time "net owed" figure.
- Log diesel/fuel fill-ups per vehicle and total fleet fuel costs.
- Log vehicle maintenance (mechanic invoices with line items).
- Manage inventory (construction materials, tools, safety gear).
- Log office expenses with optional AI receipt scanning.
- Export financial summaries to PDF for accounting handoffs.
- Write daily site reports (plain text) that cross-reference attendance for that date, printable from the browser.

Currency is EUR throughout. No billing, no external customer management, no project management — purely internal ops tracking.

### User Roles

There is **no role-based access control** in the application. All authenticated users see and can modify all data. In practice, current users are:

1. **Company owner / manager** — reviews dashboard, exports PDFs, checks fleet registration expiry alerts.
2. **Site supervisor / admin** — enters attendance records (bulk entry for all workers on a given day), logs diesel, adds workers, adds vehicle services.

There is no concept of a read-only user, a driver-only user, or a per-project scoped user.

---

## 2. The Complete Tech Stack

### Frontend

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 16.1.6 |
| UI Runtime | React | 19.2.3 |
| Styling | Tailwind CSS | v4 (PostCSS plugin, no config file) |
| Icon Library | lucide-react | 0.577.0 |
| Toast Notifications | react-hot-toast | 2.6.0 |
| Chart Library | recharts | 3.8.0 (imported but minimal use) |
| Date Utilities | date-fns | 4.1.0 |
| PDF Export | jsPDF + jspdf-autotable | 4.2.1 / 5.0.7 (lazy-imported on demand) |
| State Management | React built-in (`useState`, `useEffect`, `useCallback`, `useContext`) — no Redux, no Zustand, no React Query |
| Global Refresh Bus | Custom `AppRefreshContext` (integer version counter) — all pages subscribe via `useAppRefreshVersion()` |
| PWA | Service Worker via `ServiceWorkerRegistration` component; `manifest.json` in `/public` |
| Language | Albanian (ISO 639-1: `sq`), all UI strings in `lib/translations.ts` |

### Backend & API

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js via Next.js | Server Components + Route Handlers |
| API Routes | Next.js App Router Route Handlers | Only 1 active endpoint |
| Primary API | `POST /api/ocr` | Receipt OCR via OpenAI Vision |
| Admin API stubs | `/api/admin/me`, `/api/admin/users` | Directories exist but **both are empty** — no files inside |
| Middleware | `middleware.ts` (Edge Runtime) | Auth guard: redirects unauthenticated → `/login` |

All CRUD operations bypass API routes entirely. The client directly calls Supabase via the JS SDK. There is **no custom REST or GraphQL API layer** between the browser and the database.

### Database & ORM

| Layer | Technology | Notes |
|---|---|---|
| Database | PostgreSQL (via Supabase) | Hosted, managed |
| ORM | **None** | Raw Supabase JS client (`@supabase/supabase-js` v2.99.2) |
| Schema Management | SQL migration files in `supabase/migrations/` | Applied manually via Supabase SQL editor or `supabase db push` |
| Data Mapping | Manual row mappers in `lib/db.ts` | snake_case DB → camelCase TypeScript interfaces |
| Image Storage | **Base64 strings in DB columns** (`photo_base64 text`) | No Supabase Storage buckets used |
| Offline / Local Cache | Dexie (IndexedDB wrapper) is installed as a dependency | **Not actively used in any component** — planned feature only |

### Authentication & Session Management

| Layer | Technology | Notes |
|---|---|---|
| Auth Provider | Supabase Auth | `signInWithPassword` email+password flow |
| Username trick | `lib/auth-email.ts: toAuthEmail()` | If user types `artan` (no `@`), it becomes `artan@firma.local`. Domain configurable via `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` env var |
| Session storage | Supabase SSR cookies (`@supabase/ssr` v0.9.0) | Handled by `utils/supabase/middleware.ts` and `utils/supabase/server.ts` |
| Auth enforcement | `middleware.ts` runs on every non-static request | Redirects unauthenticated users to `/login`; redirects authenticated users away from `/login` |
| Client singleton | `lib/supabase.ts: getClient()` | Single `SupabaseClient` instance cached in module scope — shared across all component calls |
| Logout | `supabase.auth.signOut()` on profile page | Redirects to `/login` |
| Authorization | **None** | No roles, no row-level user ownership, no per-resource permission checks |

---

## 3. Repository Map & Core Entry Points

```
ndertimi-construction/
├── app/                          # Next.js App Router root
│   ├── layout.tsx                # ROOT LAYOUT — global HTML shell, BottomNav, AppRefreshProvider, Toaster
│   ├── page.tsx                  # DASHBOARD (/) — main financial summary, PDF export, daily reports modal
│   ├── login/page.tsx            # AUTH — username/password form
│   ├── personeli/page.tsx        # PERSONNEL HUB — tabs: Punonjësit + Pjesëmarrja
│   ├── mjetet/page.tsx           # VEHICLES HUB — tabs: Mjetet + Nafta + Serviset
│   ├── stoku/page.tsx            # STOCK HUB — tabs: Stoku + Shpenzimet e zyrës
│   ├── profili/page.tsx          # USER PROFILE — shows email, logout button
│   ├── punonjesit/page.tsx       # Standalone employees page (legacy / direct-link alias)
│   ├── pjesemarrja/page.tsx      # Standalone attendance page (legacy / direct-link alias)
│   ├── nafta/page.tsx            # Standalone diesel page (legacy / direct-link alias)
│   └── api/
│       ├── ocr/route.ts          # ONLY ACTIVE API ROUTE — OpenAI Vision OCR for receipts
│       └── admin/
│           ├── me/               # EMPTY — no route.ts file
│           └── users/            # EMPTY — no route.ts file
│
├── components/
│   ├── AppRefreshProvider.tsx    # Global context + pull-to-refresh gesture handler
│   ├── BottomNav.tsx             # Fixed bottom navigation bar (5 tabs)
│   ├── ConfirmDialog.tsx         # Reusable delete confirmation modal
│   ├── EmptyState.tsx            # Empty list placeholder component
│   ├── FormField.tsx             # Labeled input wrapper
│   ├── PageHeader.tsx            # Section title component
│   ├── SegmentedTabs.tsx         # Tab switcher used in hub pages
│   ├── ServiceWorkerRegistration.tsx  # PWA service worker registration
│   └── sections/
│       ├── AttendanceSection.tsx  # Attendance CRUD + bulk daily entry + daily report modal
│       ├── DieselSection.tsx      # Diesel fill-up CRUD + OCR receipt scanning
│       ├── EmployeesSection.tsx   # Employee CRUD + archive/restore + payment log
│       ├── ServicesSection.tsx    # Vehicle service/mechanic invoice CRUD + OCR
│       └── VehiclesSection.tsx    # Vehicle CRUD + archive/restore + registration expiry
│
├── lib/
│   ├── db.ts                     # ALL DATABASE OPERATIONS — typed interfaces + Supabase queries
│   ├── supabase.ts               # Singleton Supabase client factory (browser)
│   ├── supabase-env.ts           # Env var helpers (URL + key resolution, config guard)
│   ├── auth-email.ts             # Username → email conversion for Supabase Auth
│   ├── translations.ts           # ALL UI STRINGS IN ALBANIAN (single source of truth)
│   ├── vehicleRegistration.ts    # Registration expiry status logic + badge counts
│   ├── imageCompress.ts          # Canvas-based JPEG resize (max 1024px, 85% quality)
│   └── stockConstants.ts         # Hardcoded stock categories + office expense categories
│
├── utils/supabase/
│   ├── client.ts                 # Browser Supabase client (createBrowserClient)
│   ├── server.ts                 # Server Supabase client (createServerClient + cookies)
│   └── middleware.ts             # Middleware Supabase client factory
│
├── middleware.ts                  # EDGE MIDDLEWARE — auth guard for all routes
├── supabase/migrations/           # 6 SQL migration files (applied manually)
├── .env.example                   # Documents 4 env vars
└── public/
    ├── manifest.json              # PWA manifest
    ├── sw.js                      # Service worker (static file)
    └── icons/                     # App icons (192×192, 512×512)
```

### Critical Boot Sequence

1. `middleware.ts` runs first on every request — validates Supabase session cookie.
2. `app/layout.tsx` renders: wraps all pages in `AppRefreshProvider` (context + pull-to-refresh) → `BottomNav` → `Toaster`.
3. Each page is a `"use client"` component that fetches its own data via `db.*` on mount and on `refreshVersion` change.

### Environment Variables (4 total)

```
OPENAI_API_KEY                                # Server-only. OCR endpoint.
NEXT_PUBLIC_SUPABASE_URL                      # Browser + server. Supabase project URL.
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY  # Browser + server. Supabase anon key.
NEXT_PUBLIC_AUTH_EMAIL_DOMAIN                 # Browser. Email domain for short usernames. Default: "firma.local"
```

---

## 4. Data Model & Key Schemas

All tables live in the `public` schema of a single Supabase PostgreSQL project. There are **no foreign key constraints enforced at the DB level for denormalized name columns** — names are duplicated into child tables at insert time to preserve historical accuracy if an employee's name is later edited.

### Entity Relationship Summary

```
employees (1) ──< attendance       (many)
employees (1) ──< worker_payments  (many)
vehicles  (1) ──< diesel           (many)
vehicles  (1) ──< vehicle_services (many)
daily_reports   [standalone, unique per date]
stock_items     [standalone inventory]
office_expenses [standalone expense log]
```

### Table Definitions

**`employees`**
```sql
id              bigserial PRIMARY KEY
emri            text NOT NULL           -- first name
mbiemri         text NOT NULL           -- last name
payment_method  text NOT NULL           -- 'Cash' | 'Bankë'
cmimi_ore       numeric NOT NULL        -- hourly rate in EUR
emri_bankes     text                    -- bank name (nullable)
llogaria_bankes text                    -- IBAN / account no. (nullable)
archived_at     timestamptz             -- NULL = active; set = soft-deleted
created_at      timestamptz DEFAULT now()
```

**`attendance`**
```sql
id              bigserial PRIMARY KEY
employee_id     bigint NOT NULL REFERENCES employees(id)
emri            text NOT NULL           -- denormalized first name at insert time
mbiemri         text NOT NULL           -- denormalized last name at insert time
date            date NOT NULL
payment_method  text NOT NULL           -- 'Cash' | 'Bankë'
hours_worked    numeric NOT NULL
location        text NOT NULL DEFAULT 'Pr'
                  CHECK (location IN ('Pr', 'Pz', 'M'))
created_at      timestamptz DEFAULT now()
```

Location codes: `Pr` = Prishtinë · `Pz` = Prizren · `M` = Malishevë

**`daily_reports`**
```sql
id          bigserial PRIMARY KEY
date        date NOT NULL UNIQUE     -- one report per calendar day, enforced at DB level
title       text NOT NULL
content     text NOT NULL
created_at  timestamptz DEFAULT now()
```

**`vehicles`**
```sql
id                      bigserial PRIMARY KEY
emri_mjetit             text NOT NULL           -- vehicle name/label
targa                   text NOT NULL           -- license plate
registration_expires_at date                    -- NULL = unknown/not set
archived_at             timestamptz             -- NULL = active
created_at              timestamptz DEFAULT now()
```

**`diesel`**
```sql
id            bigserial PRIMARY KEY
vehicle_id    bigint NOT NULL REFERENCES vehicles(id)
emri_mjetit   text NOT NULL           -- denormalized vehicle name at insert time
date          date NOT NULL
liters        numeric NOT NULL
total_price   numeric NOT NULL
photo_base64  text                    -- full JPEG data URI (up to ~300 KB per row)
created_at    timestamptz DEFAULT now()
```

**`worker_payments`**
```sql
id          bigserial PRIMARY KEY
employee_id bigint NOT NULL REFERENCES employees(id)
emri        text NOT NULL
mbiemri     text NOT NULL
amount      numeric NOT NULL
pershkrim   text NOT NULL           -- description e.g. "Avans", "Urgjencë"
date        date NOT NULL
created_at  timestamptz DEFAULT now()
```

**`vehicle_services`**
```sql
id            bigserial PRIMARY KEY
vehicle_id    bigint NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT
emri_mjetit   text NOT NULL
date          date NOT NULL
notes         text
items         jsonb NOT NULL DEFAULT '[]'  -- [{description: string, amount: number}, ...]
total_price   numeric NOT NULL
photo_base64  text
created_at    timestamptz DEFAULT now()
```

**`stock_items`**
```sql
id          bigserial PRIMARY KEY
category    text NOT NULL           -- value from STOCK_CATEGORIES constant
name        text NOT NULL
quantity    numeric NOT NULL DEFAULT 0
unit        text
notes       text
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()
```

**`office_expenses`**
```sql
id           bigserial PRIMARY KEY
date         date NOT NULL
category     text NOT NULL           -- value from OFFICE_EXPENSE_CATEGORIES constant
title        text NOT NULL
amount       numeric NOT NULL
notes        text
photo_base64 text
created_at   timestamptz DEFAULT now()
```

### RLS Policy Pattern

All tables use the **permissive "allow everything" pattern**:

```sql
-- Repeated across all tables (some use single combined policy, others split by operation):
CREATE POLICY "table_all" ON public.employees
  FOR ALL USING (true) WITH CHECK (true);
```

`daily_reports` uses four explicit per-operation policies but all are equally permissive (`USING (true)`). There is **no per-user data filtering at the database level**.

### TypeScript Interface Summary (`lib/db.ts`)

```typescript
interface Employee       { id, emri, mbiemri, paymentMethod, cmimiOre, emriBankes, llogariaBankes, archivedAt, createdAt }
interface Attendance     { id, employeeId, emri, mbiemri, date, paymentMethod, hoursWorked, location, createdAt }
interface DailyReport    { id, date, title, content, createdAt }
interface Vehicle        { id, emriMjetit, targa, registrationExpiresAt, archivedAt, createdAt }
interface WorkerPayment  { id, employeeId, emri, mbiemri, amount, pershkrim, date, createdAt }
interface DieselEntry    { id, vehicleId, emriMjetit, date, liters, totalPrice, photoBase64, createdAt }
interface VehicleServiceEntry { id, vehicleId, emriMjetit, date, notes, items: ServiceLineItem[], totalPrice, photoBase64, createdAt }
interface StockItem      { id, category, name, quantity, unit, notes, createdAt, updatedAt }
interface OfficeExpense  { id, date, category, title, amount, notes, photoBase64, createdAt }
```

The `db` export object is organized as namespaced method groups:
`db.employees.*` · `db.attendance.*` · `db.dailyReports.*` · `db.vehicles.*` · `db.diesel.*` · `db.workerPayments.*` · `db.vehicleServices.*` · `db.stock.*` · `db.officeExpenses.*`

---

## 5. Critical Features & Data Flows

### Feature 1: Bulk Attendance Entry + Daily Report

This is the highest-frequency write operation, executed daily.

**Flow:**

1. User opens `/personeli` → `AttendanceSection` component.
2. User clicks bulk add button → `showBulk = true` modal opens.
3. `loadData()` fetches `db.employees.getAll()` + `db.attendance.getAll()` in parallel.
4. A `BulkRow[]` array is built from active employees (those with `archived_at = null`).
5. User sets `bulkDate`, optionally applies `sameHours` and `sameLocation` to all rows via `applyToAll()`.
6. User checks which employees were present and sets individual hours/location per row.
7. `handleBulkSave()` fires:
   - Validates each checked row has `hours > 0`.
   - Calls `db.attendance.add()` for each checked row sequentially (no bulk insert used).
   - Each insert: `{ employee_id, emri, mbiemri, date, payment_method, hours_worked, location }`.
   - On success → closes bulk modal → opens **report modal** (`showReportModal = true`).
8. User fills optional daily report (title + freetext content).
9. `handleReportSave()` → `db.dailyReports.upsert({ date, title, content })` using `onConflict: "date"` — one report per date, overwritten if re-submitted same day.
10. `loadData()` called again to refresh list. `refreshVersion` context incremented globally (triggers all other pages to refetch on next visit).

**DB writes per daily session:** N rows to `attendance` (one per present worker) + 1 upsert to `daily_reports`.

---

### Feature 2: Diesel Fill-Up with AI OCR Receipt Scanning

**Flow:**

1. User opens `/mjetet` → `DieselSection` tab.
2. User taps "Ngarko Faturën" (upload receipt).
3. File input triggers → `compressImage(file)` called client-side:
   - Draws image onto a `<canvas>` element.
   - Resizes to max 1024×1024px preserving aspect ratio.
   - Encodes as JPEG data URI at 85% quality.
   - Returns base64 data URI string.
4. `runExpenseOcr(base64DataUri)` called → `POST /api/ocr` with body `{ imageBase64, mode: "diesel" }`.
5. **Server-side** (`app/api/ocr/route.ts`):
   - Validates `imageBase64` present, `OPENAI_API_KEY` set.
   - Instantiates `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`.
   - Calls `client.chat.completions.create({ model: "gpt-4o", max_tokens: 300, messages: [{ role: "user", content: [text_prompt, { type: "image_url", image_url: { url: imageBase64, detail: "high" } }] }] })`.
   - Prompt instructs model to return only `{ date, liters, totalPrice, pricePerLiter }` as JSON.
   - Extracts JSON from response with regex `/\{[\s\S]*\}/` then `JSON.parse`.
   - Returns normalized object or `{ error: "unreadable" }`.
6. Client receives response → auto-fills form fields: `date`, `liters`, `totalPrice`, `cmimiLiter`.
7. User selects vehicle from dropdown (populated from `db.vehicles.getActive()`).
8. User confirms/edits → `handleSubmit()` → `db.diesel.add({ vehicle_id, emri_mjetit, date, liters, total_price, photo_base64 })`.
9. Photo stored as raw base64 string in `photo_base64` column directly in Postgres.

**Same OCR pipeline applies to:**
- Mechanic invoices (`mode: "mechanic"`) → returns `{ lineItems[], totalPrice, notes }`.
- Office expenses (`mode: "office"`) → returns `{ date, title, totalAmount, categoryGuess }`.

**OCR mode routing:**
```typescript
export type OcrMode = "diesel" | "mechanic" | "office";
// maxTokens: mechanic=800, office=400, diesel=300
```

---

### Feature 3: Dashboard Financial Aggregation + PDF Export

The dashboard (`app/page.tsx`) is a **pure client-side aggregation engine** — no server-side computation, no aggregation views.

**Flow:**

1. On mount + on `refreshVersion` change → `loadStats()` fires.
2. Fetches **all records** from 4 tables in parallel (unbounded SELECT *):
   ```typescript
   const [dieselRecs, attRecs, emps, allPayments] = await Promise.all([
     db.diesel.getAll(),
     db.attendance.getAll(),
     db.employees.getAll(),
     db.workerPayments.getAll(),
   ]);
   ```
3. Client-side date filtering via `date-fns isWithinInterval` for selected preset (thisMonth / last3Months / last6Months / thisYear / lastYear / allTime / custom).
4. **Worker earnings computation:**
   - Groups attendance by `employeeId`, sums `hoursWorked`.
   - Joins to `employees` map for hourly rate → `total = hours × rate`.
   - Joins to `worker_payments` → `paid = sum of all payments in period`.
   - `net = total - paid` (amount still owed to worker).
5. **Diesel computation:**
   - Groups diesel records by `emriMjetit` (vehicle name string, not ID).
   - Sums liters and cost per vehicle.
6. Renders two separate worker tables: Cash workers and Bankë (bank transfer) workers.
7. Bankë workers show IBAN + bank name columns.
8. **PDF Export (`exportWorkersPdf()` / `exportVehiclesPdf()`):**
   - Lazy-imports `jsPDF` + `jspdf-autotable` on demand.
   - Generates multi-section PDF entirely client-side (no server call).
   - Auto-switches to landscape for bank workers (extra columns for IBAN).
   - `doc.save("punonjesit-{from}-{to}.pdf")` triggers browser download.

**Performance note:** All records are fetched on every load with no pagination or server-side aggregation. Degrades significantly beyond ~3 years of daily records.

---

## 6. Single-Tenant Commercial Bottlenecks

Exhaustive catalog of every hardcoded constraint and missing architectural element that blocks multi-tenancy.

---

### 6.1 Database — No Tenant Identifier on Any Table

**Every table is missing a `tenant_id` (or `company_id`) column.**

All 8 business tables (`employees`, `attendance`, `daily_reports`, `vehicles`, `diesel`, `worker_payments`, `vehicle_services`, `stock_items`, `office_expenses`) contain only business data with no ownership scope. Adding multi-tenancy requires:

- **Row-level tenancy (recommended for shared DB):** Add `tenant_id uuid NOT NULL REFERENCES tenants(id)` to every table + update all RLS policies to `USING (tenant_id = auth.jwt()->>'tenant_id')`.
- **Schema-level tenancy:** One PostgreSQL schema per tenant (`search_path` routing). Supabase supports this but adds operational complexity.
- **Project-level tenancy (silo model):** One Supabase project per customer. Maximum isolation, highest cost, complex provisioning.

---

### 6.2 RLS Policies — Fully Permissive, No User or Tenant Isolation

Every RLS policy currently:
```sql
USING (true) WITH CHECK (true)
```
Any authenticated user sees all rows in all tables. Every policy must be replaced with tenant-scoped expressions before multi-tenancy is viable.

---

### 6.3 Single Supabase Project URL Hardcoded in Env

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
```
One hardcoded project. In SaaS this becomes a routing decision (see 6.1 options). The `lib/supabase-env.ts` resolver reads only `NEXT_PUBLIC_SUPABASE_URL` — no dynamic project selection.

---

### 6.4 Auth Email Domain is a Single Global Value

```typescript
// lib/auth-email.ts
const domain = process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN?.trim() || "firma.local";
return `${username}@${domain}`;
```

`firma.local` is the hardcoded default. `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` is a single build-time env var — not per-tenant. In SaaS, either:
- Drop the username-shortening trick and require full emails.
- Store per-tenant domain in a `tenants` table and resolve it server-side at login.

---

### 6.5 Work Location Codes are Kosovo City-Specific

```typescript
// lib/db.ts
export type WorkLocation = "Pr" | "Pz" | "M";

export const WORK_LOCATION_LABELS: Record<WorkLocation, string> = {
  Pr: "Prishtinë",
  Pz: "Prizren",
  M: "Malishevë",
};
```

The attendance table schema enforces:
```sql
CHECK (location IN ('Pr', 'Pz', 'M'))
```

These are hardcoded Kosovo city codes baked into both the TypeScript type system and the DB check constraint. Multi-tenant SaaS requires a `job_sites` or `locations` table with tenant-configurable entries, and the check constraint must be removed or replaced with a FK reference.

---

### 6.6 All UI Strings Hardcoded in Albanian Only

```typescript
// lib/translations.ts — 300+ lines, single language
export const t = {
  appName: "Menaxhimi i Ndërtimit",
  appShortName: "Ndërtimi",
  // ...
} as const;
```

No i18n framework (`next-intl`, `react-i18next`, etc.), no locale routing, no pluralization. The entire application is Albanian-only. Internationalizing for SaaS requires replacing this constant with a proper i18n solution and locale-based routing.

---

### 6.7 Currency Hardcoded to EUR + German Locale Formatting

```typescript
// app/page.tsx (repeated in PDF export functions)
function eur(n: number) {
  return `€${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

The `de-DE` locale and `€` symbol appear in multiple components and PDF exports. Multi-region SaaS requires per-tenant currency + locale configuration stored in a `tenant_settings` table.

---

### 6.8 OpenAI API Key — Single Global Server Secret

```
OPENAI_API_KEY=your_openai_api_key_here  # server-only, single global key
```

One key for all OCR calls across all users. In SaaS:
- No per-tenant usage metering or cost attribution.
- No per-tenant rate limiting.
- A single key compromise affects the entire platform.
- Model version (`gpt-4o`) hardcoded in `app/api/ocr/route.ts` line 104.

The OCR route must be updated to use billing-aware metering, or route through a proxy that attributes costs per tenant.

---

### 6.9 Supabase Client is a Module-Level Singleton

```typescript
// lib/supabase.ts
let _client: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(); // reads NEXT_PUBLIC_SUPABASE_URL at module load time
  }
  return _client;
}
```

The client is created once per browser session from static build-time env vars. In a silo-model multi-tenant system (different Supabase project per customer), this singleton cannot route per-tenant. The factory must become dynamic and accept per-request configuration.

---

### 6.10 Stock & Expense Categories Are Hardcoded TypeScript Constants

```typescript
// lib/stockConstants.ts
export const STOCK_CATEGORIES = [
  "Materiale ndërtimi", "Vegla", "Siguria", "Zyra", "Mjete", "Të tjera",
] as const;

export const OFFICE_EXPENSE_CATEGORIES = [
  "Zyra", "Ushqim", "Transport", "Shërbime", "Materiale", "Të tjera",
] as const;
```

Construction-specific Albanian category names hardcoded at the code level. These also appear verbatim in OCR prompts (the `mode: "office"` prompt includes `categoryGuess` options matching this list). SaaS requires these to be tenant-configurable rows in a `categories` table, and OCR prompts must be dynamically constructed from those rows.

---

### 6.11 Photo Storage as Base64 in Database Columns

Every receipt/photo feature stores images as raw base64 text in `photo_base64 text` columns:
- `diesel.photo_base64`
- `vehicle_services.photo_base64`
- `office_expenses.photo_base64`

This pattern:
- Bloats the Postgres database (a single JPEG receipt = ~150–300 KB as base64 in a text column).
- Has no CDN, no expiry, no presigned URL access control.
- Makes pg_dump exports enormous.
- Violates Supabase's own best-practice recommendation (use Supabase Storage).
- Makes per-tenant data isolation and deletion ("right to erasure") harder.

For SaaS, all `photo_base64` columns must be migrated to Supabase Storage object paths with signed URL generation at read time. Each tenant needs an isolated storage bucket or a tenant-prefixed path within a shared bucket.

---

### 6.12 Dashboard Loads All Records Without Pagination

```typescript
// app/page.tsx — four unbounded SELECT * queries on every load
const [dieselRecs, attRecs, emps, allPayments] = await Promise.all([
  db.diesel.getAll(),          // SELECT * FROM diesel ORDER BY date DESC
  db.attendance.getAll(),      // SELECT * FROM attendance ORDER BY date DESC
  db.employees.getAll(),       // SELECT * FROM employees ORDER BY archived_at, emri
  db.workerPayments.getAll(),  // SELECT * FROM worker_payments ORDER BY date DESC
]);
```

Client-side date filtering applied in JavaScript after full fetch. At 10 employees × 250 working days = 2,500 attendance rows per year. After 3 years: 7,500+ rows transferred on every dashboard load before filtering. Needs server-side aggregation via Postgres `GROUP BY` queries, RPC functions, or materialized views.

---

### 6.13 App Name, HTML Lang Attribute, and PWA Metadata Are Build-Time Constants

```typescript
// lib/translations.ts
appName: "Menaxhimi i Ndërtimit",
appShortName: "Ndërtimi",

// app/layout.tsx
<html lang="sq">
<meta name="apple-mobile-web-app-title" content={t.appShortName} />
export const metadata: Metadata = {
  title: t.appName,
  description: "Aplikacion i menaxhimit të kompanisë së ndërtimit",
};
```

App name, language, and all PWA metadata are fixed at build time. White-label SaaS requires these to be tenant-configurable, fetched from a `tenants` table in a Next.js Server Component during layout render, and injected dynamically.

---

### 6.14 Admin API Routes Are Empty Stubs

`/api/admin/me/` and `/api/admin/users/` directories exist but contain **zero files**. There is no user management API. Adding new users requires direct access to the Supabase Dashboard → Authentication panel. SaaS requires:
- Tenant-admin user invitation flow.
- Role assignment (admin vs. worker vs. viewer).
- User CRUD scoped within a tenant.
- Potentially a super-admin panel for platform operators.

---

### 6.15 Vehicle Registration Expiry Logic Assumes Always-Active Vehicles

```typescript
// lib/vehicleRegistration.ts
export function countExpiredRegistrations(vehicles: Vehicle[]): number {
  return vehicles.filter(
    (v) =>
      !v.archivedAt &&
      v.registrationExpiresAt &&
      getRegistrationStatus(v.registrationExpiresAt) === "expired"
  ).length;
}
```

The badge count in `BottomNav` fires a live Supabase query on every `refreshVersion` change. In a multi-tenant system with thousands of vehicles, this ambient query needs to be either cached, rate-limited, or replaced with a real-time Supabase subscription.

---

## Appendix: Key File Cross-Reference

| Concern | Primary File(s) |
|---|---|
| All DB types + queries | `lib/db.ts` |
| Auth flow | `app/login/page.tsx`, `lib/auth-email.ts`, `middleware.ts` |
| Auth session cookies | `utils/supabase/client.ts`, `utils/supabase/server.ts`, `utils/supabase/middleware.ts` |
| Supabase env config | `lib/supabase-env.ts` |
| OCR / AI integration | `app/api/ocr/route.ts`, `lib/imageCompress.ts` |
| All UI strings | `lib/translations.ts` |
| Navigation structure | `components/BottomNav.tsx` |
| Global refresh bus | `components/AppRefreshProvider.tsx` |
| Registration expiry logic | `lib/vehicleRegistration.ts` |
| Stock/expense categories | `lib/stockConstants.ts` |
| Database migrations | `supabase/migrations/` (6 files) |
| Environment variable docs | `.env.example` |
| Dashboard + PDF export | `app/page.tsx` |
| Attendance + daily report | `components/sections/AttendanceSection.tsx` |
| Diesel + OCR flow | `components/sections/DieselSection.tsx` |
| Employee CRUD + payments | `components/sections/EmployeesSection.tsx` |
| Vehicle CRUD + archive | `components/sections/VehiclesSection.tsx` |
| Mechanic services + OCR | `components/sections/ServicesSection.tsx` |
