// Supabase authentication utilities for the PDF Ingestion review panel.
//
// The panel uses the same Supabase project as the Flutter ROV Quiz app.
// Users authenticate via email/password magic link or password (Supabase auth).
// The resulting JWT access token is stored in localStorage and used to
// authenticate against the PDF Ingestion FastAPI.
//
// Configuration (set these in review panel's .env file):
//   VITE_SUPABASE_URL=https://your-project.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-key

import { setAuthToken } from './api';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
  || 'https://pupxceksdjbtbmbfhryw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1cHhjZWtzZGpidGJtYmZocnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjA0NTcsImV4cCI6MjA5MTQ5NjQ1N30.O58b7MNjv0jeigKNZWWSbjtNbqQjoyn0oCOYvNkgmnM';

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

/**
 * Sign in with email + password using Supabase Auth.
 * Returns the raw JWT access token which is stored locally and
 * used by api.ts to authenticate against the FastAPI.
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ token: string }> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
  }

  const res = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.anonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Auth failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  setAuthToken(data.access_token);
  return { token: data.access_token };
}

/**
 * Sign out — clears the stored token from localStorage.
 */
export function signOut(): void {
  setAuthToken(null);
}

/**
 * Exchange a Supabase refresh token for a new access token.
 * Useful when the stored token has expired.
 */
export async function refreshToken(refreshToken: string): Promise<{ token: string }> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error('Supabase is not configured.');
  }

  const res = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.anonKey,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  setAuthToken(data.access_token);
  return { token: data.access_token };
}
