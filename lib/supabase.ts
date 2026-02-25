import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const NETWORK_TIMEOUT_MS = 30000;

/**
 * Custom fetch with extended timeout for slow mobile networks.
 * Supabase requests can fail on poor connections without this.
 */
const fetchWithTimeout = (url: RequestInfo, options: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  const originalSignal = options.signal;
  if (originalSignal) {
    originalSignal.addEventListener('abort', () => {
      controller.abort();
      clearTimeout(timeout);
    });
  }
  // Some carriers/networks block requests without a standard User-Agent
  const headers = new Headers(options.headers as HeadersInit);
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'WorkFlow/1.0 (com.vishrut19.WorkFlow; Android)');
  }
  return fetch(url, {
    ...options,
    headers,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

/**
 * Check if an error is a network connectivity failure.
 * Returns a user-friendly message if so, otherwise null.
 */
export function getNetworkErrorMessage(error: any): string | null {
  const msg = String(error?.message || '').toLowerCase();
  const isNetworkError =
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('aborted') ||
    error?.name === 'AbortError';
  if (isNetworkError) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }
  return null;
}
