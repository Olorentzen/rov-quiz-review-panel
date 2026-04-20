import { useState, useEffect } from 'react';
import type { Question, LearningCategory, ReviewStatus } from '../types/pack';
import { DIFFICULTY_OPTIONS, OPTION_LABELS } from '../types/pack';
import { GROUP_OPTIONS, type GroupOption } from '../utils/api';

function getReviewStatus(q: Question): ReviewStatus {
  if (q.reviewStatus) return q.reviewStatus;
  if (q.isApproved) return 'approved';
  return 'unreviewed';
}

const REJECTION_REASONS = [
  { value: 'ambiguous_stem', label: 'Ambiguous stem' },
  { value: 'bad_grounding', label: 'Bad grounding' },
  { value: 'not_instructor_voice', label: 'Not instructor voice' },
  { value: 'too_easy', label: 'Too easy' },
  { value: 'too_hard', label: 'Too hard' },
  { value: 'other', label: 'Other' },
];

interface QuestionEditorProps {
  question: Question | null;
  onUpdate: (question: Question) => void;
  onDuplicate: (question: Question) => void;
  onDelete: (questionId: string) => void;
  learningCategories: LearningCategory[];
  groups?: GroupOption[];
}

export default function QuestionEditor({
  question,
  onUpdate,
  onDuplicate,
  onDelete,
  learningCategories,
  groups = GROUP_OPTIONS,
}: QuestionEditorProps) {
  const [localQuestion, setLocalQuestion] = useState<Question | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [pendingReason, setPendingReason] = useState('');

  useEffect(() => {
    if (!question) {
      setLocalQuestion(null);
      return;
    }
    // Normalize correct_answer_index to a number
    const cai = question.correct_answer_index;
    const normalized = {
      ...question,
      correct_answer_index: Number(cai ?? 0),
      options: question.options.map(o => String(o ?? '')) as [string, string, string, string],
    };
    setLocalQuestion(normalized);
  }, [question]);

  if (!localQuestion) {
    return (
      <div className="editor">
        <div className="editor-empty">
          Select a question to edit or create a new one
        </div>
      </div>
    );
  }

  const handleField = <K extends keyof Question>(field: K, value: Question[K]) => {
    setRejectionError(null);
    const updated = { ...localQuestion, [field]: value };
    setLocalQuestion(updated);
    onUpdate(updated);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...localQuestion.options] as [string, string, string, string];
    newOptions[index] = value;
    handleField('options', newOptions);
  };

  const handleCorrectAnswer = (index: number) => {
    handleField('correct_answer_index', index);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!localQuestion.tags.includes(newTag)) {
        handleField('tags', [...localQuestion.tags, newTag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    handleField('tags', localQuestion.tags.filter(t => t !== tag));
  };

  const handleAddCategory = (categoryId: string) => {
    if (categoryId && !(localQuestion.learning_categories ?? []).includes(categoryId)) {
      handleField('learning_categories', [...(localQuestion.learning_categories ?? []), categoryId]);
    }
  };

  const handleRemoveCategory = (categoryId: string) => {
    handleField('learning_categories', (localQuestion.learning_categories ?? []).filter(c => c !== categoryId));
  };

  const handleAddNewCategory = () => {
    if (newCategoryInput.trim()) {
      const newCatId = newCategoryInput.trim().toLowerCase().replace(/\s+/g, '_');
      handleField('learning_categories', [...(localQuestion.learning_categories ?? []), newCatId]);
      setNewCategoryInput('');
    }
  };

  const handleSetStatus = (newStatus: ReviewStatus) => {
    setRejectionError(null);
    if (newStatus === 'rejected') {
      if (!pendingReason) {
        setPendingReason('ambiguous_stem');
        setShowRejectForm(true);
        return;
      }
    }
    setShowRejectForm(false);
    handleField('reviewStatus', newStatus);
  };

  return (
    <div className="editor">
      <div className="editor-header">
        <div className="editor-title">Question Editor</div>
        <div className="editor-actions">
          <button
            className="btn btn-approved"
            onClick={() => handleSetStatus('approved')}
            disabled={getReviewStatus(localQuestion) === 'approved'}
          >
            Approve
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleSetStatus('rejected')}
            disabled={getReviewStatus(localQuestion) === 'rejected'}
          >
            Reject
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onDuplicate(localQuestion)}
          >
            Duplicate
          </button>
          <button
            className="btn btn-danger"
            onClick={() => onDelete(localQuestion.question_id)}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Judge metadata — subtle secondary info */}
      {(localQuestion.judgeConfidence != null || localQuestion.judgePrimaryIssue || localQuestion.autoReviewedAt) && (
        <div style={{
          padding: '6px 12px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border)',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          {localQuestion.judgeConfidence != null && (
            <span>Judge confidence: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(localQuestion.judgeConfidence * 100)}%</strong></span>
          )}
          {localQuestion.judgePrimaryIssue && (
            <span>Primary issue: <code style={{ fontSize: '11px' }}>{localQuestion.judgePrimaryIssue}</code></span>
          )}
          {localQuestion.reviewNotes && (
            <span>Rejection reason: <code style={{ fontSize: '11px' }}>{localQuestion.reviewNotes}</code></span>
          )}
        </div>
      )}

      {/* Rejection reason — shown only while actively filling out the reject form */}
      {showRejectForm && (
        <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Rejection reason <span style={{ color: 'var(--error)' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                flex: 1,
              }}
              value={pendingReason}
              onChange={e => setPendingReason(e.target.value)}
            >
              {REJECTION_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {pendingReason === 'other' && (
              <input
                type="text"
                className="form-input"
                style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }}
                placeholder="Describe the issue..."
                value={localQuestion.reviewNotes?.split(':')[1]?.trim() || ''}
                onChange={e => handleField('reviewNotes', `other: ${e.target.value}`)}
              />
            )}
          </div>
          {rejectionError && (
            <div style={{ fontSize: '12px', color: 'var(--error)', marginTop: '6px' }}>
              {rejectionError}
            </div>
          )}
          {showRejectForm && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (!pendingReason) {
                    setRejectionError('Please select a rejection reason before rejecting.');
                    return;
                  }
                  if (pendingReason === 'other' && !localQuestion.reviewNotes?.split(':')[1]?.trim()) {
                    setRejectionError('Please describe the issue in the text field.');
                    return;
                  }
                  setRejectionError(null);
                  setShowRejectForm(false);
                  setPendingReason('');
                  // Batch both field updates into one state call to avoid stale closure
                  setLocalQuestion(prev => {
                    if (!prev) return prev;
                    const updated: Question = { ...prev, reviewNotes: pendingReason, reviewStatus: 'rejected' as ReviewStatus };
                    onUpdate(updated);
                    return updated;
                  });
                }}
              >
                Confirm Reject
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionError(null);
                  setPendingReason('');
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="editor-form">
        <div className="form-group">
          <label className="form-label">Stem</label>
          <textarea
            className="form-textarea"
            value={localQuestion.stem}
            onChange={e => handleField('stem', e.target.value)}
            placeholder="Enter the question stem..."
            rows={3}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Options (4 required)</label>
          <div className="options-grid">
            {OPTION_LABELS.map((label, i) => (
              <><span key={`label-${i}`} className="option-label">{label}</span>
                <input
                  key={`input-${i}`}
                  type="text"
                  className={`form-input${localQuestion.correct_answer_index === i ? ' option-correct' : ''}`}
                  value={localQuestion.options[i]}
                  onChange={e => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${label}`}
                />
              </>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Correct Answer</label>
          <div className="correct-answer-group">
            {OPTION_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                className={`correct-btn${localQuestion.correct_answer_index === i ? ' selected' : ''}`}
                onClick={() => handleCorrectAnswer(i)}
              >
                {label}
              </button>
            ))}
            <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {localQuestion.options[localQuestion.correct_answer_index ?? 0]
                ? `= ${localQuestion.options[localQuestion.correct_answer_index ?? 0]}`
                : '(no value)'}
            </span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Explanation</label>
          <textarea
            className="form-textarea"
            value={localQuestion.explanation}
            onChange={e => handleField('explanation', e.target.value)}
            placeholder="Explain the correct answer..."
            rows={3}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Group</label>
          <select
            className="form-select"
            style={{
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              width: '100%',
            }}
            value={localQuestion.groupId || ''}
            onChange={e => handleField('groupId', e.target.value || null)}
          >
            <option value="">— none —</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Difficulty</label>
            <select
              className="form-select"
              style={{
                padding: '8px 12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                width: '100%',
              }}
              value={localQuestion.difficulty}
              onChange={e => handleField('difficulty', e.target.value as Question['difficulty'])}
            >
              {DIFFICULTY_OPTIONS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Min Rank</label>
            <input
              type="text"
              className="form-input"
              value={String(localQuestion.min_rank ?? '')}
              onChange={e => handleField('min_rank', e.target.value)}
              placeholder="e.g., pilot_1"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confidence (0-1)</label>
            <input
              type="number"
              className="form-input"
              value={localQuestion.confidence}
              onChange={e => handleField('confidence', parseFloat(e.target.value) || 0)}
              min={0}
              max={1}
              step={0.1}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Subsystem Category</label>
            <input
              type="text"
              className="form-input"
              value={localQuestion.subsystem_category}
              onChange={e => handleField('subsystem_category', e.target.value)}
              placeholder="e.g., hydraulic, electrical"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Subsystem Label</label>
            <input
              type="text"
              className="form-input"
              value={localQuestion.subsystem_label}
              onChange={e => handleField('subsystem_label', e.target.value)}
              placeholder="e.g., Hydraulic Power Unit"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Learning Categories</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {(localQuestion.learning_categories ?? []).map(catId => {
              const cat = learningCategories.find(c => c.category_id === catId);
              return (
                <span key={catId} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {cat?.label || catId}
                  <span className="tag-remove" onClick={() => handleRemoveCategory(catId)}>×</span>
                </span>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="form-select"
              style={{
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                flex: 1,
              }}
              value=""
              onChange={e => handleAddCategory(e.target.value)}
            >
              <option value="">Add category...</option>
              {learningCategories
                .filter(c => !(localQuestion.learning_categories ?? []).includes(c.category_id))
                .map(c => (
                  <option key={c.category_id} value={c.category_id}>{c.label}</option>
                ))}
            </select>
            <input
              type="text"
              className="form-input"
              value={newCategoryInput}
              onChange={e => setNewCategoryInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNewCategory();
                }
              }}
              placeholder="New category name"
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={handleAddNewCategory} style={{ padding: '6px 12px' }}>
              Add
            </button>
          </div>
        </div>

        <details className="advanced-section">
          <summary className="advanced-summary">Advanced</summary>

          <div className="form-group">
            <label className="form-label">Tags</label>
            <div className="tags-input">
              {localQuestion.tags.map(tag => (
                <span key={tag} className="tag">
                  {tag}
                  <span className="tag-remove" onClick={() => handleRemoveTag(tag)}>×</span>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type and press Enter..."
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  minWidth: '120px',
                  flex: 1,
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Source Quote</label>
            <textarea
              className="form-textarea"
              value={localQuestion.source_quote || ''}
              onChange={e => handleField('source_quote', e.target.value)}
              placeholder="Quote from source document..."
              rows={2}
            />
          </div>

          <div className="source-traceability">
            <div className="source-trace-title">Source Traceability</div>
            <div className="source-trace-grid">
              <div className="source-trace-item">
                <span className="source-trace-label">Source Fact ID</span>
                <span className="source-trace-value">{localQuestion.source_fact_id || '—'}</span>
              </div>
              <div className="source-trace-item">
                <span className="source-trace-label">Fact Type</span>
                <span className="source-trace-value">{localQuestion.fact_type || '—'}</span>
              </div>
              <div className="source-trace-item">
                <span className="source-trace-label">Manual ID</span>
                <span className="source-trace-value">{localQuestion.manual_id || '—'}</span>
              </div>
              <div className="source-trace-item">
                <span className="source-trace-label">Stage</span>
                <span className="source-trace-value">{localQuestion.stage || '—'}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Review Notes</label>
            <textarea
              className="form-textarea"
              value={localQuestion.reviewNotes || ''}
              onChange={e => handleField('reviewNotes', e.target.value)}
              placeholder="Internal review notes..."
              rows={2}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
