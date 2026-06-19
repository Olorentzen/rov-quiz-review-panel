# rov-quiz-review-panel — Implementation Plan

## A. Current State Summary

### What exists
- **4 pages** via tab-based navigation (no react-router): `UploadPage`, `RunsPage`, `ReviewPage`, `PacksPage`
- **Auth**: Supabase email/password. JWT stored in `localStorage` under `pdfingest_token`. Injected into every API request via `Authorization: Bearer` header.
- **Review page**: `QuestionList` (left) + `QuestionEditor` + `ValidationPanel` (right). Filters: manual selector, triage status dropdown, review status dropdown, search text. Bulk approve/reject/delete.
- **Packs page**: Lists packs, builds from approved questions (server-side), renames, deletes, downloads, exports to Supabase.
- **Upload page**: PDF drag-and-drop, step selection checkboxes, manual list, run now / queue batch.
- **Runs page**: Polls `listJobs()` every 5s when active, every 15s when idle. Job detail + logs view. Cancel/delete.
- **API base URL**: hardcoded `http://localhost:8000/api` — no env override.
- **Unused components**: `FilterBar.tsx` (defined, not wired); `PackLoader.tsx` (defined, not wired).
- **TypeScript types**: `src/types/pack.ts` defines `Question`, `Stage5Pack`, `LearningCategory`, `FilterState`, etc.

### What should be preserved
- All existing backend API contracts (endpoints, request/response shapes)
- Pack JSON format consumed by Flutter (field names, nesting, schema_version) — see Section E
- Supabase auth flow (JWT in localStorage, injected on every request)
- Tab-based navigation — all existing pages remain functional
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars

### Backend-coupled assumptions that must not break
- `POST /api/packs/build` response: `{ packId, outputPath, totalQuestions, byManual }`
- `POST /api/packs/{packId}/export` — uploads pack JSON to Supabase Storage, updates manifest
- `GET /api/review/questions` — current query params: `manual_id`, `job_id`, `review_status`, `triageStatus`
- `QuestionReviewItem` and `Stage5Pack` field shapes must remain compatible with Flutter

### Role/env-based gating opportunity
- Standard Vite env vars: `VITE_DEPLOY_MODE` and `VITE_API_BASE_URL` — no custom `define` in vite.config.ts needed
- TypeScript will auto-complete `import.meta.env.VITE_*` vars; add `/// <reference types="vite/client" />` to `src/vite-env.d.ts` if not already present
- No build-time code injection; env vars are read at module initialization (same as `VITE_SUPABASE_URL` already works)
- Feature flags as plain constants in `src/utils/featureFlags.ts`

---

## B. UI Simplification Plan for Review

### Fields to keep visible by default (reviewer-first)
- **Stem** — primary content, always visible
- **Options A–D + correct answer selector** — always visible
- **Explanation** — always visible
- **Learning category checkboxes** — always visible; this is the primary new workflow
- **Approve / Reject buttons** — prominent, always visible
- **Difficulty** dropdown (easy / medium / hard) — compact, always visible

### Fields to move to "Advanced" (collapsible `<details>/<summary>` section)
Collapsed by default. Expand only when reviewer needs full traceability:
- `subsystem_category` + `subsystem_label` (read-only badge)
- `fact_type` (read-only)
- `source_quote` (read-only, full text)
- `min_rank` (dropdown, rarely changed)
- `confidence` (read-only numeric — judge confidence)
- `tags` (comma-separated input, rarely used)
- `judgePrimaryIssue` (read-only)
- `autoReviewedAt` (read-only)
- `rule_check_failures` / `rule_check_warnings` — shown as icon badges with tooltip, not raw text dump

### Fields to remove from default view entirely
- `questionId` display — internal field, confusing to reviewers
- `jobId` — internal field

### Combined status dropdown — exact mapping

Current two dropdowns:
- `triageStatus`: `needs_review` | `auto_approved` | `auto_rejected` | `approved` | `rejected`
- `reviewStatus`: `unreviewed` | `approved` | `rejected`

