import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Question, FilterState, ReviewStatus, TriageStatus } from '../types/pack';
import {
  listQuestions,
  updateQuestion,
  deleteQuestion,
  duplicateQuestion,
  listManuals,
  listCategories,
  listGroups,
  GROUP_OPTIONS,
  type Manual,
  type QuestionReviewItem,
  type QuestionReviewStatus,
  type TriageStatus as TriageStatusType,
  type LearningCategory,
  type GroupOption,
} from '../utils/api';
import QuestionList from '../components/QuestionList';
import QuestionEditor from '../components/QuestionEditor';
import ValidationPanel from '../components/ValidationPanel';
import NewQuestionModal from '../components/NewQuestionModal';
import { validatePack, computePackStats } from '../utils/validation';

// Combined status dropdown option → API param mapping
export type CombinedStatus =
  | 'all'
  | 'needs_review'
  | 'auto_approved'
  | 'awaiting_human'
  | 'approved'
  | 'rejected'
  | 'auto_rejected';

export function combinedStatusParams(status: CombinedStatus): { triageStatus?: TriageStatus; reviewStatus?: ReviewStatus } {
  switch (status) {
    case 'all':           return {};
    case 'needs_review':   return { triageStatus: 'needs_review' };
    case 'auto_approved': return { triageStatus: 'auto_approved' };
    case 'awaiting_human': return { triageStatus: 'needs_review', reviewStatus: 'unreviewed' };
    case 'approved':      return { reviewStatus: 'approved' };
    case 'rejected':      return { reviewStatus: 'rejected' };
    case 'auto_rejected': return { triageStatus: 'auto_rejected' };
  }
}

const DEFAULT_FILTERS: FilterState = {
  learningCategory: null,
  subsystemCategory: null,
  difficulty: null,
  minRank: null,
  factType: null,
  searchText: '',
  questionId: '',
  confidenceMin: null,
  confidenceMax: null,
  reviewStatus: null,
  triageStatus: 'needs_review',
  groupCategory: null,
};

function filterQuestions(questions: Question[], filters: FilterState): Question[] {
  return questions.filter(q => {
    if (filters.subsystemCategory && q.subsystem_category !== filters.subsystemCategory) return false;
    if (filters.difficulty && q.difficulty !== filters.difficulty) return false;
    if (filters.triageStatus && filters.triageStatus !== 'all' && q.triageStatus !== filters.triageStatus) return false;
    if (filters.confidenceMin !== null && (q.confidence === undefined || q.confidence < filters.confidenceMin)) return false;
    if (filters.confidenceMax !== null && (q.confidence === undefined || q.confidence > filters.confidenceMax)) return false;
    if (filters.groupCategory && q.groupId !== filters.groupCategory) return false;
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      const matchesStem = q.stem.toLowerCase().includes(search);
      const matchesTags = q.tags.some(t => t.toLowerCase().includes(search));
      const matchesSubsystem = q.subsystem_label.toLowerCase().includes(search);
      if (!matchesStem && !matchesTags && !matchesSubsystem) return false;
    }
    return true;
  });
}

function reviewItemToQuestion(item: QuestionReviewItem): Question {
  return {
    question_id: item.questionId,
    manual_id: item.manualId,
    stem: item.editedStem || item.stem,
    options: (item.editedOptions || item.options) as [string, string, string, string],
    correct_answer: item.correctAnswer || '',
    correct_answer_index: item.correctAnswerIndex ?? 0,
    explanation: item.editedExplanation || item.explanation || '',
    difficulty: (item.difficulty || 'medium') as Question['difficulty'],
    min_rank: (item.minRank || 'pilot_1') as Question['min_rank'],
    subsystem_category: item.subsystemLabel || 'unknown',
    subsystem_label: item.subsystemLabel || '',
    tags: item.tags || [],
    learning_categories: item.learningCategories || [],
    groupId: item.groupId ?? undefined,
    confidence: item.confidence || 0,
    source_quote: item.sourceQuote || '',
    fact_type: item.factType || '',
    reviewStatus: item.reviewStatus,
    reviewNotes: item.rejectionReason ?? undefined,
    triageStatus: item.triageStatus,
    judgeConfidence: item.judgeConfidence ?? null,
    judgePrimaryIssue: item.judgePrimaryIssue ?? null,
    judgeResultJson: item.judgeResultJson ?? null,
    autoReviewedAt: item.autoReviewedAt ?? null,
  };
}

