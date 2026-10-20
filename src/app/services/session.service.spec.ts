import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';

const persistent = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
const tab = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
const preferences = { theme: 'light', showTips: true, compact: false };

beforeEach(() => {
  vi.resetAllMocks();
  persistent.getItem.mockReturnValue(null);
  tab.getItem.mockReturnValue(null);
  vi.stubGlobal('localStorage', persistent);
  vi.stubGlobal('sessionStorage', tab);
});

describe('H-01: tab-scoped session', () => {
  it('removes old persistent session keys without migrating a token', () => {
    new SessionService();
    expect(persistent.removeItem).toHaveBeenCalledWith('workshop_token');
    expect(persistent.removeItem).toHaveBeenCalledWith('workshop_user');
    expect(persistent.removeItem).not.toHaveBeenCalledWith('workshop_preferences');
    expect(tab.setItem).not.toHaveBeenCalled();
  });

  it('stores session in the tab and only preferences persistently', () => {
    new SessionService().save('test-token', { username: 'student' }, preferences);
    expect(tab.setItem).toHaveBeenCalledWith('workshop_token', 'test-token');
    expect(tab.setItem).toHaveBeenCalledWith('workshop_user', '{"username":"student"}');
    expect(persistent.setItem).toHaveBeenCalledExactlyOnceWith('workshop_preferences', JSON.stringify(preferences));
  });

  it('reads the token and user from the same tab after service recreation', () => {
    tab.getItem.mockImplementation((key: string) => key === 'workshop_token' ? 'test-token' : '{"username":"student"}');
    const session = new SessionService();
    expect(session.readToken()).toBe('test-token');
    expect(session.readUser()).toEqual({ username: 'student' });
    expect(new SessionService().readToken()).toBe('test-token');
  });

  it('has no session in a tab with empty storage', () => {
    const session = new SessionService();
    expect(session.readToken()).toBeNull();
    expect(session.readUser()).toEqual({});
  });

  it.each(['{invalid', 'null', '[]'])('does not crash on malformed stored user %s', (value) => {
    tab.getItem.mockReturnValue(value);
    expect(new SessionService().readUser()).toEqual({});
  });

  it('clears both session locations while preserving preferences', () => {
    const session = new SessionService();
    vi.clearAllMocks();
    session.clear();
    for (const storage of [persistent, tab]) {
      expect(storage.removeItem).toHaveBeenCalledWith('workshop_token');
      expect(storage.removeItem).toHaveBeenCalledWith('workshop_user');
      expect(storage.removeItem).not.toHaveBeenCalledWith('workshop_preferences');
    }
  });

  it('rolls back partial session writes when storage fails', () => {
    tab.setItem.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error('quota'); });
    const session = new SessionService();
    expect(() => session.save('test-token', { username: 'student' }, preferences)).toThrow('No se pudo guardar la sesión');
    expect(tab.removeItem).toHaveBeenCalledWith('workshop_token');
    expect(tab.removeItem).toHaveBeenCalledWith('workshop_user');
  });

  it('handles unavailable storage without throwing from construction or reads', () => {
    persistent.removeItem.mockImplementation(() => { throw new Error('blocked'); });
    tab.getItem.mockImplementation(() => { throw new Error('blocked'); });
    tab.removeItem.mockImplementation(() => { throw new Error('blocked'); });
    const session = new SessionService();
    expect(session.readToken()).toBeNull();
    expect(session.readUser()).toEqual({});
    expect(() => session.clear()).not.toThrow();
    expect(() => session.save('test-token', {}, preferences)).toThrow('No se pudo guardar la sesión');
  });

  it('keeps defaults and deep merge behavior for saved preferences', () => {
    persistent.getItem.mockReturnValue('{"theme":"dark","layout":{"nested":{"visible":true}}}');
    expect(new SessionService().loadPreferences()).toEqual({ ...preferences, theme: 'dark', layout: { nested: { visible: true } } });
  });
});