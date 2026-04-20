import { useState, useEffect } from 'react';
import UploadPage from './pages/UploadPage';
import RunsPage from './pages/RunsPage';
import ReviewPage from './pages/ReviewPage';
import PacksPage from './pages/PacksPage';
import GroupsPage from './pages/GroupsPage';
import { checkHealth, getAuthToken, clearAuthToken } from './utils/api';
import { signInWithPassword, signOut as supabaseSignOut, getSupabaseConfig } from './utils/supabase';
import { canAccessUploads, canAccessRuns } from './utils/featureFlags';

type Tab = 'upload' | 'runs' | 'review' | 'packs' | 'groups';

// ---------------------------------------------------------------------------
// Login screen — shown when no Supabase JWT is stored
// ---------------------------------------------------------------------------

function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const config = getSupabaseConfig();

  if (!config) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">PDF Ingestion Dashboard</h1>
          <p className="login-error">
            Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file, then restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithPassword(email, password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">PDF Ingestion Dashboard</h1>
        <p className="login-subtitle">Sign in with your Supabase account</p>
        <form className="login-form" onSubmit={handleLogin}>
          <label className="login-label">
            Email
            <input
              type="email"
              className="login-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </label>
          <label className="login-label">
            Password
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app shell — requires auth
// ---------------------------------------------------------------------------

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [, setSelectedJobId] = useState<string | null>(null);

  // Redirect to 'review' if the current tab is inaccessible in hosted mode
  useEffect(() => {
    if (activeTab === 'upload' && !canAccessUploads) setActiveTab('review');
    else if (activeTab === 'runs' && !canAccessRuns) setActiveTab('review');
  }, []);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error' | 'unauthorized'>('checking');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!getAuthToken());

  useEffect(() => {
    checkHealth()
      .then(() => setApiStatus('ok'))
      .catch((err) => {
        // Distinguish 401 (auth guard) from network error
        if (err instanceof Error && err.message.includes('401')) {
          setApiStatus('unauthorized');
        } else {
          setApiStatus('error');
        }
      });
  }, []);

  function handleLogin() {
    setIsAuthenticated(true);
    setApiStatus('checking');
    checkHealth()
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'));
  }

  function handleSignOut() {
    supabaseSignOut();
    clearAuthToken();
    setIsAuthenticated(false);
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoggedIn={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <span className="brand-title">PDF Ingestion</span>
          <span className="brand-subtitle">Quiz Review Dashboard</span>
        </div>

        <nav className="header-nav">
          {canAccessUploads && (
            <button
              className={`nav-tab${activeTab === 'upload' ? ' active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              Upload
            </button>
          )}
          {canAccessRuns && (
            <button
              className={`nav-tab${activeTab === 'runs' ? ' active' : ''}`}
              onClick={() => setActiveTab('runs')}
            >
              Runs
            </button>
          )}
          <button
            className={`nav-tab${activeTab === 'review' ? ' active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            Review
          </button>
          <button
            className={`nav-tab${activeTab === 'packs' ? ' active' : ''}`}
            onClick={() => setActiveTab('packs')}
          >
            Packs
          </button>
          <button
            className={`nav-tab${activeTab === 'groups' ? ' active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            Groups
          </button>
        </nav>

        <div className="header-right">
          <div className={`api-status api-status-${apiStatus === 'unauthorized' ? 'error' : apiStatus}`}>
            <span className="api-dot" />
            <span className="api-label">
              {apiStatus === 'checking' && 'Checking API...'}
              {apiStatus === 'ok' && 'API Connected'}
              {apiStatus === 'error' && 'API Offline'}
              {apiStatus === 'unauthorized' && 'Unauthorized — log in again'}
            </span>
          </div>
          <button className="sign-out-button" onClick={handleSignOut} title="Sign out">
            Sign Out
          </button>
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'upload' && (
          <UploadPage onJobCreated={jobId => { setSelectedJobId(jobId); setActiveTab('runs'); }} />
        )}
        {activeTab === 'runs' && (
          <RunsPage onSelectJob={jobId => setSelectedJobId(jobId)} />
        )}
        {activeTab === 'review' && <ReviewPage />}
        {activeTab === 'packs' && <PacksPage />}
        {activeTab === 'groups' && <GroupsPage />}
      </main>
    </div>
  );
}
