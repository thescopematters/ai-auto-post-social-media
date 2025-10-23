/**
 * DEPRECATED: This file is being phased out.
 * All database operations should now go through the API client.
 * Import { apiClient, authApi, workspaceApi, documentApi, contentApi, dashboardApi } from './apiClient' instead.
 */

console.warn('[DEPRECATED] Direct Supabase client usage is deprecated. Use API client instead.');

// Stub export to prevent immediate import errors during migration
export const supabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signUp: () => {
      throw new Error('Use authApi.register() from apiClient instead');
    },
    signInWithPassword: () => {
      throw new Error('Use authApi.login() from apiClient instead');
    },
    signOut: () => {
      throw new Error('Use authApi.logout() from apiClient instead');
    },
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  },
  from: () => {
    throw new Error('Direct database access is not allowed. Use API client instead.');
  },
  rpc: () => {
    throw new Error('Direct RPC calls are not allowed. Use API client instead.');
  },
};
