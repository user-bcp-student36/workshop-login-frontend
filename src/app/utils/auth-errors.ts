import { isRecord } from '../models/auth.models';
import { SessionStorageError } from '../services/session.service';

export const LOGIN_MESSAGES = {
  usernameRequired: 'Ingrese un usuario.',
  passwordRequired: 'Ingrese una contraseña.',
  tokenMissing: 'El backend respondió sin token.'
};

const CREDENTIAL_REJECTIONS = new Set([401, 403]);
const CONNECTION_FAILURES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK']);

export function publicErrorMessage(error: unknown, context: 'login' | 'tasks'): string {
  if (error instanceof SessionStorageError) return error.message;
  const failure = isRecord(error) ? error : {};
  const response = isRecord(failure['response']) ? failure['response'] : undefined;
  if (context === 'login' && CREDENTIAL_REJECTIONS.has(response?.['status'] as number)) {
    return 'Usuario o contraseña incorrectos.';
  }
  if (CONNECTION_FAILURES.has(failure['code'] as string) || (failure['request'] && !response)) {
    return 'No se pudo conectar con el servicio. Vuelva a intentarlo.';
  }
  return context === 'login'
    ? 'No se pudo autenticar. Vuelva a intentarlo.'
    : 'No se pudo cargar el dashboard. Vuelva a intentarlo.';
}