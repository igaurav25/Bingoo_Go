/**
 * mobile/services/storageService.ts
 *
 * Local persistence wrapper for Mobile auth tokens, server LAN URL, settings, and profile.
 */

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'bingo_mobile_auth_token',
  AUTH_USER: 'bingo_mobile_auth_user',
  SERVER_URL: 'bingo_mobile_server_url'
};

class StorageService {
  private memoryStore: Map<string, string> = new Map();

  public async setItem(key: string, value: string): Promise<void> {
    this.memoryStore.set(key, value);
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        (globalThis as any).localStorage.setItem(key, value);
      }
    } catch {}
  }

  public async getItem(key: string): Promise<string | null> {
    if (this.memoryStore.has(key)) {
      return this.memoryStore.get(key) || null;
    }
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        return (globalThis as any).localStorage.getItem(key);
      }
    } catch {}
    return null;
  }

  public async removeItem(key: string): Promise<void> {
    this.memoryStore.delete(key);
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        (globalThis as any).localStorage.removeItem(key);
      }
    } catch {}
  }

  public async setObject<T>(key: string, object: T): Promise<void> {
    await this.setItem(key, JSON.stringify(object));
  }

  public async getObject<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
}

export const storageService = new StorageService();
export default storageService;
