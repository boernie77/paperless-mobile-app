import { signal } from '@preact/signals';
import { PaperlessAPI } from './api';

export const authState = signal<{
  baseUrl: string;
  token: string;
  isAuthenticated: boolean;
} | null>(null);

export const apiSignal = signal<PaperlessAPI | null>(null);

export function initializeAuth(baseUrl: string, token: string) {
  const api = new PaperlessAPI(baseUrl, token);
  apiSignal.value = api;
  authState.value = { baseUrl, token, isAuthenticated: true };
  
  localStorage.setItem('paperless_url', baseUrl);
  localStorage.setItem('paperless_token', token);
}

export function logout() {
  apiSignal.value = null;
  authState.value = null;
  localStorage.removeItem('paperless_url');
  localStorage.removeItem('paperless_token');
}

// Auto-login from localStorage
const savedUrl = localStorage.getItem('paperless_url');
const savedToken = localStorage.getItem('paperless_token');
if (savedUrl && savedToken) {
  initializeAuth(savedUrl, savedToken);
}

// Global filter state for DocumentList
export const filterSignal = signal<Record<string, any>>({});
export const failedDocsSignal = signal<{id: number, title: string}[] | null>(null);
export const duplicateDocsSignal = signal<{id: number, title: string}[] | null>(null);

// Owner/user filter: null = show all, number[] = show only these user IDs
const _savedOwnerFilter = localStorage.getItem('owner_filter');
export const ownerFilterSignal = signal<number[] | null>(
  _savedOwnerFilter ? JSON.parse(_savedOwnerFilter) : null
);

