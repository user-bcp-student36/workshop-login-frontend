# Flujo y endpoints observados

Contrato reconstruido exclusivamente desde el frontend, porque este documento no existía. Describe lo que el cliente envía y consume, no garantiza el comportamiento de los servidores. No se consultaron otros repositorios ni se ejecutaron peticiones. El seguimiento de hallazgos vive únicamente en [HALLAZGOS.md](../HALLAZGOS.md).

## Ejecución local

Según [README.md](../README.md), se requiere Node.js >= 22.12.0; ejecutar `npm install` y `npm start` desde este repositorio y abrir `http://localhost:4200`. Los servicios esperados son autenticación en `http://localhost:8080` y tareas en `http://localhost:8000`.

## Componentes y dependencias

| Elemento | Responsabilidad y dependencias observadas | Evidencia |
|---|---|---|
| Arranque | `bootstrapApplication` crea `AppComponent` e instala las rutas mediante `provideRouter`. | [src/main.ts:6](../src/main.ts#L6) |
| `AppComponent` | Contiene un `RouterOutlet`, sin lógica de autenticación. | [src/app/app.component.ts:8](../src/app/app.component.ts#L8) |
| Rutas | Carga diferida de login y dashboard; ruta vacía y desconocidas redirigen a login. No hay guards declarados en estas rutas. | [src/app/app.routes.ts:3](../src/app/app.routes.ts#L3) |
| `LoginComponent` | Usa `CommonModule`, `FormsModule`, `Router`, `axios` y `lodash/merge`; carga preferencias, valida credenciales, llama al backend y persiste la sesión. | [src/app/login/login.component.ts:1](../src/app/login/login.component.ts#L1); [src/app/login/login.component.ts:22](../src/app/login/login.component.ts#L22); [src/app/login/login.component.ts:31](../src/app/login/login.component.ts#L31) |
| `DashboardComponent` | Usa `CommonModule`, `Router`, `axios`, `NgZone`, `ChangeDetectorRef` y `formatTaskLabel`; lee sesión, consulta tareas, prepara su presentación y cierra sesión. | [src/app/dashboard/dashboard.component.ts:1](../src/app/dashboard/dashboard.component.ts#L1); [src/app/dashboard/dashboard.component.ts:29](../src/app/dashboard/dashboard.component.ts#L29); [src/app/dashboard/dashboard.component.ts:35](../src/app/dashboard/dashboard.component.ts#L35); [src/app/dashboard/dashboard.component.ts:74](../src/app/dashboard/dashboard.component.ts#L74) |
| `formatTaskLabel` | Construye una etiqueta con prioridad y propietario en mayúsculas. Devuelve `SIN-DATOS` para tarea ausente, y usa `NORMAL` / `SIN-ASIGNAR` cuando faltan los campos. | [src/app/utils/legacy-format.ts:1](../src/app/utils/legacy-format.ts#L1) |
| Dependencias declaradas | Angular 21.2.19, axios 0.31.0, lodash 4.17.21, rxjs 7.8.2, tslib 2.8.1 y zone.js 0.15.1. Son versiones del manifiesto, no una verificación de versiones instaladas ni de CVEs. Vitest 3.2.4 y coverage-v8 3.2.4 son dependencias de desarrollo. | [package.json:12](../package.json#L12); [package.json:25](../package.json#L25) |
| Pruebas | Vitest, entorno Node, descubre `src/**/*.spec.ts`; el único archivo encontrado prueba el formato nominal de la etiqueta. | [vitest.config.ts:5](../vitest.config.ts#L5); [src/app/utils/legacy-format.spec.ts:4](../src/app/utils/legacy-format.spec.ts#L4) |

## Endpoints

### POST /auth/login

- URL actual: `http://localhost:8080/auth/login`.
- Cuerpo JSON: `{ username, password, client: 'angular-workshop' }`. Los valores originales se envían sin recortarlos; `trim()` solo se usa para comprobar que no estén vacíos.
- Timeout explícito: 5000 ms. Esta llamada no configura un encabezado `Authorization`.
- Respuesta consumida: `response.data.token` y `response.data.user`. Un token verdadero según JavaScript habilita la persistencia y navegación; el cliente no valida su formato ni los campos del usuario antes de guardarlos.
- Si no hay token, se muestra el mensaje de respuesta sin token. En el `catch`, el mensaje se toma de `error.response.data.message`, luego de `error.message`, o de un texto de respaldo, y se combina con el usuario como HTML.
- Evidencia: [src/app/login/login.component.ts:33](../src/app/login/login.component.ts#L33), [src/app/login/login.component.ts:41](../src/app/login/login.component.ts#L41), [src/app/login/login.component.ts:46](../src/app/login/login.component.ts#L46), [src/app/login/login.component.ts:52](../src/app/login/login.component.ts#L52), [src/app/login/login.component.ts:55](../src/app/login/login.component.ts#L55), [src/app/login/login.component.html:39](../src/app/login/login.component.html#L39).

### GET /api/tasks

- URL actual: `http://localhost:8000/api/tasks?owner=` concatenada con `user.username`, o cadena vacía si ese campo es falso según JavaScript. La concatenación no codifica el valor del parámetro.
- Encabezado: `Authorization: Bearer <token>` leído desde `localStorage`.
- Esta llamada no especifica un timeout propio.
- Respuesta consumida: `response.data`, que se trata como un arreglo de tareas. Cada tarea se usa con `status`, `priority`, `owner`, `title` y `description`; no se valida el esquema en ejecución.
- Se excluye de la lista visible únicamente el estado exacto `ARCHIVED`. Cada tarea visible recibe `label = formatTaskLabel(task)` y se ordena con `a.priority > b.priority ? -1 : 1`; no se observa una escala semántica de prioridades.
- `statusLabel()` traduce TODO, IN_PROGRESS, DONE, RESUELTO y COMPLETED, normalizando a mayúsculas para la etiqueta de estado.
- Ante errores se muestra `error.response.data.detail`, luego `error.message`, o un texto de respaldo. No hay tratamiento especial de 401/403 ni limpieza automática de sesión en este `catch`.
- Evidencia: [src/app/dashboard/dashboard.component.ts:7](../src/app/dashboard/dashboard.component.ts#L7), [src/app/dashboard/dashboard.component.ts:31](../src/app/dashboard/dashboard.component.ts#L31), [src/app/dashboard/dashboard.component.ts:43](../src/app/dashboard/dashboard.component.ts#L43), [src/app/dashboard/dashboard.component.ts:49](../src/app/dashboard/dashboard.component.ts#L49), [src/app/dashboard/dashboard.component.ts:54](../src/app/dashboard/dashboard.component.ts#L54), [src/app/dashboard/dashboard.component.ts:65](../src/app/dashboard/dashboard.component.ts#L65), [src/app/dashboard/dashboard.component.html:21](../src/app/dashboard/dashboard.component.html#L21).

## Flujo de autenticación a preservar

1. Abrir `/login`. El constructor intenta leer y parsear `workshop_preferences`, y mezcla sus datos con las preferencias iniciales mediante `merge`. Si falla, registra el error y continúa. Evidencia: [src/app/login/login.component.ts:22](../src/app/login/login.component.ts#L22).
2. Pulsar Ingresar. Se limpian los mensajes, se comprueba usuario y contraseña no vacíos, se activa `busy` y se ejecuta `POST /auth/login`. `finally` restaura `busy` al terminar el intento HTTP. Evidencia: [src/app/login/login.component.html:34](../src/app/login/login.component.html#L34), [src/app/login/login.component.ts:31](../src/app/login/login.component.ts#L31), [src/app/login/login.component.ts:58](../src/app/login/login.component.ts#L58).
3. Con token, guardar `workshop_token` como valor del token, `workshop_user` como JSON del usuario y `workshop_preferences` como JSON de preferencias; navegar a `/dashboard`. Evidencia: [src/app/login/login.component.ts:46](../src/app/login/login.component.ts#L46).
4. Al iniciar el dashboard, leer token y parsear usuario. Sin token, navegar a `/login` y no consultar tareas. El parseo del usuario ocurre antes de esa comprobación y fuera del `try` de la petición. Evidencia: [src/app/dashboard/dashboard.component.ts:35](../src/app/dashboard/dashboard.component.ts#L35).
5. Con token, consultar `GET /api/tasks` con propietario y Bearer; preparar las tareas visibles y terminar el estado de carga dentro de `zone.run` con `detectChanges()`. Mostrar saludo, tareas, estado vacío o error según el resultado. Evidencia: [src/app/dashboard/dashboard.component.ts:43](../src/app/dashboard/dashboard.component.ts#L43), [src/app/dashboard/dashboard.component.ts:59](../src/app/dashboard/dashboard.component.ts#L59), [src/app/dashboard/dashboard.component.ts:66](../src/app/dashboard/dashboard.component.ts#L66), [src/app/dashboard/dashboard.component.html:6](../src/app/dashboard/dashboard.component.html#L6), [src/app/dashboard/dashboard.component.html:13](../src/app/dashboard/dashboard.component.html#L13).
6. Pulsar Cerrar sesión. Eliminar `workshop_token` y `workshop_user`, conservar `workshop_preferences` y navegar a `/login`. No se llama a un endpoint de logout ni se solicita revocación del token. Evidencia: [src/app/dashboard/dashboard.component.html:9](../src/app/dashboard/dashboard.component.html#L9), [src/app/dashboard/dashboard.component.ts:74](../src/app/dashboard/dashboard.component.ts#L74).

## Límites del contrato

No se verificaron esquemas del servidor, códigos de respuesta, expiración o revocación de tokens, CORS ni autorización efectiva del parámetro `owner`. La presencia local de un token solo controla si el cliente intenta consultar tareas; no demuestra que el servidor acepte ese token. Cualquier refactor debe preservar ambos endpoints y el flujo anterior, con cambios de comportamiento explícitos y respaldados por pruebas.