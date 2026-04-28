/// <reference types="vite/client" />

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'https://web-production-7c9f9.up.railway.app/api';

// Hosted mode = served from Railway (review.db-electronics.no).
// Using window.location check ensures it works even with cached builds,
// since window.location is evaluated at runtime, not build time.
const _hostname = typeof window !== 'undefined' ? window.location.hostname : '';
export const isHosted = _hostname === 'review.db-electronics.no' || _hostname === 'www.review.db-electronics.no';

export const canAccessUploads = !isHosted;
export const canAccessRuns = !isHosted;
