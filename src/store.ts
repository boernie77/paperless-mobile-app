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