export default function ReviewPage() {
  const [questions, setQuestions] = useState<QuestionReviewItem[]>([]);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [learningCategories, setLearningCategories] = useState<LearningCategory[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>(GROUP_OPTIONS);
  const [selectedManualId, setSelectedManualId] = useState<string>('');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);

  const loadManuals = useCallback(async () => {
    try {
      const list = await listManuals();
      setManuals(list);
    } catch (e) { /* ignore */ }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await listCategories();
      setLearningCategories(cats);
    } catch (e) { /* ignore */ }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const gs = await listGroups();
      setGroups(gs);
    } catch (e) { /* ignore */ }
  }, []);

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params: { manualId?: string; reviewStatus?: QuestionReviewStatus; triageStatus?: TriageStatusType; groupId?: string } = {};
      if (selectedManualId) params.manualId = selectedManualId;
      if (filters.reviewStatus) params.reviewStatus = filters.reviewStatus as QuestionReviewStatus;
      if (filters.triageStatus && filters.triageStatus !== 'all') params.triageStatus = filters.triageStatus;
      if (filters.groupCategory) params.groupId = filters.groupCategory;
      const list = await listQuestions(params);
      setQuestions(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  }, [selectedManualId, filters.reviewStatus, filters.triageStatus, filters.groupCategory]);

  // Derived combined status from current filter state
  const getCombinedStatus = (): CombinedStatus => {
    if (filters.triageStatus === 'needs_review' && !filters.reviewStatus) return 'needs_review';
    if (filters.triageStatus === 'auto_approved' && !filters.reviewStatus) return 'auto_approved';
    if (filters.triageStatus === 'needs_review' && filters.reviewStatus === 'unreviewed') return 'awaiting_human';
    if (filters.triageStatus === 'auto_rejected' && !filters.reviewStatus) return 'auto_rejected';
    if (filters.reviewStatus === 'approved' && !filters.triageStatus) return 'approved';
    if (filters.reviewStatus === 'rejected' && !filters.triageStatus) return 'rejected';
    return 'all';
  };

  const handleCombinedStatusChange = (status: CombinedStatus) => {
    if (status === 'all') {
      setFilters(prev => ({ ...prev, triageStatus: 'all', reviewStatus: null }));
      return;
    }
    const { triageStatus, reviewStatus } = combinedStatusParams(status);
    setFilters(prev => ({
      ...prev,
      triageStatus: triageStatus ?? 'all',
      reviewStatus: reviewStatus ?? null,
    }));
  };

  useEffect(() => {
    loadManuals();
    loadCategories();
    loadGroups();
  }, [loadManuals, loadCategories, loadGroups]);

  // Sync triage/review filters from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ts = params.get('triage_status') as TriageStatus | null;
    const rs = params.get('review_status') as ReviewStatus | null;
    const gc = params.get('group_category');
    if (ts === 'all' || (!ts && !rs)) {
      setFilters(prev => ({ ...prev, triageStatus: 'all', reviewStatus: null, groupCategory: gc || null }));
      return;
    }
    const combined = (
      ts === 'needs_review' && rs === 'unreviewed' ? 'awaiting_human'
        : ts === 'needs_review' ? 'needs_review'
        : ts === 'auto_approved' ? 'auto_approved'
        : ts === 'auto_rejected' ? 'auto_rejected'
        : rs === 'approved' ? 'approved'
        : rs === 'rejected' ? 'rejected'
        : 'all'
    );
    const { triageStatus, reviewStatus } = combinedStatusParams(combined);
    setFilters(prev => ({
      ...prev,
      triageStatus: triageStatus ?? 'all',
      reviewStatus: reviewStatus ?? null,
      groupCategory: gc || null,
    }));
  }, []);

  // Update URL when combined status changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.triageStatus && filters.triageStatus !== 'needs_review') {
      params.set('triage_status', filters.triageStatus);
    }
    if (filters.reviewStatus) {
      params.set('review_status', filters.reviewStatus);
    }
    if (filters.groupCategory) {
      params.set('group_category', filters.groupCategory);
    }
    const search = params.toString();
    const newUrl = search ? `${window.location.pathname}?${search}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [filters.triageStatus, filters.reviewStatus, filters.groupCategory]);

  // Support browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const ts = params.get('triage_status') as TriageStatus | null;
      const rs = params.get('review_status') as ReviewStatus | null;
      const gc = params.get('group_category');
      if (ts === 'all' || (!ts && !rs)) {
        setFilters(prev => ({ ...prev, triageStatus: 'all', reviewStatus: null, groupCategory: gc || null }));
        return;
      }
      const combined = (
        ts === 'needs_review' && rs === 'unreviewed' ? 'awaiting_human'
          : ts === 'needs_review' ? 'needs_review'
          : ts === 'auto_approved' ? 'auto_approved'
          : ts === 'auto_rejected' ? 'auto_rejected'
          : rs === 'approved' ? 'approved'
          : rs === 'rejected' ? 'rejected'
          : 'all'
      );
      const { triageStatus, reviewStatus } = combinedStatusParams(combined);
      setFilters(prev => ({
        ...prev,
        triageStatus: triageStatus ?? 'all',
        reviewStatus: reviewStatus ?? null,
        groupCategory: gc || null,
      }));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const questions2: Question[] = useMemo(() => questions.map(reviewItemToQuestion), [questions]);
  const filteredQuestions = useMemo(() => filterQuestions(questions2, filters), [questions2, filters]);
  const validationErrors = useMemo(() => validatePack(questions2), [questions2]);
  const packStats = useMemo(() => computePackStats(questions2), [questions2]);

  const selectedQuestion = useMemo(
    () => questions2.find(q => q.question_id === selectedQuestionId) ?? null,
    [questions2, selectedQuestionId]
  );

  const handleUpdateQuestion = useCallback(async (updated: Question) => {
    const reviewItem = questions.find(q => q.questionId === updated.question_id);
    if (!reviewItem) return;

    const status = updated.reviewStatus || 'unreviewed';
    // Sync triageStatus with reviewStatus when human makes a decision
    const triageStatus: TriageStatus =
      status === 'approved' ? 'approved'
      : status === 'rejected' ? 'rejected'
      : reviewItem.triageStatus;

    setQuestions(prev => prev.map(q => {
      if (q.questionId !== updated.question_id) return q;
      return {
        ...q,
        stem: updated.stem,
        options: updated.options,
        explanation: updated.explanation,
        difficulty: updated.difficulty,
        minRank: String(updated.min_rank),
        reviewStatus: (updated.reviewStatus || 'unreviewed') as QuestionReviewItem['reviewStatus'],
        triageStatus: triageStatus as QuestionReviewItem['triageStatus'],
        rejectionReason: updated.reviewNotes ?? null,
        learningCategories: updated.learning_categories ?? [],
        groupId: updated.groupId ?? null,
      };
    }));

    try {
      await updateQuestion(reviewItem.id, {
        reviewStatus: status,
        editedStem: updated.stem,
        editedOptions: updated.options as string[],
        editedExplanation: updated.explanation || undefined,
        rejectionReason: updated.reviewNotes || undefined,
        triageStatus,
        learningCategories: updated.learning_categories,
        groupId: updated.groupId ?? undefined,
      });
    } catch (err: unknown) {
      // Revert on error
      setQuestions(questions);
      // If 422 (validation error from backend), re-throw so the editor shows inline error
      if (err instanceof Error && err.message.includes('422')) {
        throw err;
      }
    }
  }, [questions]);

  const handleBulkSetReviewStatus = useCallback(async (status: ReviewStatus) => {
    const triageStatus: TriageStatus =
      status === 'approved' ? 'approved'
      : status === 'rejected' ? 'rejected'
      : 'needs_review';
    const toUpdate = questions2.filter(q => selectedQuestionIds.has(q.question_id));
    for (const q of toUpdate) {
      const reviewItem = questions.find(rq => rq.questionId === q.question_id);
      if (!reviewItem) continue;
      try {
        await updateQuestion(reviewItem.id, { reviewStatus: status, triageStatus });
      } catch (err) { /* ignore */ }
    }
    loadQuestions();
    setSelectedQuestionIds(new Set());
  }, [questions2, selectedQuestionIds, questions, loadQuestions]);

  const handleBulkReject = useCallback(async (reason: string) => {
    const toUpdate = questions2.filter(q => selectedQuestionIds.has(q.question_id));
    for (const q of toUpdate) {
      const reviewItem = questions.find(rq => rq.questionId === q.question_id);
      if (!reviewItem) continue;
      try {
        await updateQuestion(reviewItem.id, { reviewStatus: 'rejected', rejectionReason: reason, triageStatus: 'rejected' });
      } catch (err) { /* ignore */ }
    }
    loadQuestions();
    setSelectedQuestionIds(new Set());
  }, [questions2, selectedQuestionIds, questions, loadQuestions]);

  const handleBulkDelete = useCallback(async () => {
    const toDelete = questions2.filter(q => selectedQuestionIds.has(q.question_id));
    if (!confirm(`Delete ${toDelete.length} question${toDelete.length === 1 ? '' : 's'}?`)) return;
    const failed: string[] = [];
    for (const q of toDelete) {
      const reviewItem = questions.find(rq => rq.questionId === q.question_id);
      if (!reviewItem) continue;
      try {
        await deleteQuestion(reviewItem.id);
      } catch (err) {
        failed.push(q.stem.slice(0, 40) || q.question_id);
      }
    }
    setSelectedQuestionIds(new Set());
    loadQuestions();
    if (failed.length > 0) {
      alert(`Failed to delete ${failed.length} question${failed.length === 1 ? '' : 's'}:\n${failed.slice(0, 5).join('\n')}${failed.length > 5 ? '\n...' : ''}`);
    }
  }, [questions2, selectedQuestionIds, questions, loadQuestions]);

  const handleToggleSelect = useCallback((questionId: string) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedQuestionIds.size === filteredQuestions.length) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(filteredQuestions.map(q => q.question_id)));
    }
  }, [filteredQuestions, selectedQuestionIds.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedQuestionIds(new Set());
  }, []);

  const getLearningCategories = () => {
    return learningCategories;
  };

  const manualsWithQuestions = useMemo(() => {
    // Always show all manuals in the dropdown, not just ones in the current question set
    return manuals;
  }, [manuals]);

  return (
    <div className="page-content" style={{ padding: 0 }}>
      {/* Review header */}
      <div className="review-header">
        <div className="review-header-left">
          <span className="review-title">Question Review</span>
          <select
            className="filter-select"
            value={selectedManualId}
            onChange={e => setSelectedManualId(e.target.value)}
          >
            <option value="">All Manuals</option>
            {manualsWithQuestions.map(m => (
              <option key={m.id} value={m.id}>{m.filename}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={getCombinedStatus()}
            onChange={e => handleCombinedStatusChange(e.target.value as CombinedStatus)}
          >
            <option value="all">All Questions</option>
            <option value="needs_review">Needs Review</option>
            <option value="auto_approved">Auto-Approved</option>
            <option value="awaiting_human">Awaiting Human</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="auto_rejected">Auto-Rejected</option>
          </select>
          <input
            type="text"
            className="filter-input"
            placeholder="Search..."
            value={filters.searchText}
            onChange={e => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
          />
          <select
            className="filter-select"
            value={filters.groupCategory || ''}
            onChange={e => setFilters(prev => ({ ...prev, groupCategory: e.target.value || null }))}
          >
            <option value="">All Groups</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
          <button className="btn btn-secondary" style={{ flexShrink: 0 }} onClick={() => setShowNewQuestionModal(true)}>
            + New Question
          </button>
        </div>
        <div className="review-count">
          {isLoading ? 'Loading...' : `${filteredQuestions.length} / ${questions2.length} questions`}
        </div>
      </div>

      {loadError && (
        <div style={{ padding: '12px 16px', color: 'var(--error)', fontSize: '13px' }}>
          {loadError}
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: '8px' }} onClick={loadQuestions}>
            Retry
          </button>
        </div>
      )}

      <div className="review-main">
        <aside className="left-pane">
          <QuestionList
            questions={filteredQuestions}
            selectedId={selectedQuestionId}
            selectedIds={selectedQuestionIds}
            onSelect={setSelectedQuestionId}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onBulkSetReviewStatus={handleBulkSetReviewStatus}
            onBulkReject={handleBulkReject}
            onBulkDelete={handleBulkDelete}
            onBulkSetDifficulty={() => {}}
            onBulkAddTag={() => {}}
            onBulkRemoveTag={() => {}}
            onBulkAddCategory={() => {}}
            onBulkRemoveCategory={() => {}}
            onClearSelection={handleClearSelection}
            allQuestions={questions2}
            learningCategories={getLearningCategories()}
          />
        </aside>

        <section className="right-pane">
          <div className="review-body">
            <QuestionEditor
              question={selectedQuestion}
              groups={groups}
              onUpdate={handleUpdateQuestion}
              onDuplicate={async (q) => {
                const reviewItem = questions.find(rq => rq.questionId === q.question_id);
                if (!reviewItem) return;
                try {
                  const created = await duplicateQuestion(reviewItem.id);
                  await loadQuestions();
                  setSelectedQuestionId(created.questionId);
                } catch (err) { /* ignore */ }
              }}
              onDelete={async (questionId) => {
                const reviewItem = questions.find(rq => rq.questionId === questionId);
                if (!reviewItem) return;
                if (!confirm('Delete this question?')) return;
                try {
                  await deleteQuestion(reviewItem.id);
                  setSelectedQuestionId(null);
                  await loadQuestions();
                } catch (err) { /* ignore */ }
              }}
              learningCategories={getLearningCategories()}
            />
            <ValidationPanel
              errors={validationErrors}
              selectedId={selectedQuestionId}
              stats={packStats}
              onSelectQuestion={setSelectedQuestionId}
            />
          </div>
        </section>
      </div>

      {showNewQuestionModal && (
        <NewQuestionModal
          learningCategories={getLearningCategories()}
          groups={groups}
          onClose={() => setShowNewQuestionModal(false)}
          onCreated={async (questionId: string) => {
            setShowNewQuestionModal(false);
            await loadQuestions();
            setSelectedQuestionId(questionId);
          }}
        />
      )}
    </div>
  );
}
