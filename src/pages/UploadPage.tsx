import { useState, useCallback, useEffect } from 'react';
import { uploadManual, listManuals, createJob, deleteManual, batchEnqueueJobs, ALL_STEPS, type Manual } from '../utils/api';

const STEP_LABELS: Record<string, string> = {
  parse: '1. Parse PDF',
  segment: '2. Segment / Chunk',
  extract: '3. Extract Facts',
  generate: '4. Generate MCQs',
  review_prep: '5. Review Prep',
};

export default function UploadPage({ onJobCreated }: { onJobCreated: (jobId: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [selectedManuals, setSelectedManuals] = useState<Set<string>>(new Set());
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set(ALL_STEPS));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadManuals = useCallback(async () => {
    try {
      const list = await listManuals();
      setManuals(list);
    } catch (e) {
      // silently ignore
    }
  }, []);

  const handleDeleteManual = async (manualId: string) => {
    try {
      await deleteManual(manualId);
      setManuals(prev => prev.filter(m => m.id !== manualId));
      setSelectedManuals(prev => {
        const next = new Set(prev);
        next.delete(manualId);
        return next;
      });
    } catch (e) {
      // silently ignore
    }
  };

  useEffect(() => {
    loadManuals();
  }, [loadManuals]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const fileList = e.dataTransfer.files;
    if (fileList.length === 0) return;
    // Upload all dropped files together as one manual
    await doUpload(Array.from(fileList));
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    // Upload all selected files together as one manual
    await doUpload(Array.from(fileList));
    e.target.value = '';
  }, []);

  const doUpload = async (files: File[]) => {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      setUploadError('Only PDF files are supported');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const manual = await uploadManual(pdfs);
      setManuals(prev => [manual, ...prev]);
      // Auto-select the newly uploaded manual for single-run
      setSelectedManuals(new Set([manual.id]));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const toggleStep = (step: string) => {
    setSelectedSteps(prev => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedSteps(new Set(ALL_STEPS));
  const selectNone = () => setSelectedSteps(new Set());

  // Single manual: run immediately (existing behavior)
  const handleRun = async () => {
    if (selectedManuals.size !== 1) {
      setCreateError('Select exactly one manual to run');
      return;
    }
    const manualId = [...selectedManuals][0];
    if (selectedSteps.size === 0) {
      setCreateError('Select at least one step');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const job = await createJob(manualId, Array.from(selectedSteps));
      onJobCreated(job.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setCreating(false);
    }
  };

  // Multi-select: enqueue batch via queue endpoint
  const handleQueueBatch = async () => {
    if (selectedManuals.size === 0) {
      setCreateError('Select at least one manual to queue');
      return;
    }
    if (selectedSteps.size === 0) {
      setCreateError('Select at least one step');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const result = await batchEnqueueJobs([...selectedManuals], Array.from(selectedSteps));
      // Navigate to runs page and select the first enqueued job
      if (result.jobIds.length > 0) {
        onJobCreated(result.jobIds[0]);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to enqueue batch');
    } finally {
      setCreating(false);
    }
  };

  const toggleManual = (id: string) => {
    setSelectedManuals(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllManuals = () => setSelectedManuals(new Set(manuals.map(m => m.id)));
  const selectNoneManuals = () => setSelectedManuals(new Set());

  const isSingleSelected = selectedManuals.size === 1;
  const isMultiSelected = selectedManuals.size > 1;

  return (
    <div className="page-content">
      <div className="page-title">Upload & Process</div>

      {/* Upload zone */}
      <div
        className={`upload-zone${dragOver ? ' drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('pdf-file-input')?.click()}
      >
        <input
          id="pdf-file-input"
          type="file"
          accept=".pdf"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
        <div className="upload-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
        </div>
        <div className="upload-text">
          {uploading ? 'Uploading...' : 'Drop a PDF here or click to browse'}
        </div>
        <div className="upload-hint">PDF files only</div>
        {uploadError && <div className="upload-error">{uploadError}</div>}
      </div>

      {/* Step selection */}
      {selectedManuals.size > 0 && (
        <div className="section">
          <div className="section-title-row">
            <div className="section-title">Pipeline Steps</div>
            <div className="step-select-buttons">
              <button className="btn btn-sm btn-secondary" onClick={selectAll}>All</button>
              <button className="btn btn-sm btn-secondary" onClick={selectNone}>None</button>
            </div>
          </div>
          <div className="step-grid">
            {ALL_STEPS.map(step => (
              <label key={step} className="step-checkbox">
                <input
                  type="checkbox"
                  checked={selectedSteps.has(step)}
                  onChange={() => toggleStep(step)}
                />
                <span>{STEP_LABELS[step] || step}</span>
              </label>
            ))}
          </div>

          {createError && <div className="upload-error" style={{ marginTop: '8px' }}>{createError}</div>}

          {/* Run buttons */}
          <div className="run-buttons">
            {isSingleSelected && (
              <>
                <button
                  className="btn btn-primary btn-run"
                  onClick={handleRun}
                  disabled={creating || selectedSteps.size === 0}
                >
                  {creating ? 'Starting...' : 'Run Now'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    setSelectedSteps(new Set(ALL_STEPS));
                    setCreating(true);
                    setCreateError(null);
                    try {
                      const job = await createJob([...selectedManuals][0], ALL_STEPS);
                      onJobCreated(job.id);
                    } catch (err) {
                      setCreateError(err instanceof Error ? err.message : 'Failed');
                    } finally {
                      setCreating(false);
                    }
                  }}
                  disabled={creating}
                >
                  Run All Steps
                </button>
              </>
            )}
            {isMultiSelected && (
              <button
                className="btn btn-primary btn-run"
                onClick={handleQueueBatch}
                disabled={creating || selectedSteps.size === 0}
              >
                {creating ? 'Enqueuing...' : `Queue Batch (${selectedManuals.size} manuals)`}
              </button>
            )}
            {selectedManuals.size === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Select a manual above to enable run options
              </span>
            )}
          </div>
          {isMultiSelected && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Jobs will run sequentially — one after another
            </div>
          )}
        </div>
      )}

      {/* Manuals list */}
      {manuals.length > 0 && (
        <div className="section">
          <div className="section-title-row">
            <div className="section-title">
              Uploaded Manuals
              {selectedManuals.size > 0 && (
                <span style={{ marginLeft: '8px', fontWeight: 400, color: 'var(--accent)', fontSize: '11px' }}>
                  ({selectedManuals.size} selected)
                </span>
              )}
            </div>
            <div className="step-select-buttons">
              <button className="btn btn-sm btn-secondary" onClick={selectAllManuals}>All</button>
              <button className="btn btn-sm btn-secondary" onClick={selectNoneManuals}>None</button>
            </div>
          </div>
          <div className="manual-list">
            {manuals.map(m => (
              <div
                key={m.id}
                className={`manual-item${selectedManuals.has(m.id) ? ' selected' : ''}`}
                onClick={() => toggleManual(m.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={selectedManuals.has(m.id)}
                    onChange={() => toggleManual(m.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ marginTop: '2px', accentColor: 'var(--accent)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="manual-name">{m.filename}</div>
                    <div className="manual-meta">
                      {(m.size / 1024 / 1024).toFixed(1)} MB · {new Date(m.uploadedAt).toLocaleString()}
                      <button
                        className="btn btn-sm btn-danger"
                        style={{ marginLeft: '8px', padding: '1px 6px', fontSize: '10px' }}
                        onClick={e => { e.stopPropagation(); handleDeleteManual(m.id); }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
