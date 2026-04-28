import { useState, useEffect, useRef } from 'react';
import UploadPage from './pages/UploadPage';
import RunsPage from './pages/RunsPage';
import ReviewPage from './pages/ReviewPage';
import PacksPage from './pages/PacksPage';
import GroupsPage from './pages/GroupsPage';
import { checkHealth, clearAuthToken } from './utils/api';
import {
  signInWithPassword,
  signUp,
  onAuthStateChange,
  signOut as supabaseSignOut,
  getMyProfile,
  bootstrapProfile,
  getSession,
  updatePassword,
} from './lib/supabase';
import { canAccessUploads, canAccessRuns } from './utils/featureFlags';

type Tab = 'upload' | 'runs' | 'review' | 'packs' | 'groups';
type AppState = 'checking' | 'unauthenticated' | 'awaiting_approval' | 'authenticated' | 'profile_setup_failed';
type AuthView = 'signin' | 'signup' | 'forgot_password' | 'reset_password' | 'update_password' | 'signup_success';

// ---------------------------------------------------------------------------
// Password validation
// ---------------------------------------------------------------------------

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sign In screen
// ---------------------------------------------------------------------------

function SignInScreen({
  onShowSignup,
  onShowForgotPassword,
  onSuccess,
}: {
  onShowSignup: () => void;
  onShowForgotPassword: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithPassword(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">PDF Ingestion Dashboard</h1>
        <p className="login-subtitle">Sign in with your email and password</p>
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
          <label className="login-label">
            Password
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  fontSize: '0.75rem',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="login-footer">
          <button className="login-link" onClick={onShowForgotPassword}>
            Forgot password?
          </button>
          <span className="login-divider">|</span>
          <button className="login-link" onClick={onShowSignup}>
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign Up screen
// ---------------------------------------------------------------------------

function SignUpScreen({
  onShowSignin,
  onApprovalRequired,
}: {
  onShowSignin: () => void;
  onApprovalRequired: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(email, password);
      if (result.user) {
        onApprovalRequired(email);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setError('Email already registered. Try signing in or use a different email.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Create Account</h1>
        <p className="login-subtitle">Sign up to get started</p>
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
          <label className="login-label">
            Password
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  fontSize: '0.75rem',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginTop: '0.25rem' }}>
              Must contain: 8+ characters, uppercase, lowercase, and number
            </span>
          </label>
          <label className="login-label">
            Confirm Password
            <input
              type={showPassword ? 'text' : 'password'}
              className="login-input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <div className="login-footer">
          <button className="login-link" onClick={onShowSignin}>
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forgot Password screen
// ---------------------------------------------------------------------------

function ForgotPasswordScreen({
  onShowSignin,
}: {
  onShowSignin: () => void;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { resetPasswordForEmail } = await import('./lib/supabase');
      const { error: resetError } = await resetPasswordForEmail(email);
      if (resetError) {
        setError(resetError);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">Check Your Email</h1>
          <p className="login-subtitle">
            We sent a password reset link to <strong>{email}</strong>.
            Click the link to reset your password.
          </p>
          <button className="login-button" onClick={onShowSignin}>
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Reset Password</h1>
        <p className="login-subtitle">Enter your email to receive a reset link</p>
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
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <div className="login-footer">
          <button className="login-link" onClick={onShowSignin}>
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Registration success screen (shows after signup, before approval)
// ---------------------------------------------------------------------------

function RegistrationSuccessScreen({
  email,
  onSignin,
}: {
  email: string;
  onSignin: () => void;
}) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Check Your Email</h1>
        <p className="login-subtitle">
          We sent a confirmation link to <strong>{email}</strong>.
          Click the link in the email to verify your address, then return here to sign in.
        </p>
        <button className="login-button" onClick={onSignin}>
          Return to Sign In
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Update Password screen (recovery flow)
// ---------------------------------------------------------------------------

function UpdatePasswordScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError);
      } else {
        setSuccess(true);
        setTimeout(() => onSuccess(), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">Password Updated</h1>
          <p className="login-subtitle">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
          <button className="login-button" onClick={onSuccess}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Set New Password</h1>
        <p className="login-subtitle">Enter your new password below</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label">
            New Password
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
                autoFocus
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  fontSize: '0.75rem',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginTop: '0.25rem' }}>
              Must contain: 8+ characters, uppercase, lowercase, and number
            </span>
          </label>
          <label className="login-label">
            Confirm New Password
            <input
              type={showPassword ? 'text' : 'password'}
              className="login-input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
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
  const [authView, setAuthView] = useState<AuthView>('signin');
  const [pendingEmail, setPendingEmail] = useState<string>('');
  // Prevent double-processing when both getSession() and onAuthStateChange fire
  const authHandledRef = useRef(false);

  // Check if we're on the update-password route
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/update-password' || path.endsWith('/update-password')) {
      setAuthView('update_password');
    }
  }, []);

  // Redirect to 'review' if the current tab is inaccessible in hosted mode
  useEffect(() => {
    if (activeTab === 'upload' && !canAccessUploads) setActiveTab('review');
    else if (activeTab === 'runs' && !canAccessRuns) setActiveTab('review');
  }, []);

  /**
   * Handle a session that has been confirmed available.
   * Called by both onAuthStateChange (login) and getSession() fallback.
   */
  async function handleSession(session: { access_token: string; user: { id: string } } | null) {
    console.log('[auth handleSession]', {
      sessionPresent: !!session,
      sessionUserId: session?.user?.id,
      pathname: window.location.pathname,
    });

    if (authHandledRef.current) {
      console.log('[auth] handleSession skipped — already handled');
      return;
    }
    authHandledRef.current = true;
    setProfileError(null);

    if (!session) {
      console.log('[auth] no session — redirecting to /login (appState: unauthenticated)');
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
          setProfileError(bootstrapErrMsg || 'Profile creation failed on the server.');
          setAppState('profile_setup_failed');
        } else {
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
    // Primary session restorer: onAuthStateChange fires when Supabase processes
    // auth state changes.
    const { data: { subscription } } = onAuthStateChange(async (session, event) => {
      console.log('[auth onAuthStateChange]', {
        event,
        sessionPresent: !!session,
        pathname: window.location.pathname,
      });
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
    setAuthView('signin');
  }

  async function handleLoginSuccess() {
    authHandledRef.current = false;
    const session = await getSession();
    handleSession(session);
  }

  function handleApprovalRequired(email: string) {
    setPendingEmail(email);
    setAuthView('signup_success');
  }

  // Detect password recovery: show UpdatePasswordScreen even when session is valid.
  // Some Supabase setups emit SIGNED_IN during recovery, so we also check the pathname.
  const isUpdatePasswordRoute =
    window.location.pathname === '/update-password' ||
    window.location.pathname.endsWith('/update-password');

  console.log('[auth render]', {
    pathname: window.location.pathname,
    appState,
    authView,
    isUpdatePasswordRoute,
  });

  if (isUpdatePasswordRoute) {
    console.log('[auth] showing UpdatePasswordScreen (recovery flow)');
    return (
      <UpdatePasswordScreen onSuccess={handleSignOut} />
    );
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
    if (authView === 'update_password') {
      return (
        <UpdatePasswordScreen onSuccess={handleSignOut} />
      );
    }
    if (authView === 'signup') {
      return (
        <SignUpScreen
          onShowSignin={() => setAuthView('signin')}
          onApprovalRequired={handleApprovalRequired}
        />
      );
    }
    if (authView === 'forgot_password') {
      return (
        <ForgotPasswordScreen onShowSignin={() => setAuthView('signin')} />
      );
    }
    if (authView === 'signup_success') {
      return (
        <RegistrationSuccessScreen
          email={pendingEmail}
          onSignin={() => setAuthView('signin')}
        />
      );
    }
    return (
      <SignInScreen
        onShowSignup={() => setAuthView('signup')}
        onShowForgotPassword={() => setAuthView('forgot_password')}
        onSuccess={handleLoginSuccess}
      />
    );
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
