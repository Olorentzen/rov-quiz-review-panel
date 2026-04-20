import type { Question, ValidationError, PackStats } from '../types/pack';
import type { QuestionReviewItem } from './api';

export function validateQuestion(question: Question, _allQuestions: Question[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required stem
  if (!question.stem || !String(question.stem).trim()) {
    errors.push({
      questionId: question.question_id,
      field: 'stem',
      severity: 'error',
      message: 'Stem is required',
    });
  }

  // Exactly 4 options
  const opts = question.options;
  if (!Array.isArray(opts) || opts.length !== 4) {
    errors.push({
      questionId: question.question_id,
      field: 'options',
      severity: 'error',
      message: 'Must have exactly 4 options',
    });
  } else {
    // Check for empty options
    opts.forEach((opt, i) => {
      if (!String(opt || '').trim()) {
        errors.push({
          questionId: question.question_id,
          field: `option_${i}`,
          severity: 'warning',
          message: `Option ${['A', 'B', 'C', 'D'][i]} is empty`,
        });
      }
    });
  }

  // Valid correct_answer_index
  const caiRaw = question.correct_answer_index;
  const cai = Number(caiRaw);
  if (isNaN(cai) || cai < 0 || cai > 3 || !Number.isInteger(cai)) {
    errors.push({
      questionId: question.question_id,
      field: 'correct_answer_index',
      severity: 'error',
      message: 'Correct answer must be A, B, C, or D (0-3)',
    });
  }

  // Empty explanation warning
  if (!question.explanation || !String(question.explanation).trim()) {
    errors.push({
      questionId: question.question_id,
      field: 'explanation',
      severity: 'warning',
      message: 'Explanation is empty',
    });
  }

  // Confidence range
  if (typeof question.confidence === 'number' && (question.confidence < 0 || question.confidence > 1)) {
    errors.push({
      questionId: question.question_id,
      field: 'confidence',
      severity: 'warning',
      message: 'Confidence should be between 0 and 1',
    });
  }

  return errors;
}

export function validatePack(questions: Question[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Per-question validation
  questions.forEach(q => {
    errors.push(...validateQuestion(q, questions));
  });

  // Duplicate question IDs
  const ids = questions.map(q => q.question_id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    const seen = new Set<string>();
    ids.forEach((id) => {
      if (seen.has(id)) {
        errors.push({
          questionId: id,
          field: 'question_id',
          severity: 'error',
          message: `Duplicate question ID: ${id}`,
        });
      } else {
        seen.add(id);
      }
    });
  }

  // Exact duplicate stems
  const exactDupGroups = detectExactDuplicateStems(questions);
  exactDupGroups.forEach(group => {
    group.forEach(id => {
      errors.push({
        questionId: id,
        field: 'stem',
        severity: 'warning',
        message: `Duplicate stem (${group.length} questions share this stem)`,
      });
    });
  });

  return errors;
}

function normalizeStem(stem: string): string {
  return stem
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectExactDuplicateStems(questions: Question[]): string[][] {
  const groups: string[][] = [];
  const stemMap = new Map<string, string[]>();

  questions.forEach(q => {
    if (!q.stem || !q.stem.trim()) return;
    const normalized = normalizeStem(q.stem);
    if (!normalized) return;
    const existing = stemMap.get(normalized) ?? [];
    existing.push(q.question_id);
    stemMap.set(normalized, existing);
  });

  stemMap.forEach(ids => {
    if (ids.length > 1) {
      groups.push(ids);
    }
  });

  return groups;
}

export function detectNearDuplicateSourceFacts(questions: Question[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  const factIdMap = new Map<string, string[]>();

  questions.forEach(q => {
    if (!q.source_fact_id) return;
    const existing = factIdMap.get(q.source_fact_id) ?? [];
    existing.push(q.question_id);
    factIdMap.set(q.source_fact_id, existing);
  });

  factIdMap.forEach((ids, factId) => {
    if (ids.length > 1) {
      groups[factId] = ids;
    }
  });

  return groups;
}

export function computePackStats(questions: Question[]): PackStats {
  const byDifficulty: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const bySubsystem: Record<string, number> = {};
  const byMinRank: Record<string, number> = {};
  const byCorrectAnswerIndex: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

  let missingExplanation = 0;
  let emptyOptions = 0;
  let invalidCorrectAnswerIndex = 0;

  questions.forEach(q => {
    // Difficulty
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1;

    // Min rank
    const rankKey = String(q.min_rank ?? '');
    byMinRank[rankKey] = (byMinRank[rankKey] ?? 0) + 1;

    // Subsystem
    if (q.subsystem_category) {
      bySubsystem[q.subsystem_category] = (bySubsystem[q.subsystem_category] ?? 0) + 1;
    }

    // Categories
    (q.learning_categories ?? []).forEach(cat => {
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    });

    // Correct answer index
    const cai = Number(q.correct_answer_index);
    if (cai >= 0 && cai <= 3 && Number.isInteger(cai)) {
      byCorrectAnswerIndex[cai]++;
    } else {
      invalidCorrectAnswerIndex++;
    }

    // Missing explanation
    if (!q.explanation || !String(q.explanation).trim()) {
      missingExplanation++;
    }

    // Empty options
    const opts = q.options ?? [];
    emptyOptions += opts.filter(o => !String(o ?? '').trim()).length;
  });

  return {
    totalQuestions: questions.length,
    byDifficulty,
    byCategory,
    bySubsystem,
    byMinRank,
    byCorrectAnswerIndex,
    missingExplanation,
    emptyOptions,
    invalidCorrectAnswerIndex,
    duplicateStemGroups: detectExactDuplicateStems(questions),
    nearDuplicateSourceFactGroups: detectNearDuplicateSourceFacts(questions),
  };
}

// ---------------------------------------------------------------------------
// Export-focused validation using QuestionReviewItem (API type)
// ---------------------------------------------------------------------------

export type ValidationIssueType =
  | 'missing_learning_categories'
  | 'invalid_correct_answer_index'
  | 'missing_options'
  | 'empty_stem'
  | 'missing_explanation'
  | 'low_confidence'
  | 'duplicate_stem';

export interface ValidationIssue {
  type: ValidationIssueType;
  questionId: string;
  questionStem: string;
  message: string;
  severity: 'blocker' | 'warning';
}

export interface PackValidationResult {
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
  isValid: boolean;
}

function isBlank(s: string | null | undefined): boolean {
  return !s || s.trim().length === 0;
}

function getStem(q: QuestionReviewItem): string {
  return (q.editedStem || q.stem || '').trim();
}

function getOptions(q: QuestionReviewItem): string[] {
  return q.editedOptions || q.options || [];
}

/**
 * Validate questions before export.
 * Uses QuestionReviewItem from the API — the live review DB data.
 */
export function validateQuestionsForExport(questions: QuestionReviewItem[]): PackValidationResult {
  const blockers: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const stemSeen = new Map<string, string>(); // lowerStem -> questionId

  for (const q of questions) {
    const stem = getStem(q);
    const options = getOptions(q);
    const lc = q.learningCategories || [];
    const lowerStem = stem.toLowerCase();

    // --- Blockers ---

    // 1. Empty/missing learning_categories
    if (lc.length === 0) {
      blockers.push({
        type: 'missing_learning_categories',
        questionId: q.questionId,
        questionStem: stem.slice(0, 80),
        message: 'No learning categories assigned',
        severity: 'blocker',
      });
    }

    // 2. Invalid/missing correct_answer_index
    if (
      q.correctAnswerIndex === null ||
      q.correctAnswerIndex === undefined ||
      q.correctAnswerIndex < 0 ||
      q.correctAnswerIndex > 3
    ) {
      blockers.push({
        type: 'invalid_correct_answer_index',
        questionId: q.questionId,
        questionStem: stem.slice(0, 80),
        message: `Invalid correct answer index (${q.correctAnswerIndex ?? 'null'})`,
        severity: 'blocker',
      });
    }

    // 3. Fewer than 4 valid options
    const validOptions = options.filter(o => !isBlank(o));
    if (validOptions.length < 4) {
      blockers.push({
        type: 'missing_options',
        questionId: q.questionId,
        questionStem: stem.slice(0, 80),
        message: `Only ${validOptions.length} valid option(s); 4 required`,
        severity: 'blocker',
      });
    }

    // 4. Empty stem
    if (isBlank(stem)) {
      blockers.push({
        type: 'empty_stem',
        questionId: q.questionId,
        questionStem: '(empty stem)',
        message: 'Stem is empty',
        severity: 'blocker',
      });
    }

    // --- Warnings ---

    // 5. Missing explanation
    const explanation = q.editedExplanation || q.explanation;
    if (isBlank(explanation)) {
      warnings.push({
        type: 'missing_explanation',
        questionId: q.questionId,
        questionStem: stem.slice(0, 80),
        message: 'Missing explanation',
        severity: 'warning',
      });
    }

    // 6. Low confidence
    if (q.confidence !== null && q.confidence !== undefined && q.confidence < 0.5) {
      warnings.push({
        type: 'low_confidence',
        questionId: q.questionId,
        questionStem: stem.slice(0, 80),
        message: `Low confidence: ${q.confidence}`,
        severity: 'warning',
      });
    }

    // 7. Duplicate stem within the pack
    if (stemSeen.has(lowerStem)) {
      warnings.push({
        type: 'duplicate_stem',
        questionId: q.questionId,
        questionStem: stem.slice(0, 80),
        message: `Duplicate stem (matches ${stemSeen.get(lowerStem)?.slice(0, 8)}...)`,
        severity: 'warning',
      });
    } else {
      stemSeen.set(lowerStem, q.questionId);
    }
  }

  return {
    blockers,
    warnings,
    isValid: blockers.length === 0,
  };
}

export function groupIssuesByType(issues: ValidationIssue[]): Partial<Record<ValidationIssueType, ValidationIssue[]>> {
  const grouped: Partial<Record<ValidationIssueType, ValidationIssue[]>> = {};
  for (const issue of issues) {
    if (!grouped[issue.type]) grouped[issue.type] = [];
    grouped[issue.type]!.push(issue);
  }
  return grouped;
}

export function formatIssueSummary(result: PackValidationResult): string {
  const parts: string[] = [];
  if (result.blockers.length > 0) {
    parts.push(`${result.blockers.length} blocking issue${result.blockers.length !== 1 ? 's' : ''}`);
  }
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning${result.warnings.length !== 1 ? 's' : ''}`);
  }
  return parts.join(', ') || 'No issues found';
}
