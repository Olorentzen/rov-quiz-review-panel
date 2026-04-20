/// <reference types="vite/client" />

export const DEPLOY_MODE = (import.meta.env.VITE_DEPLOY_MODE as 'hosted' | 'offline') ?? 'offline';
export const isHosted = DEPLOY_MODE === 'hosted';
export const canAccessUploads = !isHosted;
export const canAccessRuns = !isHosted;
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api';
