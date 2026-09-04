# Graph Report - ndertimi-construction  (2026-09-04)

## Corpus Check
- 100 files · ~57,423 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 260 nodes · 425 edges · 43 communities (35 shown, 8 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47dd0aca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]

## God Nodes (most connected - your core abstractions)
1. `useBodyScrollLock()` - 12 edges
2. `getSupabaseUrl()` - 11 edges
3. `getSupabaseAnonKey()` - 11 edges
4. `createClient()` - 11 edges
5. `useAppRefreshVersion()` - 10 edges
6. `compressImage()` - 9 edges
7. `Select()` - 8 edges
8. `useRole()` - 6 edges
9. `loadEmployees()` - 6 edges
10. `parseNum()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `handleExportAttendance()` --calls--> `exportAttendanceMatrixPdf()`  [INFERRED]
  app/profili/page.tsx → lib/attendanceExport.ts
- `AiDailyReportModal()` --calls--> `useBodyScrollLock()`  [INFERRED]
  components/AiDailyReportModal.tsx → lib/useBodyScrollLock.ts
- `createClient()` --calls--> `getSupabaseUrl()`  [INFERRED]
  vercel-recovery/2K6b37HEZ/src/utils/supabase/client.ts → lib/supabase-env.ts
- `createClient()` --calls--> `getSupabaseAnonKey()`  [INFERRED]
  vercel-recovery/2K6b37HEZ/src/utils/supabase/client.ts → lib/supabase-env.ts
- `middleware()` --calls--> `getSupabaseUrl()`  [INFERRED]
  middleware.ts → lib/supabase-env.ts

## Communities (43 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (16): BottomNav(), updateCount(), useRole(), canViewFinancials(), getRoleFromEmail(), isStaffBlockedPath(), navHrefAllowedForRole(), normalizeEmail() (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (17): AiDailyReportModal(), ConfirmDialog(), defaultLocationForCompany(), workLocationLabel(), useBodyScrollLock(), applyToAll(), buildBulkRows(), existingEmployeeIdsForDate() (+9 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (12): applyCustom(), applyPreset(), defaultReportDate(), escapeHtml(), eur(), exportVehiclesPdf(), exportWorkersPdf(), getPresetRange() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (12): toAuthEmail(), mapAttendance(), mapDiesel(), mapEmployee(), mapOfficeExpense(), mapPayment(), mapStockItem(), mapVehicle() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.23
Nodes (16): handleAddPayment(), handleArchive(), handleChange(), handleDelete(), handleDeletePayment(), handleEdit(), handleOpenAdd(), handlePaymentFieldChange() (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (10): Select(), normalizeOfficeCategory(), loadAll(), onExpImage(), openStockAdd(), openStockEdit(), parseNum(), runExpenseOcr() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.26
Nodes (12): formatRegistrationDate(), getRegistrationStatus(), handleArchive(), handleChange(), handleDelete(), handleEdit(), handleOpenAdd(), handleRestore() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.3
Nodes (13): addLine(), emptyLine(), handleDelete(), handleImageFile(), handleSubmit(), loadData(), parseNum(), removeLine() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.2
Nodes (8): useAppRefreshVersion(), buildAttendanceMatrix(), companyPdfLabel(), companySlug(), exportAttendanceMatrixPdf(), parseYearMonth(), handleExportAttendance(), handleLogout()

### Community 9 - "Community 9"
Cohesion: 0.31
Nodes (10): compressImage(), handleChange(), handleDelete(), handleImageFile(), handleSubmit(), loadData(), parseNum(), removePhoto() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (8): getPageScrollTop(), isAtTop(), isInsideScrollableNotAtTop(), isPageAtTop(), onEnd(), onMove(), onStart(), resetPull()

### Community 11 - "Community 11"
Cohesion: 0.73
Nodes (4): maxTokensForMode(), POST(), promptForMode(), technicalDetail()

### Community 12 - "Community 12"
Cohesion: 0.7
Nodes (4): getFileContents(), getJSON(), vfetch(), walk()

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAppRefreshVersion()` connect `Community 8` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Why does `useBodyScrollLock()` connect `Community 1` to `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 3` to `Community 8`, `Community 0`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `useBodyScrollLock()` (e.g. with `AiDailyReportModal()` and `ConfirmDialog()`) actually correct?**
  _`useBodyScrollLock()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `getSupabaseUrl()` (e.g. with `middleware()` and `createClient()`) actually correct?**
  _`getSupabaseUrl()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `getSupabaseAnonKey()` (e.g. with `middleware()` and `createClient()`) actually correct?**
  _`getSupabaseAnonKey()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `createClient()` (e.g. with `getSupabaseUrl()` and `getSupabaseAnonKey()`) actually correct?**
  _`createClient()` has 2 INFERRED edges - model-reasoned connections that need verification._