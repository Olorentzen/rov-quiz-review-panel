import { useState, useEffect, useCallback } from 'react';
import { listAllGroups, createGroup, updateGroup, deleteGroup } from '../utils/api';

interface GroupRow {
  id: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [editIsActive, setEditIsActive] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listAllGroups() as unknown as GroupRow[];
      setGroups(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const startEdit = (g: GroupRow) => {
    setEditingId(g.id);
    setEditLabel(g.label);
    setEditSortOrder(g.sortOrder);
    setEditIsActive(g.isActive);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditSortOrder(0);
    setEditIsActive(true);
  };

  const saveEdit = async () => {
    if (!editLabel.trim()) { alert('Label is required'); return; }
    setSaving(true);
    try {
      await updateGroup(editingId!, { id: editingId!, label: editLabel.trim(), sortOrder: editSortOrder, isActive: editIsActive });
      await loadGroups();
      cancelEdit();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newId.trim()) { alert('ID is required'); return; }
    if (!newLabel.trim()) { alert('Label is required'); return; }
    setSaving(true);
    try {
      await createGroup({ id: newId.trim(), label: newLabel.trim(), sortOrder: newSortOrder });
      await loadGroups();
      setShowCreate(false);
      setNewId('');
      setNewLabel('');
      setNewSortOrder(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm(`Delete group "${groupId}"? This cannot be undone.`)) return;
    try {
      await deleteGroup(groupId);
      await loadGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const toggleActive = async (g: GroupRow) => {
    try {
      await updateGroup(g.id, { id: g.id, label: g.label, isActive: !g.isActive, sortOrder: g.sortOrder });
      await loadGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    }
  };

  if (loading) return <div className="empty-state" style={{ height: '80px' }}>Loading groups...</div>;

  return (
    <div className="page-content">
      <div className="page-title">Question Groups</div>

      {error && <div className="upload-error" style={{ marginBottom: '12px' }}>{error}</div>}

      <div className="section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {groups.length} group{groups.length !== 1 ? 's' : ''} total
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            + New Group
          </button>
        </div>

        {groups.length === 0 && !showCreate && (
          <div className="empty-state" style={{ height: '80px' }}>No groups yet. Create one to get started.</div>
        )}

        {showCreate && (
          <div style={{ marginBottom: '16px', padding: '12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
            <div style={{ fontWeight: 600, marginBottom: '10px', fontSize: '13px' }}>New Group</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID (kebab-case)</label>
                <input
                  className="filter-input"
                  style={{ width: '200px' }}
                  value={newId}
                  onChange={e => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="e.g. my-custom-group"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Label</label>
                <input
                  className="filter-input"
                  style={{ width: '200px' }}
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="Display name"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sort Order</label>
                <input
                  type="number"
                  className="filter-input"
                  style={{ width: '80px' }}
                  value={newSortOrder}
                  onChange={e => setNewSortOrder(parseInt(e.target.value) || 0)}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={saving}>
                  {saving ? 'Creating...' : 'Create'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreate(false); setNewId(''); setNewLabel(''); setNewSortOrder(0); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Sort Order</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.id} className={!g.isActive ? 'row-inactive' : ''}>
                {editingId === g.id ? (
                  <>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{g.id}</td>
                    <td>
                      <input
                        className="filter-input"
                        style={{ width: '180px' }}
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        autoFocus
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="filter-input"
                        style={{ width: '70px' }}
                        value={editSortOrder}
                        onChange={e => setEditSortOrder(parseInt(e.target.value) || 0)}
                      />
                    </td>
                    <td>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={e => setEditIsActive(e.target.checked)}
                        />
                        Active
                      </label>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>
                          {saving ? '...' : 'Save'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{g.id}</td>
                    <td style={{ fontWeight: 500 }}>{g.label}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{g.sortOrder}</td>
                    <td>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: g.isActive ? 'var(--success)' : 'var(--text-muted)',
                        color: '#fff',
                        opacity: g.isActive ? 1 : 0.6,
                      }}>
                        {g.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(g)}>Edit</button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleActive(g)}
                          style={{ color: g.isActive ? 'var(--warning)' : 'var(--success)' }}
                        >
                          {g.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDelete(g.id)}
                          style={{ color: 'var(--error)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
