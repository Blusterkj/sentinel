// src/lib/authStore.ts
// Zustand store for in-app wallet authentication state.
// Tracks whether the user authenticated via dapp-kit or the in-app Ed25519 wallet.

import { create } from 'zustand';

interface AuthState {
  /** Sui address of the in-app wallet (null if not authenticated via in-app wallet) */
  address: string | null;
  /** The private key — kept in memory only during session, loaded from storage on mount */
  privateKey: string | null;
  /** Authentication source */
  source: 'dapp-kit' | 'in-app' | null;
  /** Called after wallet is generated or loaded from storage */
  setInAppAuth: (address: string, privateKey: string) => void;
  /** Clear in-app auth (logout) */
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  address: null,
  privateKey: null,
  source: null,

  setInAppAuth: (address: string, privateKey: string) =>
    set({ address, privateKey, source: 'in-app' }),

  clearAuth: () =>
    set({ address: null, privateKey: null, source: null }),
}));
