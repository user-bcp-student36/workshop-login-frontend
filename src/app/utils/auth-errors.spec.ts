import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { SessionStorageError } from '../services/session.service';
import { publicErrorMessage } from './auth-errors';

describe('H-02: public errors without backend detail', () => {
  it.each([401, 403])('maps login rejection %s to a public credential message', (status) => {
    expect(publicErrorMessage({ response: { status, data: { message: '<em>internal detail</em>' } } }, 'login'))
      .toBe('Usuario o contraseña incorrectos.');
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])('maps transport failure %s without leaking details', (code) => {
    expect(publicErrorMessage({ code, message: 'internal detail' }, 'login'))
      .toBe('No se pudo conectar con el servicio. Vuelva a intentarlo.');
  });

  it('recognizes a request without a response as a connectivity failure', () => {
    expect(publicErrorMessage({ request: {}, message: 'internal detail' }, 'tasks'))
      .toBe('No se pudo conectar con el servicio. Vuelva a intentarlo.');
  });

  it('does not classify an HTTP failure as a connectivity failure', () => {
    expect(publicErrorMessage({ request: {}, response: { status: 500 } }, 'tasks'))
      .toBe('No se pudo cargar el dashboard. Vuelva a intentarlo.');
  });

  it.each([null, undefined, 'failure', [], {}, new Error('private detail')])('uses the login fallback for unknown errors', (error) => {
    expect(publicErrorMessage(error, 'login')).toBe('No se pudo autenticar. Vuelva a intentarlo.');
  });

  it('uses a tasks fallback for authorization errors without logging out', () => {
    expect(publicErrorMessage({ response: { status: 401, data: { detail: 'private detail' } } }, 'tasks'))
      .toBe('No se pudo cargar el dashboard. Vuelva a intentarlo.');
  });

  it('has a controlled message for unavailable session storage', () => {
    expect(publicErrorMessage(new SessionStorageError(), 'login'))
      .toBe('No se pudo guardar la sesión. Vuelva a intentarlo.');
  });
});