import { useState } from 'react';
import { GROUP_OPTIONS, createQuestion, type GroupOption } from '../utils/api';
import { DIFFICULTY_OPTIONS } from '../types/pack';
import type { LearningCategory } from '../utils/api';

interface Props {
  learningCategories: LearningCategory[];
  groups?: GroupOption[];
  onCreated: (questionId: string) => void;
  onClose: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const DEFAULT_FORM = {
  stem: '',
  options: ['', '', '', ''] as [string, string, string, string],
  correctAnswerIndex: -1,
  explanation: '',
  difficulty: 'medium',
  minRank: 'pilot_1',
  tags: [] as string[],
  learningCategories: [] as string[],
  groupId: '',
};

export default function NewQuestionModal({ learningCategories, groups = GROUP_OPTIONS, onCreated, onClose }: Props) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOption = (i: number, value: string) => {
    const next = [...form.options] as [string, string, string, string];
    next[i] = value;
    setForm(f => ({ ...f, options: next }));
  };

  const handleCorrectAnswer = (i: number) => {
    setForm(f => ({ ...f, correctAnswerIndex: i }));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim();
      if (!form.tags.includes(t)) {
        setForm(f => ({ ...f, tags: [...f.tags, t] }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  };

  const handleToggleCategory = (catId: string) => {
    setForm(f => ({
      ...f,
      learningCategories: f.learningCategories.includes(catId)
        ? f.learningCategories.filter(c => c !== catId)
        : [...f.learningCategories, catId],
    }));
  };

  const validate = (): string | null => {
    if (!form.stem.trim()) return 'Question stem is required.';
    if (form.options.some(o => !o.trim())) return 'All 4 options are required.';
    if (form.correctAnswerIndex < 0) return 'Please select the correct answer.';
    if (!form.groupId) return 'Group is required.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSaving(true);
    try {
      const created = await createQuestion({
        stem: form.stem.trim(),
        options: form.options.map(o => o.trim()),
        correctAnswerIndex: form.correctAnswerIndex,
        explanation: form.explanation.trim() || undefined,
        difficulty: form.difficulty,
        minRank: form.minRank,
        tags: form.tags,
        learningCategories: form.learningCategories,
        groupId: form.groupId,
      });
      onCreated(created.questionId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create question.');
      setSaving(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>New Custom Question</h2>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '18px', padding: '0 4px' }}>×</button>
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', borderRadius: '6px', color: 'var(--error)', fontSize: '13px', marginBottom: '12px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Group — required */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Group <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <select
                className="form-select"
                style={{ width: '100%', padding: '8px 12px' }}
                value={form.groupId}
                onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}
              >
                <option value="">Select a group...</option>
                {groups.map((g: GroupOption) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>

            {/* Stem */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Question Stem <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <textarea
                className="form-textarea"
                style={{ width: '100%' }}
                value={form.stem}
                onChange={e => setForm(f => ({ ...f, stem: e.target.value }))}
                placeholder="Enter the question..."
                rows={3}
              />
            </div>

            {/* Options */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Options <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 8px', alignItems: 'center' }}>
                {OPTION_LABELS.map((label, i) => (
                  <span key={i} style={{ fontSize: '13px', fontWeight: 600, color: form.correctAnswerIndex === i ? 'var(--success, #22c55e)' : 'var(--text-secondary)' }}>{label}</span>
                ))}
                {OPTION_LABELS.map((label, i) => (
                  <input
                    key={i}
                    type="text"
                    className={`form-input${form.correctAnswerIndex === i ? ' option-correct' : ''}`}
                    style={{ padding: '6px 10px', fontSize: '13px' }}
                    value={form.options[i]}
                    onChange={e => handleOption(i, e.target.value)}
                    placeholder={`Option ${label}`}
                  />
                ))}
              </div>
              <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {OPTION_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`btn btn-sm${form.correctAnswerIndex === i ? ' btn-approved' : ' btn-secondary'}`}
                    onClick={() => handleCorrectAnswer(i)}
                    style={{ fontSize: '12px', padding: '2px 8px' }}
                  >
                    {label} = {form.options[i] || label}
                  </button>
                ))}
              </div>
            </div>

            {/* Explanation */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Explanation</label>
              <textarea
                className="form-textarea"
                style={{ width: '100%', fontSize: '13px' }}
                value={form.explanation}
                onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
                placeholder="Explain the correct answer..."
                rows={2}
              />
            </div>

            {/* Difficulty & Min Rank */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Difficulty</label>
                <select
                  className="form-select"
                  style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                  value={form.difficulty}
                  onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                >
                  {DIFFICULTY_OPTIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Min Rank</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                  value={form.minRank}
                  onChange={e => setForm(f => ({ ...f, minRank: e.target.value }))}
                  placeholder="e.g., pilot_1"
                />
              </div>
            </div>

            {/* Learning Categories */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Learning Categories</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                {form.learningCategories.map(catId => {
                  const cat = learningCategories.find(c => c.category_id === catId);
                  return (
                    <span key={catId} className="tag" style={{ fontSize: '11px' }}>
                      {cat?.label || catId}
                      <span className="tag-remove" onClick={() => handleToggleCategory(catId)}>×</span>
                    </span>
                  );
                })}
              </div>
              <select
                className="form-select"
                style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                value=""
                onChange={e => { handleToggleCategory(e.target.value); }}
              >
                <option value="">Add category...</option>
                {learningCategories
                  .filter(c => !form.learningCategories.includes(c.category_id))
                  .map(c => (
                    <option key={c.category_id} value={c.category_id}>{c.label}</option>
                  ))}
              </select>
            </div>

            {/* Tags */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tags</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                {form.tags.map(tag => (
                  <span key={tag} className="tag" style={{ fontSize: '11px' }}>
                    {tag}
                    <span className="tag-remove" onClick={() => handleRemoveTag(tag)}>×</span>
                  </span>
                ))}
              </div>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type and press Enter to add a tag"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
