import '@angular/compiler';
import { ASTWithSource, parseTemplate, TmplAstBoundText, TmplAstElement, TmplAstTemplate, TmplAstNode } from '@angular/compiler';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { readFileSync } from 'node:fs';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AuthService } from './services/auth.service';
import { SessionService } from './services/session.service';
import { TasksService } from './services/tasks.service';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); }
  };
}

const navigate = vi.fn().mockResolvedValue(true);
const detectChanges = vi.fn();
const router = { navigate } as unknown as Router;
const changeDetector = { detectChanges } as unknown as ChangeDetectorRef;
const zone = { run: (operation: () => void) => operation() } as unknown as NgZone;

function loginComponent(): LoginComponent {
  return new LoginComponent(router, new AuthService(), new SessionService(), changeDetector, zone);
}

function dashboardComponent(): DashboardComponent {
  return new DashboardComponent(router, changeDetector, zone, new SessionService(), new TasksService());
}

function storeSession(username = 'student'): void {
  sessionStorage.setItem('workshop_token', 'test-token');
  sessionStorage.setItem('workshop_user', JSON.stringify({ username, displayName: 'Student' }));
}

function templateElements(nodes: TmplAstNode[]): TmplAstElement[] {
  return nodes.flatMap((node) => {
    if (node instanceof TmplAstElement) return [node, ...templateElements(node.children)];
    if (node instanceof TmplAstTemplate) return templateElements(node.children);
    return [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(axios.post).mockResolvedValue({ data: { token: 'test-token', user: { username: 'student' } } });
  vi.mocked(axios.get).mockResolvedValue({ data: [] });
});

describe('H-01: session and authentication contract', () => {
  it.each([null, undefined, '', '   '])('does not post with empty username %s', async (username) => {
    const login = loginComponent();
    login.username = username;
    login.password = 'fixture-password';
    await login.login();
    expect(axios.post).not.toHaveBeenCalled();
    expect(login.message).toContain('Ingrese un usuario.');
    expect(login.busy).toBe(false);
  });

  it.each([null, undefined, '', '   '])('does not post with empty password %s', async (password) => {
    const login = loginComponent();
    login.username = 'student';
    login.password = password;
    await login.login();
    expect(axios.post).not.toHaveBeenCalled();
    expect(login.message).toContain('Ingrese una contraseña.');
  });

  it('posts original credentials and saves session before navigation', async () => {
    const login = loginComponent();
    login.username = ' student ';
    login.password = ' fixture-password ';
    navigate.mockImplementationOnce(async () => {
      expect(sessionStorage.getItem('workshop_token')).toBe('test-token');
      expect(JSON.parse(sessionStorage.getItem('workshop_user') || '{}')).toEqual({ username: 'student' });
      return true;
    });
    await login.login();
    expect(axios.post).toHaveBeenCalledWith('http://localhost:8080/auth/login', {
      username: ' student ', password: ' fixture-password ', client: 'angular-workshop'
    }, { timeout: 5000 });
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(localStorage.getItem('workshop_preferences')).not.toBeNull();
    expect(login.busy).toBe(false);
  });

  it('does not navigate when the response has no token', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: {} });
    const login = loginComponent();
    login.username = 'student';
    login.password = 'fixture-password';
    await login.login();
    expect(login.message).toContain('El backend respondió sin token.');
    expect(navigate).not.toHaveBeenCalled();
    expect(login.busy).toBe(false);
  });

  it.each([null, [], 'unexpected'])('handles a login response without an object body %s', async (payload) => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: payload });
    const login = loginComponent();
    login.username = 'student';
    login.password = 'fixture-password';
    await login.login();
    expect(login.message).toBe('El backend respondió sin token.');
    expect(navigate).not.toHaveBeenCalled();
    expect(login.busy).toBe(false);
  });

  it('does not require new user fields or reject a truthy token value', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 123 } });
    const login = loginComponent();
    login.username = 'student';
    login.password = 'fixture-password';
    await login.login();
    expect(sessionStorage.getItem('workshop_token')).toBe('123');
    expect(sessionStorage.getItem('workshop_user')).toBe('{}');
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('redirects a dashboard without token without fetching tasks', async () => {
    await dashboardComponent().ngOnInit();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('reloads the session and sends the exact owner query and Bearer', async () => {
    storeSession('student&extra=1');
    await dashboardComponent().ngOnInit();
    await dashboardComponent().ngOnInit();
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(axios.get).toHaveBeenLastCalledWith('http://localhost:8000/api/tasks?owner=student&extra=1', {
      headers: { Authorization: 'Bearer test-token' }
    });
  });

  it('uses an empty owner when username is absent', async () => {
    sessionStorage.setItem('workshop_token', 'test-token');
    await dashboardComponent().ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=', {
      headers: { Authorization: 'Bearer test-token' }
    });
  });

  it('keeps exact archived filtering, labels and priority comparison', async () => {
    storeSession();
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [
      { title: 'normal', status: 'TODO', priority: 'A', owner: 'student' },
      { title: 'hidden', status: 'ARCHIVED', priority: 'Z' },
      { title: 'visible', status: 'archived', priority: 'Z' }
    ] });
    const dashboard = dashboardComponent();
    await dashboard.ngOnInit();
    expect(dashboard.tasks).toHaveLength(3);
    expect(dashboard.visibleTasks.map((task) => task.title)).toEqual(['visible', 'normal']);
    expect(dashboard.visibleTasks[1].label).toBe('A · STUDENT');
    expect(dashboard.loading).toBe(false);
    expect(detectChanges).toHaveBeenCalledOnce();
    expect(dashboard.statusLabel('in_progress')).toBe('En progreso');
    expect(dashboard.statusLabel('custom')).toBe('custom');
    expect(dashboard.statusLabel('')).toBe('');
  });

  it('logs out without a server request and retains preferences', async () => {
    storeSession();
    localStorage.setItem('workshop_preferences', '{"theme":"dark"}');
    await dashboardComponent().logout();
    expect(sessionStorage.getItem('workshop_token')).toBeNull();
    expect(sessionStorage.getItem('workshop_user')).toBeNull();
    expect(localStorage.getItem('workshop_token')).toBeNull();
    expect(localStorage.getItem('workshop_user')).toBeNull();
    expect(localStorage.getItem('workshop_preferences')).toBe('{"theme":"dark"}');
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('keeps the original comparator when priorities are decreasing or equal', async () => {
    storeSession();
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [
      { title: 'first', priority: 'Z' },
      { title: 'second', priority: 'A' },
      { title: 'equal', priority: 'A' }
    ] });
    const dashboard = dashboardComponent();
    await dashboard.ngOnInit();
    expect(dashboard.visibleTasks.map((task) => task.title)).toEqual(['first', 'second', 'equal']);
  });

  it.each([{}, [null], null])('handles a non-task response without leaving loading active', async (payload) => {
    storeSession();
    vi.mocked(axios.get).mockResolvedValueOnce({ data: payload });
    const dashboard = dashboardComponent();
    await dashboard.ngOnInit();
    expect(dashboard.error).toBe('No se pudo cargar el dashboard. Vuelva a intentarlo.');
    expect(dashboard.loading).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('workshop_token')).toBe('test-token');
  });

  it('does not navigate when session storage refuses a write', async () => {
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const login = loginComponent();
    login.username = 'student';
    login.password = 'fixture-password';
    await login.login();
    expect(login.message).toContain('No se pudo guardar la sesión');
    expect(login.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('workshop_token')).toBeNull();
  });
});