These are **orthogonal concepts** that must not be conflated. The backend stores them separately. The combined dropdown maps **one UI value → one API param** (or both when needed):

| UI label | triageStatus param | reviewStatus param | Notes |
|---|---|---|---|
| `All Questions` | omitted | omitted | Reset both |
| `Needs Review` | `needs_review` | omitted | Questions auto-triaged to human |
| `Auto-Approved` | `auto_approved` | omitted | AI fast-path approved |
| `Awaiting Human` | `needs_review` | `unreviewed` | Both flags together |
| `Approved` | omitted | `approved` | Human-approved |
| `Rejected` | omitted | `rejected` | Human-rejected |
| `Auto-Rejected` | `auto_rejected` | omitted | Content filter rejected |

**This means the combined dropdown passes BOTH `triageStatus` AND `reviewStatus` to the API depending on which row is selected.** Some rows only set one param, some set both.

The separate triage and review dropdowns are replaced by this single combined dropdown. No existing filter capability is lost — the mapping above covers every combination the two original dropdowns could express.

### Advanced filter panel (collapsible, below main header)

Collapsible panel (starts collapsed) for power-user filters:
- **Difficulty** dropdown (easy / medium / hard)
- **Min rank** dropdown (pilot_1 / pilot_2 / pilot_3 / pilot_4 / pilot_5 / supervisor)
- **Learning category** dropdown (from `GET /api/review/categories`)
- **Confidence range** — min/max numeric inputs (optional, can defer)

The existing `FilterBar.tsx` component can be adapted as this Advanced filter panel, or a new lightweight collapsible `<details>` can be added inline in `ReviewPage.tsx`.

---

## C. Navigation / Mode Split

### Approach: Standard Vite env vars — no custom `define`

Both `VITE_DEPLOY_MODE` and `VITE_API_BASE_URL` are read directly from `import.meta.env` in a `src/utils/featureFlags.ts` module. No vite.config.ts changes needed.

```ts
// src/utils/featureFlags.ts
/// <reference types="vite/client" />
export const DEPLOY_MODE = (import.meta.env.VITE_DEPLOY_MODE as 'hosted' | 'offline') ?? 'offline';
export const isHosted = DEPLOY_MODE === 'hosted';
export const canAccessUploads = !isHosted;
export const canAccessRuns = !isHosted;
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api';
```

TS typing: The `/// <reference types="vite/client" />` directive gives `import.meta.env` the correct Vite type signature, so `VITE_DEPLOY_MODE` and `VITE_API_BASE_URL` are typed as `string | undefined` with no extra config needed.

### Tab visibility by mode

| Tab | Hosted | Offline |
|-----|--------|---------|
| Upload | No | Yes |
| Runs | No | Yes |
| Review | Yes | Yes |
| Packs | Yes | Yes |

### `.env` strategy
- **`src/utils/featureFlags.ts`** reads env vars at module init — same pattern already used for `VITE_SUPABASE_URL`
- Default `.env` (committed to repo): `VITE_DEPLOY_MODE=hosted` — clean hosted default, safe to commit
- Internal/offline developer: override in local `.env.local` or `.env` (uncommitted) — `VITE_DEPLOY_MODE=offline` + `VITE_API_BASE_URL=http://localhost:8000/api`
- Hosted deployment: set `VITE_API_BASE_URL` to the production FastAPI URL, `VITE_DEPLOY_MODE=hosted`

### API base URL change
`src/utils/api.ts` currently has:
```ts
const API_BASE = 'http://localhost:8000/api';
```
Change to:
```ts
import { API_BASE } from './featureFlags';
```
And update `featureFlags.ts` to export `API_BASE` as the env var.

---

## D. Custom Pack MVP

### In-PacksPage subview (NOT a separate route)

Custom pack creation lives inside `PacksPage` as a toggle between two views:
- **Default view**: Pack list (existing)
- **Custom pack editor view**: activated by "Create Custom Pack" button; replaces pack list in-page with the editor panel

No new route. No react-router. State: `const [view, setView] = useState<'list' | 'custom'>('list')`.

