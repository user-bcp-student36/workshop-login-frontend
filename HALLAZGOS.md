# Hallazgos — Frontend Angular (workshop-login-frontend)

> Todos los hallazgos están en estado `CANDIDATO` y requieren revisión humana antes de abrir issues o cambiar código.

### Token en localStorage y HTML sin escapar en el login
- Estado: CANDIDATO
- Evidencia: [login.component.ts](src/app/login/login.component.ts#L47) guarda el token en `localStorage` (`workshop_token`). [login.component.ts](src/app/login/login.component.ts#L56) concatena el username y el mensaje del backend en `message`. [login.component.html](src/app/login/login.component.html#L39) lo renderiza con `[innerHTML]`.
- Impacto: un texto con marcado en el campo usuario se interpreta como HTML (XSS reflejado). Como el token está en `localStorage`, un script inyectado puede leerlo.
- Prioridad propuesta: Alta.
- Contrato potencialmente afectado: clave `workshop_token` consumida en [dashboard.component.ts](src/app/dashboard/dashboard.component.ts#L36) y el mensaje de error de `POST /auth/login` ([ENDPOINTS.md](../workshop-auth-backend/docs/ENDPOINTS.md)).
- Cómo validarlo: en el login, usar como username un texto benigno como `<b>prueba</b>` y una contraseña incorrecta. Si el texto aparece en negrita, el HTML se interpreta. Tras la corrección, el texto debe mostrarse literal.

### Sin manejo de expiración ni de 401 en el dashboard
- Estado: CANDIDATO
- Evidencia: [dashboard.component.ts](src/app/dashboard/dashboard.component.ts#L42-L45) envía el token sin verificar su vigencia. El `catch` de [dashboard.component.ts](src/app/dashboard/dashboard.component.ts#L65-L70) muestra `detail` o `message` del error y no limpia la sesión. El `expiresIn` de la respuesta de login ([login.component.ts](src/app/login/login.component.ts#L47)) no se usa.
- Impacto: con un token vencido, el usuario ve un mensaje técnico y queda con una sesión inválida guardada hasta cerrar sesión manualmente.
- Prioridad propuesta: Media.
- Contrato potencialmente afectado: respuesta `401` de `GET /api/tasks` en la API Python y campo `expiresIn` de `POST /auth/login`.
- Cómo validarlo: en el navegador, guardar un `workshop_token` con un valor inválido (por ejemplo `invalid`) y abrir `/dashboard`. Si aparece el error técnico y el token sigue en `localStorage`, se confirma.

### URLs de backend fijas en el código
- Estado: CANDIDATO
- Evidencia: [login.component.ts](src/app/login/login.component.ts#L42) apunta a `http://localhost:8080/auth/login`. [dashboard.component.ts](src/app/dashboard/dashboard.component.ts#L43) apunta a `http://localhost:8000/api/tasks`. No hay archivo de entorno ni configuración externa.
- Impacto: el frontend solo funciona con esos hosts y puertos. Un despliegue en contenedor o en otro host requiere editar el código y recompilar.
- Prioridad propuesta: Media.
- Contrato potencialmente afectado: URL base de `POST /auth/login` y de `GET /api/tasks` ([ENDPOINTS.md](../workshop-auth-backend/docs/ENDPOINTS.md)).
- Cómo validarlo: `Select-String -Path src -Pattern "localhost:80" -Recurse` en PowerShell debe listar ambas URLs. Tras la corrección, las URLs deben venir de un archivo de entorno.

### Imagen nginx sin cabeceras de seguridad
- Estado: CANDIDATO
- Evidencia: [nginx.conf](nginx.conf#L1-L10) solo define `listen 80`, `root` y `try_files`. No hay `add_header` para CSP, `X-Content-Type-Options` ni `X-Frame-Options`. El [Dockerfile](Dockerfile#L8-L9) copia esa configuración a la imagen final.
- Impacto: el navegador no recibe políticas que limiten scripts inline o framing. Esto amplía el impacto del XSS del primer hallazgo.
- Prioridad propuesta: Media.
- Contrato potencialmente afectado: ninguno de la API; afecta la respuesta HTML de la SPA.
- Cómo validarlo: `curl -I http://localhost:<puerto-publicado>/` contra el contenedor. Si no aparecen las cabeceras, se confirma.

### Mezcla de preferencias de localStorage con lodash.merge
- Estado: CANDIDATO
- Evidencia: [login.component.ts](src/app/login/login.component.ts#L24-L25) parsea `workshop_preferences` de `localStorage` y lo mezcla con `merge` de `lodash/merge` (versión `4.17.21` en [package.json](package.json)).
- Impacto: el valor de `localStorage` es entrada no confiable. No se ha verificado si esta combinación permite contaminación de prototipos; hay que comprobarlo antes de clasificarlo.
- Prioridad propuesta: Baja (pendiente de verificación).
- Contrato potencialmente afectado: formato de `workshop_preferences`.
- Cómo validarlo: ejecutar `npm run audit:workshop` y revisar advisories de lodash. En el navegador, guardar `workshop_preferences` con claves anidadas y comprobar si altera `Object.prototype`.
