# Pruebas del flujo de login y consulta de tareas

Describe las pruebas del flujo `POST /auth/login` y `GET /api/tasks` según [ENDPOINTS.md](ENDPOINTS.md). Se ejecutan con `npm test` (Vitest, axios simulado); la cobertura con `npm run test:coverage`.

## Casos

| Flujo | Caso | Tipo | Resultado esperado |
|---|---|---|---|
| Login + tareas | Credenciales válidas, la lista carga | Camino feliz | Navega a `/dashboard`; consulta `?owner=student` con Bearer; excluye `ARCHIVED` y ordena por prioridad |
| Tareas | Backend devuelve lista vacía | Borde | Lista vacía, sin error, `loading = false` |
| Login | Usuario y contraseña vacíos | Borde | No hay petición; "Ingrese un usuario." |
| Login | Contraseña en blanco | Borde | No hay petición; "Ingrese una contraseña." |
| Login | Respuesta sin token | Borde | "El backend respondió sin token."; sin sesión ni navegación |
| Etiqueta | Tarea ausente o sin prioridad/propietario | Borde | `SIN-DATOS` / `NORMAL · SIN-ASIGNAR` |
| Login | Rechazo 401 o 403 | Error | "Usuario o contraseña incorrectos."; sin sesión; `busy = false` |
| Login | Backend caído (`ERR_NETWORK`) | Error | Mensaje de conexión; `busy = false` |
| Login | Timeout (`ECONNABORTED`, límite 5000 ms) | Error | Mensaje de conexión; `busy = false` |
| Tareas | Token inválido (401) | Error | Mensaje genérico sin detalle del backend; la sesión se conserva (ENDPOINTS.md: sin tratamiento especial de 401/403) |
| Tareas | Backend caído o timeout | Error | Mensaje de conexión; sin tareas; `loading = false` |

Además, [auth-flow.spec.ts](../src/app/auth-flow.spec.ts), [session.service.spec.ts](../src/app/services/session.service.spec.ts), [auth-errors.spec.ts](../src/app/utils/auth-errors.spec.ts) y [legacy-format.spec.ts](../src/app/utils/legacy-format.spec.ts) cubren sesión, preferencias, mensajes públicos y logout.

## Resultado

74 pruebas en verde (5 archivos). Cobertura de los archivos del flujo (componentes, servicios, utilidades): 100 % de sentencias, ramas y líneas; global 90,34 % (el resto son `main.ts`, `app.component.ts` y `app.routes.ts`, sin lógica probada).

## Código