```
PacksPage
├── view: 'list' | 'custom'   (useState)
├── <PackListView>            (shown when view === 'list')
│   ├── pack list table
│   ├── Build / Export buttons
│   └── [Create Custom Pack] button → setView('custom')
└── <CustomPackEditorView>    (shown when view === 'custom')
    ├── PackMetadataForm
    ├── QuestionPicker
    └── PackActions (Save Draft / Export to Supabase)
```

### User flow
1. Click "Create Custom Pack" → `setView('custom')`, load approved questions into QuestionPicker
2. Fill metadata: name (required), description (optional), access_tier (default: `free`)
3. Pick questions via `QuestionPicker` (see below)
4. "Save Draft" → `POST /api/packs/build` with `isDraft=true` and `questionIds=[...]` → pack appears in pack list with "Draft" badge
5. "Export to Supabase" → `POST /api/packs/{packId}/export` (same as existing export flow)
6. "Back to Packs" → `setView('list')`, reload pack list

### Question picker UX
- Loads all `approved` questions via `GET /api/review/questions?review_status=approved` on mount
- Groups by `manual_id` with manual filename as group header
- Each row: checkbox + stem preview (80 chars) + category badge chips
- Select-all / deselect-all per manual group
- Search input: client-side stem text filter
- Learning category filter: dropdown (from `GET /api/review/categories`) — filters which rows are visible
- Right panel: selected questions list with remove button, question count
- No pagination for MVP (approved pool is bounded; can add later)

### Pack metadata form (minimum fields)
| Field | Required | Backend storage | Exported to Flutter JSON |
|-------|----------|-----------------|--------------------------|
| `name` | Yes | `packs.name` column | No (panel-only) |
| `description` | No | `packs.name` column? or new `description` col | No |
| `access_tier` | Yes (default: `free`) | Not stored yet — add to packs table | Yes: `access_tier` in manifest entry |
| `category` | No | Not stored yet | No (internal label only) |
| `questionIds` | Yes | Not stored as override yet — body of build request | Yes: actual questions in pack JSON |
| `isDraft` | Yes (default: `true`) | `packs.is_draft` column (new) | No |

**The `name` field maps to the existing `packs.name` column (already renameable via `PATCH /api/packs/{packId}`).**

### Backend changes required (additive)
1. **`POST /api/packs/build`** body extension:
   ```json
   {
     "manualId": "manual_xxx",     // existing — optional
     "questionIds": ["q1", "q2"], // NEW — select specific questions by id
     "isDraft": true              // NEW — save as draft without building export pack
   }
   ```
   - If `questionIds` is provided, ignore `manualId`; build pack from those specific questions only
   - If `isDraft` is `true`, build the pack JSON file and save the pack record but do NOT auto-export
   - If `isDraft` is absent/false and `questionIds` is absent, existing behavior unchanged (build from all approved for manual, auto-export nothing)

2. **`GET /api/packs`** response — add `isDraft: boolean` field to each `PackListItem`:
   ```ts
   // PackListItem in api.ts (backend model)
   interface PackListItem {
     packId: string;
     createdAt: string;
     totalQuestions: number;
     outputPath: string;
     name?: string;
     byManual: Record<string, number>;
     isDraft?: boolean; // NEW
   }
   ```

3. **New column in `packs` table**: `is_draft INTEGER NOT NULL DEFAULT 0` (migration)

4. **`PATCH /api/packs/{packId}`** — already exists for rename. Extend to accept `{ name?, isDraft? }`.

### What is NOT stored per-pack (panel-only metadata)
- `description` — add `description TEXT` column to `packs` table if needed (can defer, store in frontend state for MVP)
- `category` — panel-only label, not in Flutter JSON

### Validation rules (client-side, before save/export)
- Name required, non-empty
- At least 1 question selected
- Warn (non-blocking) if >50% of selected questions have `confidence < 0.7`

---

## E. Pack Metadata Field Map — Panel DB vs Flutter JSON

