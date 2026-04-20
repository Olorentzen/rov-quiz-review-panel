import { useState, useEffect, useCallback, useRef } from 'react';
import { listJobs, getJob, cancelJob, deleteJob, type JobListItem, type JobDetail } from '../utils/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#6b7280',
  queued: '#9ca3af',
  running: '#4f8aff',
  completed: '#22c55e',
  failed: '#ef4444',
  cancelled: '#f59e0b',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export default function RunsPage(_props: { onSelectJob?: (jobId: string) => void }) {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const list = await listJobs();
      setJobs(list);
    } catch (e) {
      // ignore
    }
  }, []);

  // Smart polling: 5s when active jobs exist, 15s when idle
  useEffect(() => {
    loadJobs();
    const schedule = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      const hasActive = jobs.some(j => j.status === 'queued' || j.status === 'running');
      const interval = hasActive ? 5000 : 15000;
      pollRef.current = setInterval(loadJobs, interval);
    };
    schedule();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh selected job detail when polling
  useEffect(() => {
    if (!selectedJobId) return;
    const runningJob = jobs.find(j => j.id === selectedJobId && (j.status === 'running' || j.status === 'queued'));
    if (!runningJob) return;
    const poll = async () => {
      try {
        const detail = await getJob(selectedJobId);
        setJobDetail(detail);
      } catch (e) { /* ignore */ }
    };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [selectedJobId, jobs]);

  const selectJob = async (jobId: string) => {
    if (selectedJobId === jobId) return;
    setSelectedJobId(jobId);
    setLoading(true);
    try {
      const detail = await getJob(jobId);
      setJobDetail(detail);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cancelJob(jobId);
      await loadJobs();
      if (selectedJobId === jobId) {
        const detail = await getJob(jobId);
        setJobDetail(detail);
      }
    } catch (err) {
      // ignore
    }
  };

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteJob(jobId);
      if (selectedJobId === jobId) {
        setSelectedJobId(null);
        setJobDetail(null);
      }
      await loadJobs();
    } catch (err) {
      // ignore
    }
  };

  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'running' || j.status === 'pending');
  const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');

  // Queue summary counts
  const runningCount = jobs.filter(j => j.status === 'running').length;
  const queuedCount = jobs.filter(j => j.status === 'queued').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;
  const hasActive = activeJobs.length > 0;

  return (
    <div className="page-content">
      <div className="page-title">Pipeline Runs</div>

      {/* Queue summary bar */}
      {hasActive && (
        <div className="queue-summary-bar">
          {runningCount > 0 && (
            <span className="queue-summary-item">
              <span className="queue-dot" style={{ background: STATUS_COLORS.running }} />
              Running: {runningCount}
            </span>
          )}
          {queuedCount > 0 && (
            <span className="queue-summary-item">
              <span className="queue-dot" style={{ background: STATUS_COLORS.queued }} />
              Queued: {queuedCount}
            </span>
          )}
          {failedCount > 0 && (
            <span className="queue-summary-item" style={{ color: STATUS_COLORS.failed }}>
              Failed: {failedCount}
            </span>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Refreshing every {jobs.some(j => j.status === 'queued' || j.status === 'running') ? '5s' : '15s'}
          </span>
        </div>
      )}

      {jobs.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">▶</div>
          <div>No pipeline runs yet. Go to Upload to start one.</div>
        </div>
      )}

      <div className="runs-layout">
        {/* Job list */}
        <div className="runs-list">
          {activeJobs.length > 0 && (
            <>
              <div className="runs-section-title">Active</div>
              {activeJobs.map(job => (
                <JobListItem
                  key={job.id}
                  job={job}
                  selected={selectedJobId === job.id}
                  onSelect={() => selectJob(job.id)}
                  onCancel={handleCancel}
                  onDelete={() => {}}
                />
              ))}
            </>
          )}

          {completedJobs.length > 0 && (
            <>
              <div className="runs-section-title">Completed</div>
              {completedJobs.map(job => (
                <JobListItem
                  key={job.id}
                  job={job}
                  selected={selectedJobId === job.id}
                  onSelect={() => selectJob(job.id)}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}
        </div>

        {/* Job detail */}
        {selectedJobId && (
          <div className="runs-detail">
            {loading ? (
              <div className="empty-state">Loading...</div>
            ) : jobDetail ? (
              <JobDetailView job={jobDetail} onCancel={handleCancel} onDelete={handleDelete} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function JobListItem({
  job,
  selected,
  onSelect,
  onCancel,
  onDelete,
}: {
  job: JobListItem;
  selected: boolean;
  onSelect: () => void;
  onCancel: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const pct = job.progressPct;
  const eta = job.etaSeconds;
  const etaStr = eta != null ? (eta < 60 ? `${Math.round(eta)}s` : `${Math.round(eta / 60)}m`) : null;

  const isQueued = job.status === 'queued';
  const isRunning = job.status === 'running';
  const isActive = isQueued || isRunning;

  return (
    <div
      className={`run-item${selected ? ' selected' : ''}${job.status === 'failed' ? ' failed' : ''}${isQueued ? ' queued' : ''}`}
      onClick={onSelect}
    >
      <div className="run-item-header">
        <div className="run-name">
          {isQueued && job.queueRank != null && (
            <span style={{ fontSize: '10px', color: STATUS_COLORS.queued, marginRight: '4px', fontWeight: 600 }}>
              #{job.queueRank}
            </span>
          )}
          {job.manualName}
        </div>
        <div className="run-status-chip" style={{ color: STATUS_COLORS[job.status] }}>
          {STATUS_LABELS[job.status] || job.status}
          {isQueued && job.queueRank != null ? ` (#${job.queueRank})` : ''}
        </div>
      </div>
      <div className="run-item-meta">
        {job.currentStep && <span>Step: {job.currentStep}</span>}
        {etaStr && isRunning && <span>ETA: {etaStr}</span>}
        {job.startedAt && <span>Started: {new Date(job.startedAt).toLocaleTimeString()}</span>}
        {job.finishedAt && <span>Finished: {new Date(job.finishedAt).toLocaleTimeString()}</span>}
        {isQueued && <span style={{ color: STATUS_COLORS.queued }}>Waiting in queue</span>}
      </div>
      {isActive && (
        <div className="run-progress-wrap">
          <div className="run-progress-bar">
            <div
              className="run-progress-fill"
              style={{
                width: `${pct}%`,
                background: isQueued ? STATUS_COLORS.queued : STATUS_COLORS.running,
              }}
            />
          </div>
          <span className="run-progress-pct">{pct}%</span>
          {isRunning && (
            <button
              className="btn btn-sm btn-danger"
              style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '11px' }}
              onClick={e => onCancel(job.id, e)}
            >
              Cancel
            </button>
          )}
        </div>
      )}
      {(job.status === 'failed' || job.status === 'cancelled') && (
        <div style={{ marginTop: '6px' }}>
          <button
            className="btn btn-sm btn-danger"
            style={{ padding: '2px 8px', fontSize: '11px' }}
            onClick={e => { e.stopPropagation(); onDelete(job.id, e); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function JobDetailView({ job, onCancel, onDelete }: { job: JobDetail; onCancel: (id: string, e: React.MouseEvent) => void; onDelete: (id: string, e: React.MouseEvent) => void }) {
  return (
    <div className="job-detail">
      <div className="job-detail-header">
        <div>
          <div className="job-detail-title">{job.manualName}</div>
          <div className="job-detail-id">{job.id}</div>
        </div>
        <div className="job-detail-status" style={{ color: STATUS_COLORS[job.status] }}>
          {STATUS_LABELS[job.status] || job.status?.toUpperCase()}
        </div>
      </div>

      {/* Steps */}
      <div className="job-steps">
        {job.steps.map(step => (
          <div key={step.step} className={`job-step ${step.status}`}>
            <div className="job-step-icon">
              {step.status === 'completed' ? '✓' : step.status === 'running' ? '↻' : step.status === 'failed' ? '✗' : '○'}
            </div>
            <div className="job-step-info">
              <div className="job-step-name">{step.step}</div>
              <div className="job-step-duration">
                {step.durationSeconds != null ? `${step.durationSeconds.toFixed(1)}s` : ''}
                {step.message && <span className="job-step-msg"> — {step.message}</span>}
              </div>
            </div>
            <div className="job-step-status" style={{ color: STATUS_COLORS[step.status] }}>
              {step.status}
            </div>
          </div>
        ))}
      </div>

      {/* Logs */}
      {job.logs.length > 0 && (
        <div className="job-logs">
          <div className="job-logs-title">Recent Logs</div>
          <div className="job-logs-list">
            {job.logs.slice(-50).reverse().map((log, i) => (
              <div key={i} className={`log-entry log-${log.level.toLowerCase()}`}>
                <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`log-level-${log.level.toLowerCase()}`}>{log.level}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(job.status === 'running' || job.status === 'pending' || job.status === 'queued') && (
        <button
          className="btn btn-danger"
          onClick={e => onCancel(job.id, e)}
        >
          Cancel Job
        </button>
      )}

      {(job.status === 'failed' || job.status === 'cancelled') && (
        <button
          className="btn btn-danger"
          style={{ marginTop: '12px' }}
          onClick={e => onDelete(job.id, e)}
        >
          Delete Job
        </button>
      )}
    </div>
  );
}
