import type { FilterState, LearningCategory, ReviewStatus } from '../types/pack';
import { DIFFICULTY_OPTIONS, REVIEW_STATUS_OPTIONS } from '../types/pack';

interface FilterBarProps {
  filters: FilterState;
  onChange: (updates: Partial<FilterState>) => void;
  learningCategories: LearningCategory[];
  subsystems: string[];
}

export default function FilterBar({
  filters,
  onChange,
  learningCategories,
  subsystems,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="filter-row">
        <input
          type="text"
          className="filter-input"
          placeholder="Search stem, tags, subsystem..."
          value={filters.searchText}
          onChange={e => onChange({ searchText: e.target.value })}
        />
      </div>

      <div className="filter-row">
        <input
          type="text"
          className="filter-input"
          placeholder="Question ID"
          value={filters.questionId}
          onChange={e => onChange({ questionId: e.target.value })}
          style={{ maxWidth: '130px' }}
        />
        <select
          className="filter-select"
          value={filters.reviewStatus ?? ''}
          onChange={e => onChange({ reviewStatus: (e.target.value as ReviewStatus) || null })}
        >
          <option value="">Status</option>
          {REVIEW_STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.difficulty ?? ''}
          onChange={e => onChange({ difficulty: e.target.value || null })}
        >
          <option value="">Difficulty</option>
          {DIFFICULTY_OPTIONS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {(learningCategories.length > 0 || subsystems.length > 0) && (
        <div className="filter-row">
          {learningCategories.length > 0 && (
            <select
              className="filter-select"
              value={filters.learningCategory ?? ''}
              onChange={e => onChange({ learningCategory: e.target.value || null })}
            >
              <option value="">Learning Category</option>
              {learningCategories.map(c => (
                <option key={c.category_id} value={c.category_id}>{c.label}</option>
              ))}
            </select>
          )}
          {subsystems.length > 0 && (
            <select
              className="filter-select"
              value={filters.subsystemCategory ?? ''}
              onChange={e => onChange({ subsystemCategory: e.target.value || null })}
            >
              <option value="">Subsystem</option>
              {subsystems.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="filter-row">
        <input
          type="text"
          className="filter-input"
          placeholder="Min rank"
          value={filters.minRank ?? ''}
          onChange={e => onChange({ minRank: e.target.value || null })}
          style={{ maxWidth: '90px' }}
        />
        <input
          type="text"
          className="filter-input"
          placeholder="Fact type"
          value={filters.factType ?? ''}
          onChange={e => onChange({ factType: e.target.value || null })}
          style={{ maxWidth: '100px' }}
        />
        <input
          type="number"
          className="filter-input"
          placeholder="Conf min"
          value={filters.confidenceMin ?? ''}
          onChange={e => onChange({ confidenceMin: e.target.value ? parseFloat(e.target.value) : null })}
          min={0}
          max={1}
          step={0.1}
          style={{ maxWidth: '70px' }}
        />
        <input
          type="number"
          className="filter-input"
          placeholder="Conf max"
          value={filters.confidenceMax ?? ''}
          onChange={e => onChange({ confidenceMax: e.target.value ? parseFloat(e.target.value) : null })}
          min={0}
          max={1}
          step={0.1}
          style={{ maxWidth: '70px' }}
        />
      </div>
    </div>
  );
}