### Flutter-consumed pack JSON (what must NOT change)
This is the JSON downloaded by the Flutter app from Supabase Storage. Its schema is consumed by `Stage5Pack` in Flutter.

| Field | Where defined | Notes |
|-------|---------------|-------|
| `schema_version` | packs.py, hardcoded `"1.2"` | Do not change |
| `stage` | packs.py, hardcoded `"stage5_packs"` | Do not change |
| `generated_at` | packs.py | ISO timestamp |
| `manual_id` | packs.py | Source manual id |
| `manual_name` | packs.py | Source filename |
| `oem_brand` | packs.py | Hardcoded `"ROV"` |
| `vehicle_family` | packs.py | Hardcoded `"Quiz"` |
| `display_title` | packs.py | `manual_name` |
| `source_type` | packs.py | `"operator_manual"` |
| `total_filtered_questions` | packs.py | Count of questions |
| `questions[]` | packs.py | Array of question objects |
| `learning_categories[]` | packs.py | Category definitions with `question_ids` |
| `rank_profiles` | packs.py | Empty `[]` for now |
| `access_tier` | **in manifest only**, NOT in pack JSON | Set in manifest at export time |

### Panel-only fields (stored in SQLite `packs` table, NOT in Flutter JSON)
| Field | Column | Used for |
|-------|--------|----------|
| `name` | `packs.name` | Display label in panel |
| `is_draft` | `packs.is_draft` | Draft vs published filter |
| `id` | `packs.id` | Pack identifier |
| `output_path` | `packs.output_path` | Local path to pack JSON file |
| `total_questions` | `packs.total_questions` | Count display |
| `by_manual` | `packs.by_manual` | Per-manual count breakdown |
| `created_at` | `packs.created_at` | Sort order |

### Manifest fields (set at export time, stored in Supabase Storage `manifests/prod/manifest.json`)
These are set by `POST /api/packs/{packId}/export` and are what Flutter reads to find pack URLs.

| Field | Set where | Notes |
|-------|-----------|-------|
| `manual_id` | packs.py | Source manual |
| `title` | packs.py | `manual_name` |
| `version` | packs.py | Date `YYYY-MM-DD` |
| `checksum` | packs.py | SHA256 of pack JSON |
| `storage_path` | packs.py | Path in `question-packs` bucket |
| `access_tier` | packs.py export endpoint | `"free"` or `"premium"` — currently hardcoded `"free"` |
| `question_count` | packs.py | From pack JSON |
| `schema_version` | packs.py | `"1.0"` |
| `min_app_version` | packs.py | `"1.0.0"` |

**`access_tier` is currently hardcoded in the export endpoint.** For custom packs, the export should accept a per-pack `access_tier` override — either from the `packs` table or passed at export time.

---

## F. Safe Implementation Order

### Phase 1: Mode Split + API Base URL + Review UI Cleanup

**Scope (in order):**
1. Create `src/utils/featureFlags.ts` — export `DEPLOY_MODE`, `isHosted`, `canAccessUploads`, `canAccessRuns`, `API_BASE`
2. Update `src/utils/api.ts` — replace hardcoded `const API_BASE = 'http://localhost:8000/api'` with `import { API_BASE } from './featureFlags'`
3. Update `.env` — add `VITE_DEPLOY_MODE=hosted` and `VITE_API_BASE_URL=http://localhost:8000/api`
4. Update `.env.example` — add both new vars with comments
5. Update `src/vite-env.d.ts` or create it with `/// <reference types="vite/client" />` for TS autocomplete on `import.meta.env`
6. `src/App.tsx` — import `canAccessUploads`, `canAccessRuns`; conditionally render the 4 tabs. Hosted: Review+Packs only. Offline: all 4.
7. `ReviewPage.tsx` — replace triage + review dropdowns with combined dropdown using the mapping in Section B
8. `QuestionEditor.tsx` — wrap Advanced fields in `<details><summary>Advanced</summary>...</details>` (collapsible, default collapsed)
9. Add collapsible Advanced filter section in `ReviewPage.tsx` header (difficulty, min_rank, learning category)
10. `PacksPage.tsx` — add "Create Custom Pack" button stub (calls `setView('custom')` state that will be wired in Phase 2)

