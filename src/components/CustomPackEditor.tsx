import { useState, useEffect, useMemo } from 'react';
import { listQuestions, listCategories, getPack, listGroups, type QuestionReviewItem, type LearningCategory, type GroupOption } from '../utils/api';
import { validateQuestionsForExport, groupIssuesByType, formatIssueSummary, type PackValidationResult } from '../utils/validation';

interface Props {
  packId?: string;
  groups?: GroupOption[];
  onSaveDraft: (name: string, description: string, questionIds: string[]) => Promise<void>;
  onExport: (name: string, description: string, questionIds: string[]) => Promise<void>;
  onCancel: () => void;
}

export default function CustomPackEditor({ packId, groups: groupsProp, onSaveDraft, onExport, onCancel }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionReviewItem[]>([]);
  const [categories, setCategories] = useState<LearningCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<GroupOption[]>(groupsProp || []);
  const [validationResult, setValidationResult] = useState<PackValidationResult | null>(null);

  // Load pack data when editing an existing pack
  useEffect(() => {
    if (packId) {
      getPack(packId).then(pack => {
        setName(pack.name || '');
        setSelectedIds(new Set(pack.questionIds || []));
      }).catch(() => {});
    }
  }, [packId]);

  useEffect(() => {
    Promise.all([
      listQuestions({ reviewStatus: 'approved' }),
      listCategories(),
      groupsProp ? Promise.resolve(groupsProp) : listGroups(),
    ]).then(([qs, cats, gs]) => {
      setQuestions(qs);
      setCategories(cats);
      if (!groupsProp) setGroups(gs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Group questions by groupId
  const grouped = useMemo(() => {
    const filtered = questions.filter(q => {
      const matchSearch = !search || q.stem.toLowerCase().includes(search.toLowerCase());
      const matchCat = !categoryFilter || (q.learningCategories || []).includes(categoryFilter);
      return matchSearch && matchCat;
    });
    const result: Record<string, QuestionReviewItem[]> = {};
    for (const q of filtered) {
      const gid = q.groupId || 'uncategorized';
      if (!result[gid]) result[gid] = [];
      result[gid].push(q);
    }
    return result;
  }, [questions, search, categoryFilter]);

  const toggleQuestion = (qId: string) => {
    setValidationResult(null);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const selectAll = (groupId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const q of grouped[groupId] || []) next.add(q.questionId);
      return next;
    });
  };

  const deselectAll = (groupId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const q of grouped[groupId] || []) next.delete(q.questionId);
      return next;
    });
  };

  const removeSelected = (qId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(qId);
      return next;
    });
  };

  const handleSave = async (asDraft: boolean) => {
    if (!name.trim()) { alert('Please enter a pack name.'); return; }
    if (selectedIds.size === 0) { alert('Please select at least one question.'); return; }
    setSaving(true);
    setValidationResult(null);

    // For exports (not drafts), validate first
    if (!asDraft) {
      const selectedQuestions = questions.filter(q => selectedIds.has(q.questionId));
      const result = validateQuestionsForExport(selectedQuestions);
      setValidationResult(result);
      if (!result.isValid) {
        setSaving(false);
        return;
      }
    }

    try {
      if (asDraft) {
        await onSaveDraft(name.trim(), description.trim(), Array.from(selectedIds));
      } else {
        await onExport(name.trim(), description.trim(), Array.from(selectedIds));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="empty-state" style={{ height: '80px' }}>Loading approved questions...</div>;

  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      {/* Left: question picker */}
      <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            className="filter-input"
            placeholder="Search questions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 200px' }}
          />
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ flex: '0 0 180px' }}
          >
            <option value="">All categories</option>
            {categories.map(c => (
              <option key={c.category_id} value={c.category_id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
          {Object.entries(grouped).map(([groupId, qs]) => {
            const groupLabel = groups.find(g => g.id === groupId)?.label || (groupId === 'uncategorized' ? 'Uncategorized' : groupId);
            return (
            <div key={groupId} style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px', background: 'var(--bg-secondary)', fontWeight: 600, fontSize: '13px'
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {groupLabel}
                </span>
                <span style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => selectAll(groupId)} style={{ fontSize: '11px', padding: '1px 6px' }}>All</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => deselectAll(groupId)} style={{ fontSize: '11px', padding: '1px 6px' }}>None</button>
                </span>
              </div>
              {qs.map(q => (
                <label key={q.questionId} style={{
                  display: 'flex', gap: '8px', padding: '6px 10px',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  fontSize: '13px', alignItems: 'flex-start'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(q.questionId)}
                    onChange={() => toggleQuestion(q.questionId)}
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, overflow: 'hidden' }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.stem}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {(q.learningCategories || []).join(', ') || 'No category'} · {q.difficulty || 'unknown'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          );
          })}
          {Object.keys(grouped).length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No questions match your filters.
            </div>
          )}
        </div>
      </div>

      {/* Right: selected panel */}
      <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
            Pack Details
          </div>
          <input
            className="filter-input"
            placeholder="Pack name (required)"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', marginBottom: '6px' }}
          />
          <textarea
            className="filter-input"
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        <div style={{
          flex: 1, border: '1px solid var(--border)', borderRadius: '6px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{
            padding: '6px 10px', background: 'var(--bg-secondary)', fontWeight: 600, fontSize: '13px'
          }}>
            Selected ({selectedIds.size})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: '80px' }}>
            {Array.from(selectedIds).map(qId => {
              const q = questions.find(q => q.questionId === qId);
              return (
                <div key={qId} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: '12px'
                }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q?.stem || qId}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeSelected(qId)}
                    style={{ padding: '0 4px', fontSize: '11px', minWidth: '20px' }}
                  >
                    x
                  </button>
                </div>
              );
            })}
            {selectedIds.size === 0 && (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No questions selected
              </div>
            )}
          </div>
        </div>

        {validationResult && !validationResult.isValid && (
          <div style={{ marginTop: '8px', padding: '8px', border: '1px solid var(--error)', borderRadius: '6px', fontSize: '12px', maxHeight: '150px', overflowY: 'auto' }}>
            <div style={{ fontWeight: 600, color: 'var(--error)', marginBottom: '6px' }}>
              Export blocked — {formatIssueSummary(validationResult)}
            </div>
            {Object.entries(groupIssuesByType(validationResult.blockers)).map(([type, issues]) => (
              <div key={type} style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--error)', fontWeight: 600, textTransform: 'capitalize' }}>
                  {type.replace(/_/g, ' ')}
                </div>
                {issues.map(issue => (
                  <div key={issue.questionId} style={{ fontSize: '11px', paddingLeft: '6px', borderLeft: '2px solid var(--error)', marginTop: '2px', color: 'var(--text)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>[{issue.questionId.slice(0, 8)}]</span>{' '}
                    {issue.questionStem}{' — '}{issue.message}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {validationResult && validationResult.isValid && validationResult.warnings.length > 0 && (
          <div style={{ marginTop: '8px', padding: '6px', border: '1px solid var(--warning, #f59e0b)', borderRadius: '6px', fontSize: '12px' }}>
            <div style={{ fontWeight: 600, color: 'var(--warning, #f59e0b)', marginBottom: '2px' }}>
              Warnings ({validationResult.warnings.length}) — export allowed
            </div>
            {Object.entries(groupIssuesByType(validationResult.warnings)).slice(0, 2).map(([type, issues]) => (
              <div key={type} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {type.replace(/_/g, ' ')}: {issues.length} question{issues.length !== 1 ? 's' : ''}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            className="btn btn-primary"
            onClick={() => handleSave(true)}
            disabled={saving}
            style={{ width: '100%' }}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleSave(false)}
            disabled={saving}
            style={{ width: '100%' }}
          >
            {saving ? 'Exporting...' : 'Export to Supabase'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={saving}
            style={{ width: '100%' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
