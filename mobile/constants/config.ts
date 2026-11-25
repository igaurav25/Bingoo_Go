/**
 * mobile/constants/config.ts
 *
 * Networking configuration for Mobile React Native application.
 * Supports emulator defaults AND configurable LAN IP for physical devices.
 */

import { Platform } from 'react-native';

export const DEFAULT_SERVER_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000'
});

export const DEFAULT_WS_URL = Platform.select({
  android: 'ws://10.0.2.2:3000',
  default: 'ws://localhost:3000'
});

export function normalizeServerUrl(input: string): string {
  let clean = (input || '').trim().replace(/\/+$/, '');
  if (!clean) return DEFAULT_SERVER_URL;
  if (!/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }
  return clean;
}

export function deriveWsUrl(httpUrl: string): string {
  const clean = normalizeServerUrl(httpUrl);
  if (clean.startsWith('https://')) {
    return `wss://${clean.slice('https://'.length)}`;
  }
  return `ws://${clean.slice('http://'.length)}`;
}

export const APP_CONFIG = {
  appName: 'Bingo Championship',
  version: '1.0.0',
  apiBaseUrl: DEFAULT_SERVER_URL,
  wsBaseUrl: DEFAULT_WS_URL,
  defaultTurnTimeoutSeconds: 30,
  defaultCoins: 500,
  defaultDiamonds: 10
};
