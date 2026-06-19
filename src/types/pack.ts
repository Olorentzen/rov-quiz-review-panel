// Stage 5 ROV Quiz Pack Types
// Matches the actual schilling-hd_packs.json schema

export interface LearningCategory {
  category_id: string;
  label: string;
  question_ids?: string[];
}

export interface RankProfile {
  rank_id: string;
  label: string;
  recommended_exam_question_count?: number;
  pass_threshold?: number;
  promotion_requirement?: string | null;
  difficulty_mix?: Record<string, number>;
  category_weights?: Record<string, number>;
  recommended_question_ids?: string[];
}

export type Difficulty = string;
export type ReviewStatus = 'unreviewed' | 'approved' | 'rejected';
export type TriageStatus = 'needs_review' | 'auto_approved' | 'auto_rejected' | 'approved' | 'rejected' | 'all';

export interface Question {
  // Metadata
  schema_version?: string;
  stage?: string;
  question_id: string;
  source_fact_id?: string;
  manual_id?: string;
  fact_type?: string;
  // Content
  stem: string;
  options: [string, string, string, string];
  correct_answer?: string;
  correct_answer_index?: number;
  explanation: string;
  source_quote?: string;
  // Classification
  difficulty: Difficulty;
  min_rank: string | number;
  subsystem_category: string;
  subsystem_label: string;
  learning_categories?: string[];
  groupId?: string | null;
  tags: string[];
  confidence?: number;
  stage5_status?: string;
  // Internal review
  isApproved?: boolean;
  reviewStatus?: ReviewStatus;
  reviewNotes?: string;
  // Triage metadata
  triageStatus?: TriageStatus;
  judgeConfidence?: number | null;
  judgePrimaryIssue?: string | null;
  judgeResultJson?: Record<string, unknown> | null;
  autoReviewedAt?: string | null;
  rejectionReason?: string | null;
  // M3 self-eval (defensive — backend may not surface these yet)
  selfVerdict?: 'pass' | 'borderline' | 'fail' | null;
  selfConfidence?: number | null;
  selfReasons?: string[];
  selfPrimaryIssue?: 'wrong_answer' | 'ambiguous_stem' | 'poor_options' | 'source_mismatch' | 'duplicate' | 'generic_voice' | 'other' | null;
}

export const MIN_RANK_OPTIONS = [
  'pilot_2',
  'pilot_1',
  'senior_pilot',
  'supervisor',
  'superintendent',
  'non_rov_personnel',
  'all',
] as const;

export const SELF_VERDICT_OPTIONS = ['pass', 'borderline', 'fail'] as const;
export const SELF_PRIMARY_ISSUE_OPTIONS = [
  'wrong_answer',
  'ambiguous_stem',
  'poor_options',
  'source_mismatch',
  'duplicate',
  'generic_voice',
  'other',
] as const;

export interface Stage5Pack {
  schema_version?: string;
  stage?: string;
  generated_at?: string;
  manual_id: string;
  manual_name: string;
  oem_brand: string;
  vehicle_family: string;
  display_title: string;
  source_type: string;
  pack_identity?: Record<string, string>;
  total_filtered_questions?: number;
  learning_categories: LearningCategory[];
  rank_profiles: RankProfile[];
  questions: Question[];
}

export interface FilterState {
  learningCategory: string | null;
  subsystemCategory: string | null;
  difficulty: string | null;
  minRank: string | null;
  factType: string | null;
  searchText: string;
  questionId: string;
  confidenceMin: number | null;
  confidenceMax: number | null;
  reviewStatus: ReviewStatus | null;
  triageStatus: TriageStatus | null;
  groupCategory: string | null;
}

export interface ValidationError {
  questionId: string;
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface PackStats {
  totalQuestions: number;
  byDifficulty: Record<string, number>;
  byCategory: Record<string, number>;
  bySubsystem: Record<string, number>;
  byMinRank: Record<string, number>;
  byCorrectAnswerIndex: Record<number, number>;
  missingExplanation: number;
  emptyOptions: number;
  invalidCorrectAnswerIndex: number;
  duplicateStemGroups: string[][];
  nearDuplicateSourceFactGroups: Record<string, string[]>;
}

export interface PackState {
  pack: Stage5Pack | null;
  isDirty: boolean;
  selectedQuestionId: string | null;
  filters: FilterState;
  validationErrors: ValidationError[];
  isLoading: boolean;
}

export const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard', 'beginner', 'intermediate', 'advanced', 'expert'];

export const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export const REVIEW_STATUS_OPTIONS: ReviewStatus[] = ['unreviewed', 'approved', 'rejected'];
