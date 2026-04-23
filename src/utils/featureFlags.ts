/// <reference types="vite/client" />

export const DEPLOY_MODE = (import.meta.env.VITE_DEPLOY_MODE as 'hosted' | 'offline') ?? 'offline';
export const isHosted = DEPLOY_MODE === 'hosted';
export const canAccessUploads = !isHosted;
export const canAccessRuns = !isHosted;
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'https://web-production-7c9f9.up.railway.app/api';
