import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const CLOUDFLARE_PROXY_URL = process.env.EXPO_PUBLIC_CLOUDFLARE_PROXY_URL || '';

const NETWORK_TIMEOUT_MS = 30000;

const fetchWithProxy = async (
  url: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> => {
  if (typeof url === 'string' && url.includes(SUPABASE_URL)) {
    const proxied = url.replace(SUPABASE_URL, CLOUDFLARE_PROXY_URL);
    console.log('🔀 PROXY URL:', proxied);
    console.log('🔑 PROXY ENV:', CLOUDFLARE_PROXY_URL);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

  const originalSignal = options.signal;
  if (originalSignal) {
    originalSignal.addEventListener('abort', () => {
      controller.abort();
      clearTimeout(timeout);
    });
  }

  // Replace Supabase URL with Cloudflare proxy URL
  let primaryUrl: RequestInfo | URL = url;
  if (typeof url === 'string' && CLOUDFLARE_PROXY_URL && url.includes(SUPABASE_URL)) {
    primaryUrl = url.replace(SUPABASE_URL, CLOUDFLARE_PROXY_URL);
  }

  try {
    // First attempt via Cloudflare proxy (works for JIO + everyone)
    const response = await fetch(primaryUrl, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (proxyError: any) {
    console.warn('Cloudflare proxy failed, trying direct Supabase...', proxyError?.message);

    // Fallback: try direct Supabase URL (works for Airtel/WiFi if proxy fails)
    if (primaryUrl !== url) {
      try {
        const fallback = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return fallback;
      } catch (fallbackError: any) {
        clearTimeout(timeout);
        throw fallbackError;
      }
    }

    clearTimeout(timeout);
    throw proxyError;
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchWithProxy },
});

export function getNetworkErrorMessage(error: any): string | null {
  const msg = String(error?.message || '').toLowerCase();
  const isNetworkError =
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('aborted') ||
    error?.name === 'AbortError' ||
    error?.name === 'TypeError';
  if (isNetworkError) return 'Unable to connect. Please check your internet connection and try again.';
  return null;
}