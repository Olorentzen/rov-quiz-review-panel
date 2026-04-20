import { useState } from 'react';
import type { Question, ReviewStatus } from '../types/pack';
import { DIFFICULTY_OPTIONS } from '../types/pack';
import { GROUP_OPTIONS } from '../utils/api';

function getReviewStatus(q: Question): ReviewStatus {
  if (q.reviewStatus) return q.reviewStatus;
  if (q.isApproved) return 'approved';
  return 'unreviewed';
}

function getTriageLabel(triage: string): string {
  const labels: Record<string, string> = {
    needs_review: 'REVIEW',
    auto_approved: 'AUTO-APPROVED',
    auto_rejected: 'AUTO-REJECTED',
    approved: 'APPROVED',
    rejected: 'REJECTED',
  };
  return labels[triage] || triage.toUpperCase();
}

function TriageBadge({ triage }: { triage: string }) {
  const colorMap: Record<string, string> = {
    needs_review: '#f59e0b',
    auto_approved: '#22c55e',
    auto_rejected: '#ef4444',
    approved: '#22c55e',
    rejected: '#ef4444',
  };
  const bg = colorMap[triage] || '#6b7280';
  const isHuman = triage === 'approved' || triage === 'rejected';

  if (isHuman) {
    return (
      <span style={{
        display: 'inline-block',
        fontSize: '0.65rem',
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: '3px',
        border: `1.5px solid ${bg}`,
        color: bg,
        background: 'transparent',
        letterSpacing: '0.02em',
      }}>
        {getTriageLabel(triage)}
      </span>
    );
  }

  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.65rem',
      fontWeight: 600,
      padding: '1px 6px',
      borderRadius: '3px',
      background: bg,
      color: 'white',
      letterSpacing: '0.02em',
    }}>
      {getTriageLabel(triage)}
    </span>
  );
}

interface BulkActionBarProps {
  selectedCount: number;
  onSetStatus: (status: ReviewStatus) => void;
  onReject: (reason: string) => void;
  onDelete: () => void;
  onSetDifficulty: (difficulty: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onAddCategory: (catId: string) => void;
  onRemoveCategory: (catId: string) => void;
  onClearSelection: () => void;
  allQuestions: Question[];
  learningCategories: unknown[];
}

function BulkActionBar({
  selectedCount,
  onSetStatus,
  onReject,
  onDelete,
  onSetDifficulty,
  onAddTag,
  onRemoveTag: _onRemoveTag,
  onAddCategory: _onAddCategory,
  onRemoveCategory: _onRemoveCategory,
  onClearSelection,
  learningCategories: _learningCategories,
}: BulkActionBarProps) {
  const [tagInput, setTagInput] = useState('');
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('ambiguous_stem');
  const [rejectOtherText, setRejectOtherText] = useState('');

  if (selectedCount === 0) return null;

  return (
    <div className="bulk-action-bar">
      <div className="bulk-action-row">
        <span className="bulk-selection-count">{selectedCount} selected</span>
        <div className="bulk-status-buttons">
          <button className="btn btn-sm btn-unreviewed" onClick={() => onSetStatus('unreviewed')}>
            Unreviewed
          </button>
          <button className="btn btn-sm btn-approved" onClick={() => onSetStatus('approved')}>
            Approved
          </button>
          {showReject ? (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <select
                className="filter-select"
                style={{ fontSize: '12px', padding: '3px 6px' }}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              >
                <option value="ambiguous_stem">Ambiguous stem</option>
                <option value="bad_grounding">Bad grounding</option>
                <option value="not_instructor_voice">Not instructor voice</option>
                <option value="too_easy">Too easy</option>
                <option value="too_hard">Too hard</option>
                <option value="other">Other</option>
              </select>
              {rejectReason === 'other' && (
                <input
                  type="text"
                  className="filter-input"
                  style={{ fontSize: '12px', padding: '3px 6px', width: '120px' }}
                  placeholder="Describe..."
                  value={rejectOtherText}
                  onChange={e => setRejectOtherText(e.target.value)}
                />
              )}
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  if (rejectReason === 'other' && !rejectOtherText.trim()) return;
                  const fullReason = rejectReason === 'other'
                    ? `other: ${rejectOtherText.trim()}`
                    : rejectReason;
                  onReject(fullReason);
                  setShowReject(false);
                  setRejectReason('ambiguous_stem');
                  setRejectOtherText('');
                }}
                disabled={rejectReason === 'other' && !rejectOtherText.trim()}
              >
                Confirm
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => { setShowReject(false); setRejectReason('ambiguous_stem'); setRejectOtherText(''); }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn btn-sm btn-danger"
              onClick={() => setShowReject(true)}
            >
              Reject
            </button>
          )}
        </div>

