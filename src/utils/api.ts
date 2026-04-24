// API service for pdfingest backend
//
// All /api/* routes require a Supabase JWT token (except /api/health).
// The token is stored in localStorage under the key 'pdfingest_token' and
// injected into every request via the Authorization header.

import { API_BASE } from './featureFlags';
const TOKEN_KEY = 'pdfingest_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function _injectAuth(headers: HeadersInit = {}): HeadersInit {
  const token = getAuthToken();
  if (token) {
    return {
      ...headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Auth token is required for all /api/* routes (except /api/health).
  // If no token is present and this is an auth-required route, surface a clear error.
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ..._injectAuth(options?.headers as Record<string, string> | undefined),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    const body = await res.text().catch(() => '');
    throw new Error(`Unauthorized (401). Log in again or check your Supabase token. Detail: ${body}`);
  }
  if (res.status === 422) {
    // Read body ONCE, then parse — res.json() consumes the body stream
    const text = await res.text();
    let detail: { blockers?: Array<{ message: string }> } | string | null = null;
    try {
      detail = JSON.parse(text);
    } catch {
      detail = text;
    }
    if (detail && typeof detail === 'object' && 'blockers' in detail && Array.isArray(detail.blockers) && detail.blockers.length > 0) {
      const b = detail.blockers;
      throw new Error(
        `Export blocked: ${b[0].message}${b.length > 1 ? ` (+${b.length - 1} more)` : ''}`
      );
    }
    throw new Error(`Validation failed (422): ${text}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  const text = await res.text();
  if (!text) return {} as T;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(`Expected JSON but got ${ct} from ${path}: ${text.slice(0, 100)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from ${path}: ${text.slice(0, 100)}`);
  }
}

// ---------------------------------------------------------------------------
// Types (mirror backend models)
// ---------------------------------------------------------------------------

export interface Manual {
  id: string;
  filename: string;
  uploadedAt: string;
  size: number;
  status: 'uploaded';
}

export type JobStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface JobStep {
  step: string;
  status: StepStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  message: string | null;
}

export interface JobLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface JobListItem {
  id: string;
  manualId: string;
  manualName: string;
  status: JobStatus;
  currentStep: string | null;
  progressPct: number;
  etaSeconds: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  queueRank?: number | null;
}

export interface QueuedJobInfo {
  jobId: string;
  manualId: string;
  manualName: string;
  queueRank: number;
}

export interface QueueStatusResponse {
  workerActive: boolean;
  currentJobId: string | null;
  currentJobManualId: string | null;
  queueLength: number;
  queuedJobs: QueuedJobInfo[];
}

export interface BatchEnqueueResponse {
  jobIds: string[];
  queuePosition: number;
  totalQueued: number;
}

export interface JobDetail {
  id: string;
  manualId: string;
  manualName: string;
  status: JobStatus;
  currentStep: string | null;
  progressPct: number;
  etaSeconds: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  steps: JobStep[];
  logs: JobLogEntry[];
}

export type QuestionReviewStatus = 'unreviewed' | 'approved' | 'rejected';
export type TriageStatus = 'needs_review' | 'auto_approved' | 'auto_rejected' | 'approved' | 'rejected' | 'all';

export interface QuestionReviewItem {
  id: string;
  questionId: string;
  manualId: string;
  manualName: string;
  jobId: string;
  reviewStatus: QuestionReviewStatus;
  triageStatus: TriageStatus;
  sourceQuote: string | null;
  subsystemCategory: string | null;
  subsystemLabel: string | null;
  factType: string | null;
  stem: string;
  options: string[];
  correctAnswer: string | null;
  correctAnswerIndex: number | null;
  explanation: string | null;
  difficulty: string | null;
  minRank: string | null;
  confidence: number | null;
  tags: string[];
  learningCategories: string[];
  groupId: string | null;
  editedStem: string | null;
  editedOptions: string[] | null;
  editedExplanation: string | null;
  rejectionReason: string | null;
  judgeConfidence: number | null;
  judgePrimaryIssue: string | null;
  judgeResultJson: Record<string, unknown> | null;
  autoReviewedAt: string | null;
}

export interface PackBuildResponse {
  packId: string;
  outputPath: string;
  totalQuestions: number;
  byManual: Record<string, number>;
}

export interface PackListItem {
  packId: string;
  createdAt: string;
  totalQuestions: number;
  outputPath: string;
  name: string | null;
  slug: string | null;
  byManual: Record<string, number>;
  byGroup: Record<string, number>;
  isDraft?: boolean;
  questionIds?: string[];
}

// ---------------------------------------------------------------------------
// Manuals
// ---------------------------------------------------------------------------

export async function uploadManual(files: File[]): Promise<Manual> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/manuals/upload`, { method: 'POST', body: form, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export async function listManuals(): Promise<Manual[]> {
  return request<Manual[]>('/manuals');
}

export async function deleteManual(manualId: string): Promise<void> {
  await request(`/manuals/${manualId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function createJob(manualId: string, steps?: string[]): Promise<JobListItem> {
  return request<JobListItem>('/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manualId, steps }),
  });
}

export async function listJobs(): Promise<JobListItem[]> {
  return request<JobListItem[]>('/jobs');
}

export async function getJob(jobId: string): Promise<JobDetail> {
  return request<JobDetail>(`/jobs/${jobId}`);
}

export async function getJobLogs(jobId: string): Promise<JobLogEntry[]> {
  return request<JobLogEntry[]>(`/jobs/${jobId}/logs`);
}

export async function cancelJob(jobId: string): Promise<void> {
  await request(`/jobs/${jobId}/cancel`, { method: 'DELETE' });
}

export async function deleteJob(jobId: string): Promise<void> {
  await request(`/jobs/${jobId}`, { method: 'DELETE' });
}

export async function batchEnqueueJobs(manualIds: string[], steps?: string[]): Promise<BatchEnqueueResponse> {
  return request<BatchEnqueueResponse>('/jobs/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manualIds, steps }),
  });
}

export async function getQueueStatus(): Promise<QueueStatusResponse> {
  return request<QueueStatusResponse>('/jobs/queue/status');
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export async function listQuestions(params?: {
  manualId?: string;
  jobId?: string;
  reviewStatus?: QuestionReviewStatus;
  triageStatus?: TriageStatus;
  groupId?: string;
}): Promise<QuestionReviewItem[]> {
  const qs = new URLSearchParams();
  if (params?.manualId) qs.set('manual_id', params.manualId);
  if (params?.jobId) qs.set('job_id', params.jobId);
  if (params?.reviewStatus) qs.set('review_status', params.reviewStatus);
  if (params?.triageStatus && params.triageStatus !== 'all') qs.set('triage_status', params.triageStatus);
  if (params?.groupId) qs.set('group_id', params.groupId);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<QuestionReviewItem[]>(`/review/questions${query}`);
}

export interface LearningCategory {
  category_id: string;
  label: string;
  question_ids?: string[];
}

export interface GroupOption {
  id: string;
  label: string;
}

/** Hardcoded fallback — used only if the API is unavailable. */
export const GROUP_OPTIONS: GroupOption[] = [
  { id: 'schilling-hd', label: 'Schilling HD' },
  { id: 'kystdesign-constructor', label: 'Kystdesign Constructor' },
  { id: 'general-electrical', label: 'General Electrical' },
  { id: 'general-hydraulic', label: 'General Hydraulic' },
  { id: 'general-rov-operations', label: 'General ROV Operations' },
  { id: 'safety-procedures', label: 'Safety / Procedures' },
];

export async function listGroups(): Promise<GroupOption[]> {
  try {
    return await request<GroupOption[]>('/groups');
  } catch {
    // Fallback to hardcoded values if API is unavailable
    return GROUP_OPTIONS;
  }
}

export async function listAllGroups(): Promise<GroupOption[]> {
  try {
    return await request<GroupOption[]>('/groups/all');
  } catch {
    return GROUP_OPTIONS;
  }
}

export interface UpsertGroupParams {
  id: string;
  label: string;
  isActive?: boolean;
  sortOrder?: number;
}

export async function createGroup(params: UpsertGroupParams): Promise<GroupOption> {
  return request<GroupOption>('/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function updateGroup(groupId: string, params: UpsertGroupParams): Promise<GroupOption> {
  return request<GroupOption>(`/groups/${groupId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function deleteGroup(groupId: string): Promise<void> {
  await request(`/groups/${groupId}`, { method: 'DELETE' });
}

export async function listCategories(): Promise<LearningCategory[]> {
  return request<LearningCategory[]>(`/review/categories`);
}

export async function updateQuestion(
  qId: string,
  data: {
    reviewStatus: QuestionReviewStatus;
    editedStem?: string;
    editedOptions?: string[];
    editedExplanation?: string;
    rejectionReason?: string;
    triageStatus?: TriageStatus;
    learningCategories?: string[];
    groupId?: string;
  }
): Promise<QuestionReviewItem> {
  return request<QuestionReviewItem>(`/review/questions/${qId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteQuestion(qId: string): Promise<void> {
  await request(`/review/questions/${qId}`, { method: 'DELETE' });
}

export async function duplicateQuestion(qId: string): Promise<QuestionReviewItem> {
  return request<QuestionReviewItem>(`/review/questions/${qId}/duplicate`, { method: 'POST' });
}

export interface CreateQuestionParams {
  stem: string;
  options: string[];
  correctAnswerIndex?: number;
  explanation?: string;
  difficulty?: string;
  minRank?: string;
  tags?: string[];
  learningCategories?: string[];
  groupId: string;
}

export async function createQuestion(params: CreateQuestionParams): Promise<QuestionReviewItem> {
  return request<QuestionReviewItem>('/review/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

// ---------------------------------------------------------------------------
// Packs
// ---------------------------------------------------------------------------

export async function buildPack(params: {
  manualId?: string;
  groupId?: string;
  questionIds?: string[];
  isDraft?: boolean;
}): Promise<PackBuildResponse> {
  return request<PackBuildResponse>('/packs/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function listPacks(): Promise<PackListItem[]> {
  return request<PackListItem[]>('/packs');
}

export async function getPack(packId: string): Promise<PackListItem> {
  return request<PackListItem>(`/packs/${packId}`);
}

export async function renamePack(packId: string, name: string): Promise<PackListItem> {
  return request<PackListItem>(`/packs/${packId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function deletePack(packId: string): Promise<void> {
  await request(`/packs/${packId}`, { method: 'DELETE' });
}

export async function updatePackQuestions(packId: string, questionIds: string[]): Promise<PackListItem> {
  return request<PackListItem>(`/packs/${packId}/questions`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionIds }),
  });
}

export function getPackDownloadUrl(packId: string): string {
  return `${API_BASE}/packs/${packId}/download`;
}

export interface PackExportResult {
  pack_id: string;
  storage_path: string;
  checksum: string;
  question_count: number;
  manifest_updated: boolean;
}

export async function exportPackToSupabase(packId: string): Promise<PackExportResult> {
  return request<PackExportResult>(`/packs/${packId}/export`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function checkHealth(): Promise<{ status: string; version: string }> {
  return request<{ status: string; version: string }>('/health');
}

export async function bootstrapProfile(): Promise<{ status: string; profile_id: string }> {
  return request<{ status: string; profile_id: string }>('/auth/bootstrap', { method: 'POST' });
}

export const ALL_STEPS = ['parse', 'segment', 'extract', 'generate', 'review_prep'];
