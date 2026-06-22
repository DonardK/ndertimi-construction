# Graph Report - ndertimi-construction  (2026-06-22)

## Corpus Check
- 88 files · ~44,533 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 212 nodes · 320 edges · 44 communities (35 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7a44436c`
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
2. `Select()` - 8 edges
3. `compressImage()` - 8 edges
4. `createClient()` - 8 edges
5. `loadEmployees()` - 6 edges
6. `parseNum()` - 6 edges
7. `loadVehicles()` - 6 edges
8. `POST()` - 5 edges
9. `loadData()` - 5 edges
10. `handleSubmit()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `updateCount()` --calls--> `countExpiredRegistrations()`  [INFERRED]
  components/BottomNav.tsx → lib/vehicleRegistration.ts
- `handleReportSave()` --calls--> `loadData()`  [EXTRACTED]
  components/sections/AttendanceSection.tsx → vercel-recovery/2K6b37HEZ/src/components/sections/AttendanceSection.tsx
- `handleArchive()` --calls--> `loadEmployees()`  [EXTRACTED]
  components/sections/EmployeesSection.tsx → vercel-recovery/2K6b37HEZ/src/components/sections/EmployeesSection.tsx
- `handleRestore()` --calls--> `loadEmployees()`  [EXTRACTED]
  components/sections/EmployeesSection.tsx → vercel-recovery/2K6b37HEZ/src/components/sections/EmployeesSection.tsx
- `handleArchive()` --calls--> `loadVehicles()`  [EXTRACTED]
  components/sections/VehiclesSection.tsx → vercel-recovery/2K6b37HEZ/src/components/sections/VehiclesSection.tsx

## Communities (44 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.25
Nodes (16): handleAddPayment(), handleArchive(), handleChange(), handleDelete(), handleDeletePayment(), handleEdit(), handleOpenAdd(), handlePaymentFieldChange() (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.24
Nodes (10): Select(), normalizeOfficeCategory(), loadAll(), onExpImage(), openStockAdd(), openStockEdit(), parseNum(), runExpenseOcr() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.3
Nodes (13): addLine(), emptyLine(), handleDelete(), handleImageFile(), handleSubmit(), loadData(), parseNum(), removeLine() (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.26
Nodes (12): formatRegistrationDate(), getRegistrationStatus(), handleArchive(), handleChange(), handleDelete(), handleEdit(), handleOpenAdd(), handleRestore() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (5): toAuthEmail(), getClient(), handleSubmit(), handleLogout(), createClient()

### Community 5 - "Community 5"
Cohesion: 0.31
Nodes (10): compressImage(), handleChange(), handleDelete(), handleImageFile(), handleSubmit(), loadData(), parseNum(), removePhoto() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.25
Nodes (9): applyToAll(), handleBulkSave(), handleDelete(), handleReportSave(), loadData(), openBulk(), setBulkHours(), toggleAll() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (9): applyCustom(), applyPreset(), escapeHtml(), eur(), exportVehiclesPdf(), exportWorkersPdf(), getPresetRange(), printReport() (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.24
Nodes (9): isAtTop(), onEnd(), onMove(), onStart(), resetPull(), useAppRefreshVersion(), BottomNav(), updateCount() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.31
Nodes (8): mapAttendance(), mapDiesel(), mapEmployee(), mapOfficeExpense(), mapPayment(), mapStockItem(), mapVehicle(), mapVehicleService()

### Community 10 - "Community 10"
Cohesion: 0.62
Nodes (5): getSupabaseAnonKey(), getSupabaseUrl(), isSupabaseConfigured(), requireSupabaseConfig(), createClient()

### Community 11 - "Community 11"
Cohesion: 0.73
Nodes (4): maxTokensForMode(), POST(), promptForMode(), technicalDetail()

### Community 12 - "Community 12"
Cohesion: 0.7
Nodes (4): getFileContents(), getJSON(), vfetch(), walk()

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAppRefreshVersion()` connect `Community 8` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.374) - this node is a cross-community bridge._
- **Why does `getClient()` connect `Community 4` to `Community 9`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._