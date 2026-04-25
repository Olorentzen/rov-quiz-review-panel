import { useState, useEffect, useRef } from 'react';
import UploadPage from './pages/UploadPage';
import RunsPage from './pages/RunsPage';
import ReviewPage from './pages/ReviewPage';
import PacksPage from './pages/PacksPage';
import GroupsPage from './pages/GroupsPage';
import { checkHealth, clearAuthToken } from './utils/api';
import { sendMagicLink, onAuthStateChange, signOut as supabaseSignOut, getMyProfile, bootstrapProfile, getSession } from './lib/supabase';
import { canAccessUploads, canAccessRuns } from './utils/featureFlags';

type Tab = 'upload' | 'runs' | 'review' | 'packs' | 'groups';
type AppState = 'checking' | 'unauthenticated' | 'awaiting_approval' | 'authenticated' | 'profile_setup_failed';

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
// Profile setup failed screen
// ---------------------------------------------------------------------------

function ProfileSetupFailedScreen({ error, onSignOut }: { error: string; onSignOut: () => void }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Profile setup failed</h1>
        <p className="login-subtitle">
          Account created, but profile setup failed. Please contact support with
          the error below.
        </p>
        <pre style={{ fontSize: '0.75rem', color: '#cc0000', wordBreak: 'break-all', margin: '1rem 0' }}>
          {error}
        </pre>
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
  const [profileError, setProfileError] = useState<string | null>(null);
  // Prevent double-processing when both getSession() and onAuthStateChange fire
  const authHandledRef = useRef(false);

  // Redirect to 'review' if the current tab is inaccessible in hosted mode
  useEffect(() => {
    if (activeTab === 'upload' && !canAccessUploads) setActiveTab('review');
    else if (activeTab === 'runs' && !canAccessRuns) setActiveTab('review');
  }, []);

  /**
   * Handle a session that has been confirmed available.
   * Called by both onAuthStateChange (magic-link redirect) and getSession() fallback.
   */
  async function handleSession(session: { access_token: string; user: { id: string } } | null) {
    if (authHandledRef.current) return;
    authHandledRef.current = true;
    setProfileError(null);

    if (!session) {
      setAppState('unauthenticated');
      setApiStatus('checking');
      return;
    }

    let bootstrapFailed = false;
    let bootstrapErrMsg = '';

    try {
      console.log('[auth] calling bootstrapProfile...');
      await bootstrapProfile();
      console.log('[auth] bootstrapProfile succeeded');
    } catch (err) {
      bootstrapFailed = true;
      bootstrapErrMsg = err instanceof Error ? err.message : String(err);
      console.error('[auth] bootstrapProfile failed:', bootstrapErrMsg);
    }

    try {
      console.log('[auth] calling getMyProfile...');
      const profile = await getMyProfile();
      console.log('[auth] getMyProfile result:', profile);

      if (!profile) {
        if (bootstrapFailed) {
          // Bootstrap failed AND no profile row — surface as error, not "awaiting approval"
          setProfileError(bootstrapErrMsg || 'Profile creation failed on the server.');
          setAppState('profile_setup_failed');
        } else {
          // Bootstrap succeeded but still no row — rare; treat as setup failed
          setProfileError('Profile row not found after bootstrap. Please contact support.');
          setAppState('profile_setup_failed');
        }
      } else if (!profile.approved) {
        setAppState('awaiting_approval');
      } else {
        setAppState('authenticated');
      }
    } catch (err) {
      console.error('[auth] getMyProfile failed:', err);
      setProfileError(String(err));
      setAppState('profile_setup_failed');
    }
  }

  useEffect(() => {
    // Primary session restorer: onAuthStateChange fires when Supabase finishes
    // processing the URL hash after a magic-link redirect.
    const { data: { subscription } } = onAuthStateChange(async (session) => {
      await handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fallback: if onAuthStateChange hasn't fired within 2s (e.g. session already
  // persisted in localStorage from a prior visit), try getSession() directly.
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (authHandledRef.current) return;
      const session = await getSession();
      await handleSession(session);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (appState !== 'authenticated') return;
    checkHealth()
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'));
  }, [appState]);

  function handleSignOut() {
    authHandledRef.current = false;
    setProfileError(null);
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

  if (appState === 'profile_setup_failed') {
    return <ProfileSetupFailedScreen error={profileError || 'Unknown error'} onSignOut={handleSignOut} />;
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