        {showDifficulty ? (
          <select
            className="filter-select"
            onChange={e => {
              if (e.target.value) {
                onSetDifficulty(e.target.value);
                setShowDifficulty(false);
              }
            }}
            onBlur={() => setShowDifficulty(false)}
            autoFocus
          >
            <option value="">Set difficulty...</option>
            {DIFFICULTY_OPTIONS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        ) : (
          <button className="btn btn-sm btn-secondary" onClick={() => setShowDifficulty(true)}>
            Difficulty
          </button>
        )}

        <div className="bulk-tag-input">
          <input
            type="text"
            placeholder="Add tag..."
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && tagInput.trim()) {
                onAddTag(tagInput.trim());
                setTagInput('');
              }
            }}
          />
        </div>

        <button className="btn btn-sm btn-secondary" onClick={onClearSelection}>
          Clear
        </button>
        <button className="btn btn-sm" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

interface QuestionListProps {
  questions: Question[];
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onBulkSetReviewStatus: (status: ReviewStatus) => void;
  onBulkReject: (reason: string) => void;
  onBulkDelete: () => void;
  onBulkSetDifficulty: (difficulty: string) => void;
  onBulkAddTag: (tag: string) => void;
  onBulkRemoveTag: (tag: string) => void;
  onBulkAddCategory: (catId: string) => void;
  onBulkRemoveCategory: (catId: string) => void;
  onClearSelection: () => void;
  allQuestions: Question[];
  learningCategories: unknown[];
}

export default function QuestionList({
  questions,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onSelectAll,
  onBulkSetReviewStatus,
  onBulkReject,
  onBulkDelete,
  onBulkSetDifficulty,
  onBulkAddTag,
  onBulkRemoveTag,
  onBulkAddCategory,
  onBulkRemoveCategory,
  onClearSelection,
  allQuestions,
  learningCategories,
}: QuestionListProps) {
  const allSelected = questions.length > 0 && selectedIds.size === questions.length;

  return (
    <div className="question-list">
      <div className="question-list-header">
        <label className="select-all-checkbox">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onSelectAll}
          />
          Questions ({questions.length})
        </label>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        onSetStatus={onBulkSetReviewStatus}
        onReject={onBulkReject}
        onDelete={onBulkDelete}
        onSetDifficulty={onBulkSetDifficulty}
        onAddTag={onBulkAddTag}
        onRemoveTag={onBulkRemoveTag}
        onAddCategory={onBulkAddCategory}
        onRemoveCategory={onBulkRemoveCategory}
        onClearSelection={onClearSelection}
        allQuestions={allQuestions}
        learningCategories={learningCategories}
      />

      <div className="question-list-items">
        {questions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">?</div>
            <div>No questions match your filters</div>
          </div>
        ) : (
          questions.map(q => (
            <div
              key={q.question_id}
              className={`question-item${selectedId === q.question_id ? ' selected' : ''}`}
              onClick={e => {
                if (e.ctrlKey || e.metaKey) {
                  onToggleSelect(q.question_id);
                } else {
                  onSelect(q.question_id);
                }
              }}
            >
              <div className="question-item-row">
                <input
                  type="checkbox"
                  className="question-checkbox"
                  checked={selectedIds.has(q.question_id)}
                  onChange={e => {
                    e.stopPropagation();
                    onToggleSelect(q.question_id);
                  }}
                  onClick={e => e.stopPropagation()}
                />
                <div className="question-item-content">
                  <div className="question-item-stem">{q.stem || '(empty stem)'}</div>
                  <div className="question-item-meta">
                    {q.triageStatus && (
                      <TriageBadge triage={q.triageStatus} />
                    )}
                    <span className={`question-item-tag status-${getReviewStatus(q)}`}>
                      {getReviewStatus(q)}
                    </span>
                    <span className={`question-item-tag difficulty ${q.difficulty}`}>
                      {q.difficulty}
                    </span>
                    {q.subsystem_category && (
                      <span className="question-item-tag">{q.subsystem_category}</span>
                    )}
                    {q.groupId && (
                      <span className="question-item-tag" style={{ borderLeft: '3px solid #8b5cf6', paddingLeft: '5px' }}>
                        {GROUP_OPTIONS.find(g => g.id === q.groupId)?.label ?? q.groupId}
                      </span>
                    )}
                    {q.min_rank != null && q.min_rank !== '' && (
                      <span className="question-item-tag">rank {q.min_rank}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
