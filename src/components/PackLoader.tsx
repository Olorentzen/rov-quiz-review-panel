import { useRef } from 'react';

interface PackLoaderProps {
  onLoad: (file: File) => void;
  onNew: () => void;
  isLoading: boolean;
  error: string | null;
}

export default function PackLoader({ onLoad, onNew, isLoading, error }: PackLoaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoad(file);
    }
    // Reset input so same file can be loaded again
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        className="btn btn-secondary"
        onClick={onNew}
        disabled={isLoading}
      >
        New
      </button>
      <button
        className="btn btn-primary"
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : 'Load Pack'}
      </button>
      {error && (
        <span style={{ color: 'var(--error)', fontSize: '13px' }}>{error}</span>
      )}
    </>
  );
}