**Files changed:** `src/utils/featureFlags.ts` (new), `src/utils/api.ts`, `.env`, `.env.example`, `src/App.tsx`, `src/pages/ReviewPage.tsx`, `src/components/QuestionEditor.tsx`, `src/pages/PacksPage.tsx`

**Risk:** Very low — additive changes, new env vars default to current behavior. The only behavior change is tab visibility in hosted mode.
**Regression points:** API calls must still work with hosted-mode build pointing to correct backend URL.

---

### Phase 2: Custom Pack MVP

**Scope:**
1. `pdf_ingestion/api/db.py` — add `is_draft INTEGER NOT NULL DEFAULT 0` to `packs` table (migration)
2. `pdf_ingestion/api/db.py` — `create_pack()` accepts `is_draft: bool = False`; `list_packs()` returns `is_draft` in row
3. `pdf_ingestion/api/routes/packs.py` — extend `PackBuildRequest` to accept `questionIds?: list[str]` and `isDraft?: bool`; update `build_pack()` logic
4. `pdf_ingestion/api/routes/packs.py` — extend `POST /api/packs/{pack_id}/export` to accept optional `accessTierOverride?: str` body param; update manifest entry with it
5. `src/utils/api.ts` — extend `buildPack()` signature: `buildPack(manualId?: string, questionIds?: string[], isDraft?: boolean): Promise<PackBuildResponse>`
6. `src/utils/api.ts` — add `isDraft?: boolean` to `PackListItem` interface
7. `src/pages/PacksPage.tsx` — add `view: 'list' | 'custom'` state; render `<CustomPackEditorView>` when `view === 'custom'`
8. `src/components/QuestionPicker.tsx` — **new component**: loads approved questions, group by manual, checkbox multi-select, search, category filter
9. `src/components/PackMetadataForm.tsx` — **new component**: name input, description textarea, access_tier select
10. `src/components/PackActions.tsx` — Save Draft / Export to Supabase buttons; wires to `buildPack()` then `exportPackToSupabase()`
11. `src/pages/PacksPage.tsx` — wire "Back to Packs" → `setView('list')`, reload packs
12. `src/pages/PacksPage.tsx` — show "Draft" badge on packs where `isDraft === true`; enable delete on drafts

**Files changed:** `pdf_ingestion/api/db.py`, `pdf_ingestion/api/routes/packs.py`, `pdf_ingestion/api/models.py`, `src/utils/api.ts`, `src/types/pack.ts`, `src/pages/PacksPage.tsx`, `src/components/QuestionPicker.tsx` (new), `src/components/PackMetadataForm.tsx` (new), `src/components/PackActions.tsx` (new)

**Risk:** Low — new API params are optional and backward-compatible; existing pack build/export flow unchanged for callers that don't pass them.
**Regression points:** Existing pack build with `manualId` only must still work exactly as before.

---

## G. Test Matrix

### Phase 1 tests

| # | Test | Mode | Steps | Expected |
|---|------|------|-------|----------|
| 1 | Hosted mode: only Review + Packs tabs visible | hosted | Load app, inspect tab bar | Upload tab absent; Runs tab absent; Review + Packs present |
| 2 | Offline mode: all 4 tabs visible | offline | Load app, inspect tab bar | All 4 tabs present |
| 3 | Combined status dropdown — each option | offline | Select each dropdown option, check network tab | Correct `triageStatus` and/or `reviewStatus` param sent to `GET /api/review/questions` |
| 4 | Combined dropdown: "Needs Review" | offline | Select, verify | `triageStatus=needs_review` in request, no `reviewStatus` param |
| 5 | Combined dropdown: "Approved" | offline | Select, verify | `reviewStatus=approved` in request, no `triageStatus` param |
| 6 | Combined dropdown: "Awaiting Human" | offline | Select, verify | Both `triageStatus=needs_review` AND `reviewStatus=unreviewed` in request |
| 7 | Advanced fields collapsed by default | both | Load question in editor, inspect | Advanced section collapsed; stem, options, explanation, categories, approve/reject visible |
| 8 | Advanced fields expand on click | both | Click "Advanced" summary | Section expands, all advanced fields visible |
| 9 | API base URL: custom override | hosted | Set `VITE_API_BASE_URL=https://custom.api.com/api`, load app | All API calls go to custom URL (verify in network tab) |
| 10 | No regression: Review page loads questions | both | Load Review page with real backend | Questions load, triage badges shown |

