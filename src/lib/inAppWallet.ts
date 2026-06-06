// src/lib/inAppWallet.ts
// Ed25519 keypair generation + platform-aware persistence
// Storage: @capacitor/preferences on APK, localStorage on web
//
// MNEMONIC FLOW (correct):
//   1. Generate random BIP39 mnemonic via @scure/bip39 + english wordlist
//   2. Derive Ed25519 keypair from that mnemonic via Ed25519Keypair.deriveKeypair()
//   3. Save the bech32 private key (suiprivkey...) to storage for session restore
//   4. Show the mnemonic to the user as the human-readable backup phrase
//
// Recovery: user can import via bech32 private key OR (future) via mnemonic.

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateMnemonic, mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'sentinel_wallet_pk';

// ── Wallet generation ──────────────────────────────────────────────────────

/**
 * Generate a new Ed25519 wallet using the standard Sui derivation path.
 *
 * Flow:
 *   1. Generate a cryptographically random 12-word BIP39 mnemonic (128-bit entropy)
 *   2. Derive the Ed25519 keypair via SLIP-0010 at m/44'/784'/0'/0'/0'
 *   3. Export the bech32 private key for storage/session restore
 *   4. Return both so the UI can show the mnemonic as the human-readable backup
 *
 * Returns:
 *   address    — 0x... Sui address
 *   privateKey — bech32 suiprivkey... (used for storage and import)
 *   mnemonic   — 12 English words (the real BIP39 backup phrase)
 */
export async function generateWallet(): Promise<{
  address: string;
  privateKey: string;
  mnemonic: string;
}> {
  // Step 1 — real BIP39 mnemonic (128-bit entropy → 12 words)
  const mnemonic = generateMnemonic(wordlist, 128);

  // Step 2 — derive keypair at the default Sui path m/44'/784'/0'/0'/0'
  const keypair = Ed25519Keypair.deriveKeypair(mnemonic);

  // Step 3 — bech32 secret key for storage/restore
  const privateKey = keypair.getSecretKey();

  // Step 4 — Sui address
  const address = keypair.getPublicKey().toSuiAddress();

  return { address, privateKey, mnemonic };
}

/**
 * Import a wallet from a bech32 private key string (suiprivkey... format).
 * This is the format produced by getSecretKey() and stored in preferences.
 */
export function importWallet(privateKey: string): {
  address: string;
  privateKey: string;
} {
  // Ed25519Keypair.fromSecretKey accepts Uint8Array or bech32 string
  const keypair = Ed25519Keypair.fromSecretKey(privateKey);
  const address = keypair.getPublicKey().toSuiAddress();
  return { address, privateKey };
}

/**
 * Validate that a given string is a parseable private key.
 * Returns true if importable, false otherwise.
 */
export function isValidPrivateKey(key: string): boolean {
  try {
    Ed25519Keypair.fromSecretKey(key.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a BIP39 mnemonic phrase.
 * Returns true if all words are in the english wordlist and checksum passes.
 */
export function isValidMnemonic(phrase: string): boolean {
  try {
    // mnemonicToEntropy throws if phrase is invalid
    mnemonicToEntropy(phrase.trim(), wordlist);
    return true;
  } catch {
    return false;
  }
}

// ── Platform-aware storage ─────────────────────────────────────────────────

/**
 * Save bech32 private key to platform-appropriate storage.
 * APK  → @capacitor/preferences (persists across app restarts)
 * Web  → localStorage
 */
export async function saveWallet(privateKey: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: STORAGE_KEY, value: privateKey });
  } else {
    localStorage.setItem(STORAGE_KEY, privateKey);
  }
}

/**
 * Load wallet from platform-appropriate storage.
 * Returns { address, privateKey } or null if not found / key is corrupted.
 */
export async function loadWallet(): Promise<{
  address: string;
  privateKey: string;
} | null> {
  let privateKey: string | null = null;

  if (Capacitor.isNativePlatform()) {
    const { Preferences } = await import('@capacitor/preferences');
    const result = await Preferences.get({ key: STORAGE_KEY });
    privateKey = result.value;
  } else {
    privateKey = localStorage.getItem(STORAGE_KEY);
  }

  if (!privateKey) return null;

  try {
    return importWallet(privateKey);
  } catch {
    // Corrupted or migrated key — clear it so we re-onboard cleanly
    await clearWallet();
    return null;
  }
}

/**
 * Remove wallet from storage (logout / device reset flow).
 */
export async function clearWallet(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key: STORAGE_KEY });
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
