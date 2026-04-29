# ROV Quiz Review Panel — Reviewer Guide

**URL:** https://review.db-electronics.no

The Review Panel is used by subject-matter experts to review, edit, and approve multiple-choice questions generated from ROV operation manuals. Approved questions are exported to Supabase and eventually appear in the ROV Quiz app.

---

## 1. Getting Started

### First-Time Setup

1. Go to **https://review.db-electronics.no**
2. Click **Create account**
3. Enter your email and a password containing:
   - At least 8 characters
   - One uppercase letter
   - One lowercase letter
   - One number
4. Click **Create Account**
5. Check your email at `auth@db-electronics.no` for a confirmation link
6. Click the link in the email
7. Return to the sign-in page and sign in with your credentials

**Note:** After confirming your email, your account must be approved by an administrator before you can access the full panel. If you see "Account pending approval" after signing in, contact an administrator.

### Signing In

1. Go to **https://review.db-electronics.no**
2. Enter your email and password
3. Click **Sign In**

If you forget your password, click **Forgot password?** on the sign-in screen and enter your email. A reset link will be sent to your inbox.

---

## 2. The Review Panel — Overview

After signing in, the panel has five tabs:

| Tab | Purpose |
|-----|---------|
| **Review** | Review, edit, approve, or reject questions |
| **Runs** | Monitor pipeline jobs (PDF processing) |
| **Packs** | Build question packs and export to Supabase |
| **Groups** | Manage question group categories |
| **Upload** | *(Admin only)* Upload new PDF manuals |

The **Review** tab is the main workspace for reviewers.

---

## 3. Review Tab — Working with Questions

### Filtering the Question List

The left panel lists all questions. Use the filters at the top to find questions:

- **All Manuals** dropdown — filter by a specific manual
- **Status** dropdown — filter by triage/review state:
  - **Needs Review** — questions auto-triaged as uncertain, require human review
  - **Auto-Approved** — passed automated checks, but still need reviewer sign-off
  - **Awaiting Human** — needs_review triage + unreviewed status
  - **Approved** — reviewed and approved by a human
  - **Rejected** — reviewed and rejected
  - **Auto-Rejected** — failed automated checks
  - **All Questions** — show everything
- **Search** — search question text, tags, or subsystem labels
- **All Groups** dropdown — filter by group category

### Question Status Flow

```
auto_approved → approved (human reviews and confirms)
needs_review  → approved (human approves)
needs_review  → rejected (human rejects, must provide reason)
auto_rejected → approved (human overrides rejection)
auto_rejected → rejected (human confirms rejection)
```

### Opening and Editing a Question

Click any question in the left panel to open it in the editor on the right.

The editor shows:
- **Question stem** — the question text
- **Options** — four answer choices (A–D)
- **Correct answer** — which option is correct (all generated questions have **A** as the correct answer; the Flutter quiz app randomizes the order of options so players see them in a shuffled sequence)
- **Explanation** — why the answer is correct
- **Difficulty** — pilot level (pilot_1 through pilot_5)
- **Learning Categories** — select one or more categories
- **Group** — assign the question to a group

To approve or reject:
- Use the **Approve** or **Reject** buttons in the editor
- When rejecting, you must enter a **rejection reason**

### Bulk Actions

Select multiple questions by checking the boxes next to them, then use the toolbar above the list:

- **Approve Selected** — approve all selected questions
- **Reject Selected** — reject all selected questions
- **Delete Selected** — permanently delete selected questions
- **Select All** / **Clear** — select/deselect all visible questions

### Creating a New Question

Click **+ New Question** in the top bar to manually create a question (for cases where the pipeline missed something).

### Validation Panel

The panel on the right side of the Review tab shows:
- **Validation errors** — problems that will block export (e.g., missing correct answer)
- **Pack statistics** — counts of approved questions by difficulty, category, and group

---

## 4. Runs Tab — Monitoring Pipeline Jobs

The **Runs** tab shows the status of all PDF processing jobs, including both active jobs and completed runs.

### Job Statuses

| Status | Meaning |
|--------|---------|
| Pending | Queued, not yet started |
| Queued | Waiting in the processing queue |
| Running | Actively being processed |
| Completed | Finished successfully |
| Failed | Encountered an error |
| Cancelled | Manually cancelled |

### Pipeline Steps

Each job goes through these steps:

1. **Parse PDF** — extract raw text from the manual
2. **Segment / Chunk** — split text into manageable sections
3. **Extract Facts** — pull factual statements from each chunk
4. **Generate MCQs** — create multiple-choice questions from facts
5. **Review Prep** — format questions for review and publish to Supabase

### Viewing Job Details

Click any job in the list to see:
- Current step and overall progress
- Duration of each completed step
- Error messages (for failed steps)
- Recent log entries

