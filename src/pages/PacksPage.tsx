import { useState, useCallback, useEffect, useRef } from 'react';
import { listPacks, buildPack, listManuals, listQuestions, renamePack, deletePack, getPackDownloadUrl, exportPackToSupabase, updatePackQuestions, getPack, listGroups, type Manual, type PackListItem, type GroupOption } from '../utils/api';
import CustomPackEditor from '../components/CustomPackEditor';
import { validateQuestionsForExport, groupIssuesByType, formatIssueSummary, type PackValidationResult } from '../utils/validation';

export default function PacksPage() {
  const [packs, setPacks] = useState<PackListItem[]>([]);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [approvedCounts, setApprovedCounts] = useState<Record<string, number>>({});
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportingPackId, setExportingPackId] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'custom'>('list');
  const [customEditingPackId, setCustomEditingPackId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<PackValidationResult | null>(null);
  const exportingRef = useRef(false);

  const load = useCallback(async () => {
    setActionError(null);
    setExportResult(null);
    setValidationResult(null);
    setView('list');
    try {
      const [packList, manualList, groupList] = await Promise.all([listPacks(), listManuals(), listGroups()]);
      setPacks(packList);
      setManuals(manualList);
      setGroups(groupList);
    } catch (e) { /* ignore */ }
  }, []);

  const loadApprovedCounts = useCallback(async () => {
    try {
      const questions = await listQuestions({ reviewStatus: 'approved' });
      const counts: Record<string, number> = {};
      const gcounts: Record<string, number> = {};
      for (const q of questions) {
        counts[q.manualId] = (counts[q.manualId] || 0) + 1;
        if (q.groupId) {
          gcounts[q.groupId] = (gcounts[q.groupId] || 0) + 1;
        }
      }
      setApprovedCounts(counts);
      setGroupCounts(gcounts);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    loadApprovedCounts();
  }, [load, loadApprovedCounts]);

  const handleBuild = async () => {
    setBuilding(true);
    setBuildResult(null);
    setBuildError(null);
    setExportResult(null);
    try {
      const result = await buildPack({ groupId: selectedGroupId || undefined });
      setBuildResult(
        `Pack built successfully! ${result.totalQuestions} questions saved to:\n${result.outputPath}`
      );
      await load();
      await loadApprovedCounts();
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : 'Build failed');
    } finally {
      setBuilding(false);
    }
  };

  const totalApproved = Object.values(approvedCounts).reduce((a, b) => a + b, 0);

  const handleRename = async (packId: string) => {
    if (!editingName.trim()) return;
    setActionError(null);
    try {
      await renamePack(packId, editingName.trim());
      await load();
      setEditingPackId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const handleDelete = async (packId: string) => {
    if (!confirm('Delete this pack?')) return;
    setActionError(null);
    try {
      await deletePack(packId);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleExport = async (packId: string) => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setActionError(null);
    setExportResult(null);
    setValidationResult(null);

    // Validate the pack before exporting
    try {
      const [pack, allApproved] = await Promise.all([
        getPack(packId),
        listQuestions({ reviewStatus: 'approved' }),
      ]);
      const questionIds = pack.questionIds || [];
      const packQuestions = allApproved.filter(q => questionIds.includes(q.questionId));
      const result = validateQuestionsForExport(packQuestions);
      setValidationResult(result);

      if (!result.isValid) {
        const first = result.blockers[0];
        const msg = `Export blocked — ${first.message}`;
        setActionError(msg);
        setExportingPackId(null);
        return;
      }

      // Proceed with export even if warnings exist
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Validation failed');
      setExportingPackId(null);
      return;
    }

    setExportingPackId(packId);
    try {
      const result = await exportPackToSupabase(packId);
      setExportResult(
        `Exported to Supabase Storage!\n` +
        `Path: ${result.storage_path}\n` +
        `Questions: ${result.question_count}\n` +
        `Checksum: ${result.checksum}`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingPackId(null);
      exportingRef.current = false;
    }
  };

  const handleSaveDraft = async (name: string, _description: string, questionIds: string[]) => {
    setBuilding(true);
    setBuildError(null);
    setBuildResult(null);
    try {
      if (customEditingPackId) {
        // Updating an existing draft pack
        await updatePackQuestions(customEditingPackId, questionIds);
        const pack = packs.find(p => p.packId === customEditingPackId);
        if (name && name !== (pack?.name || '')) {
          await renamePack(customEditingPackId, name);
        }
        setBuildResult(`Draft updated: ${questionIds.length} questions.`);
        setCustomEditingPackId(null);
        setView('list');
      } else {
        // Creating a new draft pack
        const result = await buildPack({ questionIds, isDraft: true });
        if (name) {
          await renamePack(result.packId, name);
        }
        setBuildResult(`Draft saved: ${result.totalQuestions} questions.`);
      }
      await load();
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : 'Save draft failed');
    } finally {
      setBuilding(false);
    }
  };

  const handleExportCustom = async (name: string, _description: string, questionIds: string[]) => {
    setBuilding(true);
    setBuildError(null);
    setBuildResult(null);
    try {
      const result = await buildPack({ questionIds, isDraft: false });
      if (name) {
        await renamePack(result.packId, name);
      }
      const exportResult = await exportPackToSupabase(result.packId);
      setBuildResult(
        `Custom pack exported!\n` +
        `Path: ${exportResult.storage_path}\n` +
        `Questions: ${exportResult.question_count}\n` +
        `Checksum: ${exportResult.checksum}`
      );
      await load();
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBuilding(false);
    }
  };

  const startRename = (pack: PackListItem) => {
    setEditingPackId(pack.packId);
    setEditingName(pack.name || pack.packId);
  };

  return (
    <div className="page-content">
      <div className="page-title">Packs / Export</div>

      <div style={{ display: view === 'custom' ? 'none' : undefined }}>
      {/* Approved question summary */}
      <div className="section">
        <div className="section-title">Approved Questions by Group</div>
        {manuals.length === 0 && (
          <div className="empty-state" style={{ height: '80px' }}>No manuals found. Run pipeline first.</div>
        )}
        <div className="approved-list">
          {groups.map(g => {
            const count = groupCounts[g.id] || 0;
            return (
              <div key={g.id} className={`approved-item${count === 0 ? ' zero' : ''}`}>
                <div className="approved-name">{g.label}</div>
                <div className="approved-count">
                  <span className={count > 0 ? 'count-good' : 'count-zero'}>{count}</span>
                  <span className="count-label"> approved</span>
                </div>
              </div>
            );
          })}
          <div className="approved-item approved-total">
            <div className="approved-name">Total</div>
            <div className="approved-count">
              <span className={totalApproved > 0 ? 'count-good' : 'count-zero'}>{totalApproved}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Build section */}
      <div className="section">
        <div className="section-title">Build Export Pack</div>
        <div className="build-controls">
          <select
            className="filter-select"
            value={selectedGroupId}
            onChange={e => setSelectedGroupId(e.target.value)}
          >
            <option value="">All Groups (combined)</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>
                {g.label} ({(groupCounts[g.id] || 0)} approved)
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={handleBuild}
            disabled={building || totalApproved === 0}
          >
            {building ? 'Building...' : 'Build Pack'}
          </button>
        </div>
        {buildError && <div className="upload-error" style={{ marginTop: '8px' }}>{buildError}</div>}
        {buildResult && (
          <div className="build-success">
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{buildResult}</pre>
          </div>
        )}
        {exportResult && (
          <div className="build-success" style={{ marginTop: '8px' }}>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{exportResult}</pre>
          </div>
        )}
        {actionError && (
          <div className="upload-error" style={{ marginTop: '8px' }}>{actionError}</div>
        )}
      </div>

      {/* Pack history */}
      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div className="section-title" style={{ margin: 0 }}>Built Packs</div>
          <button
            className="btn btn-secondary"
            onClick={() => { setCustomEditingPackId(null); setView('custom'); }}
          >
            + Create Custom Pack
          </button>
        </div>

        {/* Custom Pack Editor is rendered outside this div when view === 'custom' */}
        {packs.length === 0 && (
          <div className="empty-state" style={{ height: '80px' }}>No packs built yet.</div>
        )}
        <div className="pack-list">
          {packs.map(pack => (
            <div key={pack.packId} className="pack-item">
              <div className="pack-info">
                {editingPackId === pack.packId ? (
                  <div className="rename-form">
                    <input
                      className="filter-input"
                      style={{ width: '200px' }}
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(pack.packId);
                        if (e.key === 'Escape') setEditingPackId(null);
                      }}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" style={{ marginLeft: '6px' }} onClick={() => handleRename(pack.packId)}>Save</button>
                    <button className="btn btn-secondary btn-sm" style={{ marginLeft: '4px' }} onClick={() => setEditingPackId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="pack-id" style={{ cursor: 'pointer' }} onClick={() => startRename(pack)} title="Click to rename">
                      {pack.name || pack.packId}
                      {pack.isDraft && <span style={{ marginLeft: '8px', fontSize: '11px', background: 'var(--warning, #f59e0b)', color: '#000', padding: '1px 6px', borderRadius: '4px' }}>Draft</span>}
                    </div>
                    <div className="pack-meta">
                      {pack.totalQuestions} questions · {new Date(pack.createdAt).toLocaleString()}
                    </div>
                    <div className="pack-path">{pack.outputPath}</div>
                  </>
                )}
              </div>
              {editingPackId !== pack.packId && (
                <div className="pack-actions">
                  <a
                    className="btn btn-secondary btn-sm"
                    href={getPackDownloadUrl(pack.packId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open File
                  </a>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: '6px' }}
                    onClick={() => {
                      setCustomEditingPackId(pack.packId);
                      setView('custom');
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: '6px' }}
                    onClick={() => handleExport(pack.packId)}
                    disabled={exportingPackId === pack.packId}
                  >
                    {exportingPackId === pack.packId ? 'Exporting...' : 'Export to Supabase'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: '6px' }}
                    onClick={() => startRename(pack)}
                  >
                    Rename
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: '4px', color: 'var(--error)' }}
                    onClick={() => handleDelete(pack.packId)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
        {validationResult && !validationResult.isValid && (
          <div className="upload-error" style={{ marginTop: '8px' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>
              Export blocked — {formatIssueSummary(validationResult)}
            </div>
            {Object.entries(groupIssuesByType(validationResult.blockers)).map(([type, issues]) => (
              <div key={type} style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '12px', color: 'var(--error)', fontWeight: 600, textTransform: 'capitalize' }}>
                  {type.replace(/_/g, ' ')}
                </div>
                {issues.map(issue => (
                  <div key={issue.questionId} style={{ fontSize: '12px', paddingLeft: '8px', borderLeft: '2px solid var(--error)', marginTop: '2px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>[{issue.questionId.slice(0, 8)}]</span>{' '}
                    {issue.questionStem}
                    {' — '}{issue.message}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {validationResult && validationResult.isValid && validationResult.warnings.length > 0 && (
          <div style={{ marginTop: '8px', padding: '8px', border: '1px solid var(--warning, #f59e0b)', borderRadius: '6px', fontSize: '13px' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--warning, #f59e0b)' }}>
              Warnings ({validationResult.warnings.length})
            </div>
            {Object.entries(groupIssuesByType(validationResult.warnings)).slice(0, 2).map(([type, issues]) => (
              <div key={type} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {type.replace(/_/g, ' ')}: {issues.length} question{issues.length !== 1 ? 's' : ''}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Pack Editor - outside the wrapper so it shows when view === 'custom' */}
      {view === 'custom' && (
        <div className="section">
          <div style={{ marginBottom: '16px', padding: '12px', border: '1px solid var(--border)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setView('list'); setCustomEditingPackId(null); }}>
                Back to Packs
              </button>
            </div>
            <CustomPackEditor
              packId={customEditingPackId || undefined}
              onSaveDraft={handleSaveDraft}
              onExport={handleExportCustom}
              onCancel={() => { setView('list'); setCustomEditingPackId(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