describe('H-02: public errors and text interpolation', () => {
  it.each([
    [{ response: { data: { message: '<em>backend detail</em>' } }, message: 'transport detail' }, 'No se pudo autenticar. Vuelva a intentarlo.'],
    [{ message: 'transport detail' }, 'No se pudo autenticar. Vuelva a intentarlo.'],
    [{}, 'No se pudo autenticar. Vuelva a intentarlo.']
  ])('restores busy without exposing external error details', async (error, expected) => {
    vi.mocked(axios.post).mockRejectedValueOnce(error);
    const login = loginComponent();
    login.username = 'student';
    login.password = 'fixture-password';
    await login.login();
    expect(login.message).toBe(expected);
    expect(login.message).not.toContain('detail');
    expect(login.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    [{ response: { data: { detail: 'task detail' } } }, 'No se pudo cargar el dashboard. Vuelva a intentarlo.'],
    [{ message: 'transport detail' }, 'No se pudo cargar el dashboard. Vuelva a intentarlo.'],
    [{}, 'No se pudo cargar el dashboard. Vuelva a intentarlo.']
  ])('finishes dashboard loading without automatic logout', async (error, expected) => {
    storeSession();
    vi.mocked(axios.get).mockRejectedValueOnce(error);
    const dashboard = dashboardComponent();
    await dashboard.ngOnInit();
    expect(dashboard.error).toBe(expected);
    expect(dashboard.loading).toBe(false);
    expect(detectChanges).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('workshop_token')).toBe('test-token');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('interpolates dynamic messages without an innerHTML binding', () => {
    const source = readFileSync(new URL('./login/login.component.html', import.meta.url), 'utf8');
    const template = parseTemplate(source, 'login.component.html');
    expect(template.errors).toBeNull();
    const elements = templateElements(template.nodes);
    expect(elements.some((element) => element.inputs.some((input) => input.name === 'innerHTML'))).toBe(false);
    expect(elements.some((element) => element.children.some((child) => child instanceof TmplAstBoundText && child.value instanceof ASTWithSource && child.value.source.includes('message')))).toBe(true);
  });
});

describe('H-03: preferences before dependency changes', () => {
  it('uses defaults when preferences are absent', () => {
    expect(loginComponent().preferences).toEqual({ theme: 'light', showTips: true, compact: false });
  });

  it('keeps defaults after invalid JSON', () => {
    localStorage.setItem('workshop_preferences', '{broken');
    expect(loginComponent().preferences).toEqual({ theme: 'light', showTips: true, compact: false });
  });

  it('overwrites supplied fields and retains nested objects', () => {
    localStorage.setItem('workshop_preferences', JSON.stringify({ theme: 'dark', layout: { nested: { visible: true } } }));
    expect(loginComponent().preferences).toEqual({ theme: 'dark', showTips: true, compact: false, layout: { nested: { visible: true } } });
  });
});