For **Running** or **Queued** jobs, you can click **Cancel** to stop processing.

For **Failed** or **Cancelled** jobs, you can click **Delete** to remove the job record.

---

## 5. Packs Tab — Building and Exporting Question Packs

Once questions are approved, you can build them into packs and export to Supabase for use in the Flutter app.

### Approved Questions by Group

The top of the Packs tab shows a count of approved questions per group. Use this to see how many approved questions exist before building a pack.

### Building a Pack

1. Select a **Group** from the dropdown (or leave blank for all groups combined)
2. Click **Build Pack**
3. The system assembles all approved questions for the selected group(s)
4. A pack file is generated and saved locally

### Exporting a Pack to Supabase

After building a pack, click **Export to Supabase** next to any built pack to push it to the shared Supabase database.

Before exporting, the system validates the pack. If there are **validation errors** (e.g., questions without a correct answer set), the export is blocked and the errors are shown. You must fix these questions in the **Review** tab before exporting.

### Custom Packs

Click **+ Create Custom Pack** to manually select which approved questions to include in a pack, rather than including all approved questions for a group.

- **Save Draft** — saves the selection for later
- **Export** — immediately exports the custom pack

### Pack History

All previously built packs are listed below. Each pack shows:
- Name and creation date
- Number of questions
- Output file path

Actions available per pack:
- **Open File** — view/download the pack JSON file
- **Edit** — modify the pack's question selection
- **Export to Supabase** — push to Supabase
- **Rename** — change the pack name
- **Delete** — remove the pack

---

## 6. Groups Tab — Managing Question Categories

The **Groups** tab lets you create and manage question group categories.

### Default Groups

The system ships with these standard groups:
- `pilot_1` — Pilot Level 1
- `pilot_2` — Pilot Level 2
- `pilot_3` — Pilot Level 3
- `pilot_4` — Pilot Level 4
- `pilot_5` — Pilot Level 5
- `general` — General knowledge
- `safety` — Safety-related
- `equipment` — Equipment operation
- `procedures` — Standard procedures

### Creating a New Group

1. Click **+ New Group**
2. Enter an **ID** (lowercase, hyphenated, e.g., `my-group`)
3. Enter a **Label** (human-readable name, e.g., "My Group")
4. Set a **Sort Order** (controls display order)
5. Click **Create**

### Editing or Deactivating a Group

Click **Edit** next to any group to change its label or sort order. Use the **Deactivate** button to deactivate a group (it remains in the database but is hidden from the dropdown).

---

## 7. Common Workflows

### Reviewing New Questions from a Manual

1. Wait for the pipeline run to complete (**Runs** tab)
2. Go to the **Review** tab
3. Select the manual from the **All Manuals** dropdown
4. Filter by **Needs Review** to see questions requiring attention
5. Click through questions, reading the stem, options, explanation, and metadata
6. For each question, either:
   - Click **Approve** if the question is correct
   - Click **Reject** and enter a reason if the question is wrong or poor quality
7. Use bulk select for large batches of clearly good or bad questions

### Exporting Questions to the Quiz App

1. Ensure all questions you want to export are **Approved** in the Review tab
2. Go to the **Packs** tab
3. Check the **Approved Questions by Group** summary
4. Select a group and click **Build Pack**
5. Click **Export to Supabase** on the built pack
6. The questions are now available in the Flutter quiz app

### Handling Questions That Block Export

If an export is blocked due to validation errors:

1. Note the error message (identifies the problem question)
2. Go to the **Review** tab
3. Find the question (search by ID or stem text)
4. Fix the issue (e.g., set correct answer, fill in explanation)
5. Return to **Packs** and try exporting again

---

## 8. Troubleshooting

### "Account pending approval" after sign in

Your account has not yet been approved. Contact an administrator to approve your account in the Supabase dashboard.

### No questions appearing in the Review tab

1. Check that pipeline runs have completed successfully in the **Runs** tab
2. Verify the manual filter dropdown at the top is set to **All Manuals** or a specific manual
3. Verify the status filter is set to show questions (e.g., **Needs Review** or **All Questions**)

### Pipeline run failed

Click the failed job in the **Runs** tab to see which step failed and what error occurred. Common causes:
- Corrupted or scanned PDF (text not extractable)
- Manual already processed
- API rate limit from LLM provider

Contact an administrator if the issue persists.

### Questions not exporting to Supabase

Check the **Packs** tab for validation errors. Export is blocked if any approved question has a critical validation error (missing correct answer, empty stem, etc.). Fix the flagged questions in the **Review** tab and try again.

### Forgotten password

On the sign-in page, click **Forgot password?** and enter your email. A reset link will be sent to your inbox.
