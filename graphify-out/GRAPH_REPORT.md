# Graph Report - ndertimi-construction  (2026-07-08)

## Corpus Check
- 95 files · ~52,028 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 245 nodes · 385 edges · 44 communities (36 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5496f923`
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
- [[_COMMUNITY_Community 21|Community 21]]

## God Nodes (most connected - your core abstractions)
1. `useAppRefreshVersion()` - 10 edges
2. `useBodyScrollLock()` - 10 edges
3. `createClient()` - 9 edges
4. `Select()` - 8 edges
5. `compressImage()` - 8 edges
6. `useRole()` - 6 edges
7. `loadEmployees()` - 6 edges
8. `parseNum()` - 6 edges
9. `loadVehicles()` - 6 edges
10. `POST()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `handleExportAttendance()` --calls--> `exportAttendanceMatrixPdf()`  [INFERRED]
  app/profili/page.tsx → lib/attendanceExport.ts
- `middleware()` --calls--> `getRoleFromEmail()`  [INFERRED]
  middleware.ts → lib/roles.ts
- `middleware()` --calls--> `isStaffBlockedPath()`  [INFERRED]
  middleware.ts → lib/roles.ts
- `updateCount()` --calls--> `countExpiredRegistrations()`  [INFERRED]
  components/BottomNav.tsx → lib/vehicleRegistration.ts
- `ConfirmDialog()` --calls--> `useBodyScrollLock()`  [INFERRED]
  vercel-recovery/2K6b37HEZ/src/components/ConfirmDialog.tsx → lib/useBodyScrollLock.ts

## Communities (44 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (13): toAuthEmail(), mapAttendance(), mapDiesel(), mapEmployee(), mapOfficeExpense(), mapPayment(), mapStockItem(), mapVehicle() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (11): applyCustom(), applyPreset(), escapeHtml(), eur(), exportVehiclesPdf(), exportWorkersPdf(), getPresetRange(), printReport() (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.19
Nodes (11): applyToAll(), buildBulkRows(), existingEmployeeIdsForDate(), handleBulkSave(), handleDelete(), handleReportSave(), loadData(), openBulk() (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.25
Nodes (16): handleAddPayment(), handleArchive(), handleChange(), handleDelete(), handleDeletePayment(), handleEdit(), handleOpenAdd(), handlePaymentFieldChange() (+8 more)

### Community 4 - "Community 4"
Cohesion: 0.24
Nodes (10): compressImage(), normalizeOfficeCategory(), loadAll(), onExpImage(), openStockAdd(), openStockEdit(), parseNum(), runExpenseOcr() (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (10): BottomNav(), updateCount(), useRole(), canViewFinancials(), getRoleFromEmail(), isStaffBlockedPath(), navHrefAllowedForRole(), normalizeEmail() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.3
Nodes (13): addLine(), emptyLine(), handleDelete(), handleImageFile(), handleSubmit(), loadData(), parseNum(), removeLine() (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.26
Nodes (12): formatRegistrationDate(), getRegistrationStatus(), handleArchive(), handleChange(), handleDelete(), handleEdit(), handleOpenAdd(), handleRestore() (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.31
Nodes (10): Select(), handleChange(), handleDelete(), handleImageFile(), handleSubmit(), loadData(), parseNum(), removePhoto() (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (7): useAppRefreshVersion(), buildAttendanceMatrix(), companyPdfLabel(), companySlug(), exportAttendanceMatrixPdf(), parseYearMonth(), handleExportAttendance()

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (8): getPageScrollTop(), isAtTop(), isInsideScrollableNotAtTop(), isPageAtTop(), onEnd(), onMove(), onStart(), resetPull()

### Community 11 - "Community 11"
Cohesion: 0.62
Nodes (5): getSupabaseAnonKey(), getSupabaseUrl(), isSupabaseConfigured(), requireSupabaseConfig(), createClient()

### Community 12 - "Community 12"
Cohesion: 0.73
Nodes (4): maxTokensForMode(), POST(), promptForMode(), technicalDetail()

### Community 13 - "Community 13"
Cohesion: 0.7
Nodes (4): getFileContents(), getJSON(), vfetch(), walk()

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAppRefreshVersion()` connect `Community 9` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 0` to `Community 9`, `Community 5`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `useBodyScrollLock()` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 8`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._