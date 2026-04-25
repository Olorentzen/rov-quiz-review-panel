// Supabase authentication utilities for the PDF Ingestion review panel.
//
// The panel uses the same Supabase project as the Flutter ROV Quiz app.
// Users authenticate via email/password (Supabase auth).
// The resulting JWT access token is stored in localStorage and used to
// authenticate against the PDF Ingestion FastAPI.
//
// Configuration (set these in review panel's .env file):
//   VITE_SUPABASE_URL=https://your-project.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-key

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { setAuthToken } from '../utils/api';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
  || 'https://pupxceksdjbtbmbfhryw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1cHhjZWtzZGpidGJtYmZocnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjA0NTcsImV4cCI6MjA5MTQ5NjQ1N30.O58b7MNjv0jeigKNZWWSbjtNbqQjoyn0oCOYvNkgmnM';

// Singleton Supabase client
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}

export interface SupabaseAuthConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseAuthConfig | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

// ---------------------------------------------------------------------------
// Email/password authentication
// ---------------------------------------------------------------------------

export interface SignInError {
  message: string;
  status?: number;
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ user: User; session: { access_token: string } }> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
  }

  const { data, error } = await getClient().auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.session) {
    setAuthToken(data.session.access_token);
  }

  return { user: data.user, session: data.session };
}

export async function signUp(
  email: string,
  password: string
): Promise<{ user: User | null; session: { access_token: string } | null }> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await getClient().auth.signUp({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.session) {
    setAuthToken(data.session.access_token);
  }

  return { user: data.user, session: data.session };
}

export async function resetPasswordForEmail(
  email: string
): Promise<{ error: string | null }> {
  const { error } = await getClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`,
  });
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** Get current session (null if not authenticated) */
export async function getSession() {
  const { data } = await getClient().auth.getSession();
  return data.session;
}

/** Clear local FastAPI auth token */
function clearApiToken() {
  setAuthToken(null);
}

/** Store FastAPI auth token from Supabase session into localStorage for api.ts */
function syncApiToken(session: { access_token: string } | null) {
  if (session?.access_token) {
    setAuthToken(session.access_token);
  } else {
    clearApiToken();
  }
}

// ---------------------------------------------------------------------------
// Auth state listener
// ---------------------------------------------------------------------------

/**
 * Subscribe to auth state changes. Calls callback immediately with current session,
 * then again whenever auth changes (login, logout, token refresh).
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (session: { access_token: string; user: { id: string; email?: string } } | null, event?: string) => void,
): { data: { subscription: { unsubscribe: () => void } } } {
  return getClient().auth.onAuthStateChange((_event, session) => {
    syncApiToken(session);
    callback(session);
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  auth_user_id: string;
  role: string;
  approved: boolean;
}

/**
 * Fetch the local profile for the current authenticated user.
 * Returns null if no session or no profile row exists.
 */
export async function getMyProfile(): Promise<Profile | null> {
  const session = await getSession();
  if (!session?.user) return null;

  const { data, error } = await getClient()
    .from('profiles')
    .select('id, auth_user_id, role, approved')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

export async function signOut(): Promise<void> {
  clearApiToken();
  await getClient().auth.signOut();
}

// ---------------------------------------------------------------------------
// Bootstrap — create profile row if needed, call FastAPI
// ---------------------------------------------------------------------------

/**
 * Bootstrap the authenticated user:
 * 1. Store Supabase access token for FastAPI auth
 * 2. Call POST /api/auth/bootstrap to create profile row
 * Safe to call every login; backend uses INSERT OR IGNORE.
 */
export async function bootstrapProfile(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  syncApiToken(session);

  const API_BASE = import.meta.env.VITE_API_BASE as string || 'http://localhost:8000';

  console.log('[supabase] bootstrapProfile: POST', `${API_BASE}/api/auth/bootstrap`, {
    hasToken: !!session.access_token,
  });

  const response = await fetch(`${API_BASE}/api/auth/bootstrap`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('[supabase] bootstrapProfile: response status', response.status);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[supabase] bootstrapProfile: failed', response.status, body);
    throw new Error(`Bootstrap failed: ${body || response.status}`);
  }

  const text = await response.text().catch(() => '');
  console.log('[supabase] bootstrapProfile: success', text || response.status);
}

// ---------------------------------------------------------------------------
// Password update (for recovery flow)
// ---------------------------------------------------------------------------

export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  const { error } = await getClient().auth.updateUser({
    password: newPassword,
  });
  return { error: error?.message ?? null };
}