### Phase 2 tests

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 11 | Custom pack editor opens in-page | Click "Create Custom Pack" in PacksPage | Pack list hidden; CustomPackEditorView shown |
| 12 | QuestionPicker loads approved questions | Open custom pack editor | Approved questions load in picker, grouped by manual |
| 13 | QuestionPicker search filters | Type in search box | Question rows filter client-side by stem text |
| 14 | QuestionPicker category filter | Select a category | Rows filter to that category only |
| 15 | Question selection syncs to selected panel | Check 3 questions | 3 items appear in right selected panel with remove buttons |
| 16 | Select all per manual group | Click "Select All" on a manual group | All questions in that group checked |
| 17 | Save draft: name required | Leave name empty, click Save | Error/disabled state; no API call |
| 18 | Save draft: no questions selected | Fill name, 0 questions, click Save | Error/disabled state; no API call |
| 19 | Save draft: success | Fill name, select 3 questions, Save | `POST /api/packs/build` called with `isDraft=true`, `questionIds=[...]`; pack appears in list with Draft badge |
| 20 | Draft in packs list | After save, back on pack list | New row with name, "Draft" badge, 3 questions count |
| 21 | Export draft to Supabase | Click Export on draft row | `POST /api/packs/{packId}/export` called; success; Flutter can download |
| 22 | Delete draft | Click delete on draft | Pack removed from list |
| 23 | Back to packs returns to list view | Click "Back to Packs" | `view === 'list'`, pack list reloaded |
| 24 | No regression: existing pack build+export | Build a normal pack (auto-approved only), export | Works exactly as before; Flutter downloads valid pack JSON |
| 25 | No regression: review page post custom-pack save | Save a custom pack, go to Review page | All existing behavior unchanged |

---

## H. Exact Files Likely to Change First (Phase 1)

1. `src/utils/featureFlags.ts` — **new file** — `DEPLOY_MODE`, `canAccessUploads`, `canAccessRuns`, `API_BASE`
2. `src/vite-env.d.ts` — **new or update** — add `/// <reference types="vite/client" />` for TS autocomplete
3. `src/utils/api.ts` — replace hardcoded `API_BASE` with import from `featureFlags`
4. `.env` — add `VITE_DEPLOY_MODE=hosted`, `VITE_API_BASE_URL=http://localhost:8000/api`
5. `.env.example` — add both new vars with comments
6. `src/App.tsx` — import flags, conditionally render 4 tabs
7. `src/pages/ReviewPage.tsx` — combined status dropdown with exact param mapping, advanced filter section
8. `src/components/QuestionEditor.tsx` — wrap Advanced fields in `<details>/<summary>`
9. `src/pages/PacksPage.tsx` — add "Create Custom Pack" button stub

## Phase 2 files
1. `pdf_ingestion/api/db.py` — `is_draft` column migration + `create_pack()`/`list_packs()` updates
2. `pdf_ingestion/api/routes/packs.py` — `PackBuildRequest` extension, build logic for `questionIds`, export override
3. `pdf_ingestion/api/models.py` — `PackBuildRequest` new fields
4. `src/utils/api.ts` — `buildPack()` signature, `PackListItem.isDraft`
5. `src/types/pack.ts` — `PackListItem.isDraft` type
6. `src/pages/PacksPage.tsx` — `view` state, `CustomPackEditorView` sub-component
7. `src/components/QuestionPicker.tsx` — **new**
8. `src/components/PackMetadataForm.tsx` — **new**
9. `src/components/PackActions.tsx` — **new** (or folded into `CustomPackEditorView`)
