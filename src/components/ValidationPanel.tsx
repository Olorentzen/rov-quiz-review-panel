import { useState, useRef, useCallback, useEffect } from 'react';
import type { ValidationError, PackStats } from '../types/pack';
import { OPTION_LABELS } from '../types/pack';

interface ValidationPanelProps {
  errors: ValidationError[];
  selectedId: string | null;
  stats: PackStats;
  onSelectQuestion: (id: string) => void;
}

type Tab = 'stats' | 'issues' | 'duplicates';

export default function ValidationPanel({ errors, selectedId, stats, onSelectQuestion }: ValidationPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [panelHeight, setPanelHeight] = useState(220);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = panelHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [panelHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(800, startHeight.current + delta));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;
  const selectedErrors = errors.filter(e => e.questionId === selectedId);

  return (
    <div className="validation-panel" ref={panelRef}>
      <div
        className="validation-resize-handle"
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize"
      />
      <div className="validation-content" style={{ height: panelHeight, overflowY: 'auto' }}>
        <div className="validation-tabs">
        <button
          className={`validation-tab${activeTab === 'stats' ? ' active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Stats
        </button>
        <button
          className={`validation-tab${activeTab === 'issues' ? ' active' : ''}`}
          onClick={() => setActiveTab('issues')}
        >
          Issues
          {errorCount > 0 && <span className="tab-badge error">{errorCount}</span>}
          {warningCount > 0 && <span className="tab-badge warning">{warningCount}</span>}
        </button>
        <button
          className={`validation-tab${activeTab === 'duplicates' ? ' active' : ''}`}
          onClick={() => setActiveTab('duplicates')}
        >
          Duplicates
          {stats.duplicateStemGroups.length > 0 && (
            <span className="tab-badge warning">{stats.duplicateStemGroups.length}</span>
          )}
        </button>
      </div>

      {activeTab === 'stats' && (
        <div className="stats-panel">
          <div className="stats-section">
            <div className="stats-title">Total: {stats.totalQuestions}</div>
          </div>

          <div className="stats-section">
            <div className="stats-title">Difficulty</div>
            {Object.entries(stats.byDifficulty).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <div key={k} className="stats-row">
                <span className="stats-label">{k}</span>
                <span className="stats-value">{v}</span>
              </div>
            ))}
          </div>

          <div className="stats-section">
            <div className="stats-title">Correct Answer Distribution</div>
            <div className="answer-dist">
              {OPTION_LABELS.map((label, i) => (
                <div key={i} className="answer-dist-item">
                  <span className="answer-dist-label">{label}</span>
                  <div className="answer-dist-bar-wrap">
                    <div
                      className="answer-dist-bar"
                      style={{
                        width: `${stats.totalQuestions > 0 ? (stats.byCorrectAnswerIndex[i] / stats.totalQuestions) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="answer-dist-count">{stats.byCorrectAnswerIndex[i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-section">
            <div className="stats-title">Quality</div>
            <div className="stats-row">
              <span className="stats-label">Missing explanation</span>
              <span className="stats-value">{stats.missingExplanation}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">Empty options</span>
              <span className="stats-value">{stats.emptyOptions}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">Invalid correct_answer_index</span>
              <span className="stats-value">{stats.invalidCorrectAnswerIndex}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">Duplicate stems</span>
              <span className="stats-value">{stats.duplicateStemGroups.length} groups</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">Near-duplicate source facts</span>
              <span className="stats-value">{Object.keys(stats.nearDuplicateSourceFactGroups).length} groups</span>
            </div>
          </div>

          {Object.keys(stats.bySubsystem).length > 0 && (
            <div className="stats-section">
              <div className="stats-title">Subsystem</div>
              {Object.entries(stats.bySubsystem).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => (
                <div key={k} className="stats-row">
                  <span className="stats-label">{k}</span>
                  <span className="stats-value">{v}</span>
                </div>
              ))}
            </div>
          )}

          {Object.keys(stats.byMinRank).length > 0 && (
            <div className="stats-section">
              <div className="stats-title">Min Rank</div>
              {Object.entries(stats.byMinRank).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
                <div key={k} className="stats-row">
                  <span className="stats-label">{k}</span>
                  <span className="stats-value">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="validation-list">
          {errors.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
              No validation issues
            </div>
          ) : selectedId ? (
            selectedErrors.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
                No issues for selected question
              </div>
            ) : (
              selectedErrors.map((e, i) => (
                <div key={i} className={`validation-item ${e.severity} clickable`}
                  onClick={() => onSelectQuestion(e.questionId)}>
                  <span className="validation-icon">
                    {e.severity === 'error' ? '✕' : '⚠'}
                  </span>
                  <span className="validation-message">
                    <code>{e.field}</code>: {e.message}
                  </span>
                </div>
              ))
            )
          ) : (
            errors.slice(0, 50).map((e, i) => (
              <div key={i} className={`validation-item ${e.severity} clickable`}
                onClick={() => onSelectQuestion(e.questionId)}>
                <span className="validation-icon">
                  {e.severity === 'error' ? '✕' : '⚠'}
                </span>
                <span className="validation-message">
                  <code>{e.questionId}</code>: {e.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'duplicates' && (
        <div className="validation-list">
          {stats.duplicateStemGroups.length === 0 && Object.keys(stats.nearDuplicateSourceFactGroups).length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
              No duplicates found
            </div>
          ) : (
            <>
              {stats.duplicateStemGroups.length > 0 && (
                <div className="dup-section">
                  <div className="dup-section-title">Exact Duplicate Stems ({stats.duplicateStemGroups.length} groups)</div>
                  {stats.duplicateStemGroups.map((group, i) => (
                    <div key={i} className="dup-group">
                      <div className="dup-group-ids">
                        {group.map(id => (
                          <code
                            key={id}
                            className="dup-id clickable"
                            onClick={() => onSelectQuestion(id)}
                          >
                            {id}
                          </code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {Object.keys(stats.nearDuplicateSourceFactGroups).length > 0 && (
                <div className="dup-section">
                  <div className="dup-section-title">Same Source Fact ({Object.keys(stats.nearDuplicateSourceFactGroups).length} groups)</div>
                  {Object.entries(stats.nearDuplicateSourceFactGroups).slice(0, 20).map(([factId, ids]) => (
                    <div key={factId} className="dup-group">
                      <div className="dup-group-label">
                        <code className="dup-fact-id">{factId}</code>
                        <span className="dup-count">({ids.length} questions)</span>
                      </div>
                      <div className="dup-group-ids">
                        {ids.map(id => (
                          <code
                            key={id}
                            className="dup-id clickable"
                            onClick={() => onSelectQuestion(id)}
                          >
                            {id}
                          </code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
