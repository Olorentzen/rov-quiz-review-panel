import { useState, useEffect } from 'react';
import UploadPage from './pages/UploadPage';
import RunsPage from './pages/RunsPage';
import ReviewPage from './pages/ReviewPage';
import PacksPage from './pages/PacksPage';
import GroupsPage from './pages/GroupsPage';
import { checkHealth, clearAuthToken } from './utils/api';
import { sendMagicLink, onAuthStateChange, signOut as supabaseSignOut, getMyProfile, bootstrapProfile, getSession } from './lib/supabase';
import { canAccessUploads, canAccessRuns } from './utils/featureFlags';

type Tab = 'upload' | 'runs' | 'review' | 'packs' | 'groups';
type AppState = 'checking' | 'unauthenticated' | 'awaiting_approval' | 'authenticated';

// ---------------------------------------------------------------------------
// Login screen — magic link only
// ---------------------------------------------------------------------------

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await sendMagicLink(email);
      if (authError) {
        setError(authError);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">Check your email</h1>
          <p className="login-subtitle">
            A sign-in link has been sent to <strong>{email}</strong>.
            Click the link in the email to sign in.
          </p>
          <button className="login-button" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">PDF Ingestion Dashboard</h1>
        <p className="login-subtitle">Enter your email to receive a sign-in link</p>
        <form className="login-form" onSubmit={handleSubmit}>
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
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Sending...' : 'Send Sign-In Link'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Awaiting approval screen
// ---------------------------------------------------------------------------

function AwaitingApprovalScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Account pending approval</h1>
        <p className="login-subtitle">
          Your account has been created but is not yet approved.
          Please contact an administrator to approve your account.
        </p>
        <button className="login-button" onClick={onSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app shell — requires auth + approval
// ---------------------------------------------------------------------------

export default function App() {
  const [appState, setAppState] = useState<AppState>('checking');
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [, setSelectedJobId] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  // Redirect to 'review' if the current tab is inaccessible in hosted mode
  useEffect(() => {
    if (activeTab === 'upload' && !canAccessUploads) setActiveTab('review');
    else if (activeTab === 'runs' && !canAccessRuns) setActiveTab('review');
  }, []);

  /**
   * Restore session on mount — handles magic-link redirect where the session
   * is in the URL hash. Runs before onAuthStateChange so we capture the session
   * synchronously from getSession(), then bootstrap and check approval.
   */
  useEffect(() => {
    async function restoreSession() {
      const session = await getSession();
      if (!session) {
        setAppState('unauthenticated');
        setApiStatus('checking');
        return;
      }

      try {
        await bootstrapProfile();
      } catch {
        // Non-fatal: profile row might already exist; continue to fetch it
      }

      try {
        const profile = await getMyProfile();
        if (!profile) {
          setAppState('awaiting_approval');
        } else if (!profile.approved) {
          setAppState('awaiting_approval');
        } else {
          setAppState('authenticated');
        }
      } catch {
        setAppState('unauthenticated');
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    // Listen for subsequent auth changes (logout, token refresh, etc.)
    const { data: { subscription } } = onAuthStateChange(async (session) => {
      if (!session) {
        setAppState('unauthenticated');
        setApiStatus('checking');
        return;
      }
      // Session already restored and bootstrapped by restoreSession() above;
      // onAuthStateChange here handles token refresh / logout only.
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (appState !== 'authenticated') return;
    checkHealth()
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'));
  }, [appState]);

  function handleSignOut() {
    supabaseSignOut();
    clearAuthToken();
    setAppState('unauthenticated');
  }

  if (appState === 'checking') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <p className="login-subtitle">Checking session...</p>
        </div>
      </div>
    );
  }

  if (appState === 'unauthenticated') {
    return <LoginScreen />;
  }

  if (appState === 'awaiting_approval') {
    return <AwaitingApprovalScreen onSignOut={handleSignOut} />;
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
          <div className={`api-status api-status-${apiStatus}`}>
            <span className="api-dot" />
            <span className="api-label">
              {apiStatus === 'checking' && 'Checking API...'}
              {apiStatus === 'ok' && 'API Connected'}
              {apiStatus === 'error' && 'API Offline'}
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