Archivo `src/app/login-tasks-flow.spec.ts`:
```ts
import '@angular/compiler';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { AuthService } from './services/auth.service';
import { SessionService } from './services/session.service';
import { TasksService } from './services/tasks.service';
import { formatTaskLabel } from './utils/legacy-format';

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
const router = { navigate } as unknown as Router;
const changeDetector = { detectChanges: vi.fn() } as unknown as ChangeDetectorRef;
const zone = { run: (operation: () => void) => operation() } as unknown as NgZone;

function loginComponent(username = 'student', password = 'fixture-password'): LoginComponent {
  const login = new LoginComponent(router, new AuthService(), new SessionService(), changeDetector, zone);
  login.username = username;
  login.password = password;
  return login;
}

function dashboardComponent(): DashboardComponent {
  return new DashboardComponent(router, changeDetector, zone, new SessionService(), new TasksService());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Camino feliz: login valido y carga de tareas', () => {
  it('logs in, lands on the dashboard and loads the tasks of that user', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { token: 'jwt-1', user: { username: 'student', displayName: 'Student' } } });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [
      { title: 'low', status: 'TODO', priority: 'A', owner: 'student' },
      { title: 'high', status: 'IN_PROGRESS', priority: 'Z', owner: 'student' },
      { title: 'old', status: 'ARCHIVED', priority: 'M', owner: 'student' }
    ] });

    const login = loginComponent();
    await login.login();
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(login.message).toBe('');
    expect(login.busy).toBe(false);

    const dashboard = dashboardComponent();
    await dashboard.ngOnInit();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer jwt-1' }
    });
    expect(dashboard.user.username).toBe('student');
    expect(dashboard.visibleTasks.map((task) => task.title)).toEqual(['high', 'low']);
    expect(dashboard.error).toBe('');
    expect(dashboard.loading).toBe(false);
  });
});

describe('Casos borde', () => {
  it('shows an empty list when the backend returns no tasks', async () => {
    sessionStorage.setItem('workshop_token', 'jwt-1');
    sessionStorage.setItem('workshop_user', JSON.stringify({ username: 'student' }));
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [] });
    const dashboard = dashboardComponent();
    await dashboard.ngOnInit();
    expect(dashboard.visibleTasks).toEqual([]);
    expect(dashboard.error).toBe('');
    expect(dashboard.loading).toBe(false);
  });

  it('does not call the backend when username and password are both empty', async () => {
    const login = loginComponent('', '');
    await login.login();
    expect(axios.post).not.toHaveBeenCalled();
    expect(login.message).toBe('Ingrese un usuario.');
  });

  it('does not call the backend when only the password is blank', async () => {
    const login = loginComponent('student', '   ');
    await login.login();
    expect(axios.post).not.toHaveBeenCalled();
    expect(login.message).toBe('Ingrese una contraseña.');
  });

  it('does not store a session when the response has no token', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { user: { username: 'student' } } });
    const login = loginComponent();
    await login.login();
    expect(login.message).toBe('El backend respondió sin token.');
    expect(sessionStorage.getItem('workshop_token')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('formats a missing task and a task without priority or owner', () => {
    expect(formatTaskLabel(undefined)).toBe('SIN-DATOS');
    expect(formatTaskLabel({})).toBe('NORMAL · SIN-ASIGNAR');
  });
});

describe('Errores documentados', () => {
  it.each([401, 403])('shows a credential message when login is rejected with %s', async (status) => {
    vi.mocked(axios.post).mockRejectedValueOnce({ response: { status, data: { message: 'secret detail' } } });
    const login = loginComponent();
    await login.login();
    expect(login.message).toBe('Usuario o contraseña incorrectos.');
    expect(login.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('workshop_token')).toBeNull();
  });

  it('reports an unavailable auth backend on login', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce({ code: 'ERR_NETWORK', request: {}, message: 'Network Error' });
    const login = loginComponent();
    await login.login();
    expect(login.message).toBe('No se pudo conectar con el servicio. Vuelva a intentarlo.');
    expect(login.busy).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a login timeout and sends the 5000 ms limit', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce({ code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' });
    const login = loginComponent();
    await login.login();
    expect(axios.post).toHaveBeenCalledWith(expect.any(String), expect.any(Object), { timeout: 5000 });
    expect(login.message).toBe('No se pudo conectar con el servicio. Vuelva a intentarlo.');
    expect(login.busy).toBe(false);
  });

  it('keeps the session and shows a public error when tasks reject the token', async () => {
    sessionStorage.setItem('workshop_token', 'expired');
    sessionStorage.setItem('workshop_user', JSON.stringify({ username: 'student' }));
    vi.mocked(axios.get).mockRejectedValueOnce({ response: { status: 401, data: { detail: 'Invalid token' } } });
    const dashboard = dashboardComponent();
    await dashboard.ngOnInit();
    expect(dashboard.error).toBe('No se pudo cargar el dashboard. Vuelva a intentarlo.');
    expect(dashboard.error).not.toContain('Invalid token');
    expect(dashboard.loading).toBe(false);
    expect(sessionStorage.getItem('workshop_token')).toBe('expired');
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['backend down', { code: 'ERR_NETWORK', request: {}, message: 'Network Error' }],
    ['timeout', { code: 'ECONNABORTED', message: 'timeout' }]
  ])('reports a connectivity error when the tasks service fails: %s', async (_name, error) => {
    sessionStorage.setItem('workshop_token', 'jwt-1');
    sessionStorage.setItem('workshop_user', JSON.stringify({ username: 'student' }));
    vi.mocked(axios.get).mockRejectedValueOnce(error);
    const dashboard = dashboardComponent();
    await dashboard.ngOnInit();
    expect(dashboard.error).toBe('No se pudo conectar con el servicio. Vuelva a intentarlo.');
    expect(dashboard.visibleTasks).toEqual([]);
    expect(dashboard.loading).toBe(false);
  });
});
```

