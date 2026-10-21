import 'react-native-url-polyfill/auto';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { createSecureStorage } from './secure-storage';

let client: SupabaseClient | null | undefined;

export function getAuthClient() {
  if (client !== undefined) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return (client = null);
  client = createClient(url, key, {
    auth: {
      storage: createSecureStorage({
        getItemAsync: name => SecureStore.getItemAsync(name),
        setItemAsync: (name, value) => SecureStore.setItemAsync(name, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
        deleteItemAsync: name => SecureStore.deleteItemAsync(name),
      }, randomUUID),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
    },
  });
  return client;
}

// A cold link and a navigation rerender can deliver the same one-use code twice.
let lastCode: string | undefined;
let lastExchange: Promise<void> | undefined;
export function exchangeAuthCode(code: string) {
  if (code === lastCode && lastExchange) return lastExchange;
  lastCode = code;
  lastExchange = (async () => {
    const auth = getAuthClient();
    if (!auth) throw new Error('Sign-in is not configured in this build.');
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (error) throw new Error('Sign-in could not complete. Request a new link and open it on this phone.');
  })();
  return lastExchange;
}
