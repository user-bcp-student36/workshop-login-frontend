import { Injectable } from '@angular/core';
import merge from 'lodash/merge';
import { isRecord, Preferences, User } from '../models/auth.models';

const STORAGE_KEYS = {
  token: 'workshop_token',
  user: 'workshop_user',
  preferences: 'workshop_preferences'
};

export class SessionStorageError extends Error {
  constructor() {
    super('No se pudo guardar la sesión. Vuelva a intentarlo.');
    this.name = 'SessionStorageError';
  }
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private legacyCleared: boolean;

  constructor() {
    this.legacyCleared = this.removeSession('local');
  }

  readToken(): string | null {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.token);
    } catch {
      return null;
    }
  }

  readUser(): User {
    try {
      const user: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.user) || '{}');
      return isRecord(user) ? user as User : {};
    } catch {
      return {};
    }
  }

  loadPreferences(): Preferences {
    const defaults: Preferences = { theme: 'light', showTips: true, compact: false };
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) || '{}');
      return merge(defaults, saved);
    } catch {
      return defaults;
    }
  }

  save(token: unknown, user: User | undefined, preferences: Preferences): void {
    try {
      if (!this.legacyCleared) throw new SessionStorageError();
      sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user || {}));
      localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));
      sessionStorage.setItem(STORAGE_KEYS.token, String(token));
    } catch {
      this.removeSession('session');
      throw new SessionStorageError();
    }
  }

  clear(): void {
    this.removeSession('session');
    this.legacyCleared = this.removeSession('local');
  }

  private removeSession(location: 'local' | 'session'): boolean {
    let cleared = true;
    for (const key of [STORAGE_KEYS.token, STORAGE_KEYS.user]) {
      try {
        const storage = location === 'local' ? localStorage : sessionStorage;
        storage.removeItem(key);
      } catch {
        cleared = false;
      }
    }
    return cleared;
  }
}