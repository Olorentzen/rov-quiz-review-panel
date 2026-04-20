# ROV Quiz Review Panel

React dashboard for the PDF-to-quiz ingestion pipeline. Upload PDFs, monitor pipeline runs, review generated questions, and export approved packs.

## Prerequisites

- Node.js 18+
- The PDF Ingestion API backend running (see [pdfingestion README](../pdfingestion/README.md))

## Setup

```bash
npm install
```

## Running the Dashboard

```bash
npm run dev
```

The dashboard runs at `http://localhost:5173`.

## Connecting to the Backend

The dashboard connects to the FastAPI backend at `http://localhost:8000`. Ensure the API server is running first:

```bash
# From the pdfingestion workspace
python run_api.py
```

The API status indicator in the top-right corner shows connection health. A green dot means the API is reachable; a red dot means it is offline.

## Pages

### Upload

Upload PDF manuals and trigger pipeline runs. Select which steps to run (parse, segment, extract, generate, review_prep) or run all at once.

### Runs

Monitor active and completed pipeline runs. Shows per-step status, progress bars, ETA, and recent log entries. Cancel running jobs from this page.

### Review

Review and edit generated questions. Filter by manual, review status, and text search. Approve or reject individual questions. Bulk actions are available for multi-select.

### Packs

View approved question counts per manual and build export packs. Built packs are written to `data/stage5/exports/` in the pdfingestion workspace.

## Environment Variables

The API base URL is configured in `src/utils/api.ts`. To change the backend URL:

```ts
const API_BASE = 'http://localhost:8000/api'; // or your deployed URL
```

## Seeding Test Data

To test the review flow without running the full pipeline:

```python
# From the pdfingestion workspace (Python shell or script)
from pdf_ingestion.api.db import upsert_review_question

for i in range(5):
    upsert_review_question(
        question_id=f"test-q-{i:03d}",
        job_id="job_test001",
        manual_id="manual_test001",
        manual_name="test_manual.pdf",
        stem=f"What is the capital of country {i}?",
        options=[f"City A{i}", f"City B{i}", f"City C{i}", f"City D{i}"],
        correct_answer=f"City B{i}",
        correct_answer_index=1,
        explanation=f"City B{i} is the capital of country {i}.",
        difficulty=["easy", "medium", "hard"][i % 3],
        min_rank="pilot_1",
        confidence=0.7 + (i * 0.05),
        tags=["test", f"category-{i % 2}"],
    )
```

Then visit the Review tab to see the seeded questions.

## Troubleshooting

**Dashboard shows "API Offline"**

- Ensure the API server is running: `curl http://localhost:8000/api/health`
- Check that `API_BASE` in `src/utils/api.ts` matches the server address (default: `http://localhost:8000/api`)
- Check the browser console for CORS errors — the API must allow `localhost:5173`

**Review page shows questions but bulk approve/reject does nothing**

- Open the browser console — the bulk action sends `PATCH /api/review/questions/:id` for each selected question
- Verify the backend is reachable and the question IDs in the UI match IDs in the database

**Packs page shows "0 approved" after approving questions**

- The build pack endpoint only counts questions with `reviewStatus = 'approved'`
- Ensure you clicked the confirm/approve button on individual questions (not just selecting them)
- Refresh the page to see updated counts

**CSS/styling looks broken**

The dashboard uses CSS custom properties defined in `src/styles/index.css`. Ensure the CSS file is imported in `src/main.tsx`:

```ts
import './styles/index.css';
```
