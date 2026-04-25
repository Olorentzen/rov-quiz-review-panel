/// <reference types="vite/client" />

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { setAuthToken } from '../utils/api';
import { API_BASE } from '../utils/featureFlags';

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

// ---------------------------------------------------------------------------
// Magic link
// ---------------------------------------------------------------------------

/** Send a magic link to the given email */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  const { error } = await getClient().auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      shouldCreateUser: true,
    },
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

  console.log('[supabase] bootstrapProfile: POST', `${API_BASE}/auth/bootstrap`, {
    hasToken: !!session.access_token,
  });

  const response = await fetch(`${API_BASE}/auth/bootstrap`, {
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
